# Phase 1 — Unchanged donor baseline

Captured before any product-code edits. Compatibility-only step: copied `office.config.example.json` → `office.config.json` (gitignored) so Vite can resolve the optional boss config import.

## Run

- `npm install` (unchanged)
- `node server/index.js` on port 3334
- `npx vite --port 3333` on port 3333
- Opened `http://localhost:3333/?sim`

## Verified

- Isometric donor office (day art, desks, plants, printer, coffee, water cooler, door)
- Title bar: `CLAUDE CODE — AGENT OFFICE`
- Permanent Boss + Claude plus simulated agent roster
- Directional walk / desk seating / chat simulation (`#office-general`)
- Pathfinding logs and cinematic sim events (deploy chatter, etc.)

## Artifacts

| File | What |
| --- | --- |
| `donor_office_sim.png` | 1920×1080 screenshot of populated `?sim` |
| `donor_office_sim.mp4` | ~12s recording of sim mode (office + live chat) |

No product source files were changed for this gate.
