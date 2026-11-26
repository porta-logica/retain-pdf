#!/usr/bin/env bash
# Install (or update) the fork's local maintenance timers for the current user:
#   retain-pdf-sync-i18n       job 2, Mondays: merge main into a sync/<date> branch of i18n
#   retain-pdf-translate-docs  job 3, Tuesdays: update/add English translations on a translations/<date> branch
#
#   ops/fork/install-sync-timer.sh            install/update and enable both timers
#   ops/fork/install-sync-timer.sh --remove   disable and remove them
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
units=${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user
bindir=$HOME/.local/bin
jobs=("retain-pdf-sync-i18n:sync-i18n.sh" "retain-pdf-translate-docs:translate-docs.sh")

if [ "${1:-}" = "--remove" ]; then
  for job in "${jobs[@]}"; do
    name=${job%%:*}
    systemctl --user disable --now "$name.timer" 2>/dev/null || true
    rm -f "$units/$name.service" "$units/$name.timer" "$bindir/$name"
  done
  systemctl --user daemon-reload
  echo "removed"
  exit 0
fi

mkdir -p "$units" "$bindir"
for job in "${jobs[@]}"; do
  name=${job%%:*} script=${job#*:}
  install -m 0755 "$here/$script" "$bindir/$name"
  install -m 0644 "$here/systemd/$name.service" "$here/systemd/$name.timer" "$units/"
done
systemctl --user daemon-reload
for job in "${jobs[@]}"; do systemctl --user enable --now "${job%%:*}.timer"; done
systemctl --user list-timers 'retain-pdf-*' --no-pager
