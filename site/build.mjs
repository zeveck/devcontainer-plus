// Builds the devcontainer-plus site (dcp.synapticnoise.com) from CHANGELOG.md:
// a short home page and a What's new page. No dependencies; run by the Pages
// workflow as `node site/build.mjs <output folder>`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/zeveck/devcontainer-plus';

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// The little Markdown a changelog line uses: **headline**, `code` and [links](url).
const inline = (s) => escape(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
const longDate = (d) => {
  const t = new Date(`${d}T12:00:00Z`);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

/** The changelog's dated sections: [{ date, items: [markdown line] }]. */
export function sections(text) {
  const out = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('## ')) out.push({ date: line.slice(3).trim(), items: [] });
    else if (out.length && line.startsWith('- ')) out.at(-1).items.push(line.slice(2).trim());
    else if (out.at(-1)?.items.length && /^\s+\S/.test(line)) out.at(-1).items.push(`${out.at(-1).items.pop()} ${line.trim()}`);
  }
  return out;
}

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="A dev container for AI coding agents: Claude Code, Codex CLI and Gemini CLI, ready to work in.">
<style>
  :root { --bg: #14161f; --panel: #1f2230; --text: #f2f2f5; --muted: #a9adbd; --accent: #ffb238; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 16px 64px; }
  h1 { margin: 0 0 8px; font-size: clamp(30px, 6vw, 44px); line-height: 1.15; }
  h2 { margin: 40px 0 12px; font-size: 20px; color: var(--accent); }
  p.lead { margin: 0 0 24px; color: var(--muted); }
  ul { margin: 0; padding-left: 22px; }
  li { margin: 12px 0; color: var(--muted); }
  li strong { color: var(--text); }
  code { background: var(--panel); padding: 1px 6px; border-radius: 6px; font-size: 0.92em; }
  a { color: var(--accent); }
  nav { display: flex; gap: 18px; margin-bottom: 36px; font-size: 15px; }
  .panel { background: var(--panel); border-radius: 14px; padding: 18px 22px; margin: 24px 0; }
</style>
</head>
<body>
<main>
<nav><a href="/">devcontainer-plus</a><a href="/whats-new/">What's new</a><a href="${REPO}">GitHub</a></nav>
${body}
</main>
</body>
</html>
`;

export function whatsNewPage(changelog) {
  const body = sections(changelog).map((s) => `<h2>${escape(longDate(s.date))}</h2>\n<ul>\n${s.items.map((i) => `  <li>${inline(i)}</li>`).join('\n')}\n</ul>`).join('\n');
  return page("What's new in devcontainer-plus", `<h1>What's new</h1>\n<p class="lead">Changes to devcontainer-plus, newest first. In a project, <code>dcp update</code> brings them in.</p>\n${body}`);
}

export function homePage(changelog) {
  const latest = sections(changelog)[0];
  return page('devcontainer-plus', `<h1>devcontainer-plus</h1>
<p class="lead">A dev container for AI coding agents: Claude Code, Codex CLI and Gemini CLI, installed and ready, each seeing only the project you open. Use it from VS Code, or from any terminal with the <code>dcp</code> command.</p>
<div class="panel">
<p>Get started on <a href="${REPO}#getting-started">GitHub</a>. Already using it? In your project, run <code>dcp update</code> to get the latest.</p>
</div>
${latest ? `<h2>Latest: ${escape(longDate(latest.date))}</h2>\n<ul>\n${latest.items.slice(0, 3).map((i) => `  <li>${inline(i)}</li>`).join('\n')}\n</ul>\n<p><a href="/whats-new/">Everything that's new</a></p>` : ''}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || join(ROOT, '_site');
  const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  mkdirSync(join(out, 'whats-new'), { recursive: true });
  writeFileSync(join(out, 'index.html'), homePage(changelog));
  writeFileSync(join(out, 'whats-new', 'index.html'), whatsNewPage(changelog));
  console.log(`built ${out}`);
}
