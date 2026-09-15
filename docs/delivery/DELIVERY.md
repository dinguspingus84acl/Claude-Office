# Delivery — New Bot HQ fork-and-reskin

## 1. Baseline (unchanged donor)

See `docs/delivery/baseline/` — captured before product edits.

- Screenshot: `baseline/donor_office_sim.png` (1920×1080)
- Recording: `baseline/donor_office_sim.mp4`

## 2. Adapted screenshot

`docs/delivery/adapted_office.png` (added after verification)

## 3. Task-sequence recording

`docs/delivery/mira_forensics_sequence.mp4` — `?sim` Mira forensics → approval → done (added after verification)

## 4. Live preview

- Local: `npx vite --port 3333` → http://localhost:3333 and http://localhost:3333/?sim
- GitHub Pages (enable Pages + Actions on this fork): https://dinguspingus84acl.github.io/Claude-Office/
- Workflow: `.github/workflows/pages.yml`

## 5. Files changed

See the PR diff. High-signal paths:

- `src/operators.ts`, `src/statusAdapter.ts`, `src/App.tsx`, `src/theme.ts`, `src/config.ts`, `src/types.ts`
- `src/components/Character.tsx`, `src/components/SlackChat.tsx`
- `src/styles/office.css`, `hooks/*`, `server/index.js`, `README.md`, `THIRD_PARTY_NOTICES.md`
- Removed `public/sprites/office/**` and Dunder Mifflin docs images
- Added `public/sprites/companions/*`, `public/status.json`

## 6. Claude-specific code removed / replaced

| Removed | Replacement |
| --- | --- |
| Claude Code hook producer (`hooks/agent-tracker.sh`) | status.json poller (client) + optional `GET /status` |
| `install-hooks.sh` Claude settings writer | no-op pointing at status.json |
| Permanent Claude assistant + sample agent swarm | five GrokBotTech operators |
| Title `CLAUDE CODE — AGENT OFFICE` | New Bot HQ top bar |
| `/the-office` / Dunder Mifflin theme pack | removed |
| Office TV sprites, props, cats, DM room art | deleted |
| Claude chat-watcher as required boot path | frontend works without it |

## 7. Characters and mascots

Used: donor `Me-1`, `explore-1`, `dev-2`, `security-audit-1`, `employee-1` + companions bunbot, scanslime, foldfox, voltbug, archivowl.

**Not used:** GrokBot `runner-*.png` (not directional sheets), `floor.jpg`.

## 8. License

`LICENSE` (MIT, W17ANT + adaptation notice) and `THIRD_PARTY_NOTICES.md`.

## 9. State mapping

| status.json | Donor animation |
| --- | --- |
| offline | Walk to door, then absent |
| idle | Seated idle |
| reading | Seated working + post-it |
| thinking | Seated working + star |
| working | Seated typing |
| running_tool | Seated typing + rocket |
| waiting | Seated idle + sleeping bubble |
| needs_approval | Amber glow + post-it |
| blocked | Red glow + build-failed |
| done | One thumb-up / celebration, then idle |
| failed | One error cue, persistent failed bubble |

## 10. Acceptance checklist

Filled after browser verification in this PR.
