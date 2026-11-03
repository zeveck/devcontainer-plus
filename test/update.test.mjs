// dc update, against a local template repository (no network): it adds new
// files, updates untouched ones, merges ones changed here, keeps yours when
// both changed the same lines, and removes files the template dropped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DC = fileURLToPath(new URL('../.devcontainer/dc.mjs', import.meta.url));
const SETUP = 'echo one\necho two\necho three\necho four\necho five\n';

function setup(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'dc-update-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const tpl = join(dir, 'template');
  const git = (...a) => spawnSync('git', ['-C', tpl, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  const write = (root, files) => {
    for (const [name, text] of Object.entries(files)) {
      if (text === null) rmSync(join(root, '.devcontainer', name), { force: true });
      else writeFileSync(join(root, '.devcontainer', name), text);
    }
  };
  const release = (files) => { write(tpl, files); git('add', '-A'); git('commit', '-qm', 'release'); };
  mkdirSync(join(tpl, '.devcontainer'), { recursive: true });
  spawnSync('git', ['init', '-q', '-b', 'main', tpl]);
  release({ 'devcontainer.json': '{}\n', 'setup.sh': SETUP, 'old.sh': 'echo old\n' });
  const proj = join(dir, 'proj');
  mkdirSync(join(proj, '.devcontainer'), { recursive: true });
  writeFileSync(join(proj, '.devcontainer', 'devcontainer.json'), '{}\n');
  // A home of its own, so updating the installed command never touches yours.
  const home = join(dir, 'home');
  const env = { ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: join(home, 'AppData', 'Local') };
  const installed = process.platform === 'win32' ? join(env.LOCALAPPDATA, 'Programs', 'dc', 'dc.mjs') : join(home, '.local', 'share', 'dc', 'dc.mjs');
  const update = ({ yes = true } = {}) => spawnSync(process.execPath, [DC, 'update', tpl, ...(yes ? ['--yes'] : [])], { cwd: proj, encoding: 'utf8', input: '', env });
  const read = (name) => readFileSync(join(proj, '.devcontainer', name), 'utf8');
  return { proj, release, write: (files) => write(proj, files), update, read, installed };
}

test('dc update: first run adds the template, then a later one updates, merges and removes', (t) => {
  const s = setup(t);
  s.write({ 'devcontainer.json': '{"mine": true}\n' });

  let r = s.update();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(s.read('setup.sh'), SETUP, 'new file added');
  assert.equal(s.read('devcontainer.json'), '{}\n', 'a file that differs is replaced on the first run');
  assert.equal(s.read('devcontainer.json.orig'), '{"mine": true}\n', 'and, outside git, the old copy is kept');

  // You change one line; the template changes another, and drops old.sh.
  s.write({ 'setup.sh': SETUP.replace('echo one', 'echo mine') });
  s.release({ 'setup.sh': SETUP.replace('echo five', 'echo five, improved'), 'devcontainer.json': '{"v": 2}\n', 'old.sh': null });
  r = s.update();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /What's new: https:\/\/dcp\.synapticnoise\.com\/whats-new\//);
  assert.equal(s.read('setup.sh'), SETUP.replace('echo one', 'echo mine').replace('echo five', 'echo five, improved'));
  assert.equal(s.read('devcontainer.json'), '{"v": 2}\n');
  assert.ok(!existsSync(join(s.proj, '.devcontainer', 'old.sh')));

  assert.match(s.update().stdout, /is up to date/);
});

test('dc update: when you and the template changed the same lines, yours stays and theirs is saved beside it', (t) => {
  const s = setup(t);
  assert.equal(s.update().status, 0);
  s.write({ 'setup.sh': SETUP.replace('echo three', 'echo my three') });
  s.release({ 'setup.sh': SETUP.replace('echo three', 'echo their three') });
  const r = s.update();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(s.read('setup.sh'), SETUP.replace('echo three', 'echo my three'));
  assert.equal(s.read('setup.sh.new'), SETUP.replace('echo three', 'echo their three'));
  assert.match(r.stdout, /Your changes to setup\.sh \(the build steps\) overlap this update\./);
});

test('dc update: line endings alone are not a change', (t) => {
  const s = setup(t);
  assert.equal(s.update().status, 0);
  s.write({ 'setup.sh': SETUP.replace(/\n/g, '\r\n') });
  assert.match(s.update().stdout, /is up to date/);
});

test('dc update: without a yes, nothing is written', (t) => {
  const s = setup(t);
  const r = s.update({ yes: false }); // no terminal to answer on, so no
  assert.equal(r.status, 1);
  assert.ok(!existsSync(join(s.proj, '.devcontainer', 'setup.sh')));
  assert.ok(!existsSync(join(s.proj, '.devcontainer', '.dcp.json')));
});

test("dc update: a change of yours it can't merge is kept, with the reason", (t) => {
  const s = setup(t);
  assert.equal(s.update().status, 0);
  const recordPath = join(s.proj, '.devcontainer', '.dcp.json');
  writeFileSync(recordPath, readFileSync(recordPath, 'utf8').replace(/"version": "[0-9a-f]+"/, '"version": "0000000000000000000000000000000000000000"'));
  s.write({ 'setup.sh': SETUP.replace('echo one', 'echo mine') });
  s.release({ 'setup.sh': SETUP.replace('echo five', 'echo five, improved') });
  const r = s.update();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Your changes to setup\.sh \(the build steps\) can't be merged with this update/);
  assert.equal(s.read('setup.sh'), SETUP.replace('echo one', 'echo mine'));
  assert.match(s.update().stdout, /setup\.sh\.new is still here/);
});

test('dc init: adds the template to a folder without one, and leaves an existing one alone', (t) => {
  const s = setup(t);
  const fresh = join(s.proj, '..', 'fresh');
  mkdirSync(fresh);
  const init = () => spawnSync(process.execPath, [DC, 'init', join(s.proj, '..', 'template')], { cwd: fresh, encoding: 'utf8' });
  let r = init();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(fresh, '.devcontainer', 'setup.sh'), 'utf8'), SETUP);
  assert.ok(existsSync(join(fresh, '.devcontainer', '.dcp.json')));
  // And dc update then finds it up to date.
  assert.match(spawnSync(process.execPath, [DC, 'update', join(s.proj, '..', 'template')], { cwd: fresh, encoding: 'utf8' }).stdout, /is up to date/);
  writeFileSync(join(fresh, '.devcontainer', 'setup.sh'), 'mine\n');
  r = init();
  assert.match(r.stdout, /already has a \.devcontainer/);
  assert.equal(readFileSync(join(fresh, '.devcontainer', 'setup.sh'), 'utf8'), 'mine\n');
});

test("dc update: devcontainer-plus's own files are simply replaced, never merged or questioned", (t) => {
  const s = setup(t);
  s.release({ 'dc.mjs': 'one\ntwo\n' });
  assert.equal(s.update().status, 0);
  s.write({ 'dc.mjs': 'one\nmine\n', 'dc.mjs.new': 'stale\n' });
  s.release({ 'dc.mjs': 'one\ntheirs\n' });
  const r = s.update();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(s.read('dc.mjs'), 'one\ntheirs\n');
  assert.ok(!existsSync(join(s.proj, '.devcontainer', 'dc.mjs.orig')), 'no backup of it either');
  assert.ok(!existsSync(join(s.proj, '.devcontainer', 'dc.mjs.new')), 'an old .new beside it is cleared');
  assert.doesNotMatch(r.stdout, /dc\.mjs/, 'and nothing about it is said');
});

test('dc update brings the installed command up to the template too, even when the project is current', (t) => {
  const s = setup(t);
  s.release({ 'dc.mjs': 'console.log("new")\n' });
  mkdirSync(dirname(s.installed), { recursive: true });
  writeFileSync(s.installed, 'console.log("old")\n');
  let r = s.update();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Updated the dc command too\./);
  assert.equal(readFileSync(s.installed, 'utf8'), 'console.log("new")\n');
  // Up to date, but the installed copy is old again: still refreshed.
  writeFileSync(s.installed, 'console.log("old")\n');
  r = s.update();
  assert.match(r.stdout, /is up to date[\s\S]*Updated the dc command too\./);
  assert.equal(readFileSync(s.installed, 'utf8'), 'console.log("new")\n');
  // Nothing installed (or already current): nothing said.
  r = s.update();
  assert.doesNotMatch(r.stdout, /command too/);
});
