# What's new

What people would notice, newest first. This is the source of the What's new
page at https://dcp.synapticnoise.com/whats-new/, which `dcp update` links to.
Each entry is one line: a short bold headline, then a sentence or two in plain
words, under the date it's released.

## 2026-10-31

- **Update in one command.** In a project, `dcp update` brings its dev container up to the latest devcontainer-plus. Changes you've made yourself are kept.
- **Rebuilds that don't cut work off.** Before rebuilding, stopping or removing a container, `dcp` checks whether Claude or anything else is busy in it, and asks first if so.
- **A status line for Claude Code.** Under the prompt: the model, how full the conversation is, and how much of your 5-hour and 7-day limits you've used.
- **No surprise summaries.** Claude Code no longer squeezes a long conversation into a summary while you're away, so you come back to it as you left it.
- **git uses your GitHub sign-in.** After `auth`, plain `git` works with your GitHub account too, so pushing and installing plugins from private repos just work.
- **`dc` or `dcp`.** The command installs under both names, and its messages use whichever you typed. `dcp` is handy where `dc` is already taken.
- **A new name.** zeveck/devcontainers is now devcontainer-plus. The old address still redirects.

## 2026-10-30

- **Snapshots.** `dcp snapshot <name>` saves your project folder and the agents' history in one go, and `dcp restore <name>` puts it all back. Handy for trying something and starting over.

## 2026-10-19

- **Reach servers in the container.** `dcp forward <port>` opens a server running in the container on your computer, and `--network` lets your phone reach it too.
