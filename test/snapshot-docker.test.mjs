// dc snapshot / dc restore against real Docker. Runs only when DC_DOCKER_E2E=1
// (Linux CI sets it). A plain Debian container stands in for a dev container:
// it carries the label dc looks for and mounts the project's claude volume.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { devcontainerId, idLabelsFor } from '../.devcontainer/dc.mjs';

const DC = resolve(fileURLToPath(import.meta.url), '../../.devcontainer/dc.mjs');
const enabled = process.env.DC_DOCKER_E2E === '1';
const IMAGE = 'debian:stable-slim';
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });

test('dc snapshot and restore with real Docker', { skip: !enabled && 'set DC_DOCKER_E2E=1 to run against real Docker', timeout: 300000 }, (t) => {
  // A space and a comma in the path, to exercise --mount quoting for real.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'dc snap, e2e-')));
  const proj = join(dir, 'proj');
  mkdirSync(join(proj, '.devcontainer'), { recursive: true });
  writeFileSync(join(proj, '.devcontainer', 'devcontainer.json'), '{}');
  writeFileSync(join(proj, 'notes.txt'), 'original');
  const vol = `agent-claude-${devcontainerId(idLabelsFor(proj))}`;
  writeFileSync(join(dir, 'devcontainer.mjs'), ''); // stand-in for `devcontainer up` after a full restore
  const env = { ...process.env, DC_STATE_DIR: join(dir, 'state'), DC_FAKE_DEVCONTAINER: join(dir, 'devcontainer.mjs') };
  const dc = (...args) => spawnSync(process.execPath, [DC, ...args], { cwd: proj, env, encoding: 'utf8', input: '' });
  let cid = '';
  t.after(() => {
    if (cid) docker('rm', '-f', cid);
    for (const c of docker('ps', '-aq', '--filter', `label=devcontainer.local_folder=${proj}`).stdout.split('\n').filter(Boolean)) docker('rm', '-f', c);
    docker('volume', 'rm', '-f', vol);
    rmSync(dir, { recursive: true, force: true });
  });

  assert.equal(docker('pull', '-q', IMAGE).status, 0);
  assert.equal(docker('volume', 'create', vol).status, 0);
  const start = () => docker('run', '-d', '--label', `devcontainer.local_folder=${proj}`,
    '--mount', `type=volume,source=${vol},target=/data`, IMAGE, 'sleep', 'infinity').stdout.trim();
  cid = start();
  assert.ok(cid, 'container started');
  assert.equal(docker('exec', cid, 'sh', '-c', 'echo chat-1 > /data/session.txt && chown 1000:1000 /data/session.txt').status, 0);
  // Read the volume through a throwaway container, as dc does.
  const readVol = (path) => docker('run', '--rm', '--mount', `type=volume,source=${vol},target=/data`, IMAGE,
    'sh', '-c', `cat ${path} 2>/dev/null; stat -c ' %u' ${path} 2>/dev/null; ls /data`).stdout;

  // Running but idle (just `sleep`), so it pauses without asking: this reads
  // real `docker top` output.
  const snap = dc('snapshot', 'clean');
  assert.match(snap.stdout, /Pausing the container while it copies/);
  assert.equal(snap.status, 0, snap.stderr + snap.stdout);
  assert.equal(docker('inspect', '-f', '{{.State.Running}}', cid).stdout.trim(), 'true', 'container restarted after the snapshot');

  // Now something's running: it must name it and, with no one to ask, refuse.
  assert.equal(docker('exec', '-d', cid, 'tail', '-f', '/dev/null').status, 0);
  const busy = dc('snapshot', 'busy');
  assert.equal(busy.status, 1, busy.stdout);
  assert.match(busy.stdout + busy.stderr, /--yes/);
  assert.equal(docker('inspect', '-f', '{{.State.Running}}', cid).stdout.trim(), 'true', 'left running');
  assert.doesNotMatch(dc('snapshot', '--list').stdout, /^busy\s/m);

  const change = () => {
    writeFileSync(join(proj, 'notes.txt'), 'changed');
    writeFileSync(join(proj, 'new-game.txt'), 'new');
    docker('exec', cid, 'sh', '-c', 'echo chat-2 > /data/session.txt; echo x > /data/extra.txt');
  };
  const assertRestored = () => {
    assert.equal(readFileSync(join(proj, 'notes.txt'), 'utf8'), 'original');
    assert.ok(!existsSync(join(proj, 'new-game.txt')), 'added file removed');
    assert.equal(statSync(join(proj, 'notes.txt')).uid, process.getuid(), 'still owned by you, not root');
    const v = readVol('/data/session.txt');
    assert.match(v, /^chat-1\n 1000\n/, 'volume content and owner restored');
    assert.doesNotMatch(v, /extra\.txt/, 'added volume file removed');
  };

  change();
  const quick = dc('restore', 'clean', '--quick', '--yes');
  assert.equal(quick.status, 0, quick.stderr + quick.stdout);
  assertRestored();
  assert.equal(docker('inspect', '-f', '{{.State.Running}}', cid).stdout.trim(), 'true', '--quick keeps the same container');

  change();
  const full = dc('restore', 'clean', '--yes');
  assert.equal(full.status, 0, full.stderr + full.stdout);
  assert.notEqual(docker('inspect', cid).status, 0, 'the old container is gone');
  cid = '';
  assertRestored();
});
