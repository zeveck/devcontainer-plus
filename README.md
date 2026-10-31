# devcontainer-plus

A development container that's ready to work in, with Claude Code, Codex CLI, and Gemini CLI already installed and set up. Open a project, start an agent, get on with it.

It all runs locally, on your own hardware. The difference is that the agents and their tools live inside the container rather than on your system, and they only see the project you opened.

**[What's new](https://dcp.synapticnoise.com/whats-new/)**: the latest changes, in plain words.

## Contents

- [What's inside](#whats-inside)
- [Getting started](#getting-started)
- [What ends up in your project](#what-ends-up-in-your-project)
- [The `dc` command](#the-dc-command)
- [Signing in to GitHub and GitLab](#signing-in-to-github-and-gitlab)
- [Keeping agent history across rebuilds](#keeping-agent-history-across-rebuilds)
- [Snapshots: saving a moment and going back](#snapshots-saving-a-moment-and-going-back)
- [Reaching a server in the container](#reaching-a-server-in-the-container)
- [Letting an agent use a browser](#letting-an-agent-use-a-browser)
- [Changing how it's set up](#changing-how-its-set-up)
- [Getting the latest version](#getting-the-latest-version)

## What's inside

- Claude Code, Codex CLI, and Gemini CLI
- Python 3.12 and Node.js 24
- `gh` and `glab` for GitHub and GitLab, with a helper that signs you in
- Chromium, which agents drive through the Playwright CLI
- `dc`, an optional command for running all this without VS Code

## Getting started

There are two ways in, and they give you the same container. Use VS Code if you want an editor attached to it, or `dc` if you live in a terminal.

Either way you need two things:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on Linux, plain Docker works too), and it has to actually be running.
- The `.devcontainer` folder in your project. Clone this repo or [download it as a ZIP](https://github.com/zeveck/devcontainer-plus/archive/refs/heads/main.zip), then copy the `.devcontainer` folder into your project folder. Once you have the `dc` command (below), `dc init` in a project folder does this for you.

### With VS Code

You'll also want [VS Code](https://code.visualstudio.com/) and its [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

1. Open the project folder in VS Code.
2. VS Code will offer to "Reopen in Container". Click it. (If it doesn't ask, open the Command Palette and choose *Dev Containers: Reopen in Container*.)
3. Go make coffee. The first build takes a few minutes.
4. Open a terminal in VS Code and type `claude`, or `codex`, or `gemini`.

### Without VS Code

This repo includes `dc`, a little command-line tool that starts the container and runs agents inside it, straight from your terminal. It's a small Node program, so you'll need [Node.js](https://nodejs.org/). You'll also want the dev containers CLI, which is the thing that actually builds and starts containers:

```bash
npm i -g @devcontainers/cli
```

That one is technically optional. Without it `dc` downloads the same tool on the fly, which works but adds a few seconds to every command.

Install `dc` itself from the project folder. This is once per machine, not per project — skip it if you've done it before, or rerun it to pick up a newer version:

```powershell
.\.devcontainer\dc install     # Windows
```
```bash
./.devcontainer/dc install      # macOS and Linux
```

That puts a copy of `dc` on your PATH, so it works from anywhere and keeps working even if you delete the project it came from. It also answers to `dcp`, in case `dc` is already taken on your machine. Then:

```bash
dc up          # first build takes a few minutes
dc claude      # or dc codex, dc gemini
```

(If typing `dc` says the command isn't found, open a new terminal and try again.)

There's more `dc` can do, listed under [the `dc` command](#the-dc-command).

### Either way

Each agent asks you to sign in the first time you run it. Follow the prompts.

## What ends up in your project

Building the container adds two folders to your project as it goes: `.playwright/`, holding the browser's config and any screenshots it takes, and `.claude/skills/playwright-cli/`, the skill Claude uses to drive the browser. Both are written fresh on every build. Claude adds `.claude/settings.local.json` as well, once you start approving permissions.

Whether those belong in git is up to you. The first two are rebuilt from scratch every time, so committing them mostly adds noise, and the third is particular to you rather than the project. If you'd rather not track them:

```gitignore
.playwright/
.claude/skills/playwright-cli/
.claude/settings.local.json
```

## The `dc` command

`dc` drives the container from a terminal, with no VS Code involved. Installing it is covered [above](#without-vs-code).

Once installed you can type `dc` anywhere. It picks up whichever project you're currently sitting in.

```
dc up          create and start the container   (--rebuild to start over, --fresh to also clear agent history)
dc build       rebuild the image                (--no-cache to ignore the cache)
dc shell       open a shell inside it
dc claude      run Claude inside it             (also codex, gemini, pw)
dc exec ...    run any command inside it
dc down        stop it                          (dc rm deletes it too, dc rm --volumes also its agent data)
dc volumes     saved agent history              (see below)
dc forward     reach a port in the container    (see below)
dc snapshot    save this moment to come back to (see below; dc restore goes back)
dc status      show this project's container
dc statusline  switch Claude's status line      (devcontainer-plus's or yours)
dc logs        show its output                  (--follow to keep watching)
dc init        add devcontainer-plus to this folder
dc update      get the latest devcontainer-plus (see below)
dc doctor      check your setup
```

Before stopping or replacing a running container (`dc up --rebuild`, `dc up --fresh`, `dc down`, `dc rm`, `dc snapshot`, `dc restore`), `dc` looks at what's running in it. If Claude, Codex, Gemini or anything else is busy, it says what and asks first; an idle container just goes. Add `--yes` to skip the question.

When something won't start, run `dc doctor` first. It checks Docker, Node, and your project, and tells you which one is the problem.

One thing to watch for on macOS and Linux: they already ship a small calculator program called `dc`, and this will hide it. If you use it, run `dcp uninstall dc` to give the calculator its name back and type `dcp` instead. To install under a name of your own, use `dc install <name>`. To remove everything, run `dc uninstall` (with the name, if you installed under one).

## Signing in to GitHub and GitLab

This step is optional. The container includes `gh` and `glab`, the GitHub and GitLab command-line tools, which agents can use to create pull requests, work with issues, and so on. If you don't plan on that, skip this section — and you almost certainly want one of the two, not both.

The normal sign-ins work fine from inside the container: `gh auth login` shows a code to type into github.com in your browser, and you're in. The one catch is that GitHub allows a single `gh auth login` per account, so signing in from a second container quietly logs the first one out. If you only ever run one container at a time, that will never bother you.

If it does bother you, the container includes `auth`, which signs in with an access token instead — one token works in any number of containers at once:

```bash
auth            # figures out GitHub or GitLab from your project's git remote
auth --gh
auth --glab
auth --both
auth --force    # replace a login you already have
auth --logout   # sign out
```

It sends you to the right page to create the token, then takes the token you paste back and signs you in. For GitHub it also lets plain `git` use the login, so `git push` works and agents can install plugins from your private repos. (`gh auth login` asks about this itself; say yes.)

Either way, rebuilding a container signs you out, since logins aren't stored outside it. Sign in again and carry on. And `auth --logout` only affects the container you're in — the token stays valid, so anywhere else you've used it keeps working.

## Keeping agent history across rebuilds

Rebuilding a container normally throws away everything inside it. So that your agents pick up where they left off, each project keeps the agents' own folders in Docker volumes, which outlive rebuilds:

| Folder | What's kept |
|---|---|
| `~/.claude` | Claude Code sessions (`claude --resume`), memory, settings, plugins, and prompt history |
| `~/.codex` | Codex CLI sessions, history, and settings |
| `~/.gemini` | Gemini CLI chats, checkpoints, and settings |

Sign-ins are the exception. Every rebuild deletes the agents' login files before anything starts, so after a rebuild you run `/login` in Claude (and sign in to Codex or Gemini if you use them), and everything else is as you left it. A login only lasts as long as the container it was made in, rather than piling up across rebuilds. `gh` and `glab` aren't kept either, so sign in to those again too.

Each project gets its own volumes, so containers for different projects can't see each other's history. `dc` handles them for you:

```
dc volumes            list this project's saved agent data
dc up --rebuild       rebuild and keep it
dc up --fresh         rebuild with empty agent folders (asks first)
dc rm                 remove the container; the data stays for the next dc up
dc rm --volumes       remove the container and delete its data (asks first)
dc volumes --rm       delete the data of a container you've already removed (asks first)
dc volumes --prune    delete saved data no container uses (asks first)
```

The commands that delete ask first; add `--yes` to skip the question, for example in a script. Docker can't delete a volume while a container is using it, even a stopped one, so `dc volumes --rm` refuses while the container exists; `dc rm --volumes` removes both. To clear the data and carry on working, use `dc up --fresh`.

*Rebuild Container* in VS Code keeps the data too, and the `dc` commands work on containers VS Code made, so use `dc up --fresh` from a terminal when you want a clean slate.

A few things to know:

- **Moving or renaming the project folder starts fresh.** The volume names come from the folder's path, so the moved project gets new ones. The old data stays with the old container: `dc status` from the new location lists every dev container on the machine, so remove the one with the old path (`docker rm <id>`) and then `dc volumes --prune` deletes its data.
- **The logins in an abandoned project stay put.** They're deleted when a container is next created, so a project you remove with `dc rm` (or *Remove Container* in VS Code) and never start again keeps its last login in its volume. To remove a project for good, use `dc rm --volumes`. `dc volumes --rm` deletes a project's saved data, logins included; `dc volumes --prune` deletes it for every project with no container.
- **Docker's own cleanup can delete them.** `docker volume prune --all` removes every volume no container is using, which includes these whenever a project's container is removed (on Docker older than 23, plain `docker volume prune` does too). Don't run it if you want the history.
- **Sessions are kept as written.** Anything pasted into a session, or printed during one, stays in its history. Logins are deleted, but a key you typed into a settings file yourself (such as the `env` block of Claude's `settings.json`, or `~/.gemini/.env`) is kept like any other setting.

Without `dc`, the volumes are named `agent-claude-<id>`, `agent-codex-<id>`, and `agent-gemini-<id>`; `docker volume ls` lists them and `docker volume rm` deletes them once their container is removed.

## Snapshots: saving a moment and going back

A snapshot saves your project folder and the agents' data (their history, settings, plugins and sign-ins) so you can come back to exactly that moment later. It's handy for trying things: set things up the way you like, take a snapshot, try something, and go back as often as you want.

```
dc snapshot clean          save this moment as "clean"
dc restore clean           go back to it
dc snapshot --list         see your snapshots
dc snapshot --rm clean     delete one
```

To take a new snapshot under a name you've used before, add `--overwrite` (`dc snapshot clean --overwrite`). The old one is replaced only once the new one has saved completely, so a snapshot that fails partway leaves the old one as it was.

If the container is running, `dc snapshot` stops it for a moment while it copies (so nothing is saved half-written) and starts it again after. If that would interrupt something, like a Claude session or a dev server, it tells you what and asks first; it's best to finish or exit what you're doing before taking a snapshot.

You can keep as many as you like and hop between them: take `clean` before trying something, `try-1` after, and `dc restore clean` or `dc restore try-1` whenever you want.

`dc restore` puts the project folder back exactly as it was (files made since are removed, changed files go back) and starts a brand-new container, so anything the work left inside the old container is gone too. That takes a few minutes while the agents install, and, as with any rebuild, you'll sign in to Claude again. Add `--quick` to keep the container instead: it's back in seconds, sign-in and all, but anything installed inside the container since stays.

Restoring replaces what's in your project folder, so `dc restore` asks first (add `--yes` to skip the question). It checks the snapshot is whole and belongs to this project before it changes anything. A few things to know:

- **It's the whole folder, git included.** Commits and branches made since the snapshot go too, so push or copy anything you want to keep first.
- **Close VS Code's window on this container first,** if you have one open; restoring removes the container out from under it.
- **A `--quick` sign-in can be stale.** It's the one from when you took the snapshot; if Claude has refreshed it since, you may need to sign in again anyway.
- **If a file can't be removed** (another program has it open), everything from the snapshot still comes back, and `dc restore` tells you which leftovers to delete.

Snapshots are kept on your computer in `dc`'s own folder, never in the project, because they hold your sign-ins and `.env` keys. The image isn't part of a snapshot: nothing you do changes it, and `dc restore` reuses it (unless the snapshot's dev container setup differs from what's cached, in which case it's rebuilt). In the rare case there's no image to do the copying with, `dc` fetches a small one, which needs an internet connection the first time.

## Reaching a server in the container

If something in the container runs a web server, say a dev server on port 8999, `dc forward` lets you open it in your browser at `http://localhost:8999`:

```
dc forward 8999        open container port 8999 at localhost:8999
dc forward             see what's forwarded
dc forward --rm 8999   stop forwarding it
```

A forward keeps working until you remove it. It pauses when the container stops and comes back with `dc up`; if you start the container some other way, such as from VS Code, run `dc forward` to bring your forwards back. They're saved on your computer, not in the project, so there's nothing to commit. You can forward several ports at once: `dc forward 3000 8999`.

If something on your computer is already using the port, `dc forward` tells you, and starts forwarding as soon as the port is free.

VS Code has its own port forwarding, so you only need this when you're using `dc`.

### Opening it to other devices

At first, only your own computer can reach a forwarded port. To try your app from your phone or another computer on the same network, add `--network`:

```
dc forward 8999 --network   your computer and your network
dc forward 8999             back to just your computer
```

`dc` shows the address to use on the other device, such as `http://192.168.1.20:8999`. Anyone on the same network can reach it while it's open, so only do this on networks you trust. `dc forward` shows which ports are open to your network.

If the other device can't connect:

- Try the address on your own computer first. If it works there, something is blocking the other device, usually the firewall.
- The first time, your firewall may ask whether to allow Node.js. Allow it for private networks.
- On Windows, check that your network is set to Private: Settings → Network & internet → your Wi-Fi or Ethernet → Network profile type.

## Letting an agent use a browser

Chromium is installed, and Claude has a skill for driving it. You don't need to configure anything. Try starting Claude and pasting this in:

> Create an HTML file called hello.html with a colorful heading saying 'Hello Playwright!', then use playwright-cli to take a screenshot of it.

You'll get the file, and a screenshot of it rendered in a real browser.

It's more useful on real work: point an agent at your dev server and ask it to walk through signup, or to check whether a page still looks right on a phone-sized screen. Run `playwright-cli --help` for everything it can do.

## Changing how it's set up

The whole configuration is a handful of files in `.devcontainer/`:

- `devcontainer.json` sets the base image, VS Code extensions, and container options
- `setup.sh` installs the agents, the browser, and the command-line tools
- `statusline.sh` is the status line Claude Code shows under the prompt, and `statusline.py` sets it up and switches it
- `on-create.sh` runs first on each build: it fixes folder ownership and deletes saved agent logins
- `auth` is the sign-in helper
- `dc`, `dc.cmd`, `dc.ps1`, and `dc.mjs` make up the `dc` command

To add or remove software, edit `setup.sh` and rebuild the container.

Claude Code also gets a status line under the prompt: the model, how much of the conversation's context is used, and how much of your 5-hour and 7-day usage limits is gone, each as a bar that turns yellow and then red. It's only added if your Claude settings don't have a status line already; one you've set up yourself is never replaced, and the build shows a preview of this one instead. To switch, run `dc statusline` (or, in the container, `python3 .devcontainer/statusline.py switch`): it swaps to this one and keeps yours, and running it again swaps back. With no status line of your own, running it again turns it off, and it stays off when you rebuild. To leave it out of builds entirely, uncomment `NO_STATUSLINE=1` in `setup.sh`.

Claude Code normally compacts a long conversation while you're away from it, so you come back to a summary. The container turns that off, unless your Claude settings already say either way. To keep it on, uncomment `KEEP_IDLE_COMPACTION=1` in `setup.sh` and rebuild, or remove the `"idleCompaction": false` line from `~/.claude/settings.json` in the container.

If your network blocks npmjs.org, point `NPM_REGISTRY` somewhere else in `devcontainer.json` and setup will use it for every install:

```json
"containerEnv": { "NPM_REGISTRY": "https://your-registry.example.com/api/npm/npm-repos/" }
```

## Getting the latest version

To bring a project's `.devcontainer` up to the latest devcontainer-plus, run this in the project folder on your computer:

```bash
dc update
```

It checks GitHub for a newer version (or give it a local copy of this repo: `dc update C:\LocalDev\devcontainer-plus`), links to [what's new](https://dcp.synapticnoise.com/whats-new/), and asks before changing anything. Then rebuild with `dc up --rebuild`.

Files you haven't touched are simply updated. Files you've changed keep your changes, with the new version merged in. If you both changed the same lines, yours stays as it is and the new version is saved beside it as `<file>.new` to compare; `dc update` tells you when that happens. Files that aren't part of devcontainer-plus are left alone.

It keeps a small record of what it installed in `.devcontainer/.dcp.json`; commit it with the rest. The first time, before there's a record, it can't tell your changes from an older copy, so it replaces files that differ and says so. If the project is in git, `git diff .devcontainer` shows what changed, so you can put back anything of yours; if not, the old copies are kept as `.orig` files.

## Disclaimer

This is provided as-is, for experimenting and learning. Expect rough edges. It isn't production software and comes with no warranty. The AI tools and browser packages it installs change frequently and occasionally break.
