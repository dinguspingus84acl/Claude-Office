# New Bot HQ

Pixel-art isometric office for **GrokBotTech** operators. This repository is a fork of [W17ant/Claude-Office](https://github.com/W17ant/Claude-Office) (MIT). The donor office, furniture, directional sprites, pathfinding, and workstation animations are kept. Product copy, roster, and live data are adapted for **New Bot HQ** at [grokbottech.com](https://grokbottech.com).

This project is **not affiliated** with Anthropic, Claude, NBC, or *The Office*. Dunder Mifflin mode has been removed.

**Mode:** `PAPER RESEARCH ONLY`

## Operators

Five permanent operators occupy five existing donor desks. No extra rooms or walking mascots.

| Operator | Role | Companion | Donor sprite |
| --- | --- | --- | --- |
| New Bot | Coordinator | Bunbot | `Me-1` |
| Mira | Research / Forensics | Scanslime | `explore-1` |
| Kai | Analysis / Clustering | Foldfox | `dev-2` |
| Oak | Monitoring / Watch | Voltbug | `security-audit-1` |
| Rex | Review / Archive | Archivowl | `employee-1` |

Walking characters use the donor four-direction sprite sheets. GrokBot `runner-*.png` files are **not** used (they are not directional walk sheets). Mascot PNGs sit as small stationary companions at the desk and appear in the click-detail panel.

## Live data

The floor polls `status.json` (no Claude Code hooks).

Default URLs (first that succeeds):

- https://dinguspingus84acl.github.io/new-bot-hq/status.json
- https://raw.githubusercontent.com/dinguspingus84acl/new-bot-hq/main/status.json
- `./status.json` (bundled fallback)

Override with `?status=<url>`, `VITE_STATUS_URL`, or `office.config.json` → `statusUrl`.

On `grokbottech.com` and `*.github.io` the optional local WebSocket (`ws://localhost:3334/ws`) and roster poll (`http://localhost:3334/roster`) are **never opened**. Those endpoints exist only for loopback (`localhost` / `127.0.0.1`). If a local socket URL is missing, not loopback-allowed, or the connection fails, the client stops retrying and keeps polling `status.json` quietly.

Identical `{id,status,task,progress,lastAction}` ticks do **not** restart walks, sounds, bubbles, or effects.

Normalized record shape:

```json
{
  "id": "mira",
  "name": "Mira",
  "role": "Research / Forensics",
  "status": "working",
  "task": "Watchlist token forensics",
  "progress": 72,
  "lastAction": "Scan pass 4 of 5",
  "updatedAt": "2026-09-15T18:41:02Z"
}
```

## Quick start

```bash
npm install
cp office.config.example.json office.config.json   # optional
node server/index.js &                             # optional local WS + /status proxy
npx vite --port 3333
```

- Office: http://localhost:3333
- Simulation (deterministic five-operator sequence): http://localhost:3333/?sim
- Optional local server: http://localhost:3334/health and `/status`

Audio is **muted by default**. Unmute in the floor log if you want approval / failure / completion cues.

## GitHub Pages

Workflow: `.github/workflows/pages.yml`. Production is the apex custom domain.

- **Live:** https://grokbottech.com/ (`public/CNAME`, `BASE_PATH=/`)
- **Project URL fallback:** https://dinguspingus84acl.github.io/Claude-Office/

The Actions build sets `BASE_PATH=/` so asset URLs resolve on the custom domain. Vite reads `process.env.BASE_PATH` in `vite.config.ts` (default `./` for local builds).

To preview the github.io project path instead, dispatch the workflow with `base_path=/Claude-Office/`. Do not use that value for production — `/Claude-Office/` asset prefixes 404 on `grokbottech.com`.

Local preview of the static build:

```bash
BASE_PATH=/ npm run build:pages
npx vite preview --port 4173
```

## License

MIT — see `LICENSE`. Original copyright W17ANT; adaptation copyright GrokBotTech / dinguspingus84acl.

Artwork is **not** automatically MIT because the code is. See `THIRD_PARTY_NOTICES.md`.
