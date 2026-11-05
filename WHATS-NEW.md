# What's new

The highlights, newest first: only what someone using devcontainer-plus would
be glad to hear about (git history has everything else). This is the source
of https://dcp.synapticnoise.com/whats-new/, which `dcp update` links to.
Each entry is one line: a short bold headline, then a sentence in plain words,
under the date it's released.

## 2026-11-05

- **Antigravity CLI is installed too.** `agy`, Google's successor to Gemini CLI, is the one to use if you sign in with a Google account; run it with `agy` or `dcp agy`. Gemini CLI stays for API keys.

## 2026-11-03

- **Restoring a snapshot really works on Windows now.** The Nov 1 fix still left restored files read-only inside the container; they're yours again, and existing snapshots work as they are.
- **Full snapshots bring back the container as it was.** `dcp snapshot <name> --full` saves the container too, so restoring it has the same tools and versions, still signed in, with nothing to reinstall.
- **`dcp update` keeps the `dcp` command current too.** No more running `dc install` again after an update, and `dcp version` shows which version you have.

## 2026-11-01

- **Restoring a snapshot works on Windows and macOS.** Restored projects were left read-only inside the container, so setup stopped with "Permission denied"; they now belong to you again.

## 2026-10-31

- **Start a project in one command.** In any project folder, `dcp init` adds devcontainer-plus, ready to go.
- **Stay up to date in one command.** `dcp update` brings in the latest, keeping any changes you've made to the setup.
- **Rebuilds that won't cut off your work.** If Claude or anything else is busy in the container, `dcp` asks before rebuilding or stopping it.
- **A status line for Claude Code.** Right under the prompt: the model, how full the conversation is, and how much of your usage limits you've used.
- **No more surprise summaries.** Claude Code no longer condenses a long conversation while you're away, so you come back to it as you left it.
- **Push with your GitHub sign-in.** After `auth`, `git push` and installing plugins from your private repos just work.

## 2026-10-30

- **Snapshots.** `dcp snapshot <name>` saves your project and the agents' history in one go, and `dcp restore <name>` takes you back. Try something, then start over.

## 2026-10-19

- **Open servers from the container.** `dcp forward <port>` puts a server running in the container on your computer, and on your phone with `--network`.

## 2026-10-11

- **Agent history survives rebuilds.** Claude, Codex and Gemini keep their sessions, memory, settings and plugins when you rebuild.

## 2026-08-23

- **Use it from any terminal.** `dc` runs everything without VS Code, and the whole setup is one folder you drop into any project.
- **GitHub and GitLab, ready.** `gh` and `glab` come installed, and `auth` signs you in, so agents can open pull requests and work with issues.

## 2025-09-30

- **First release.** Claude Code, Codex CLI and Gemini CLI, ready to work in a container, with a browser they can drive.
