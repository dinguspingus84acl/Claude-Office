# Delivery — New Bot HQ fork-and-reskin

## 1. Baseline (unchanged donor)

Captured **before** product edits. See `docs/delivery/baseline/`.

- Screenshot: `baseline/donor_office_sim.png` (1920×1080)
- Recording: `baseline/donor_office_sim.mp4` (~12s `?sim`)

## 2. Adapted screenshot

`docs/delivery/adapted_office.png` (1920×1080) — New Bot HQ `?sim`, five operators, Mira detail panel, `#hq-floor` log.

`docs/delivery/adapted_office_walkin.png` — same sim after reload: operators entering from the door, Needs You 1, Mira scan/approval chat.

## 3. Task-sequence recording

`docs/delivery/mira_forensics_sequence.mp4` (16s) — deterministic `?sim` reload: walk-in from the door, Mira scan pass 4 → 5 → packet ready.

## 4. Live preview

- Local: `npx vite --port 3333` → http://localhost:3333 and http://localhost:3333/?sim
- GitHub Pages (enable Pages + Actions on this fork): https://dinguspingus84acl.github.io/Claude-Office/
- Workflow: `.github/workflows/pages.yml`
- Status feed defaults: https://dinguspingus84acl.github.io/new-bot-hq/status.json (fallback raw GitHub + `./status.json`)

## 5. Files changed (high-signal)

Added: `src/operators.ts`, `src/statusAdapter.ts`, `public/status.json`, `public/sprites/companions/*`, `THIRD_PARTY_NOTICES.md`, `.github/workflows/pages.yml`, `docs/delivery/**`

Edited: `src/App.tsx`, `src/theme.ts`, `src/config.ts`, `src/types.ts`, `src/components/Character.tsx`, `src/components/SlackChat.tsx`, `src/styles/office.css`, `src/agentManager.ts`, `src/events.ts`, `src/sounds.ts`, `src/hooks/useAgentSocket.ts`, `hooks/*`, `server/index.js`, `README.md`, `LICENSE`, `package.json`, `vite.config.ts`, `index.html`

Removed: `public/sprites/office/**`, `public/rooms/office-*-dm.png`, Dunder Mifflin `docs/images/*`

## 6. Claude-specific code removed / replaced

| Removed | Replacement |
| --- | --- |
| Claude Code hook producer | Client `status.json` poll + optional `GET /status` |
| Hook installer writing `~/.claude/settings.json` | No-op pointing at status URL |
| Permanent Claude assistant + swarm sim | Five named operators |
| `CLAUDE CODE — AGENT OFFICE` title | New Bot HQ top bar |
| `/the-office` + Office TV theme | Deleted |
| Office TV sprites/props/cats/DM rooms | Deleted |

**Note:** The donor isometric *painting* still has a small “CLAUDE” doorplate baked into `office-day.png` / `office-night.png`. We did not mutilate the room art. Product UI, chat, and docs no longer say Claude.

## 7. Characters and mascots

| Operator | Role | Walking sprite (donor directional) | Companion |
| --- | --- | --- | --- |
| New Bot | Coordinator | `Me-1` | Bunbot |
| Mira | Research / Forensics | `explore-1` | Scanslime |
| Kai | Analysis / Clustering | `dev-2` | Foldfox |
| Oak | Monitoring / Watch | `security-audit-1` | Voltbug |
| Rex | Review / Archive | `employee-1` | Archivowl |

**Not used:** `runner-coord.png`, `runner-deep.png`, `runner-cluster.png`, `runner-watch.png`, `runner-lab.png` (static frames, not four-direction sheets), `floor.jpg` (old GrokBot photo office). Unused donor file `Claude-1-*.png` is not mapped to anyone.

## 8. License

MIT preserved (`LICENSE`: W17ANT + adaptation line). Artwork inventory: `THIRD_PARTY_NOTICES.md`.

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
| needs_approval | Amber attention + post-it |
| blocked | Restrained red + build-failed |
| done | One thumb-up / celebration, then idle |
| failed | One error cue, persistent failed |

Identical `{id,status,task,progress,lastAction}` ticks do not restart movement, sounds, bubbles, or effects.

## 10. Acceptance checklist

| Criterion | Result |
| --- | --- |
| Phase 1: unchanged donor `?sim` runs | Pass — baseline artifacts |
| Donor isometric office / desks / directional walks kept | Pass |
| Not a CSS-box office or `office-floor.jpg` | Pass |
| Product New Bot HQ, grokbottech.com, PAPER RESEARCH ONLY | Pass |
| Exactly five operators on existing desk slots | Pass |
| Donor sprites mapped; no TV cast; no runner-*.png walks | Pass |
| status.json adapter + dedupe | Pass (poll + sim apply path) |
| Claude hooks / Dunder Mifflin mode removed | Pass (doorplate paint leftover only) |
| Compact top bar; office primary; click details | Pass |
| Random wander off; audio muted by default | Pass |
| MIT + THIRD_PARTY_NOTICES | Pass |
| GitHub Pages workflow documented | Pass — enable Actions/Pages on the fork |
