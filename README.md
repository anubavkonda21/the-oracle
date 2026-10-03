# THE ORACLE

> You don’t need to know what’s inside.
> You only need to know how to ask.

A browser-playable mystery game for the Quriosity quantum game-development competition. Its subject is the **Deutsch–Jozsa algorithm**, taught the way the competition asks: *play first, understand later*.

## Status

**Checkpoint 07 — The Promise.** Part-way through the investigation the laboratory discloses the one thing that is known about the machine: it is guaranteed to obey one of two rules. The task changes from finding out everything the machine does to telling which of the two kinds it is, and the record now shows the evidence that bears on that. The player can put a conclusion on record; the laboratory says whether the record establishes it, never whether it is right — nothing in the game knows the answer. There is deliberately **no other way of asking yet, no quantum mode for the Oracle, no victory, no story and no sound**; `src/story/`, `src/data/` and `src/audio/` are empty placeholders for later checkpoints.

What exists today:

- Main menu → `ENTER` → the laboratory → `ESC` / `RETURN` back to the menu
- A playable loop in the laboratory: binary input → ask → processing → output → experiment log (see [Checkpoint 04](#checkpoint-04--first-playable-oracle-prototype))
- The classical investigation built on that loop: a map of all 64 possible inputs, a record that can be consulted, repeated inputs that use no query, and remarks that grow more pointed as the queries add up (see [Checkpoint 06](#checkpoint-06--classical-investigation))
- The promise, and the classification it sets: the constraint the machine is under, the evidence on record, and a conclusion that is judged against that evidence alone (see [Checkpoint 07](#checkpoint-07--the-promise))
- THE BOX: a sealed box, one action — OBSERVE — and one definite outcome, measured on the real state-vector engine (see [Checkpoint 05](#checkpoint-05--the-box))
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
| [05 — The Box](#checkpoint-05--the-box) | [`9c50cf9`](https://github.com/anubavkonda21/the-oracle/commit/9c50cf9e422db261975647672520c3799ccaf2da) `feat: add The Box, an experiential introduction to measurement` | THE BOX scene; a single-qubit superposition measured by the engine; the dark room; session tracking; the way from the laboratory and back. | 532 |

| [06 — Classical Investigation](#checkpoint-06--classical-investigation) | [`b1a7b9a`](https://github.com/anubavkonda21/the-oracle/commit/b1a7b9abafbf6f889a3280f0fbe72e78271e50c7) `feat: add the classical investigation` | The investigation and its record; the map of the input space; repeated inputs answered from the record, using no query; the laboratory's remarks as the queries add up. | 659 |

| [07 — The Promise](#checkpoint-07--the-promise) | [`834f375`](https://github.com/anubavkonda21/the-oracle/commit/834f375b0a9de8b10874ab3f21eb1e4971200ed0) `feat: add the promise and the classification objective` | The promise, checked against the hidden function; the constraint disclosed in the laboratory; a classifier that reasons from the record alone; the classification objective and a conclusion on record. | 832 |

Still to come: quantum mode, quantum visuals, story and sound. Commits that only touch documentation are not listed here; the complete log is on the [commits page](https://github.com/anubavkonda21/the-oracle/commits/main).

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
│   ├── scenes/             Boot → Preload → MainMenu ⇄ Laboratory ⇄ Box
│   ├── entities/           things on the canvas (the machine, the box)
│   ├── systems/            shared services, session, keyboard, font loading, desktop gate
│   │   ├── oracle/         the machine's game logic: the Oracle, the input model, the prototype rule;
│   │   │                   the investigation of it — the record, the input space, the remarks;
│   │   │                   and the promise — its check, the evidence, the classification
│   │   └── box/            THE BOX's logic: one qubit, prepared and measured on the quantum engine
│   ├── ui/                 the HTML layer: components and per-scene views
│   └── effects/            paper grain, scene fade, stage environment, motion preference
├── styles/                 tokens → fonts → base → shell → components → oracle → views → box
├── assets/fonts/           self-hosted Inter and JetBrains Mono (SIL OFL)
├── quantum/                the simulator, the oracle and Deutsch–Jozsa — imports nothing from the game
├── utils/                  small pure helpers
└── story/ data/ audio/     reserved for later checkpoints
tests/
├── game/                   tokens, display maths, paper grain, the game Oracle, input model, the investigation,
│                           the input space, the remarks, the promise, the evidence, the classification,
│                           THE BOX, session, player-facing text
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

Nothing in the laboratory names a concept the player has not met. The words *phase*, *Hadamard*, *qubit* and *Deutsch–Jozsa* appear nowhere the player can read. *Quantum* and *superposition* appear only in the short context of THE BOX (Checkpoint 05), after the player has observed. *Constant* and *balanced* appear only in the text of the constraint (Checkpoint 07), none of which is shown until the laboratory discloses it. A test scans every string in the game layer to keep it that way.

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

80 new tests, 478 in the project at this checkpoint:

- **Game Oracle** — answers match the hidden function on every input; length and character validation; the record of queries and its immutability; nothing about the function is exposed.
- **Input model** — typing, erasing, toggling and cursor movement, including the edges.
- **Prototype machine** — identical behaviour in every session, pinned to a fingerprint of all 64 answers.
- **Keyboard filter** — handled presses and browser shortcuts are left alone.
- **Player-facing text** — no unrevealed term in any string of the game layer or the page.

The interface itself was exercised in a browser: typing, clicking, focus order, the processing lock, 30 queries in a row, both ways out, and the layout from 900px to 1920px wide.

## Checkpoint 05 — The Box

THE BOX is an **experiential introduction**: something the player does and sees before anything is explained. It is **not the official competition problem statement**. The official problem remains the **Deutsch–Jozsa algorithm**, which the Oracle is building towards; THE BOX only prepares the intuition that observing a system changes what can be known about it.

### The experience

From the laboratory, `THE BOX` (or `B`) leads to a darker, quieter room with a single sealed box.

1. The box is sealed. Nothing says what is inside or what will happen. There is one action: `OBSERVE`.
2. On `OBSERVE`, everything is locked and the room holds still for a moment.
3. The measurement happens, once.
4. The shutter rises on one of two outcomes, pictured as the silhouette of a cat: `STILL` or `AWAKE`.
5. Three sentences of context appear.
6. `RETURN TO THE ORACLE` goes back to the laboratory, with the experiment log as it was left. `OBSERVE AGAIN` seals a new box.

The whole sequence takes about half a minute. There is no lecture, quiz or question, and no explanation before the player acts.

### Single-qubit superposition, measured for real

`BoxExperiment` (`src/game/systems/box/`) holds one qubit of the Checkpoint 02 engine:

```ts
QuantumState.basis(1, 0).applyGate(Gates.H, 0);   // (|0⟩ + |1⟩)/√2
```

- **Before measurement** the state is that superposition, with amplitude 1/√2 on each outcome and a probability of exactly one half for each. It stays that way through the held moment after `OBSERVE` is pressed.
- **The measurement** is the engine's own destructive `QuantumState.measure()`. The outcome is not drawn from `Math.random()` and attached to a picture; no file in the game layer calls `Math.random()` at all.
- **After measurement** the state has collapsed to |0⟩ or |1⟩, and that is what the box shows.
- **Replay** prepares a fresh superposition. Nothing is ordered or weighted: the first observation is not fixed, and one outcome does not influence the next.

### The context shown afterwards

> Before measurement, the system was described by a superposition of possible outcomes.
> Measurement produced one definite result.
> Schrödinger’s cat was a thought experiment, designed to expose the strange consequences of applying quantum ideas to everyday objects.

The wording is deliberate. The system "was described by" a superposition: that is a statement about the description, not a claim that a cat was two things at once. The result is attributed to measurement, not to being looked at, and nothing suggests that a mind causes it. The cat is the picture; the thing measured is one qubit.

It does not mention Hadamard gates, phase, the quantum oracle, Deutsch–Jozsa, or constant and balanced functions. Those come later.

### How it fits the game

- **A dark room.** Scenes now choose an environment. The dark one swaps the four classical colours for `#171717`, `#F1EFE9`, `#A8A59E` and `#5A5750`, so every existing component arrives dark without a variant of its own. There is no indigo yet.
- **Session only.** `GameSession` remembers, in memory, whether THE BOX has been observed; the laboratory's control then reads `THE BOX | OBSERVED`. Nothing is written to storage.
- **The laboratory resumes.** Returning from THE BOX keeps the machine, its log and the input. Returning from the main menu still starts a fresh experiment.
- **No audio.** The project has no audio system yet, so no sound hooks were added.

### Tests

54 new tests, 532 in the project:

- **The state before measurement** — amplitudes 1/√2 each, probabilities one half each, identical to the engine's `H|0⟩`, unchanged through the hold and by inspection.
- **Observation** — produces a measurement, collapses the state onto a valid basis state, and can only happen once per observation.
- **One at a time** — a second request during or after an observation is refused.
- **Replay** — both outcomes occur, about half the time each over 20,000 observations, with no influence from the previous outcome.
- **Provenance** — the outcome follows the engine's sampling for the same random draws; `BoxExperiment` never calls `Math.random()`.
- **Leaving and returning** — a box abandoned mid-observation is sealed and fair on re-entry; the Oracle's record is untouched; the laboratory resumes only when THE BOX asks it to.
- **The text** — nothing is explained before the player acts, and the context makes none of the claims it must not make.

## Checkpoint 06 — Classical Investigation

The laboratory becomes an investigation. The player still asks the machine about one input at a time, exactly as in Checkpoint 04, but the laboratory now keeps a proper record, shows how much of the input space that record leaves untouched, and never spends a query on a question it can already answer.

Nothing is explained. The aim is for the player to arrive, on their own, at the thought *"I've asked the machine several questions… but I still don't really know what it does"* — and then at *"how am I supposed to find out efficiently?"* That question is what a later checkpoint answers.

**Not here yet, on purpose:** any other way of asking. At this checkpoint there was no quantum mode, nothing to classify or submit, and no reveal; the words *constant*, *balanced*, *phase*, *Hadamard* and *Deutsch–Jozsa* appeared nowhere the player could read. ([Checkpoint 07](#checkpoint-07--the-promise) adds the reveal, the classification and the first two of those words.) The player is never asked to work out the machine's rule.

### What the laboratory shows

| Part | What it is |
| --- | --- |
| **Input space** | A panel beside the machine: `6 BITS`, `64 POSSIBLE INPUTS`, and an 8 × 8 map with one cell for every input, in counting order from `000000` (top left) to `111111` (bottom right). A cell is an empty outline until its input has been tested, and from then on shows the answer the way a bit of the input does — open for 0, filled for 1, with the digit printed in both. Four corner marks show the cell of the input being composed. Beneath it, `TESTED` and `UNTESTED` counts. |
| **Record line** | Under the input: `UNTESTED`, or `TESTED · QUERY_003 · OUTPUT 1`. It follows the input digit by digit, so the record can be consulted by dialling an input, without asking anything. |
| **Experiment log** | The same log, now the investigation's record. Its count reads `QUERIES USED`; the entry for the input being composed is ringed and tinted; an entry can be recalled (see below); and the column headings carry a rule, so entries scroll cleanly beneath them. |
| **Remarks** | One quiet line under the console that changes as the queries add up (see below). |

The input is shown three ways at once — as bits, as a place in the input space and as an entry in the log — and the three move together.

### A repeated input uses no query

When the player asks about an input that is already on record:

- the machine is **not asked**. It shows no activity, there is no processing wait, and the aperture keeps the last answer the machine actually gave;
- `QUERIES USED` does not change;
- the record line gains `· NO QUERY USED` and steps forward, the log scrolls to the original entry and marks it, and a screen reader is told in a sentence.

This is sound because the hidden function is fixed for the whole session: the same input always gets the same answer, so there is nothing a second query could learn.

It is built as two layers, which keeps Checkpoint 04's machine exactly as it was:

| | `GameOracle` (unchanged) | `Investigation` (new) |
| --- | --- | --- |
| What it is | The machine | The notebook kept beside it |
| Asked the same thing twice | Answers again, and counts it | Finds it in the record; the machine is not touched |
| Knows | The hidden function | Only the answers obtained so far |

`Investigation.ask(input)` returns either `{ kind: 'asked', query }` or `{ kind: 'recalled', query }`, and the laboratory asks through it and nothing else. The machine's own record stays the single source of truth: the investigation keeps no second copy that could drift out of step. Like the machine, it exposes nothing about the hidden function.

### What the laboratory remarks

One line at a time, and none before the first query: the player acts first. The lines follow the player's own train of thought and are spaced so that the last of them is reached within about a dozen queries.

| From query | Remark |
| --- | --- |
| 1 | The machine answered. That is one input out of 64. |
| 3 | Each answer describes a single input, and no other. |
| 5 | 59 of the 64 possible inputs are untested. |
| 8 | 8 answers on record. What the machine does is still unknown. |
| 11 | One input at a time, certainty can take as many as 33 queries. *(Until Checkpoint 07 this read "…a complete record would take 64 queries." By this query the constraint has been disclosed, so the cost that matters is the cost of being sure which kind the machine is.)* |
| 14 | There may be a better way to ask. |
| 32 | 32 queries, and 32 inputs are still unknown. There may be a better way to ask. |
| 64 | Every input is on record. It took 64 queries: one for each. |

The numbers are live, and each remark is true for as long as it is shown. The last idea is only wondered at — *there may be* — and nothing says what that way would be. The line echoes the game's tagline: *you only need to know how to ask*.

A player who does test all 64 inputs gets a complete map and the last remark. Nothing else happens; there is still no conclusion to submit.

### How it fits the game

- **Coming back from THE BOX** restores the investigation as it stood: the record, the map, the counts, the remark and the input. Nothing "arrives" a second time. Entering from the main menu still starts a fresh investigation of the same machine.
- **Keyboard.** Every control works as in Checkpoint 04, and nothing new needs a pointer. The map is a picture, not a control (`role="img"`, with a description that keeps count); everything it shows is also in the log, as text. After a repeated input, as after an answer, typing starts over from the left.
- **Reduced motion.** An answer landing in its cell, a recalled entry and a new remark each have a short animation; all are switched off under `prefers-reduced-motion`, and none of them carries information that is not also there in words.
- **Narrow windows.** Checked from 900 × 600 to 1920 × 1080 with a full log: nothing overlaps and nothing leaves the window.

### Tests

127 new tests, 659 in the project:

- **Investigation** — a new input asks the machine and uses one query; a repeated one is recalled, hands back the very entry on record and uses none, however often it is repeated; looking an input up is free; progress always accounts for the whole input space; a complete record takes exactly 64 queries and no more are possible; a refused input is never remembered as an answer; nothing about the function is exposed.
- **The fixed function** — the same answer at the start and the end of a session, in any order of asking, in every investigation; a complete record is exactly the prototype machine's pinned behaviour.
- **Input space** — 2ⁿ inputs; the 8 × 8 layout; position and input are each other's inverse; the first bits pick the row; the order is the one the machine reads inputs in.
- **Remarks** — nothing before the first query; the eight thresholds; never a step backwards; the question of a better way is reached within 16 queries; every number quoted is a real one; the record is called complete only when it is; nothing names the rule, what comes later, or a finish line; other machine sizes and singular wording.
- **The laboratory** — it asks only through the investigation and holds no machine of its own; a repeat returns before the machine is set to work; coming back from THE BOX keeps the investigation.
- **Player-facing text** — the new words are present, and the unrevealed ones are still absent everywhere.

Twenty-three deliberate bugs were introduced one at a time (a repeat that uses a query, a lookup that matches the wrong entry, a reversed bit order, a remark that arrives late or announces instead of wonders, a laboratory that bypasses the record, and others). The tests caught twenty-two; the twenty-third exposed a gap, which a new test now closes.

The interface was exercised in a browser: sixty-four queries to a complete record, repeats at every stage, the keyboard alone, leaving for THE BOX mid-query, and the layout at six window sizes.

## Checkpoint 07 — The Promise

Until now the player has been investigating a machine about which nothing was known. This checkpoint introduces the one thing that *is* known — and with it the question the rest of the game is about.

It adds no new way of asking, and it does not teach the Deutsch–Jozsa algorithm: the player has still only ever asked about one input at a time. What they have now is the **problem** that algorithm solves, and a first-hand sense of what it costs to solve it this way.

### The promise

> This machine is guaranteed to obey one of two rules.

| Kind | What such a machine does | For six bits (64 possible inputs) |
| --- | --- | --- |
| **CONSTANT** | Every possible input produces the same output. | All 64 alike: `64 / 0` |
| **BALANCED** | Half of all possible inputs produce 0. Half produce 1. | Exactly `32 / 32` |

Nothing in between is allowed. That is the promise.

**It is true of the machine, not merely said of it.** A machine is now built only by `createPromisedOracle(f)` (`systems/oracle/promise.ts`), which works out every output of the hidden function, counts them, and refuses a function that is neither kind — one stray output is enough. The check runs once, before the machine exists, and uses none of the player's queries.

The laboratory's machine is the same function it has been since Checkpoint 04; it was not changed to fit. It is **balanced**: of its 64 inputs, exactly 32 answer 0 and exactly 32 answer 1.

**Nothing in the game holds the answer.** The check throws the kind away once it has passed: no machine, investigation or interface keeps it, so none of them can give it away. It has to be found out.

### How the player meets it

At the eighth query the laboratory remarks, as before, that what the machine does "is still unknown" — and then a plate appears above the machine, with the one thing that is known:

1. `ORACLE CONSTRAINT` — a system state, with the signal dot.
2. *This machine is guaranteed to obey one of two rules.*
3. What a machine under each rule **does**, side by side.
4. Only then, what the two are **called**: `CONSTANT · 64 / 0` and `BALANCED · 32 / 32`.

Once the names have arrived, the objective changes from *Find out what the machine does* to:

> Determine which kind of Oracle you are dealing with.

There is no modal, no quiz and no lecture, and nothing waits for the player: the plate arrives over about three seconds while the laboratory stays usable, and then remains as a reference. Until that moment, none of it exists as far as the player — or a screen reader — can tell.

### Classical evidence

With the task comes the evidence that bears on it, at the head of the experiment log:

`OUTPUTS OBSERVED` — `0 ONLY`, `1 ONLY` or `0 AND 1`.

That is all it says. It states what is on record and draws no conclusion; the reasoning is the player's.

The reasoning itself lives in `systems/oracle/evidence.ts`, a pure classifier that is handed the record and the size of the input space, and nothing else:

| On record | What that rules out | So, given the promise |
| --- | --- | --- |
| Two different outputs | Constant | **Balanced** |
| One output, for at most half of all inputs | Nothing | Undetermined: both kinds could have answered this way |
| One output, for *more* than half — 33 of 64 | Balanced | **Constant** |
| Every input | Everything but the truth | Classified exactly |

A balanced machine gives each output for exactly half of all inputs, so half can agree by coincidence and not one more. That is where 33 comes from.

The classifier never sees the machine. It does not inspect the hidden function, work out an answer that has not been observed, or use the quantum engine — its only imports are two types, and a test checks that. So whatever it concludes, the player could conclude from the same record.

### A conclusion on record

Below the evidence are two controls, `CONSTANT` and `BALANCED`. Choosing one puts that conclusion on record; choosing it again takes it back. The laboratory then says how the conclusion stands **against the record**:

| Standing | Meaning | With it, the evidence that decides |
| --- | --- | --- |
| `ESTABLISHED` | The record has ruled the other kind out. | `0 AND 1 OBSERVED`, or `33 OF 64 AGREE` |
| `NOT ESTABLISHED` | The record allows it — and still allows the other kind too. | `8 OF 64 AGREE · 33 NEEDED`, or `ONLY 0 OBSERVED` |
| `CONTRADICTED` | The record has ruled it out. | `0 AND 1 OBSERVED`, or `33 OF 64 AGREE` |

This is not a grade. The laboratory cannot say whether a conclusion is *right*, because it does not know; it can only say what the record shows, which is all the player can know either. A conclusion is re-judged as each answer comes in, so one recorded too early can be overturned by the next query. There is no "classify" button that produces the answer, and nothing is announced that the player has not concluded for themselves.

### What it costs, one input at a time

- **At best, two queries** — two different outputs settle it.
- **At worst, 33** — a constant machine cannot be told from a balanced one until more than half of its inputs have agreed.

The game does not force the worst case or script the moment of discovery. It states the figure once, in the remark at the eleventh query — *One input at a time, certainty can take as many as 33 queries* — and shows it whenever a player concludes *constant* from a run of identical answers. With this machine that is easy to do: the inputs people try first (`000000`, `111111`, `101010`, `010101`, `111000`, `000111`) all answer 0.

The remark that follows, at the fourteenth query, is unchanged: *There may be a better way to ask.*

### What was left alone

- **Checkpoint 06 is intact** — the 6-bit input, the map, the query count, the log, repeated inputs, THE BOX and the keyboard all work as before. One remark was reworded (see the table under Checkpoint 06).
- **THE BOX says nothing new.** The parallel between the two rooms — an uncertain state, an observation, a definite outcome; an unknown machine, observations, evidence — is left for the player to notice.
- **The visual language is still classical**: paper, black, grey, and the red signal dot. Quantum indigo remains unused.
- **Accessibility.** The two conclusion controls are real buttons, in the tab order, operable with `Enter` or `Space`. The chosen one is shown filled and marked `aria-pressed`, and its standing is given in words, so nothing rests on colour. The figures `64 / 0` and `32 / 32` are also given as sentences to a screen reader. The arrival animations are switched off under `prefers-reduced-motion`.

### Tests

173 new tests, 832 in the project:

- **The promise** — constant functions keep it and so do balanced ones (every parity function of one to six bits, and random balanced functions that are not parities); everything else is refused, including functions one output away from balanced; of the 256 functions of three bits exactly 2 + 70 are accepted and 184 refused.
- **The laboratory's machine** — exactly 32 inputs answer 0 and 32 answer 1; it is the function pinned since Checkpoint 04; it is built through the check; changing any single answer would have had it refused.
- **Nothing holds the answer** — the truth table of a hidden function is worked out in one module only, and only the builder of the machine can reach it.
- **Evidence** — both outputs rule out constant; one output, up to half of all inputs, settles nothing; 33 identical answers rule out balanced and 32 do not; a complete record classifies exactly. For every promised machine of one, two and three bits, against every set of inputs that could be on record, the classifier concludes exactly what the record allows — no more and no less.
- **Seeing only the record** — the classifier works from a hand-written record with no machine anywhere, consults no machine, and imports nothing that could.
- **The cost** — two queries at best; exactly 33 for a constant machine, in every order tried; 33 for a balanced one asked in an unlucky order; never more, across forty random machines.
- **The conclusion** — recorded, changed and withdrawn; judged against the record as it grows; never established for both kinds at once.
- **The text** — the two names appear only in the text of the constraint; the behaviours are described without them; the interface code never spells them; nothing names a later idea or a verdict.
- **The laboratory** — the constraint and the controls are built hidden; the task is set only after the names have arrived; the laboratory never announces a verdict of its own.

Thirty-eight deliberate bugs were introduced one at a time (a function let through that breaks the promise, 32 identical answers accepted as proof, one output taken as proof of constant, a repeat counted as new evidence, the names shown before the behaviours, the laboratory announcing its own verdict, indigo in the laboratory, and others). The tests caught all thirty-eight.

The interface was exercised in a browser: the reveal timed part by part, each standing of a conclusion reached and overturned, the keyboard alone, THE BOX and back mid-reveal, and the layout at seven window sizes.

## Known limits

- **Desktop only.** Below a 900px-wide viewport the game is replaced by a notice.
- **Secondary text contrast.** Warm grey `#6F6D67` on the background `#F1EFE9` measures 4.4992:1 — effectively the 4.5:1 WCAG AA threshold, but a hair under it. It is used only on the plain background, never on the darker panel surface.
- **Bundle size.** Phaser is included whole (about 320 kB gzipped). A trimmed custom Phaser build is a later optimisation.
- **Quantum engine scope.** Multi-qubit operations are limited to permutations of basis states, which is all an oracle needs; there is no general multi-qubit gate (an arbitrary controlled rotation, say).
- **Simulating the oracle is not free.** Building U_f evaluates f on all 2ⁿ inputs, because a simulator must know the whole unitary. That is the cost of simulating a quantum computer on a classical one; the algorithm itself still makes a single query.
- **Investigation scope.** The machine has one fixed hidden rule, and nothing ends the investigation: a conclusion can be put on record, and the laboratory says how it stands, but there is no victory and no next level yet. The record and the conclusion are not saved: they survive a visit to THE BOX, but returning to the main menu — one press of `Esc` — clears them.
- **This machine is quick to classify.** The laboratory's machine is balanced, so its kind is settled as soon as two different outputs are on record — two queries, with luck. The 33-query worst case is only met by a constant machine, or by a balanced one asked in an unlucky order. The game does not force it; it states the figure, and shows it when a player concludes *constant* from a run of identical answers.
- **The constraint arrives on a count.** It is disclosed at the eighth query, whatever the answers have been, and cannot be asked for sooner.
- **A query in flight counts.** If the player leaves for THE BOX while the machine is still working, that query is on record when they return, with its answer, though they did not see it arrive.
- **The map is drawn cell by cell.** That suits six bits (64 cells). A machine with a much longer input would need a different picture.
- **Session only.** Whether THE BOX has been observed is remembered until the page is reloaded, and no longer.
- **No sound.** There is no audio system yet.
- **Log scrolling.** The log draws no scrollbar. It follows its newest entry by itself; older entries are reached with the wheel, a trackpad, or the arrow keys once it has focus.
- **Deterministic by nature.** Under the promise, Deutsch–Jozsa is never wrong, so repeated runs on the same function always agree on the verdict. For some balanced functions the measured bit string varies between runs; it is just never all zeros.

## Licences

Inter and JetBrains Mono are distributed under the SIL Open Font License 1.1; the licence texts are in `src/assets/fonts/`.
