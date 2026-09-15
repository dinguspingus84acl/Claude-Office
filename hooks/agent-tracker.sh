#!/usr/bin/env bash
# =============================================================================
# Retired — Claude Code hook producer
#
# New Bot HQ no longer ingests Claude CLI / PreToolUse / PostToolUse hooks.
# Live operators are driven by polling status.json:
#   https://dinguspingus84acl.github.io/new-bot-hq/status.json
#   https://raw.githubusercontent.com/dinguspingus84acl/new-bot-hq/main/status.json
#
# Override the URL with ?status= or VITE_STATUS_URL / office.config.json.
# This script exits 0 so leftover Claude settings.json hook entries stay silent.
# =============================================================================
exit 0
