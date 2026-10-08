# Deploying play.compono.md

The playground deploys itself on a server with systemd and nginx. A timer runs [`deploy/sync.mjs`](../deploy/sync.mjs) 5 minutes after its previous run ended. Each run:

1. fetches the playground and Compono,
2. deploys the newest playground release tag (`v1.2.3`) if it isn't deployed yet,
3. builds the Compono versions the deployed release is missing: main's newest commit and every release tag since v0.7.0.

There is no server process: nginx serves static files, and a deploy switches a symlink.

## What it does

- **Playground releases.** A new tag is built with `npm ci` and `npm run build` (its version, shown on the page, is the tag), gets its Compono builds, and replaces the deployed release in one step. Only stable tags (`v1.2.3`) are deployed. The previous release is kept for rolling back; older ones are deleted.
- **Compono main.** Only main's newest commit is built. The build it replaces is deleted an hour later, so pages that are open can still load it.
- **Compono tags.** Every stable tag since v0.7.0 is built once. A tag removed from Compono is removed from the list. A tag on main's commit shares main's build.
- **Bridge changes.** A playground release whose `wasm/` didn't change reuses the previous release's builds. If it changed, every version is built again for the new release before it is deployed.
- **Failures.** A build that fails (e.g. Compono changed its API and the bridge's tests fail) is logged, the previous build of that version stays listed, and the run exits with an error (`systemctl --failed`). It is tried again after 6 hours or when the commit changes. If a new release can't build main's newest commit, it builds the main of the previous release instead, so main stays listed.
- **Safety.** Files are replaced by renaming, so a visitor never gets a half written file. A lock keeps two runs from overlapping.

The sync script updates itself: each run checks out the newest release in its own clone, and the next run uses that release's script.

## Layout

```
/var/lib/compono-playground/
  repos/playground/    clone of the playground; the sync runs from here
  repos/compono/       clone of Compono
  sources/<tag>/       source of a release (its bridge)
  releases/<tag>/      a built release; compono/ holds its Compono builds
  current              symlink to the deployed release, nginx's root
  state.json           recently failed builds, builds waiting to be deleted
```

## Setup

Requires git, Go 1.23+ (what Compono's `go.mod` needs), Node.js 20.19+ and nginx.

1. Create a user for the sync:

   ```sh
   sudo useradd --system --create-home --home-dir /var/lib/compono-playground \
     --shell /usr/sbin/nologin compono-playground
   # nginx reads the site from here.
   sudo chmod 755 /var/lib/compono-playground
   ```

2. Clone the playground. Its `origin` must be the repository releases are tagged in:

   ```sh
   sudo -u compono-playground git clone https://github.com/umono-cms/compono-playground.git \
     /var/lib/compono-playground/repos/playground
   ```

3. Install the systemd units. Set the `PATH` in the service to where Go and Node.js are installed:

   ```sh
   sudo cp /var/lib/compono-playground/repos/playground/deploy/compono-playground-sync.{service,timer} \
     /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now compono-playground-sync.timer
   ```

   The units are copies: when a release changes them, copy them again.

4. Install the nginx site from [`deploy/nginx.conf`](../deploy/nginx.conf), add TLS (e.g. `certbot --nginx -d play.compono.md`) and reload nginx.

5. Tag a release of the playground if there is none yet:

   ```sh
   git tag v0.1.0
   git push upstream v0.1.0
   ```

   Run the sync right away instead of waiting for the timer and follow it:

   ```sh
   sudo systemctl start compono-playground-sync.service
   journalctl -u compono-playground-sync -f
   ```

   The first run builds the release and every Compono version, a few minutes.

## Operations

| Task | How |
| --- | --- |
| Logs | `journalctl -u compono-playground-sync` |
| Next and last run | `systemctl list-timers compono-playground-sync.timer` |
| Failed runs | `systemctl --failed` |
| Run now | `sudo systemctl start compono-playground-sync.service` |
| Release the playground | Push a tag `v1.2.3`; it is deployed by the next run. |
| Roll back a release | Delete its tag from the repository. The next run deploys the newest remaining tag; the previous release is still built, so it switches at once. |
| Retry a failed build now | Remove its entry from `failed` in `state.json`. |

The sync reads `COMPONO_PLAYGROUND_DATA` (default `/var/lib/compono-playground`) and `COMPONO_REPO` (default `https://github.com/umono-cms/compono.git`). Running it by hand as the `compono-playground` user works too: `node repos/playground/deploy/sync.mjs`. Without `--self-update` it doesn't check out the newest release in its clone.
