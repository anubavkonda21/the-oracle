# How THE ORACLE Works

> *"You didn't check every possibility. You changed the way you asked the question."*

**THE ORACLE** is an interactive puzzle game designed to build intuition for the **Deutsch–Jozsa algorithm**—one of the foundational examples of quantum speedup—before introducing formal quantum notation.

---

## 1. The Core Puzzle

In each round, you are presented with a sealed black-box machine (**the Oracle**) that accepts an $n$-bit binary string $x \in \{0, 1\}^n$ and outputs a single bit $f(x) \in \{0, 1\}$.

You cannot inspect the internal rule, but you are given one guarantee (the **Promise**): the hidden function $f$ belongs to exactly one of two classes:

- **Constant:** $f(x)$ produces the **same output** for every possible input (either all `0`s or all `1`s).
- **Balanced:** $f(x)$ outputs `0` for **exactly half** of all possible inputs and `1` for the other half.

Your goal is to determine whether the Oracle is **Constant** or **Balanced**.

---

## 2. Why Classical Probing Hits a Wall

In **Classical Mode**, you query the Oracle one input at a time (e.g. `010110` $\rightarrow$ `1`):

- **Best case (Balanced):** If you observe both a `0` and a `1`, you immediately know the function cannot be Constant, so it must be **Balanced** (as few as 2 queries).
- **Worst case:** If every query so far has returned the same bit (say, all `0`s), you cannot rule out Balanced until you have checked **more than half** of the entire input space—at least $2^{n-1} + 1$ distinct inputs.

As the input size scales across the game's levels:

| Level | Input Size ($n$) | Total Inputs ($2^n$) | Classical Worst-Case for Certainty |
| --- | --- | --- | --- |
| Level 1 — Foundation | 2 bits | 4 | 3 queries |
| Level 2 — Uncertainty | 4 bits | 16 | 9 queries |
| Level 3–5 — Scale / Quantum / Gauntlet | 6 bits | 64 | **33 queries** |

With only 8 classical queries available on a 6-bit Oracle, certainty by one-by-one testing is impossible.

---

## 3. How the Quantum Probe Solves It in One Query

Starting in **Level 4 (Quantum Probe)**, you can switch from querying individual inputs to running the **Deutsch–Jozsa circuit** across all $2^n$ inputs simultaneously:

1. **Superposition:** Hadamard gates ($H$) place the $n$-qubit input register into an equal superposition of every possible binary input at once, while an ancilla qubit is prepared in $|-\rangle = \frac{|0\rangle - |1\rangle}{\sqrt{2}}$.
2. **Single Oracle Query (Phase Kickback):** Applying the Oracle $U_f$ **once** flips the ancilla whenever $f(x) = 1$, which writes a relative phase of $(-1)^{f(x)}$ onto each input state $|x\rangle$.
3. **Interference:** A second layer of Hadamard gates recombines all amplitudes onto the $|0\dots 0\rangle$ state, making its amplitude proportional to:
   $$\frac{1}{2^n} \sum_{x \in \{0, 1\}^n} (-1)^{f(x)}$$
   - **If Constant:** Every term has the same sign ($+1$ or $-1$). The waves **constructively interfere**, so measuring the input register always yields `000000` (probability `1.0`).
   - **If Balanced:** Half the terms are $+1$ and half are $-1$. They **destructively interfere** and cancel to `0` at `000000` (probability `0.0`), scattering the measurement to a non-zero bitstring.

---

## 4. Key Takeaway

A quantum computer does not "try all 64 answers and print out a table of 64 results." A single measurement still yields only one $n$-bit string. Instead, **interference** lets you ask a global question about the structure of $f$—turning a problem that can require $2^{n-1} + 1$ classical queries into one that is solved with certainty in **1 quantum query**.
