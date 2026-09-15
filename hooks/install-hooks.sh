#!/usr/bin/env bash
# New Bot HQ does not install Claude Code hooks.
# Point the office at a status.json URL instead (see README).
set -euo pipefail
echo "Claude Code hooks are not used."
echo "Configure status.json via ?status=, VITE_STATUS_URL, or office.config.json"
echo "Default: https://dinguspingus84acl.github.io/new-bot-hq/status.json"
exit 0
