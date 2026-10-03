# THE ORACLE

> You don’t need to know what’s inside.
> You only need to know how to ask.

A browser-playable mystery game for the Quriosity quantum game-development competition. Its subject is the **Deutsch–Jozsa algorithm**, taught the way the competition asks: *play first, understand later*.

## Status

**Checkpoint 01 — foundation.** The project, scene architecture and visual identity are in place. There is deliberately **no quantum simulator, no Oracle logic and no gameplay yet**; `src/quantum/`, `src/story/`, `src/data/` and `src/audio/` are empty placeholders for later checkpoints.

What exists today:

- Main menu → `ENTER` → placeholder laboratory → `ESC` / `RETURN` back to the menu
- A design system (colour, type, motion tokens) shared by CSS and canvas code
- A responsive 1440 × 900 stage that scales to the window and stays sharp on high-density screens

## Stack

TypeScript (strict) · Vite · Phaser 3 · Vitest · plain HTML and CSS. No UI framework, no backend. The build is a static site that can be served from any path (Vercel, Netlify, GitHub Pages).

## Getting started

```bash
npm install
npm run dev
```

The dev server runs at <http://localhost:5273>.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Typecheck, then build the static site into `dist/` |
| `npm run preview` | Serve the built site locally |
| `npm run test` | Run the unit tests once |
| `npm run test:watch` | Run the unit tests in watch mode |
| `npm run typecheck` | Typecheck without building |

## How it is put together

The game is drawn in two layers that scale together:

- **Canvas (Phaser)** — the world: the machine, and later everything the player experiments on.
- **Interface (HTML/CSS)** — all text and controls. Real DOM keeps type sharp at any size and makes every control focusable and keyboard-operable.

Both are sized from the same 1440 × 900 design frame: Phaser fits the canvas to the window, and CSS uses a matching "stage unit" (`--u`), so the two never drift apart.

```
src/
├── main.ts                 entry point
├── game/
│   ├── config/             design tokens, display maths, scene keys, Phaser config
│   ├── scenes/             Boot → Preload → MainMenu ⇄ Laboratory
│   ├── entities/           things on the canvas (the placeholder machine)
│   ├── systems/            shared services, font loading, desktop gate
│   ├── ui/                 the HTML layer: components and per-scene views
│   └── effects/            paper grain, scene fade, motion preference
├── styles/                 tokens → fonts → base → shell → components → views
├── assets/fonts/           self-hosted Inter and JetBrains Mono (SIL OFL)
├── utils/                  small pure helpers
└── quantum/ story/ data/ audio/    reserved for later checkpoints
tests/
├── game/                   tokens, display maths, paper grain
└── utils/                  colour, formatting, seeded random
```

### Design tokens

Colours, font stacks and motion timings are declared twice — in `src/styles/tokens.css` for the DOM and in `src/game/config/designTokens.ts` for the canvas — and a unit test fails if the two disagree. Change both together, and never write a raw colour anywhere else.

The palette is meant to progress with the game: off-white, black and warm grey for the classical world; signal red, sparingly, for uncertainty and Oracle activity; quantum indigo held back entirely until Quantum Mode exists.

## Known limits

- **Desktop only.** Below a 900px-wide viewport the game is replaced by a notice.
- **Secondary text contrast.** Warm grey `#6F6D67` on the background `#F1EFE9` measures 4.4992:1 — effectively the 4.5:1 WCAG AA threshold, but a hair under it. It is used only on the plain background, never on the darker panel surface.
- **Bundle size.** Phaser is included whole (about 320 kB gzipped). A trimmed custom Phaser build is a later optimisation.

## Licences

Inter and JetBrains Mono are distributed under the SIL Open Font License 1.1; the licence texts are in `src/assets/fonts/`.
