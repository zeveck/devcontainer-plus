# What's new

`dc update` shows the lines added here since a project last updated. Add one
plain line for each change people would notice, under the date it's released.

## 2026-10-31

- `dc update` brings a project's dev container up to the latest devcontainer-plus, keeping your own changes.
- Messages use the name you typed: `dc` or `dcp`.
- `dc up --rebuild`, `dc up --fresh`, `dc down`, `dc rm` and `dc restore` ask first if Claude or anything else is busy in the container.
- Claude Code gets a status line: the model, how much context is used, and your 5-hour and 7-day limits.
- Claude Code no longer compacts a conversation while you're away from it.
- `auth` lets plain `git` use your GitHub login, so pushing and installing plugins from private repos work.
- `dc install` installs the command as both `dc` and `dcp`.
- devcontainer-plus is the new name of zeveck/devcontainers.

## 2026-10-30

- `dc snapshot <name>` saves the project folder and the agents' data, and `dc restore <name>` puts them back.

## 2026-10-19

- `dc forward <port>` lets you reach a server in the container from your computer, and `--network` from your other devices too.
