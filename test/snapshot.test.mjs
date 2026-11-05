// dc snapshot / dc restore, against a stand-in for docker written in Node. The
// stand-in really runs each helper container's shell script, with the
// container's /v, /snap and /proj mapped to folders here, so the actual tar,
// find and rm commands are exercised. It needs a POSIX shell, so these tests
// skip on Windows; test/snapshot-docker.test.mjs runs the same flow against
// real Docker on Linux CI.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync, readdirSync, statSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SNAPSHOT_NAME, mountArg, devcontainerId, idLabelsFor, describeActivity } from '../.devcontainer/dc.mjs';

const DC = resolve(fileURLToPath(import.meta.url), '../../.devcontainer/dc.mjs');
const posixOnly = (t) => { if (process.platform === 'win32') { t.skip('POSIX shell stand-in'); return true; } return false; };

test('snapshot names: simple words only', () => {
  for (const ok of ['clean', 'frog-try-1', 'b', 'v1.2_final']) assert.ok(SNAPSHOT_NAME.test(ok), ok);
  for (const bad of ['', '-x', '../up', 'a/b', 'has space', 'x'.repeat(41)]) assert.ok(!SNAPSHOT_NAME.test(bad), bad);
});

test('describeActivity: plain words for what would be interrupted', () => {
  const idle = ['sh /bin/sh -c echo started; while sleep 1 & wait $!; do :; done', 'sleep sleep 1'];
  assert.equal(describeActivity(idle), '');
  assert.equal(describeActivity([...idle, 'bash bash -l']), 'a shell');
  assert.equal(describeActivity([...idle, 'bash bash -l', 'python3 python3 -m http.server']), 'python3');
  assert.equal(describeActivity([...idle, 'node node /home/u/.vscode-server/server.js', 'claude claude', 'node node vite']), 'a Claude session, VS Code and node');
  assert.equal(describeActivity([...idle, '2.1.304 ugrep -G --hidden']), 'a Claude session', "Claude's versioned binary");
  assert.equal(describeActivity([...idle, 'agy /home/vscode/.local/bin/agy']), 'an Antigravity session');
  assert.equal(describeActivity(['a a', 'b b', 'c c', 'd d', 'e e', 'f f']), 'a, b, c, d and 2 more');
});

test('mount arguments quote a source with a comma', () => {
  assert.equal(mountArg('bind', '/a/b', '/proj'), 'type=bind,source=/a/b,target=/proj');
  assert.equal(mountArg('volume', 'v1', '/v', true), 'type=volume,source=v1,target=/v,readonly');
  assert.equal(mountArg('bind', 'C:\\My,Games', '/proj'), 'type=bind,"source=C:\\My,Games",target=/proj');
});

const FAKE_DOCKER = `
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const statePath = process.env.FAKE_STATE;
const st = JSON.parse(readFileSync(statePath, 'utf8'));
const save = () => writeFileSync(statePath, JSON.stringify(st));
const args = process.argv.slice(2);
const a = args.join(' ');
if (args[0] !== 'ps' && args[0] !== 'exec' && args[0] !== 'inspect' && !a.startsWith('volume ls') && args[0] !== 'info' && !a.startsWith('image inspect')) {
  appendFileSync(process.env.FAKE_LOG, (args[0] === 'run' ? 'run ' + args.filter((x) => x.startsWith('type=')).join(' ') : a) + '\\n');
}
const volDir = (name) => join(st.volumesDir, name);
if (a === 'info') process.exit(0);
if (args[0] === 'ps') {
  const running = args.includes('status=running');
  if (st.container && (!running || st.state === 'running')) {
    process.stdout.write(running ? 'c1\\t' + st.folder + '\\n' : 'c1\\t' + st.state + '\\t' + st.folder + '\\n');
  }
  process.exit(0);
}
if (args[0] === 'inspect') {
  if (!st.container) process.exit(1);
  if (a.includes('{{.Image}}')) { console.log('sha256:projectimage'); process.exit(0); }
  const mounted = st.mounted || Object.keys(st.volumes);
  process.stdout.write(JSON.stringify(mounted.map((n) => ({ Type: 'volume', Name: n }))));
  process.exit(0);
}
if (a.startsWith('image inspect')) process.exit(0);
if (a.startsWith('volume ls')) { process.stdout.write(Object.keys(st.volumes).join('\\n') + '\\n'); process.exit(0); }
if (a.startsWith('volume create')) { st.volumes[args[2]] = true; mkdirSync(volDir(args[2]), { recursive: true }); save(); process.exit(0); }
if (args[0] === 'exec' && args.at(-1).includes('/proc/[0-9]')) {
  // The process listing dc runs inside the container.
  if (st.noListing) process.exit(126);
  for (const p of st.procs || ['sh /bin/sh -c while sleep 1 & wait $!; done', 'sleep sleep 1']) console.log(p);
  process.exit(0);
}
if (args[0] === 'stop') { if (st.failStop) { console.error('cannot stop'); process.exit(1); } st.state = 'exited'; save(); process.exit(0); }
if (args[0] === 'start') { st.state = 'running'; save(); process.exit(0); }
if (args[0] === 'rm') { st.container = false; save(); process.exit(0); }
if (args[0] === 'run') {
  // Map each --mount target to a folder here, then run the script with those paths.
  const map = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--mount') continue;
    const fields = {};
    for (const f of args[i + 1].match(/("[^"]*(?:""[^"]*)*"|[^,]+)/g)) {
      const kv = f.startsWith('"') ? f.slice(1, -1).replace(/""/g, '"') : f;
      const eq = kv.indexOf('=');
      fields[eq < 0 ? kv : kv.slice(0, eq)] = eq < 0 ? true : kv.slice(eq + 1);
    }
    map[fields.target] = fields.type === 'volume' ? volDir(fields.source) : fields.source;
  }
  let script = args[args.length - 1];
  for (const [target, dir] of Object.entries(map)) {
    script = script.replace(new RegExp(target.replace('/', '\\\\/') + '(?=[/\\\\s;\\'"]|$)', 'g'), dir);
  }
  const r = spawnSync('sh', ['-c', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(r.stdout); process.stderr.write(r.stderr);
  process.exit(r.status ?? 1);
}
process.exit(0);
`;

function setup(t, { running = true } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'dc-snap-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const proj = join(dir, 'proj');
  mkdirSync(join(proj, '.devcontainer'), { recursive: true });
  writeFileSync(join(proj, '.devcontainer', 'devcontainer.json'), '{}');
  writeFileSync(join(proj, 'notes.txt'), 'original notes');
  mkdirSync(join(proj, 'game'));
  writeFileSync(join(proj, 'game', 'index.html'), '<h1>v1</h1>');
  const id = devcontainerId(idLabelsFor(proj));
  const claudeVol = `agent-claude-${id}`;
  const volumesDir = join(dir, 'volumes');
  mkdirSync(join(volumesDir, claudeVol, 'projects'), { recursive: true });
  writeFileSync(join(volumesDir, claudeVol, 'settings.json'), '{"theme":"dark"}');
  writeFileSync(join(volumesDir, claudeVol, 'projects', 'session.jsonl'), 'chat 1\n');
  const statePath = join(dir, 'state.json');
  const state = { container: true, state: running ? 'running' : 'exited', folder: proj, volumesDir, volumes: { [claudeVol]: true } };
  writeFileSync(statePath, JSON.stringify(state));
  writeFileSync(join(dir, 'docker.mjs'), FAKE_DOCKER);
  writeFileSync(join(dir, 'devcontainer.mjs'), "import { appendFileSync } from 'node:fs'; appendFileSync(process.env.FAKE_LOG, 'devcontainer ' + process.argv.slice(2).join(' ') + '\\n');");
  const log = join(dir, 'calls.log');
  const env = {
    ...process.env, DC_FAKE_DOCKER: join(dir, 'docker.mjs'), DC_FAKE_DEVCONTAINER: join(dir, 'devcontainer.mjs'),
    DC_STATE_DIR: join(dir, 'dcstate'), FAKE_STATE: statePath, FAKE_LOG: log,
  };
  const dc = (...args) => spawnSync(process.execPath, [DC, ...args], { cwd: proj, env, encoding: 'utf8', input: '' });
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : []);
  const clearCalls = () => rmSync(log, { force: true });
  const vol = join(volumesDir, claudeVol);
  const docker = () => JSON.parse(readFileSync(statePath, 'utf8'));
  return { dir, proj, vol, dc, calls, clearCalls, docker, env };
}

test('dc snapshot: saves the folder and the agent data, pausing the container', (t) => {
  if (posixOnly(t)) return;
  const { dc, calls, docker, env } = setup(t);
  const r = dc('snapshot', 'clean', '--yes');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Saved snapshot clean: the project folder and claude data/);
  const snaps = join(env.DC_STATE_DIR, 'snapshots');
  const [key] = readdirSync(snaps);
  const files = readdirSync(join(snaps, key, 'clean')).sort();
  assert.deepEqual(files, ['claude.tgz', 'project.tgz', 'snapshot.json']);
  assert.equal(statSync(join(snaps, key)).mode & 0o077, 0, 'snapshots folder is private');
  const c = calls();
  assert.equal(c[0], 'stop c1', 'stops the container first');
  assert.equal(c.at(-1), 'start c1', 'and starts it again');
  assert.equal(docker().state, 'running');
});

test('dc snapshot: names must be new, and --list and --rm manage them', (t) => {
  if (posixOnly(t)) return;
  const { dc } = setup(t, { running: false });
  assert.match(dc('snapshot', '--list').stdout, /No snapshots yet/);
  assert.equal(dc('snapshot', 'a').status, 0);
  const again = dc('snapshot', 'a');
  assert.equal(again.status, 1);
  assert.match(again.stderr, /a already exists\. Add --overwrite/);
  assert.match(dc('snapshot', '../escape').stderr, /give one name/);
  assert.match(dc('snapshot').stderr, /give one name/);
  assert.match(dc('snapshot', '--list').stdout, /^a\s+.+\s+\d+\.\d (MB|GB)$/m);
  assert.match(dc('snapshot', '--rm', 'a').stdout, /Deleted snapshot a/);
  assert.match(dc('snapshot', '--list').stdout, /No snapshots yet/);
  assert.match(dc('snapshot', '--bogus', 'x').stderr, /unknown option --bogus/);
});

function changeEverything({ proj, vol }) {
  writeFileSync(join(proj, 'notes.txt'), 'changed');                 // changed
  rmSync(join(proj, 'game', 'index.html'));                          // deleted
  mkdirSync(join(proj, 'frog-game', 'assets'), { recursive: true }); // added
  writeFileSync(join(proj, 'frog-game', 'assets', 'frog.png'), 'png');
  writeFileSync(join(proj, '.env'), 'NEW_KEY=1');
  writeFileSync(join(vol, 'settings.json'), '{"theme":"light"}');
  writeFileSync(join(vol, 'projects', 'session2.jsonl'), 'chat 2\n');
}

function assertAsSnapshotted({ proj, vol }) {
  assert.equal(readFileSync(join(proj, 'notes.txt'), 'utf8'), 'original notes');
  assert.equal(readFileSync(join(proj, 'game', 'index.html'), 'utf8'), '<h1>v1</h1>');
  assert.ok(!existsSync(join(proj, 'frog-game')), 'new folder removed');
  assert.ok(!existsSync(join(proj, '.env')), 'new hidden file removed');
  assert.ok(existsSync(join(proj, '.devcontainer', 'devcontainer.json')));
  assert.equal(readFileSync(join(vol, 'settings.json'), 'utf8'), '{"theme":"dark"}');
  assert.deepEqual(readdirSync(join(vol, 'projects')), ['session.jsonl']);
}

test('dc restore --quick: puts the folder and agent data back exactly, keeping the container', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  assert.equal(s.dc('snapshot', 'clean', '--yes').status, 0);
  changeEverything(s);
  s.clearCalls();
  const r = s.dc('restore', 'clean', '--quick', '--yes');
  assert.equal(r.status, 0, r.stderr);
  assertAsSnapshotted(s);
  const c = s.calls();
  assert.ok(c.includes('stop c1') && c.includes('start c1'), c.join('\n'));
  assert.ok(!c.some((l) => l.startsWith('rm ') || l.startsWith('devcontainer')), 'no new container');
});

test('dc restore: a fresh container, even after the data was deleted', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  assert.equal(s.dc('snapshot', 'clean', '--yes').status, 0);
  changeEverything(s);
  rmSync(s.vol, { recursive: true, force: true }); // as after `dc rm --volumes`
  s.clearCalls();
  const r = s.dc('restore', 'clean', '--yes');
  assert.equal(r.status, 0, r.stderr);
  assertAsSnapshotted(s);
  const c = s.calls();
  const at = (re) => c.findIndex((l) => re.test(l));
  assert.match(c[0], /^run .*target=\/snap,readonly$/, 'checks the snapshot first');
  assert.ok(at(/^rm -f c1$/) > 0, 'then removes the old container');
  assert.ok(at(/^volume create agent-claude-/) > at(/^rm -f c1$/), 'then recreates the volume');
  assert.match(c.at(-1), /^devcontainer up --workspace-folder /, 'then starts a fresh one');
  assert.match(r.stdout, /sign in to Claude again/);
});

test('dc restore: asks first, and changes nothing when it can\'t ask', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  assert.equal(s.dc('snapshot', 'clean', '--yes').status, 0);
  changeEverything(s);
  s.clearCalls();
  const r = s.dc('restore', 'clean');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--yes/);
  assert.equal(readFileSync(join(s.proj, 'notes.txt'), 'utf8'), 'changed');
  assert.deepEqual(s.calls(), []);
});

test('dc restore: a damaged snapshot is refused before anything is deleted', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  assert.equal(s.dc('snapshot', 'clean', '--yes').status, 0);
  const [key] = readdirSync(join(s.env.DC_STATE_DIR, 'snapshots'));
  writeFileSync(join(s.env.DC_STATE_DIR, 'snapshots', key, 'clean', 'project.tgz'), 'not a tarball');
  changeEverything(s);
  s.clearCalls();
  const r = s.dc('restore', 'clean', '--yes');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /can't be used, so nothing was changed/);
  assert.equal(readFileSync(join(s.proj, 'notes.txt'), 'utf8'), 'changed');
  assert.ok(existsSync(join(s.proj, 'frog-game')));
  assert.ok(!s.calls().some((l) => /^(rm|stop) /.test(l)), 'container untouched');
});

test('dc restore: a snapshot without this project\'s dev container setup is refused', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  assert.equal(s.dc('snapshot', 'clean', '--yes').status, 0);
  // Replace the project archive with one of an unrelated folder.
  const [key] = readdirSync(join(s.env.DC_STATE_DIR, 'snapshots'));
  const other = join(s.dir, 'other'); mkdirSync(other); writeFileSync(join(other, 'x.txt'), 'x');
  spawnSync('tar', ['-C', other, '-czf', join(s.env.DC_STATE_DIR, 'snapshots', key, 'clean', 'project.tgz'), '.']);
  changeEverything(s);
  const r = s.dc('restore', 'clean', '--yes');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no \.devcontainer\/devcontainer\.json in the project archive/);
  assert.equal(readFileSync(join(s.proj, 'notes.txt'), 'utf8'), 'changed');
});

test('dc snapshot --overwrite: replaces a snapshot, but only once the new one is complete', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t, { running: false });
  assert.equal(s.dc('snapshot', 'clean').status, 0);
  writeFileSync(join(s.proj, 'notes.txt'), 'newer notes');
  // A snapshot that fails partway (here: the container won't stop) keeps the old one.
  const st = s.docker(); st.state = 'running'; st.failStop = true; writeFileSync(s.env.FAKE_STATE, JSON.stringify(st));
  const [key] = readdirSync(join(s.env.DC_STATE_DIR, 'snapshots'));
  const meta = () => readFileSync(join(s.env.DC_STATE_DIR, 'snapshots', key, 'clean', 'snapshot.json'), 'utf8');
  const before = meta();
  assert.equal(s.dc('snapshot', 'clean', '--overwrite', '--yes').status, 1);
  assert.equal(meta(), before, 'the old snapshot is untouched');
  st.failStop = false; st.state = 'exited'; writeFileSync(s.env.FAKE_STATE, JSON.stringify(st));
  const r = s.dc('snapshot', 'clean', '--overwrite');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Replaced snapshot clean/);
  writeFileSync(join(s.proj, 'notes.txt'), 'changed again');
  assert.equal(s.dc('restore', 'clean', '--quick', '--yes').status, 0);
  assert.equal(readFileSync(join(s.proj, 'notes.txt'), 'utf8'), 'newer notes');
  assert.match(s.dc('snapshot', '--list').stdout, /^clean\s/m);
  assert.doesNotMatch(s.dc('snapshot', '--list').stdout, /old|partial/);
});

test('dc restore: unknown names and options', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  assert.match(s.dc('restore', 'nope', '--yes').stderr, /no snapshot named nope/);
  assert.match(s.dc('restore').stderr, /give the snapshot's name/);
  assert.match(s.dc('restore', 'x', '--fast').stderr, /unknown option --fast/);
});

test('dc restore: a file that can\'t be removed doesn\'t stop the rest coming back', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  assert.equal(s.dc('snapshot', 'clean', '--yes').status, 0);
  changeEverything(s);
  // A folder whose contents can't be deleted, like a file another program holds open.
  const locked = join(s.proj, 'zlocked');
  mkdirSync(locked); writeFileSync(join(locked, 'held.txt'), 'x'); chmodSync(locked, 0o555);
  let r;
  try { r = s.dc('restore', 'clean', '--quick', '--yes'); } finally { chmodSync(locked, 0o755); }
  assert.equal(r.status, 1);
  assert.match(r.stderr, /everything from the snapshot is back, but these couldn't be removed .*: zlocked/);
  assert.ok(existsSync(join(s.proj, '.devcontainer', 'devcontainer.json')), 'the dev container setup is back');
  assert.equal(readFileSync(join(s.proj, 'notes.txt'), 'utf8'), 'original notes');
  assert.equal(readFileSync(join(s.proj, 'game', 'index.html'), 'utf8'), '<h1>v1</h1>');
  assert.ok(!existsSync(join(s.proj, '.dc-restore-staging')), 'no staging folder left behind');
});

test('dc snapshot: refuses to keep snapshots inside the project', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  s.env.DC_STATE_DIR = join(s.proj, '.dcstate');
  const r = s.dc('snapshot', 'clean', '--yes');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /snapshots would be kept inside the project/);
  assert.ok(!existsSync(join(s.proj, '.dcstate', 'snapshots')));
});

test('dc restore: fills the volume the container actually uses', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  assert.equal(s.dc('snapshot', 'clean', '--yes').status, 0);
  // The container now mounts a differently named claude volume (as when the
  // dev container tool saw the folder's path in another letter case).
  const other = `agent-claude-${'v'.repeat(52)}`;
  const otherDir = join(s.dir, 'volumes', other);
  mkdirSync(otherDir, { recursive: true });
  writeFileSync(join(otherDir, 'settings.json'), '{"theme":"changed"}');
  const st = s.docker(); st.volumes[other] = true; st.mounted = [other];
  writeFileSync(s.env.FAKE_STATE, JSON.stringify(st));
  assert.equal(s.dc('restore', 'clean', '--quick', '--yes').status, 0);
  assert.equal(readFileSync(join(otherDir, 'settings.json'), 'utf8'), '{"theme":"dark"}');
});

test('dc snapshot: a container that won\'t stop means nothing is saved, and it\'s left running', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  const st = s.docker(); st.failStop = true; writeFileSync(s.env.FAKE_STATE, JSON.stringify(st));
  const r = s.dc('snapshot', 'clean', '--yes');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /couldn't stop container c1, so nothing was saved/);
  assert.match(s.dc('snapshot', '--list').stdout, /No snapshots yet/);
  assert.equal(s.docker().state, 'running');
});

test('dc snapshot: sweeps up folders left by interrupted snapshots', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t, { running: false });
  assert.equal(s.dc('snapshot', 'first').status, 0);
  const [key] = readdirSync(join(s.env.DC_STATE_DIR, 'snapshots'));
  const stale = join(s.env.DC_STATE_DIR, 'snapshots', key, 'second.partial-999999');
  mkdirSync(stale);
  assert.equal(s.dc('snapshot', 'third').status, 0);
  assert.ok(!existsSync(stale));
  assert.match(s.dc('snapshot', '--list').stdout, /^first\s/m);
  assert.doesNotMatch(s.dc('snapshot', '--list').stdout, /partial/);
});

test('dc snapshot: asks before stopping a running container, and says what it would interrupt', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  const st = s.docker(); st.procs = ['bash bash -l', 'claude claude']; writeFileSync(s.env.FAKE_STATE, JSON.stringify(st));
  const r = s.dc('snapshot', 'clean');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /--yes/);
  assert.deepEqual(s.calls(), [], 'container untouched');
  assert.equal(s.docker().state, 'running');
  assert.match(s.dc('snapshot', '--list').stdout, /No snapshots yet/);
});

test('dc snapshot: names the session in the question, and "no" changes nothing', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  const st = s.docker(); st.procs = ['bash bash -l', 'claude claude', 'python3 python3 -m http.server 8000']; writeFileSync(s.env.FAKE_STATE, JSON.stringify(st));
  // Answer "n" at a real (pseudo) terminal.
  const py = `
import os, pty, select, sys, time
pid, fd = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], sys.argv[1:])
out = b''; sent = False; end = time.time() + 30
while time.time() < end:
    r, _, _ = select.select([fd], [], [], 0.5)
    if not r: continue
    try: d = os.read(fd, 4096)
    except OSError: break
    if not d: break
    out += d
    if b'Go ahead?' in out and not sent: os.write(fd, b'n\\n'); sent = True
os.waitpid(pid, 0)
sys.stdout.write(out.decode(errors='replace'))
`;
  const r = spawnSync('python3', ['-c', py, process.execPath, DC, 'snapshot', 'clean'], { cwd: s.proj, env: s.env, encoding: 'utf8' });
  if (r.error) return t.skip('no python3 here');
  assert.match(r.stdout, /The container is running a Claude session and python3\.\r?\nSnapshotting stops it for a moment, which interrupts that\.\r?\nGo ahead\?/);
  assert.equal(s.docker().state, 'running');
  assert.deepEqual(s.calls(), []);
});

test('dc snapshot: an idle running container needs no question', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  const r = s.dc('snapshot', 'clean');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Pausing the container while it copies/);
  assert.ok(s.calls().includes('stop c1') && s.calls().includes('start c1'));
});

test('dc snapshot: asks anyway when it can\'t see what\'s running', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t);
  const st = s.docker(); st.noListing = true; writeFileSync(s.env.FAKE_STATE, JSON.stringify(st));
  const r = s.dc('snapshot', 'clean');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /--yes/);
  assert.equal(s.docker().state, 'running');
  assert.deepEqual(s.calls(), []);
});

test('dc snapshot: a stopped container needs no question', (t) => {
  if (posixOnly(t)) return;
  const s = setup(t, { running: false });
  const r = s.dc('snapshot', 'clean');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!s.calls().includes('stop c1'));
});

test('restore hands files back to the recorded owner where it unpacks as root without owners', async () => {
  const { refill } = await import('../.devcontainer/dc.mjs');
  // Docker Desktop shares (Windows, macOS): no exact owners, so the helper's
  // root would own everything and the project would be read-only to the
  // container's user. The owner recorded for what's inside the folder (not
  // the folder itself, which Docker shows as root's on Windows) is put back.
  const shared = refill('/proj', 'project.tgz', false);
  assert.match(shared, /tar --numeric-owner -tvzf \/snap\/project\.tgz 2>\/dev\/null \| awk 'NR==2/);
  assert.match(shared, /\[1-9\]\*:\*\[0-9\]\) chown -R "\$o" \/proj/);
  // Root, nothing recorded, or an owner the share didn't take: made writable.
  assert.match(shared, /\[ "\$\(stat -c %u:%g \/proj\)" = "\$o" \] \|\| chmod -R a\+rwX \/proj/);
  assert.match(shared, /\*\) chmod -R a\+rwX \/proj/);
  // Linux keeps exact owners already, and the agent volumes too.
  assert.doesNotMatch(refill('/proj', 'project.tgz', true), /chown -R/);
});

test('parseJsonc reads devcontainer.json: comments, trailing commas, // inside strings', async () => {
  const { parseJsonc } = await import('../.devcontainer/dc.mjs');
  assert.deepEqual(parseJsonc('{ // a comment\n "a": "http://x // y", /* block */ "b": [1, 2, ], "c": {"d": 1,}, }'),
    { a: 'http://x // y', b: [1, 2], c: { d: 1 } });
  assert.deepEqual(parseJsonc('{"q": "say \\"hi\\" // not a comment"}'), { q: 'say "hi" // not a comment' });
});

test('a full restore starts from the project config with the saved image instead of a build', async () => {
  const { fullRestoreConfig, snapshotImage } = await import('../.devcontainer/dc.mjs');
  const text = readFileSync(new URL('../.devcontainer/devcontainer.json', import.meta.url), 'utf8');
  const c = fullRestoreConfig(text, 'dcp-snapshot-x:clean');
  assert.equal(c.image, 'dcp-snapshot-x:clean');
  assert.equal(c.features, undefined, 'features are already in the saved container');
  assert.equal(c.mounts.length, 3, 'agent volumes still mounted');
  assert.equal(c.remoteUser, 'vscode');
  assert.deepEqual(Object.keys(fullRestoreConfig('{"build": {"dockerfile": "Dockerfile"}, "name": "x"}', 'i')), ['name', 'image']);
  assert.match(snapshotImage('/some/proj', 'clean'), /^dcp-snapshot-[0-9a-f]{20}:clean$/);
});
