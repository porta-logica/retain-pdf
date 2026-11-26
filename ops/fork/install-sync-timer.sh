#!/usr/bin/env bash
# Install (or update) the weekly main -> i18n sync timer for the current user.
#   ops/fork/install-sync-timer.sh            install/update and enable the timer
#   ops/fork/install-sync-timer.sh --remove   disable and remove it
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
units=${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user
bin=$HOME/.local/bin/retain-pdf-sync-i18n

if [ "${1:-}" = "--remove" ]; then
  systemctl --user disable --now retain-pdf-sync-i18n.timer 2>/dev/null || true
  rm -f "$units/retain-pdf-sync-i18n.service" "$units/retain-pdf-sync-i18n.timer" "$bin"
  systemctl --user daemon-reload
  echo "removed"
  exit 0
fi

mkdir -p "$units" "$(dirname "$bin")"
install -m 0755 "$here/sync-i18n.sh" "$bin"
install -m 0644 "$here/systemd/retain-pdf-sync-i18n.service" "$here/systemd/retain-pdf-sync-i18n.timer" "$units/"
systemctl --user daemon-reload
systemctl --user enable --now retain-pdf-sync-i18n.timer
systemctl --user list-timers retain-pdf-sync-i18n.timer --no-pager
