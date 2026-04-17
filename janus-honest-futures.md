# Janus Honest Futures Bar

A short internal contract for when Janus is allowed to use futures-facing language as more than metaphor.

## Why this exists

Janus is branded as an AI-native decision gate and may use the sub-line:

> From many possible futures, keep the robust path.

That line is valuable only if the harness earns it. Without a bar, the wording can drift into theater: strong copy paired with weak structural support.

This file defines the minimum standard for calling the futures framing **honest**.

## Current truth (today)

Today Janus is honest when described as:
- a CLI-first decision gate
- a document evaluator that surfaces unknowns, rejected paths, and a more robust path
- a system that tests present plans against plausible failure modes

Today Janus is **not yet** honest if described as:
- a future simulator
- a prediction engine
- a tool that discovers the one true future

## Honest futures bar

Janus may use futures-facing language literally only when **all** of the following are true:

1. **Multiple candidate paths are structurally represented**
   - the harness is not only re-evaluating the same answer N times
   - it can represent more than one candidate path in a stable way

2. **Rejected alternatives are canonicalized**
   - the same rejected path does not appear as multiple distinct paths because of wording drift
   - a reviewer can tell whether two rejections are actually the same alternative

3. **Alternative generation or decomposition is explicit**
   - when the source document underspecifies alternatives, Janus can either
     - generate bounded alternatives explicitly, or
     - decompose the proposal into meaningful candidate paths/scenarios
   - this generation must be visible, not hidden behind a single summary answer

4. **Path comparison is principled**
   - candidate paths are compared with explicit criteria: fragility, unknowns, NFR coverage, reversibility, scope expansion
   - comparison logic is inspectable in output, not only implicit in the final recommendation

5. **Variance and path-search are distinguished**
   - repeated sampling (`--samples N`) is documented as confidence / variance equipment
   - multi-path reasoning is documented separately from repeated runs of the same evaluation

6. **Failure modes remain first-class**
   - futures framing must still preserve Janus principles: unknowns, abstention, reversibility, and robustness over optimism
   - future language must never imply prophecy or certainty

## Allowed copy before the bar is fully met

These are honest now:
- Janus — AI-native decision gate
- Janus tests plans against plausible failure paths
- Janus surfaces fragile paths and keeps the robust one
- From many possible futures, keep the robust path (as a brand sub-line, not a literal implementation claim)

## Disallowed copy before the bar is fully met

Do not claim:
- Janus predicts the future
- Janus sees the winning future
- Janus reveals the one true path
- Janus simulates all futures

## Near-term roadmap implication

The first structural step toward this bar is:
- canonicalize rejected paths
- make alternative generation or path decomposition explicit

That step moves Janus from a single-eval gate with sampling variance toward a genuine multi-path gate harness.
