// statusline.py, against a scratch Claude config folder: setup only ever adds
// ours, never replaces yours, and says which is in use; `switch` goes from
// yours to ours and back, or on and off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../.devcontainer/statusline.py', import.meta.url));

function setup(t, settings) {
  if (process.platform === 'win32') { t.skip('runs in the Linux container'); return null; }
  const config = mkdtempSync(join(tmpdir(), 'dcp-statusline-'));
  t.after(() => rmSync(config, { recursive: true, force: true }));
  if (settings) writeFileSync(join(config, 'settings.json'), JSON.stringify(settings));
  const run = (mode) => spawnSync('python3', [SCRIPT, mode], { encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: config } }).stdout;
  const line = () => JSON.parse(readFileSync(join(config, 'settings.json'), 'utf8')).statusLine;
  return { config, run, line };
}

test('setup adds ours only when there is none, and says so every build', (t) => {
  const s = setup(t); if (!s) return;
  assert.match(s.run('setup'), /Status line on/);
  assert.equal(s.line().command, `bash ${join(s.config, 'statusline.sh')}`);
  const again = s.run('setup');
  assert.match(again, /Status line on/);
  assert.doesNotMatch(again, /your own/, 'ours is never called yours');
});

test('setup keeps yours, with a preview of ours; switch goes to ours and back', (t) => {
  const yours = { type: 'command', command: 'bash /mine.sh' };
  const s = setup(t, { statusLine: yours }); if (!s) return;
  const out = s.run('setup');
  assert.match(out, /Keeping your own status line/);
  assert.match(out, /Opus \| ctx/, 'a preview of ours');
  assert.deepEqual(s.line(), yours);

  assert.match(s.run('switch'), /Switched to devcontainer-plus's status line\. Yours is saved/);
  assert.match(s.line().command, /statusline\.sh$/);
  assert.match(s.run('switch'), /Your own status line is back/);
  assert.deepEqual(s.line(), yours);
});

test('with none of your own, switch turns it off, and off stays off at the next build', (t) => {
  const s = setup(t); if (!s) return;
  s.run('setup');
  assert.match(s.run('switch'), /Status line off/);
  assert.equal(s.line(), undefined);
  assert.match(s.run('setup'), /Status line off/);
  assert.equal(s.line(), undefined);
  assert.match(s.run('switch'), /Switched to devcontainer-plus's/);
  assert.ok(!existsSync(join(s.config, '.statusline.off')));
});
