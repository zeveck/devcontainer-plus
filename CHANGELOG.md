# What's new

What people would notice, newest first. This is the source of the What's new
page at https://dcp.synapticnoise.com/whats-new/, which `dcp update` links to.
Each entry is one line: a short bold headline, then a sentence or two in plain
words, under the date it's released.

## 2026-10-31

- **Start a project in one command.** In a new project folder, `dcp init` adds the latest devcontainer-plus. No more copying folders around.
- **Update in one command.** In a project, `dcp update` brings its dev container up to the latest devcontainer-plus. Changes you've made yourself are kept.
- **What's new, in one place.** This page lists every change in plain words, and `dcp update` links here.
- **Rebuilds that don't cut work off.** Before rebuilding, stopping or removing a container, `dcp` checks whether Claude or anything else is busy in it, and asks first if so.
- **A status line for Claude Code.** Under the prompt: the model, how full the conversation is, and how much of your 5-hour and 7-day limits you've used.
- **No surprise summaries.** Claude Code no longer squeezes a long conversation into a summary while you're away, so you come back to it as you left it.
- **git uses your GitHub sign-in.** After `auth`, plain `git` works with your GitHub account too, so pushing and installing plugins from private repos just work.
- **`dc` or `dcp`.** The command installs under both names, and its messages use whichever you typed. `dcp` is handy where `dc` is already taken.
- **Reuse a snapshot name.** `dcp snapshot <name> --overwrite` replaces an old snapshot, but only once the new one has saved completely.
- **A new name.** zeveck/devcontainers is now devcontainer-plus. The old address still redirects.

## 2026-10-30

- **Snapshots.** `dcp snapshot <name>` saves your project folder and the agents' history in one go, and `dcp restore <name>` puts it all back. Handy for trying something and starting over.

## 2026-10-19

- **Reach servers in the container.** `dcp forward <port>` opens a server running in the container on your computer, and `--network` lets your phone reach it too.

## 2026-10-12

- **Clear out a project for good.** `dcp rm --volumes` removes a project's container and its saved agent history together, asking first.

## 2026-10-11

- **Agent history survives rebuilds.** Claude, Codex and Gemini keep their sessions, memory, settings and plugins when you rebuild, each project separately. Sign-ins are cleared each time, and `dcp volumes` shows or deletes what's saved.

## 2026-08-23

- **One folder to copy, and a command to run it.** The whole setup became a single `.devcontainer` folder you drop into any project, with `dc` to run it from a terminal without VS Code, and `auth` to sign in to GitHub or GitLab.
- **GitLab too.** `glab` comes installed alongside `gh`.

## 2026-07-12

- **GitHub CLI.** `gh` comes installed, so agents can open pull requests and work with issues.

## 2026-05-06

- **Chromium and Node.js 24.** The browser agents drive is now Chromium, Node.js is version 24, and `NPM_REGISTRY` lets installs use your own registry where npmjs.org is blocked.

## 2026-03-08

- **Lighter browser control.** Agents drive the browser through the Playwright CLI instead of the Playwright MCP server, which is simpler and takes less of Claude's attention.

## 2026-02-23

- **Playwright CLI versions.** New versions of the container that drive the browser with the Playwright CLI.

## 2026-01-26

- **Claude Code's own installer.** Claude Code installs with its native installer, so it updates itself like it does anywhere else.

## 2025-09-30

- **First release.** Dev containers for VS Code with Claude Code, Codex CLI and Gemini CLI, Python 3.12 and Node.js 22, plus the Playwright MCP server so agents can drive a web browser. Two versions: all three agents, or Claude only.
