# Third-party notices and asset inventory

MIT on this repository’s **code** does not license every bundled image or font.

## Code

| Item | License | Attribution |
| --- | --- | --- |
| Donor office app (W17ant/Claude-Office) | MIT | Copyright (c) 2026 W17ANT |
| New Bot HQ adaptation | MIT | Copyright (c) 2026 GrokBotTech / dinguspingus84acl |
| React, Vite, Express, `ws`, `better-sqlite3`, TypeScript | MIT / respective | npm packages — see `package-lock.json` |

## Fonts (CSS `@import`)

| Item | License | Attribution |
| --- | --- | --- |
| JetBrains Mono | SIL OFL 1.1 | JetBrains |
| Press Start 2P | SIL OFL 1.1 | Cody “CodeMan38” Boisclair |

## Donor isometric office (kept)

These files ship with the W17ANT donor. No separate artwork license file was included upstream. Treat them as **donor-bundled, license unspecified beyond the repo MIT claim**. They are retained only because they are required to keep the donor office intact. They are **not** cleared here as independently commercially licensed stock.

| Path | Role |
| --- | --- |
| `public/rooms/office-day.png` | Main office day background |
| `public/rooms/office-night.png` | Main office night background |
| `public/rooms/*.png` (other unused room shells) | Unused extra rooms from donor (not shown as extra floors) |
| `public/sprites/characters/*-{front,rear}-{left,right}.png` | Directional walk/sit sheets (`Me-1`, `explore-1`, `dev-1/2`, `employee-1/2/3`, `Frontend-dev-1`, `security-audit-1`, unused `Claude-1`) |
| `public/sprites/furniture/*` | Standing desks, filing cabinet |
| `public/sprites/appliances/*` | Coffee machine |
| `public/sprites/decoration/*` | Plants, printer |
| `public/sprites/culture/*` | Bell, boards (baked hotspots still clickable) |
| `public/sprites/effects/*` | Donor bubbles (typing, coffee, failed, star, etc.) |
| `public/sprites/*-walk-*.png` and role PNGs | Legacy unused walk strips from donor |

## Removed (incompatible / TV theme)

Removed from this fork — do not restore:

- Entire `public/sprites/office/` (Office TV cast, cats, Dunder Mifflin props)
- `public/rooms/office-*-dm.png`
- README / `docs/images` Dunder Mifflin cast and prop shots
- `/the-office` theme pack in `src/theme.ts`

Those assets depicted copyrighted television characters and trademarks (NBC / *The Office* / Dunder Mifflin). They are not licensed for this product.

## GrokBotTech companions (stationary only)

| File | Use | Source | Notes |
| --- | --- | --- | --- |
| `public/sprites/companions/bunbot.png` | Desk companion + detail panel | [dinguspingus84acl/new-bot-hq](https://github.com/dinguspingus84acl/new-bot-hq/tree/main/assets) | Same-owner asset; no LICENSE file in that repo |
| `scanslime.png` | same | same | same |
| `foldfox.png` | same | same | same |
| `voltbug.png` | same | same | same |
| `archivowl.png` | same | same | same |

**Not used:** `runner-coord.png`, `runner-deep.png`, `runner-cluster.png`, `runner-watch.png`, `runner-lab.png`, `floor.jpg`. The runners are single static frames, not donor-compatible directional sprite sheets. `floor.jpg` is the old GrokBot office photo and is not used.

## Sounds

Donor `src/sounds.ts` synthesizes 8-bit cues in the browser (no bundled audio files). Background hum and SFX are **off by default**.
