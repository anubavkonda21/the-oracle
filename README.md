# THE ORACLE

> You don’t need to know what’s inside.
> You only need to know how to ask.

A browser-playable mystery game for the Quriosity quantum game-development competition. Its subject is the **Deutsch–Jozsa algorithm**, taught the way the competition asks: *play first, understand later*.

## Status

**Checkpoint 03 — quantum Oracle and Deutsch–Jozsa.** The foundation, the quantum state-vector engine and the Deutsch–Jozsa algorithm are in place. There is deliberately **no gameplay, no quantum visuals and no story yet**, and the game does not use the engine yet; `src/story/`, `src/data/` and `src/audio/` are empty placeholders for later checkpoints.

What exists today:

- Main menu → `ENTER` → placeholder laboratory → `ESC` / `RETURN` back to the menu
- A design system (colour, type, motion tokens) shared by CSS and canvas code
- A responsive 1440 × 900 stage that scales to the window and stays sharp on high-density screens
- A standalone quantum state-vector simulator in `src/quantum/` (see [Checkpoint 02](#checkpoint-02--quantum-engine))
- Boolean functions, a quantum oracle and the Deutsch–Jozsa algorithm, run on that simulator (see [Checkpoint 03](#checkpoint-03--quantum-oracle-and-deutschjozsa))

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
├── quantum/                the simulator, the oracle and Deutsch–Jozsa — imports nothing from the game
├── utils/                  small pure helpers
└── story/ data/ audio/     reserved for later checkpoints
tests/
├── game/                   tokens, display maths, paper grain
├── quantum/                complex numbers, states, gates, measurement, oracle, Deutsch–Jozsa, independence
└── utils/                  colour, formatting, seeded random
```

### Design tokens

Colours, font stacks and motion timings are declared twice — in `src/styles/tokens.css` for the DOM and in `src/game/config/designTokens.ts` for the canvas — and a unit test fails if the two disagree. Change both together, and never write a raw colour anywhere else.

The palette is meant to progress with the game: off-white, black and warm grey for the classical world; signal red, sparingly, for uncertainty and Oracle activity; quantum indigo held back entirely until Quantum Mode exists.

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

`tests/quantum/` now holds 337 tests; the whole project has 398. The Checkpoint 03 additions:

- **Boolean functions** — every factory, validation, and the counts of constant, balanced and other functions for 1 to 3 bits (2/2/0, 2/6/8, 2/70/184).
- **Oracle** — U_f on every basis state of all 256 three-bit functions; self-inverse, norm-preserving and linear; phase kickback with the ancilla in |−⟩, no effect with it in |+⟩; query counting; nothing about f can be read from it.
- **Deutsch–Jozsa** — checked against brute force on **every** promised function of 1 to 4 bits (4, 8, 72 and 12,872 functions); every parity function of 1 to 5 bits must measure exactly its own mask; random balanced functions up to 10 bits; the 15-bit maximum; each of the eight steps inspected on the recorded states; every promise-breaking function of 2 and 3 bits must be refused.
- **Provenance of the verdict** — the algorithm makes exactly one query, never calls `evaluate`, ignores metadata attached to a function, works through a hand-written oracle, and its source file neither imports the Boolean-function module nor mentions `evaluate`.
- **Basis permutations and partial measurement** — against the X gate and a controlled-NOT, on product and entangled states, with real randomness and with injected random sources.

Eighteen deliberate bugs were introduced one at a time (an oracle flipping the wrong bit, an unprepared ancilla, an inverted or hardcoded verdict, a double query, a missing promise check, and others); the tests caught every one.

## Known limits

- **Desktop only.** Below a 900px-wide viewport the game is replaced by a notice.
- **Secondary text contrast.** Warm grey `#6F6D67` on the background `#F1EFE9` measures 4.4992:1 — effectively the 4.5:1 WCAG AA threshold, but a hair under it. It is used only on the plain background, never on the darker panel surface.
- **Bundle size.** Phaser is included whole (about 320 kB gzipped). A trimmed custom Phaser build is a later optimisation.
- **Quantum engine scope.** Multi-qubit operations are limited to permutations of basis states, which is all an oracle needs; there is no general multi-qubit gate (an arbitrary controlled rotation, say).
- **Simulating the oracle is not free.** Building U_f evaluates f on all 2ⁿ inputs, because a simulator must know the whole unitary. That is the cost of simulating a quantum computer on a classical one; the algorithm itself still makes a single query.
- **Deterministic by nature.** Under the promise, Deutsch–Jozsa is never wrong, so repeated runs on the same function always agree on the verdict. For some balanced functions the measured bit string varies between runs; it is just never all zeros.

## Licences

Inter and JetBrains Mono are distributed under the SIL Open Font License 1.1; the licence texts are in `src/assets/fonts/`.
