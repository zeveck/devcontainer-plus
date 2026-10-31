// The site built from CHANGELOG.md: each entry's headline and words, dated, escaped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sections, whatsNewPage, homePage } from '../site/build.mjs';

test('the What\'s new page shows every entry, headline first, with dates written out', () => {
  const log = '# What\'s new\n\n## 2026-10-31\n\n- **Snap it.** `dcp snapshot` saves <everything>.\n\n## 2026-10-19\n\n- **Old.** Earlier.\n';
  const page = whatsNewPage(log);
  assert.match(page, /<h2>October 31, 2026<\/h2>/);
  assert.match(page, /<li><strong>Snap it\.<\/strong> <code>dcp snapshot<\/code> saves &lt;everything&gt;\.<\/li>/);
  assert.ok(page.indexOf('October 31') < page.indexOf('October 19'));
  assert.match(homePage(log), /Latest: October 31, 2026[\s\S]*Snap it/);
});

test('every entry in the real changelog has a headline and a date', () => {
  const all = sections(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'));
  assert.ok(all.length > 0);
  for (const s of all) {
    assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/);
    for (const item of s.items) assert.match(item, /^\*\*[^*]+\*\* \S/, `headline: ${item}`);
  }
});
