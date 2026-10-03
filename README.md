# THE ORACLE

> You don’t need to know what’s inside.
> You only need to know how to ask.

A browser-playable mystery game for the Quriosity quantum game-development competition. Its subject is the **Deutsch–Jozsa algorithm**, taught the way the competition asks: *play first, understand later*.

## Status

**Checkpoint 04 — first playable Oracle prototype.** The game can now be played in its simplest form: give the machine a 6-bit input, watch it work, read its one-bit answer, and see the exchange added to an experiment log. There is deliberately **no investigation to complete, no quantum mode, no quantum visuals and no story yet**; `src/story/`, `src/data/` and `src/audio/` are empty placeholders for later checkpoints.

What exists today:

- Main menu → `ENTER` → the laboratory → `ESC` / `RETURN` back to the menu
- A playable loop in the laboratory: binary input → ask → processing → output → experiment log (see [Checkpoint 04](#checkpoint-04--first-playable-oracle-prototype))
- A design system (colour, type, motion tokens) shared by CSS and canvas code
- A responsive 1440 × 900 stage that scales to the window and stays sharp on high-density screens
- A standalone quantum state-vector simulator in `src/quantum/` (see [Checkpoint 02](#checkpoint-02--quantum-engine))
- Boolean functions, a quantum oracle and the Deutsch–Jozsa algorithm, run on that simulator (see [Checkpoint 03](#checkpoint-03--quantum-oracle-and-deutschjozsa))

## Checkpoint history

The game is built in numbered checkpoints, one commit each. Every checkpoint leaves the project building, typechecking and passing all of its tests.

| Checkpoint | Commit | What it added | Tests after it |
| --- | --- | --- | --- |
| [01 — Foundation](#checkpoint-01--foundation) | [`255b82c`](https://github.com/anubavkonda21/the-oracle/commit/255b82c2be80722d53918c493b68bd2c45a91167) `chore: initialize The Oracle project` | Vite + TypeScript + Phaser 3 + Vitest project; Boot, Preload, Main Menu and Laboratory scenes; the visual identity and design system; the responsive stage. | 61 |
| [02 — Quantum Engine](#checkpoint-02--quantum-engine) | [`e305f67`](https://github.com/anubavkonda21/the-oracle/commit/e305f67a67f58e4e5bdf422589906e6fd1c97bb7) `feat: add quantum state-vector engine` | Complex numbers; n-qubit state vectors; I, X, Z and H gates on any qubit; probabilities; destructive measurement and non-destructive sampling. | 249 |
| [03 — Quantum Oracle and Deutsch–Jozsa](#checkpoint-03--quantum-oracle-and-deutschjozsa) | [`0f3ae8d`](https://github.com/anubavkonda21/the-oracle/commit/0f3ae8d64611bc037f37ca670724fbc6a55501dc) `feat: add quantum oracle and Deutsch–Jozsa algorithm` | Boolean functions; the bit-flip oracle; the Deutsch–Jozsa algorithm; basis permutations and partial measurement on the state vector. | 398 |
| [04 — First Playable Oracle Prototype](#checkpoint-04--first-playable-oracle-prototype) | [`cc1f928`](https://github.com/anubavkonda21/the-oracle/commit/cc1f928cd2fe551ff337c719010d6e1c6079c4eb) `feat: add first playable oracle prototype` | The game-level Oracle; the 6-bit input; the machine's processing and answer; the experiment log. | 478 |

Still to come: the full investigation, quantum mode, quantum visuals, story and sound. Commits that only touch documentation are not listed here; the complete log is on the [commits page](https://github.com/anubavkonda21/the-oracle/commits/main).

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
│   ├── entities/           things on the canvas (the machine)
│   ├── systems/            shared services, keyboard, font loading, desktop gate
│   │   └── oracle/         the machine's game logic: the Oracle, the input model, the prototype rule
│   ├── ui/                 the HTML layer: components and per-scene views
│   └── effects/            paper grain, scene fade, motion preference
├── styles/                 tokens → fonts → base → shell → components → oracle → views
├── assets/fonts/           self-hosted Inter and JetBrains Mono (SIL OFL)
├── quantum/                the simulator, the oracle and Deutsch–Jozsa — imports nothing from the game
├── utils/                  small pure helpers
└── story/ data/ audio/     reserved for later checkpoints
tests/
├── game/                   tokens, display maths, paper grain, the game Oracle, input model, player-facing text
├── quantum/                complex numbers, states, gates, measurement, oracle, Deutsch–Jozsa, independence
└── utils/                  colour, formatting, seeded random
```

### Design tokens

Colours, font stacks and motion timings are declared twice — in `src/styles/tokens.css` for the DOM and in `src/game/config/designTokens.ts` for the canvas — and a unit test fails if the two disagree. Change both together, and never write a raw colour anywhere else.

The palette is meant to progress with the game: off-white, black and warm grey for the classical world; signal red, sparingly, for uncertainty and Oracle activity; quantum indigo held back entirely until Quantum Mode exists.

## Checkpoint 01 — Foundation

The first commit set up the project and everything the game is built on. It contains no quantum code and no gameplay. The architecture it established is described under [How it is put together](#how-it-is-put-together), above.

| Area | Detail |
| --- | --- |
| Project | Vite, strict TypeScript, Phaser 3 and Vitest, with `dev`, `build`, `preview`, `test`, `test:watch` and `typecheck` scripts. The build is a static site with relative paths. |
| Scenes | `BootScene` → `PreloadScene` → `MainMenuScene` ⇄ `LaboratoryScene`. The laboratory is a placeholder: a matte black machine drawn in code, and an empty HUD. |
| Stage | A 1440 × 900 design frame that scales to the window without cropping, rendered at the screen's pixel density so it stays sharp. Checked at 1920 × 1080, 1366 × 768 and 1280 × 720. |
| Visual identity | Warm off-white paper with a faint procedural grain, near-black type, warm grey for secondary text, and signal red used only for status. No gradients, glows or neon. |
| Typography | Inter for human text and JetBrains Mono for machine text, both self-hosted. |
| Design system | Colour, font and motion tokens declared in CSS and mirrored in TypeScript, with a test that fails if they drift apart. |
| Interface components | A control button (primary and quiet, with hover, pressed, disabled and focus states), a panel and a status indicator, all real HTML above the canvas. |
| Motion | 180ms control feedback and a 480ms fade between scenes, both switched off under `prefers-reduced-motion`. |
| Accessibility | Semantic HTML, visible keyboard focus, every action reachable by keyboard, focus carried across scene changes, and state never shown by colour alone. |
| Small screens | Below 900px wide the game is replaced by the notice "THE ORACLE IS DESIGNED FOR A DESKTOP EXPERIMENT." |

Its 61 tests cover the design tokens (including CSS/TypeScript parity and text contrast), the display scaling maths, the paper-grain generator and the small utilities.

## Checkpoint 02 — Quantum Engine

`src/quantum/` is a small, dependency-free state-vector simulator. It performs the real linear algebra: nothing about quantum behaviour is faked or hardcoded. It imports nothing from Phaser, the DOM or the game (a test enforces this), and the game does not call it yet.

This section describes the engine as built in Checkpoint 02, when Deutsch–Jozsa, the Oracle and Boolean functions had not yet been implemented. They were added in [Checkpoint 03](#checkpoint-03--quantum-oracle-and-deutschjozsa), below, together with two extensions to `QuantumState` that the algorithm needed.

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

So `QuantumState.basis(2, 0).applyGate(Gates.H, 0)` is (|00⟩ + |10⟩)/√2. State creation, gate application, measurement results, labels, the Oracle and Deutsch–Jozsa all follow this one convention.

### Measurement and randomness

Both measurement methods take the probabilities from the amplitudes and draw from them with `Math.random`. They accept an optional random source, `state.measure(random)`, so a test or a replay can supply its own. Measuring a state that is not normalised throws rather than guessing what was meant.

### Quantum unit tests

`tests/quantum/` tests mathematical behaviour, not mere existence. The engine itself is covered by:

- **Complex numbers** — arithmetic identities, polar form, conjugates, tolerance.
- **States** — every one- and two-qubit basis state, vector sizes, invalid dimensions, normalization, zero-norm handling.
- **Gates** — the truth table of each gate, unitarity, linearity, `H·H = I`, `HZH = X`, and every gate on every qubit of 2-, 3- and 4-qubit states checked against the full Kronecker-product matrix built independently in the test.
- **Hadamard** — uniform superpositions up to 6 qubits and the sign pattern (−1)^(x·y) on every 3-qubit basis state.
- **Measurement** — certain outcomes, sampled distributions using real randomness with wide margins, collapse, non-collapse, and the sampler's exact boundaries using an injected random source.
- **Independence** — the engine imports nothing outside its folder and exports only its intended API.

## Checkpoint 03 — Quantum Oracle and Deutsch–Jozsa

Given a Boolean function f(x) → {0, 1} that is promised to be either **constant** (the same output for every input) or **balanced** (0 for exactly half the inputs, 1 for the rest), the engine decides which, by running the Deutsch–Jozsa circuit on the state-vector simulator. The verdict is read from the simulated measurement. It is never looked up from the function.

Not implemented yet: gameplay, the classical investigation, quantum visuals, story and dialogue. The game still does not call the engine.

```ts
import { createOracle, createParityFunction, runDeutschJozsa } from './quantum';

const f = createParityFunction(3, 0b101);   // balanced: parity of the first and last bit
const result = runDeutschJozsa(createOracle(f));

result.verdict;        // 'balanced'
result.measuredLabel;  // '101'
result.oracleQueries;  // 1
```

### Boolean functions — `booleanFunction.ts`

A `BooleanFunction` is `{ inputQubitCount, evaluate(input) }`, where `input` is an n-bit integer whose leftmost bit belongs to qubit 0.

| Factory | Gives |
| --- | --- |
| `createConstantFunction(n, value)` | A constant function. |
| `createParityFunction(n, mask, invert?)` | A balanced function: the parity of the bits of x selected by a non-zero `mask`. |
| `createRandomBalancedFunction(n, random?)` | A balanced function drawn uniformly from *all* balanced functions of n bits, not only parities. |
| `createFunctionFromTruthTable(outputs)` | Any function at all, including ones that break the promise. |
| `createBooleanFunction(n, rule)` | A function from an arbitrary rule. |

`truthTable(f)` and `classifyByTruthTable(f)` are the **classical** brute-force route: 2ⁿ evaluations, returning `'constant'`, `'balanced'` or `'neither'`. They exist as ground truth to check the quantum answer against. The Deutsch–Jozsa code never calls them.

### The oracle — `oracle.ts`

`createOracle(f)` builds the standard bit-flip oracle on n + 1 qubits:

> U_f |x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩

The input register |x⟩ is qubits 0 … n−1 and the ancilla |y⟩ is the last qubit, so |x⟩|y⟩ has basis index 2x + y. U_f only relabels basis states and undoes itself, so it is unitary for any f.

The oracle is a black box. It exposes `applyTo(state)`, its size and a `queryCount`; the function's outputs are held in a runtime-private field and cannot be read back. Each `applyTo` is one query.

### The algorithm — `deutschJozsa.ts`

`runDeutschJozsa(oracle, random?)` is handed only the oracle, never the function. It performs these steps on a real state vector:

1. Prepare |0…0⟩|0⟩.
2. Hadamard every input qubit: an equal superposition of all 2ⁿ inputs.
3. Put the ancilla in |−⟩ = (|0⟩ − |1⟩)/√2 with X then H.
4. Apply the oracle **once**.
5. Phase kickback: with the ancilla in |−⟩, flipping it when f(x) = 1 multiplies that term by −1. The ancilla is unchanged and each input's amplitude now carries the sign (−1)^f(x). Nothing in the code applies these signs; they are what the oracle does to this state.
6. Hadamard every input qubit again. The amplitude of |0…0⟩ becomes (1/2ⁿ) Σₓ (−1)^f(x): ±1 if f is constant, 0 if f is balanced, because the signed terms either all agree or cancel exactly.
7. Measure the input register only. The ancilla is not measured.
8. All zeros → `'constant'`. Anything else → `'balanced'`.

The algorithm does not evaluate f on every input and read off the answers: a measurement yields a single n-bit string. The oracle is applied once, to a superposition, and interference turns one global property of f into a certain measurement result. Classically, certainty can take 2ⁿ⁻¹ + 1 evaluations.

The result carries `verdict`, `measuredInput`, `measuredLabel`, `inputProbabilities` (the distribution just before measuring), `oracleQueries` (counted by the oracle, not assumed) and `steps` — an independent copy of the state after each stage, for inspection and for later visualisation.

**If the promise is broken** — f is neither constant nor balanced — all zeros is neither certain nor impossible and a verdict would be meaningless, so `runDeutschJozsa` throws. It detects this from the state vector, not by inspecting f.

### Extensions to `QuantumState`

The Checkpoint 02 engine could only apply single-qubit gates and measure every qubit at once. Two additions were needed; nothing existing changed.

| Method | Purpose |
| --- | --- |
| `applyBasisPermutation(permutation)` | Sends each basis state \|i⟩ to \|π(i)⟩. This is how the oracle, an operation spanning all n + 1 qubits, is applied. A mapping that is not one-to-one is rejected, since it would not be unitary. |
| `getMarginalProbabilities(qubits)` | The probabilities of each result of measuring only the listed qubits. |
| `measureQubits(qubits, random?)` | Measures only the listed qubits; the rest keep their superposition and relative phases. **Destructive.** |

### Tests

`tests/quantum/` holds 337 tests; at Checkpoint 03 the whole project had 398. The Checkpoint 03 additions:

- **Boolean functions** — every factory, validation, and the counts of constant, balanced and other functions for 1 to 3 bits (2/2/0, 2/6/8, 2/70/184).
- **Oracle** — U_f on every basis state of all 256 three-bit functions; self-inverse, norm-preserving and linear; phase kickback with the ancilla in |−⟩, no effect with it in |+⟩; query counting; nothing about f can be read from it.
- **Deutsch–Jozsa** — checked against brute force on **every** promised function of 1 to 4 bits (4, 8, 72 and 12,872 functions); every parity function of 1 to 5 bits must measure exactly its own mask; random balanced functions up to 10 bits; the 15-bit maximum; each of the eight steps inspected on the recorded states; every promise-breaking function of 2 and 3 bits must be refused.
- **Provenance of the verdict** — the algorithm makes exactly one query, never calls `evaluate`, ignores metadata attached to a function, works through a hand-written oracle, and its source file neither imports the Boolean-function module nor mentions `evaluate`.
- **Basis permutations and partial measurement** — against the X gate and a controlled-NOT, on product and entangled states, with real randomness and with injected random sources.

Eighteen deliberate bugs were introduced one at a time (an oracle flipping the wrong bit, an unprepared ancilla, an inverted or hardcoded verdict, a double query, a missing promise check, and others); the tests caught every one.

## Checkpoint 04 — First Playable Oracle Prototype

The first version of the game that can be played. In the laboratory the player:

1. sets a 6-bit binary input, by clicking bits or typing `0` and `1`;
2. asks the machine, with the `ASK` control or `Enter`;
3. watches the machine work for about a second;
4. reads its one-bit answer in the machine's aperture;
5. sees the exchange added to the experiment log, as `QUERY_001`, `QUERY_002`, …;
6. changes the input and asks again.

It is a prototype. There is nothing to solve or submit yet, no level progression, and no quantum mode.

### Two different oracles

| | Game Oracle | Quantum oracle |
| --- | --- | --- |
| Where | `src/game/systems/oracle/GameOracle.ts` | `src/quantum/oracle.ts` |
| What it is | The machine the player operates | A unitary operation on a state vector |
| How it is asked | One binary string at a time | Once, on a superposition |
| Used by | The laboratory, now | A later quantum mode |

Both are built from the same kind of `BooleanFunction`, so the function a player probes by hand is one the quantum algorithm can later be run against. Nothing was duplicated, and the quantum engine was not changed.

### The game Oracle

`GameOracle` accepts a binary string, checks that it is the right length and contains only `0` and `1`, evaluates the hidden function, records the query and returns it. It exposes the history and the number of queries — and nothing about the function, which is held in a runtime-private field.

The prototype's function is fixed (`createPrototypeOracle()` in `prototypeOracle.ts`), not random, so every session behaves the same and a bug can be reproduced. Replacing that one function changes the machine without touching the interface.

### What the player sees

Nothing in the interface names a concept the player has not met. The words *constant*, *balanced*, *quantum*, *superposition*, *phase*, *Hadamard* and *Deutsch–Jozsa* appear nowhere the player can read, and a test scans every string in the game layer to keep it that way.

| Control | Mouse | Keyboard |
| --- | --- | --- |
| Set a bit | Click it | `0` / `1` types at the cursor; `Space` flips the focused bit |
| Move the cursor | Click a bit | `←` `→`, or `Tab` between bits |
| Undo a digit | — | `Backspace` |
| Ask the machine | `ASK` | `Enter` |
| Leave | `RETURN` | `Esc` |

While the machine is working, the input and `ASK` are unavailable and the status reads `PROCESSING`. They stay focusable, so a keyboard user is not thrown out of the control they just pressed.

### Two engineering notes

- **Key presses come from the browser, not from Phaser.** Phaser's keyboard plugin re-emits earlier presses when several key events fall within one frame, which entered a digit more than once at low frame rates. `systems/keyboard.ts` listens to `keydown` directly: one press, one event.
- **The machine answers on real time.** Phaser's clock slows down when frames are scarce, so a one-second wait could take a minute in a throttled browser. The answer is scheduled with a real timer (`StageScene.afterDelay`); only the animation is frame-driven.

### Tests

80 new tests, 478 in the project:

- **Game Oracle** — answers match the hidden function on every input; length and character validation; the record of queries and its immutability; nothing about the function is exposed.
- **Input model** — typing, erasing, toggling and cursor movement, including the edges.
- **Prototype machine** — identical behaviour in every session, pinned to a fingerprint of all 64 answers.
- **Keyboard filter** — handled presses and browser shortcuts are left alone.
- **Player-facing text** — no unrevealed term in any string of the game layer or the page.

The interface itself was exercised in a browser: typing, clicking, focus order, the processing lock, 30 queries in a row, both ways out, and the layout from 900px to 1920px wide.

## Known limits

- **Desktop only.** Below a 900px-wide viewport the game is replaced by a notice.
- **Secondary text contrast.** Warm grey `#6F6D67` on the background `#F1EFE9` measures 4.4992:1 — effectively the 4.5:1 WCAG AA threshold, but a hair under it. It is used only on the plain background, never on the darker panel surface.
- **Bundle size.** Phaser is included whole (about 320 kB gzipped). A trimmed custom Phaser build is a later optimisation.
- **Quantum engine scope.** Multi-qubit operations are limited to permutations of basis states, which is all an oracle needs; there is no general multi-qubit gate (an arbitrary controlled rotation, say).
- **Simulating the oracle is not free.** Building U_f evaluates f on all 2ⁿ inputs, because a simulator must know the whole unitary. That is the cost of simulating a quantum computer on a classical one; the algorithm itself still makes a single query.
- **Prototype scope.** The machine has one fixed hidden rule and the laboratory has no goal to reach. The experiment log is not saved: leaving the laboratory clears it.
- **Log scrolling.** The log draws no scrollbar. It follows its newest entry by itself; older entries are reached with the wheel, a trackpad, or the arrow keys once it has focus.
- **Deterministic by nature.** Under the promise, Deutsch–Jozsa is never wrong, so repeated runs on the same function always agree on the verdict. For some balanced functions the measured bit string varies between runs; it is just never all zeros.

## Licences

Inter and JetBrains Mono are distributed under the SIL Open Font License 1.1; the licence texts are in `src/assets/fonts/`.
