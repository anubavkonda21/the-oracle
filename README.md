# THE ORACLE

> You don't need to know what's inside. You only need to know how to ask.

A browser-playable educational quantum puzzle game for the Quriosity competition that teaches the **Deutsch–Jozsa algorithm** through interactive investigation.

**Live demo:** <https://the-oracle-mu.vercel.app>

<!-- TODO: add gameplay screenshot/GIF -->
[TODO: add gameplay screenshot/GIF]

---

## Gameplay & 5-Level Progression

Each level presents a black-box Oracle implementing a hidden Boolean function $f(x) \to \{0, 1\}$ promised to be either **CONSTANT** (identical output for every input) or **BALANCED** (0 for half of all inputs, 1 for the other half).

1. **Level 1 — Foundation (`2-bit`, 4 inputs):** Classify 2 consecutive Oracles within 3 classical queries each.
2. **Level 2 — Uncertainty (`4-bit`, 16 inputs):** Classify 2 consecutive Oracles within 5 classical queries each.
3. **Level 3 — The Scale (`6-bit`, 64 inputs):** A 64-input Oracle with an 8-query classical budget—showing why one-by-one classical probing cannot guarantee certainty at scale.
4. **Level 4 — Quantum Probe (`6-bit`, 64 inputs):** Unlocks the **Quantum Probe** (1 quantum query per box alongside 8 classical queries). Classify 3 consecutive Oracles.
5. **Level 5 — The Gauntlet (`6-bit`, 64 inputs):** Classify 5 consecutive Oracles with a 15-second timer per box, 1 life, 8 classical queries, and 1 quantum query.

An **Endless Sandbox** mode is also defined in `levelProgression.ts` for continuous 6-bit play with classical and quantum tools.

### Classical Investigation vs. Quantum Interference

- **Classical Investigation:** Toggle individual input bits (click or type `0`/`1`) and query the Oracle one input at a time. Repeated queries are recalled from the experiment record without spending budget. After 8 queries, the **Oracle Constraint** (`CONSTANT` vs. `BALANCED`) is disclosed.
- **Quantum Mode (`FIRE QUANTUM PROBE`):** Runs the Deutsch–Jozsa circuit on a single superposition across all $2^n$ inputs. In `QuantumScene`, the state steps through preparation, superposition, oracle query, interference, and measurement—lighting the `000000` detector when the Oracle is **CONSTANT** (constructive interference) or cancelling it and scattering to a non-zero state when **BALANCED** (destructive interference).
- **Procedural Web Audio:** `AudioManager` (`src/game/audio/AudioManager.ts`) synthesizes all audio in real time via the browser Web Audio API with zero external audio files—including a low-frequency laboratory ambience loop, bit-toggle ticks, mechanical query thuds, rising quantum probe sweeps, constructive bell tones, phase-cancel whooshes, and level-clear/error cues.

---

## How Deutsch–Jozsa Is Modeled (`src/quantum/`)

`src/quantum/` is a standalone, dependency-free TypeScript state-vector simulator (no Phaser or DOM imports).

- **State vectors & gates (`state.ts`, `gates.ts`, `complex.ts`):** Represents $n$-qubit pure states ($2^n$ complex amplitudes, up to 16 qubits) with `I`, `X`, `Z`, and `H` gates, basis permutations (`applyBasisPermutation`), marginal probabilities, and projective measurement (`measure`, `measureQubits`, `sampleMeasurement`).
- **Boolean functions & Oracles (`booleanFunction.ts`, `oracle.ts`):** `createOracle(f)` builds the unitary bit-flip oracle $U_f |x\rangle|y\rangle = |x\rangle|y \oplus f(x)\rangle$ on $n + 1$ qubits. The hidden function is kept private; `applyTo(state)` increments `queryCount` on each call.
- **Deutsch–Jozsa circuit (`deutschJozsa.ts`):** `runDeutschJozsa(oracle)` prepares $|0\dots 0\rangle|0\rangle$, applies Hadamards to the input register, sets the ancilla to $|-\rangle = (|0\rangle - |1\rangle)/\sqrt{2}$, applies `oracle.applyTo(state)` **once** (phase kickback writes $(-1)^{f(x)}$ onto each input's amplitude), applies Hadamards again, and measures only the input register. Measuring all zeros yields `'constant'`; any non-zero measurement yields `'balanced'`. Promise-breaking functions are rejected from the state vector's zero-probability check.

---

## Tech Stack & Architecture

- **Tech stack:** TypeScript (strict), Vite, Phaser 3, Vitest, HTML/CSS (self-hosted Inter & JetBrains Mono fonts).
- **Dual-layer stage:** Phaser 3 renders the canvas world (`BootScene` → `PreloadScene` → `MainMenuScene` → `LaboratoryScene` ⇄ `QuantumScene` → `RevealScene` → `CreditsScene`), while a synchronized HTML/CSS layer (`src/game/ui/`) renders crisp typography and keyboard-accessible controls inside a shared `1440 × 900` stage frame.

```text
src/
├── main.ts                 Entry point & Phaser boot
├── quantum/                Pure state-vector simulator, bit-flip oracle & Deutsch–Jozsa
├── game/
│   ├── audio/              AudioManager (procedural Web Audio API synthesizer)
│   ├── config/             Design tokens, display scaling, scene keys, Phaser & oracle configs
│   ├── effects/            Paper grain, scene fade, motion preferences
│   ├── entities/           OracleMachine canvas entity & procedural texture
│   ├── scenes/             Boot, Preload, MainMenu, Laboratory, Quantum, Reveal, Credits
│   ├── systems/            Level progression, keyboard input, font loader, oracle investigation
│   └── ui/                 DOM helpers, reusable controls & per-scene HTML views
├── styles/                 CSS tokens, fonts, layout shell, components & scene views
├── assets/fonts/           Self-hosted Inter and JetBrains Mono (SIL OFL)
└── utils/                  Color contrast, formatting & seeded PRNG helpers
tests/
├── quantum/                Complex math, states, gates, measurement, oracle & Deutsch–Jozsa tests
├── game/                   Design tokens, display math, progression, oracle investigation & UI tests
└── utils/                  Utility unit tests
```

---

## Local Setup & Scripts

```bash
npm install
npm run dev
```

The development server starts at <http://localhost:5273>.

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run typecheck` | Run TypeScript typechecking (`tsc --noEmit`) |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run build` | Typecheck and build the production bundle into `dist/` |
| `npm run preview` | Preview the built `dist/` bundle locally |
