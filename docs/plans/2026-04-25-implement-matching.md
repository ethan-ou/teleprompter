# Implement: New Matching Architecture

## Prerequisites

Complete `2026-04-25-refactor-remove-collaboration.md` first. This plan assumes a clean content store with no Y.js proxy and `useContentStore` as the single store.

---

## What this does

Replaces the sliding-window + Levenshtein matching system with a beam search tracker and adds speculative advancement so the display interpolates smoothly between confirmed speech results. The old `matchText` / `transcriptWindow` / `movingAverage` module-global approach is deleted entirely.

---

## Design decisions (do not revisit these)

| Question | Decision |
|---|---|
| Seek on click / arrow key | Reset beam entirely to that position. Instant, no settling period. |
| Interim results | Feed into beam with weight 0.4 (finals use weight 1.0). |
| `confirmedIndex` on re-reading | Forward-only. Never decrements. Only `displayIndex` moves backward. |
| Off-script speculative advancement | Slow to 50% of measured pace when confidence is low. |
| Default reading pace before first confirmed result | No speculative advancement until first final result. |

---

## New state model

Replace the four-field `Position` type:

```typescript
// Remove this:
type Position = { start: number; search: number; end: number; bounds: number };

// Use this:
type Position = {
  confirmedIndex: number;  // index of last word committed as spoken (forward-only)
  displayIndex: number;    // current display position (drives scroll + highlight, can go backward)
};
```

**How the old fields map:**
- `start` → `confirmedIndex`
- `end` → `displayIndex` (now driven by speculative advancement, not directly by matchText)
- `search` → replaced by `confirmedIndex` (the beam always knows the full script; no separate search center needed)
- `bounds` → removed; fade-ahead is computed inline as `displayIndex + N` in the renderer

**Index space:** Both `confirmedIndex` and `displayIndex` are full-sequence token indices (the same `.index` values that `tokenize()` assigns to every token including delimiters). The word tokenizer is unchanged. `getTokensFromText()` returns word-only tokens but their `.index` values are full-sequence positions — `parseScript()` preserves these. The renderer's `token.index <= confirmedIndex` comparisons therefore work directly against the same index space. Internally, `Hypothesis.position` is a subscript into the word-only `scriptTokens` array; `report()` converts it to a full-sequence index via `scriptTokens[best.position].index` before returning.

**Initial value:** `{ confirmedIndex: -1, displayIndex: -1 }`

---

## New files to create

### src/lib/phonetic.ts

Double Metaphone encoding and per-word emission scoring.

Install the `double-metaphone` npm package. Inline Jaro-Winkler (~25 lines) rather than taking a dependency.

```typescript
import doubleMetaphone from "double-metaphone";

export type PhoneticToken = {
  value: string;
  index: number;       // word index in the script (0-based, words only)
  metaphone: string;   // primary Double Metaphone code
};

// Directional ASR override table.
// These are one-way: ASR tends to mishear in these specific directions.
const ASR_OVERRIDES = new Map([
  ["a", "the"],
  ["an", "and"],
]);

export function toPhonetic(token: { value: string; index: number }): PhoneticToken {
  const [primary] = doubleMetaphone(token.value);
  return { ...token, metaphone: primary };
}

export function emissionScore(transcript: PhoneticToken, script: PhoneticToken): number {
  if (transcript.metaphone === script.metaphone) return 1.0;
  if (ASR_OVERRIDES.get(transcript.value.toLowerCase()) === script.value.toLowerCase()) return 0.9;
  const sim = jaroWinkler(transcript.value.toLowerCase(), script.value.toLowerCase());
  return sim >= 0.75 ? sim * 0.7 : 0;
}

function jaroWinkler(a: string, b: string): number {
  // Inline standard Jaro-Winkler implementation (~20 lines)
}
```

---

### src/lib/smith-waterman.ts

Local sequence alignment. Inline, no dependency. ~30 lines.

```typescript
export type AlignmentOptions = {
  match: number;
  mismatch: number;
  gap: number;
  scoreFn: (a: PhoneticToken, b: PhoneticToken) => number;
};

export function smithWaterman(
  query: PhoneticToken[],
  reference: PhoneticToken[],
  opts: AlignmentOptions,
): number {
  // Standard Smith-Waterman, return best alignment score.
  // At window sizes of 2-5 words this is ~10-25 matrix cells.
}
```

---

### src/lib/tracker.ts

Pure beam state machine. No module-level globals. No side effects. All functions take state in and return new state.

```typescript
import { type PhoneticToken, emissionScore, toPhonetic } from "./phonetic";
import { smithWaterman } from "./smith-waterman";
import { getTokensFromText } from "./word-tokenizer"; // keep as-is

// ─── Types ────────────────────────────────────────────────────────────────────

type Hypothesis = {
  position: number;   // word index in script (leading edge of match window)
  score: number;      // accumulated score, higher is better
  age: number;        // frames (STT events) this hypothesis has been alive
};

export type BeamState = {
  hypotheses: Hypothesis[];
  beamSize: number;
  consumedTranscriptWords: number;  // how many transcript words have been scored
                                    // (resets each final result; guards against double-counting)
  directionHistory: number[];       // last N position deltas, used for continuity decay
  confirmedIndex: number;           // forward-only; updated when beam commits on final
  confirmedAt: number;              // timestamp of last confirmed result (ms)
  wordsPerMs: number;               // rolling reading pace; -1 until first confirmed result
};

// ─── Initialisation ───────────────────────────────────────────────────────────

export function parseScript(text: string): PhoneticToken[] {
  // Preserve the original full-sequence index from the tokenizer (not the word-array position i).
  // The renderer compares token.index against confirmedIndex/displayIndex using the same
  // full-sequence index space, so these must match.
  return getTokensFromText(text).map((t) => toPhonetic({ value: t.value, index: t.index }));
}

export function initBeam(): BeamState {
  return {
    hypotheses: [{ position: 0, score: 1.0, age: 0 }],
    beamSize: 3,
    consumedTranscriptWords: 0,
    directionHistory: [],
    confirmedIndex: -1,
    confirmedAt: -1,
    wordsPerMs: -1,
  };
}

// Reset to a specific position (seek). Single high-weight hypothesis, no history.
export function seekBeam(position: number): BeamState {
  return {
    ...initBeam(),
    hypotheses: [{ position, score: 10.0, age: 0 }],
    confirmedIndex: position,
    confirmedAt: Date.now(),
    wordsPerMs: -1,  // pace resets on seek; re-measured from next confirmed result
  };
}

// ─── Main update ──────────────────────────────────────────────────────────────

const INTERIM_WEIGHT = 0.4;
const FINAL_WEIGHT = 1.0;

export function updateBeam(
  beam: BeamState,
  transcriptWords: string[],
  scriptTokens: PhoneticToken[],
  isFinal: boolean,
): { beam: BeamState; position: number; confidence: number } {
  // Convert transcript words to phonetic tokens.
  // These are indexed 0..N within the transcript (not script positions).
  const transcriptTokens: PhoneticToken[] = transcriptWords.map((w, i) =>
    toPhonetic({ value: w, index: i }),
  );

  // Guard against double-counting on API reset:
  // After a final result, consumedTranscriptWords resets to 0 (new transcript starts).
  // For interim, we only score the words we haven't seen yet.
  const activeTranscript = transcriptTokens.slice(beam.consumedTranscriptWords);
  if (activeTranscript.length === 0) {
    return { beam, position: beam.hypotheses[0].position, confidence: 1 };
  }

  const weight = isFinal ? FINAL_WEIGHT : INTERIM_WEIGHT;

  // 1. Expand
  const candidates = expand(beam.hypotheses, scriptTokens.length);

  // 2. Score
  const scored = candidates.map((h) => ({
    ...h,
    score: h.score + scoreCandidate(h, activeTranscript, scriptTokens, weight),
  }));

  // 3. Prune
  const pruned = prune(scored, beam.hypotheses[0], beam.directionHistory, beam.beamSize);

  // 4. Adapt beam size
  const { position, confidence } = report(pruned, activeTranscript.length);
  const beamSize = confidence < 0.3 ? 8 : confidence < 0.6 ? 5 : 3;

  // 5. Update direction history
  const delta = pruned[0].position - beam.hypotheses[0].position;
  const directionHistory = [...beam.directionHistory, delta].slice(-5);

  // 6. Commit on final
  let confirmedIndex = beam.confirmedIndex;
  let confirmedAt = beam.confirmedAt;
  let wordsPerMs = beam.wordsPerMs;
  let consumedTranscriptWords = beam.consumedTranscriptWords;

  if (isFinal && confidence >= 0.4) {
    const newConfirmed = Math.max(confirmedIndex, position); // forward-only
    const now = Date.now();

    if (newConfirmed > confirmedIndex && confirmedAt > 0) {
      const wordsMoved = newConfirmed - confirmedIndex;
      const elapsed = now - confirmedAt;
      const measured = wordsMoved / elapsed;
      // Rolling average: weight recent measurement at 30%
      wordsPerMs = wordsPerMs < 0 ? measured : wordsPerMs * 0.7 + measured * 0.3;
    }

    confirmedIndex = newConfirmed;
    confirmedAt = now;
    consumedTranscriptWords = 0; // new transcript starts after this final
  } else if (!isFinal) {
    // Track how many transcript words we've incorporated for this interim run
    consumedTranscriptWords = transcriptTokens.length;
  }

  return {
    beam: {
      hypotheses: pruned,
      beamSize,
      consumedTranscriptWords,
      directionHistory,
      confirmedIndex,
      confirmedAt,
      wordsPerMs,
    },
    position,
    confidence,
  };
}

// ─── Expand ───────────────────────────────────────────────────────────────────

const OFFSETS = [-3, -2, -1, 0, 1, 2, 3];

function transitionScore(offset: number): number {
  if (offset >= 0 && offset <= 3) return 0.0;   // normal forward
  if (offset > 3) return -0.3;                   // large skip forward
  if (offset >= -3) return -0.4;                 // re-reading
  return -0.7;                                   // large backward jump
}

function expand(hypotheses: Hypothesis[], scriptLength: number): Hypothesis[] {
  const seen = new Set<number>();
  const candidates: Hypothesis[] = [];

  for (const h of hypotheses) {
    for (const offset of OFFSETS) {
      const pos = h.position + offset;
      if (pos < 0 || pos >= scriptLength || seen.has(pos)) continue;
      seen.add(pos);
      candidates.push({ position: pos, score: h.score + transitionScore(offset), age: h.age + 1 });
    }
  }

  return candidates;
}

// ─── Score ────────────────────────────────────────────────────────────────────

function scoreCandidate(
  h: Hypothesis,
  transcript: PhoneticToken[],
  scriptTokens: PhoneticToken[],
  weight: number,
): number {
  const window = scriptTokens.slice(h.position, h.position + transcript.length + 2);
  const alignmentScore = smithWaterman(transcript, window, {
    match: 1.0,
    mismatch: -0.5,
    gap: -0.3,
    scoreFn: emissionScore,
  });
  return (alignmentScore / transcript.length) * weight;
}

// ─── Prune ────────────────────────────────────────────────────────────────────

const CONTINUITY_BONUS = 0.15;
const MIN_AGE_TO_LEAD = 2;

function prune(
  candidates: Hypothesis[],
  currentLeader: Hypothesis,
  directionHistory: number[],
  beamSize: number,
): Hypothesis[] {
  const sustainedBackward = directionHistory.slice(-3).every((d) => d < 0);
  const bonus = sustainedBackward ? CONTINUITY_BONUS * 0.3 : CONTINUITY_BONUS;

  const boosted = candidates.map((h) => ({
    ...h,
    score: h.position === currentLeader.position ? h.score + bonus : h.score,
  }));

  const sorted = boosted.sort((a, b) => b.score - a.score);

  const seen = new Set<number>();
  const pruned = sorted
    .filter((h) => {
      if (seen.has(h.position)) return false;
      seen.add(h.position);
      return true;
    })
    .slice(0, beamSize);

  // Minimum age probation — new hypotheses can't lead until age >= MIN_AGE_TO_LEAD
  const eligibleLeader = pruned.find((h) => h.age >= MIN_AGE_TO_LEAD);
  if (eligibleLeader && pruned[0].age < MIN_AGE_TO_LEAD) {
    const idx = pruned.indexOf(eligibleLeader);
    [pruned[0], pruned[idx]] = [pruned[idx], pruned[0]];
  }

  return pruned;
}

// ─── Report ───────────────────────────────────────────────────────────────────

function report(
  hypotheses: Hypothesis[],
  scriptTokens: PhoneticToken[],
  transcriptLength: number,
): { position: number; confidence: number } {
  const best = hypotheses[0];
  const second = hypotheses[1];
  // Normalise by per-frame range (transcript length) not accumulated score,
  // so confidence is stable across long sessions.
  const confidence = second
    ? Math.min(1, Math.max(0, (best.score - second.score) / transcriptLength))
    : 1.0;
  // Convert word-array subscript → full-sequence index for the renderer.
  // Hypothesis.position is an index into scriptTokens[]; .index is the full-sequence value.
  return { position: scriptTokens[best.position].index, confidence };
}
```

---

### src/app/use-display-position.ts

Speculative advancement hook. Reads from the tracker store and interpolates `displayIndex` on every animation frame.

```typescript
import { useEffect, useRef, useState } from "react";
import { useTrackerStore } from "@/features/tracker/store";

const SPECULATIVE_FRACTION = 0.85;
const MAX_LOOKAHEAD_WORDS = 3;
const OFF_SCRIPT_FRACTION = 0.5;  // 50% pace when confidence is low
const OFF_SCRIPT_THRESHOLD = 0.3;

export function useDisplayPosition(): number {
  const confirmedIndex = useTrackerStore((s) => s.beam.confirmedIndex);
  const confirmedAt = useTrackerStore((s) => s.beam.confirmedAt);
  const wordsPerMs = useTrackerStore((s) => s.beam.wordsPerMs);
  const confidence = useTrackerStore((s) => s.confidence);

  const [displayIndex, setDisplayIndex] = useState(confirmedIndex);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // No speculative advancement until we have a real pace measurement
    if (wordsPerMs < 0) {
      setDisplayIndex(confirmedIndex);
      return;
    }

    const tick = () => {
      const fraction =
        confidence < OFF_SCRIPT_THRESHOLD
          ? SPECULATIVE_FRACTION * OFF_SCRIPT_FRACTION
          : SPECULATIVE_FRACTION;

      const elapsed = Date.now() - confirmedAt;
      const speculative = confirmedIndex + elapsed * wordsPerMs * fraction;
      const capped = Math.min(speculative, confirmedIndex + MAX_LOOKAHEAD_WORDS);

      setDisplayIndex(Math.floor(Math.max(confirmedIndex, capped)));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [confirmedIndex, confirmedAt, wordsPerMs, confidence]);

  return displayIndex;
}
```

---

## New store: src/features/tracker/store.ts

Separate Zustand store for beam state. Not persisted. Resets when the script changes.

```typescript
import { create } from "zustand";
import { type BeamState, type PhoneticToken, initBeam, parseScript, seekBeam, updateBeam } from "@/lib/tracker";

type TrackerState = {
  beam: BeamState;
  scriptTokens: PhoneticToken[];
  confidence: number;
};

type TrackerActions = {
  initScript: (text: string) => void;
  onSpeechResult: (words: string[], isFinal: boolean) => void;
  seek: (wordIndex: number) => void;
};

export const useTrackerStore = create<TrackerState & TrackerActions>()((set, get) => ({
  beam: initBeam(),
  scriptTokens: [],
  confidence: 1,

  initScript: (text) => set({ scriptTokens: parseScript(text), beam: initBeam() }),

  onSpeechResult: (words, isFinal) => {
    const { beam, scriptTokens } = get();
    const result = updateBeam(beam, words, scriptTokens, isFinal);
    set({ beam: result.beam, confidence: result.confidence });

    // Sync confirmedIndex forward into content store
    const confirmedIndex = result.beam.confirmedIndex;
    if (confirmedIndex > -1) {
      useContentStore.getState().setPosition({ confirmedIndex });
    }
  },

  seek: (wordIndex) => set({ beam: seekBeam(wordIndex), confidence: 1 }),
}));
```

Note: `useTrackerStore` needs to import `useContentStore` to sync `confirmedIndex`. Keep this one-directional; the content store does not import the tracker store.

---

## Modified files

### src/features/content/store.ts

Change `Position`:

```typescript
export type Position = {
  confirmedIndex: number;
  displayIndex: number;
};
```

Initial value: `{ confirmedIndex: -1, displayIndex: -1 }`.

`setPosition` keeps the same `Partial<Position>` merge pattern — no other changes to the store.

When `setText` is called (script changes), also call `useTrackerStore.getState().initScript(text)` to reset the beam. The content store owns the text; when it changes it must notify the tracker.

---

### src/app/recognizer.ts

Replace `matchText` with `useTrackerStore.onSpeechResult`:

```typescript
import { useTrackerStore } from "@/features/tracker/store";

// In onresult callback:
speechRecognizer.onresult((finalTranscript: string, interimTranscript: string) => {
  const { onSpeechResult } = useTrackerStore.getState();

  if (finalTranscript !== "") {
    onSpeechResult(finalTranscript.trim().split(/\s+/), true);
  }
  if (interimTranscript !== "") {
    onSpeechResult(interimTranscript.trim().split(/\s+/), false);
  }
});

// onend: reset beam state
speechRecognizer.onend(() => {
  useNavbarStore.getState().stop();
  // beam persists across API resets — no reset needed here
});

// onstart: no longer needs to init bounds separately; tracker handles position
```

Remove all imports of `matchText`, `createTextRegion`, `getBoundsStart`, `resetTranscriptWindow`, `getTokensFromText`.

---

### src/features/content/index.tsx

**Rendering zones:** Replace the four-zone class logic with three zones derived from two numbers.

```typescript
const FADE_NEAR = 10;
const FADE_MID = 20;
const FADE_FAR = 30;

const getTokenClassname = (token: Token, confirmedIndex: number, displayIndex: number, status: string) => {
  if (token.type !== "TOKEN" || token.value.trim() === "") return "";
  if (token.index <= confirmedIndex) return "final-transcript";
  if (token.index <= displayIndex)   return "interim-transcript";
  if (status === "started") {
    if (token.index > displayIndex + FADE_FAR) return "opacity-40";
    if (token.index > displayIndex + FADE_MID) return "opacity-60";
    if (token.index > displayIndex + FADE_NEAR) return "opacity-80";
  }
  return "";
};
```

Note: the existing CSS class names (`final-transcript`, `interim-transcript`) can stay — only the logic driving them changes.

**Scroll target:** Use `displayIndex` as the scroll target word. The `useDisplayPosition()` hook provides this, updating every animation frame.

```typescript
const displayIndex = useDisplayPosition();
// lastRef attaches to token at getNextWordIndex(tokens, displayIndex)
```

**Click-to-seek:**

```typescript
const { seek } = useTrackerStore();

const handleClick = (wordIndex: number) => {
  seek(wordIndex);
  useContentStore.getState().setPosition({ confirmedIndex: wordIndex, displayIndex: wordIndex });
};
```

The `wordIndex` here is the word's position in the words-only array (0-based), not the full token index. The click handler needs to map from full token index to word index. `getTokensFromText(text)` gives the word array; a token's word index is its position in that array.

**Keyboard navigation (arrow keys):** Use `confirmedIndex` as the current position for `getPrevSentence` / `getNextSentence`, then call `seek(newWordIndex)`.

**Remove:** All imports of `getBoundsStart`, `resetTranscriptWindow`, `useCollaborateStore` (already gone after Plan 1). Remove `bounds` from any remaining position destructuring.

---

## Delete when all steps are validated

```
src/lib/speech-matcher.ts
src/lib/levenshtein.ts
src/lib/moving-average.ts
```

---

## Implementation order

Do these sequentially. Validate each before moving to the next.

**Step 1 — Add phonetic.ts and smith-waterman.ts**
Install `double-metaphone`. Implement and verify `emissionScore` with a few manual tests (their/there, to/two, quick/quack). Verify Smith-Waterman returns a higher score for a well-aligned sequence than a misaligned one.

**Step 2 — Implement tracker.ts**
Write `updateBeam` with a hardcoded empty `hypotheses` input and a short transcript. Verify the output hypotheses are sorted by score and the position moves in the right direction.

**Step 3 — Add tracker store**
Wire `useTrackerStore` into `recognizer.ts`. Keep the old `matchText` path in `content/index.tsx` for now — the tracker store just runs alongside it. Verify in the browser that `confirmedIndex` updates correctly as speech is recognised.

**Step 4 — Change Position type and update content/store.ts**
Replace `{start, search, end, bounds}` with `{confirmedIndex, displayIndex}`. Fix all type errors. The old rendering logic can use `confirmedIndex` in place of both `start` and `end` temporarily.

**Step 5 — Add useDisplayPosition and update rendering**
Wire `useDisplayPosition()` into `content/index.tsx`. Replace the old four-zone class logic with the three-zone logic above. Verify the display scrolls and highlights correctly.

**Step 6 — Remove old matching files**
Delete `speech-matcher.ts`, `levenshtein.ts`, `moving-average.ts`. Fix any remaining import errors.

**Step 7 — Tune**
Run against real scripts. Tune `SPECULATIVE_FRACTION`, `MAX_LOOKAHEAD_WORDS`, transition costs, Jaro-Winkler threshold (0.75), `CONTINUITY_BONUS` (0.15), and the fade-ahead constants against real speech. The starting values in this plan are estimates.

---

## Dependencies to add

```
double-metaphone   npm package, well maintained
```

Jaro-Winkler and Smith-Waterman are inlined (~25 lines and ~30 lines respectively).
