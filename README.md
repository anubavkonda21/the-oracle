# THE ORACLE

> You don’t need to know what’s inside.
> You only need to know how to ask.

A browser-playable mystery game for the Quriosity quantum game-development competition. Its subject is the **Deutsch–Jozsa algorithm**, taught the way the competition asks: *play first, understand later*.

## Status

**Checkpoint 02 — quantum engine.** The foundation and the quantum state-vector engine are in place. There is deliberately **no Oracle, no Deutsch–Jozsa and no gameplay yet**, and the game does not use the engine yet; `src/story/`, `src/data/` and `src/audio/` are empty placeholders for later checkpoints.

What exists today:

- Main menu → `ENTER` → placeholder laboratory → `ESC` / `RETURN` back to the menu
- A design system (colour, type, motion tokens) shared by CSS and canvas code
- A responsive 1440 × 900 stage that scales to the window and stays sharp on high-density screens
- A standalone quantum state-vector simulator in `src/quantum/` (see [Checkpoint 02](#checkpoint-02--quantum-engine))

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
├── quantum/                the state-vector simulator — imports nothing from the game
├── utils/                  small pure helpers
└── story/ data/ audio/     reserved for later checkpoints
tests/
├── game/                   tokens, display maths, paper grain
├── quantum/                complex numbers, states, gates, measurement, independence
└── utils/                  colour, formatting, seeded random
```

### Design tokens

Colours, font stacks and motion timings are declared twice — in `src/styles/tokens.css` for the DOM and in `src/game/config/designTokens.ts` for the canvas — and a unit test fails if the two disagree. Change both together, and never write a raw colour anywhere else.

The palette is meant to progress with the game: off-white, black and warm grey for the classical world; signal red, sparingly, for uncertainty and Oracle activity; quantum indigo held back entirely until Quantum Mode exists.

## Checkpoint 02 — Quantum Engine

`src/quantum/` is a small, dependency-free state-vector simulator. It performs the real linear algebra: nothing about quantum behaviour is faked or hardcoded. It imports nothing from Phaser, the DOM or the game (a test enforces this), and the game does not call it yet.

**Deutsch–Jozsa has NOT yet been implemented.** Neither has the Oracle, any Boolean function, or any gate acting on more than one qubit. Those belong to later checkpoints.

```ts
import { Gates, QuantumState, basisStateLabel } from './quantum';

const state = QuantumState.basis(2, 0);   // |00⟩
state.applyGate(Gates.H, 0);              // (|00⟩ + |10⟩) / √2 — qubit 0 is the left character
state.applyGate(Gates.H, 1);              // (|00⟩ + |01⟩ + |10⟩ + |11⟩) / 2
state.getProbabilities();                 // [0.25, 0.25, 0.25, 0.25]

const preview = state.sampleMeasurement(); // a possible result; the state is untouched
const outcome = state.measure();           // a result; the state has collapsed onto it
basisStateLabel(outcome, 2);               // e.g. "10"
```

### What it provides

| Area | Detail |
| --- | --- |
| Complex number arithmetic | `ComplexNumber`: `add`, `subtract`, `multiply`, `scale`, `conjugate`, `magnitude`, `magnitudeSquared`, tolerance-based `equals`; `fromReal`, `fromPolar`, and the constants `zero`, `one`, `i`. Immutable. |
| State-vector representation | `QuantumState` holds the 2ⁿ complex amplitudes of an n-qubit pure state (1 to 16 qubits). The amplitudes are the single source of truth. |
| Basis-state creation | `QuantumState.basis(qubitCount, basisIndex)`, and `QuantumState.fromAmplitudes([...])` for an arbitrary vector. A length that is not 2ⁿ is rejected. |
| Normalization | `normalize()` rescales to Σ\|αᵢ\|² = 1, preserving relative phases; `isNormalized()` checks it within a tolerance. A zero-norm vector throws instead of producing `NaN`. |
| I, X, Z and H gates | `Gates.I`, `Gates.X`, `Gates.Z`, `Gates.H`: each is a 2 × 2 complex matrix. The matrix is multiplied out in exactly one place. |
| Multi-qubit gate application | `state.applyGate(gate, targetQubit)` applies the matrix to every pair of amplitudes that differ only in the target qubit — equivalent to I ⊗ … ⊗ G ⊗ … ⊗ I. |
| Multi-qubit Hadamard | `state.applyHadamardAll()` applies `Gates.H` to each qubit in turn; there is no separate formula. |
| Probability calculation | `state.getProbabilities()` returns \|αᵢ\|² for each basis state, computed from the amplitudes on demand. |
| Measurement | `state.measure()` samples a basis index by cumulative-probability sampling and collapses the state onto it. **Destructive.** |
| Non-destructive sampling | `state.sampleMeasurement()` samples the same distribution and leaves the state unchanged. |
| Basis-state formatting | `basisStateLabel(index, qubitCount)`, e.g. `basisStateLabel(5, 3)` → `"101"`. |

Gates and measurement change a `QuantumState` in place and return it for chaining; `clone()` keeps a copy. Comparisons use the shared tolerance `QUANTUM_EPSILON` (1e-10); amplitudes themselves are never rounded.

### Qubit-order convention

**Qubit 0 is the leftmost character of a basis label, and so the most significant bit of the basis index.** A basis index is its label read as a binary number:

| Index | 2 qubits | Index | 3 qubits |
| --- | --- | --- | --- |
| 0 | `00` | 5 | `101` — qubit 0 = 1, qubit 1 = 0, qubit 2 = 1 |
| 1 | `01` | 6 | `110` |
| 2 | `10` | 7 | `111` |
| 3 | `11` | | |

So `QuantumState.basis(2, 0).applyGate(Gates.H, 0)` is (|00⟩ + |10⟩)/√2. State creation, gate application, measurement results and labels all follow this one convention, and the Oracle and Deutsch–Jozsa must keep it.

### Measurement and randomness

Both measurement methods take the probabilities from the amplitudes and draw from them with `Math.random`. They accept an optional random source, `state.measure(random)`, so a test or a replay can supply its own. Measuring a state that is not normalised throws rather than guessing what was meant.

### Quantum unit tests

`tests/quantum/` holds 188 tests of mathematical behaviour, not of mere existence:

- **Complex numbers** — arithmetic identities, polar form, conjugates, tolerance.
- **States** — every one- and two-qubit basis state, vector sizes, invalid dimensions, normalization, zero-norm handling.
- **Gates** — the truth table of each gate, unitarity, linearity, `H·H = I`, `HZH = X`, and every gate on every qubit of 2-, 3- and 4-qubit states checked against the full Kronecker-product matrix built independently in the test.
- **Hadamard** — uniform superpositions up to 6 qubits and the sign pattern (−1)^(x·y) on every 3-qubit basis state.
- **Measurement** — certain outcomes, sampled distributions using real randomness with wide margins, collapse, non-collapse, and the sampler's exact boundaries using an injected random source.
- **Independence** — the engine imports nothing outside its folder and exports only its intended API.

## Known limits

- **Desktop only.** Below a 900px-wide viewport the game is replaced by a notice.
- **Secondary text contrast.** Warm grey `#6F6D67` on the background `#F1EFE9` measures 4.4992:1 — effectively the 4.5:1 WCAG AA threshold, but a hair under it. It is used only on the plain background, never on the darker panel surface.
- **Bundle size.** Phaser is included whole (about 320 kB gzipped). A trimmed custom Phaser build is a later optimisation.
- **Quantum engine scope.** Only single-qubit gates exist, and measurement always measures every qubit. The Oracle will need an operation that acts on several qubits at once; measuring only some qubits is not supported yet.

## Licences

Inter and JetBrains Mono are distributed under the SIL Open Font License 1.1; the licence texts are in `src/assets/fonts/`.
