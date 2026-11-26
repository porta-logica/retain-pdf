# Fork maintenance (fork only)

Tools that exist only in this fork, for keeping `i18n` in step with upstream. Plan and reasoning:
[docs/ops/planning/i18n/20261126-fork-maintenance.md](../../docs/ops/planning/i18n/20261126-fork-maintenance.md).

| Job | Where | What |
|---|---|---|
| 1. Mirror | GitHub Actions, daily 03:17 UTC (`.github/workflows/fork-mirror-upstream.yml`) | fast-forwards `main` to `upstream/main` |
| 2. Integrate | local `systemd --user` timer, Mondays 07:30 (this directory) | merges `main` into a new branch `sync/<date>` from `i18n`, pushes it for review |

## Job 2: weekly main → i18n sync

`sync-i18n.sh` works in its own worktree (`../retain-pdf-sync`), so your checkouts are never touched:

1. fetches `origin`; stops if `i18n` already contains `main`;
2. branches `sync/<date>` from `origin/i18n` and merges `origin/main`;
3. devlog CSV conflicts (both sides append rows) are resolved by `resolve_devlog_conflict.py` — upstream's rows,
   then the fork's new rows; no AI;
4. any other conflict goes to headless Claude (`claude -p`) with read/edit tools only (no `git add`/`commit`,
   no other commands); its explanation goes into the merge commit message; leftover conflict markers stop the run;
5. runs quick checks (devlog format, `.github/scripts/tests`, translation status), commits, pushes `sync/<date>`
   and shows a desktop notification with the compare link.

It never changes `i18n`: review the `sync/<date>` branch and say "merge" (合).

```bash
ops/fork/install-sync-timer.sh                          # install/update + enable the timer
ops/fork/install-sync-timer.sh --remove                 # uninstall
systemctl --user list-timers retain-pdf-sync-i18n.timer # next run
systemctl --user start retain-pdf-sync-i18n.service     # run now
journalctl --user -u retain-pdf-sync-i18n.service       # output of past runs
ls ~/.local/state/retain-pdf-sync/                      # one log per run (+ Claude's notes)
RETAIN_SYNC_NO_PUSH=1 ~/.local/bin/retain-pdf-sync-i18n # try without pushing
```

Notes:

- The timer runs while you are logged in; a run missed because the PC was off happens at the next login
  (`Persistent=true`).
- Pushing uses your SSH agent from the desktop session; Claude uses your normal Claude Code login.
- After changing `sync-i18n.sh`, run the installer again (it copies the script to `~/.local/bin/`).
