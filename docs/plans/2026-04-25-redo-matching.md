# Teleprompter Voice Tracking — Matching Architecture Plan

## Context

This is a browser-based teleprompter that tracks a speaker's voice against a known script in real time. The STT source is the **Web Speech API** (cloud-based, Chrome). The matching algorithm's job is to maintain a stable, continuously updating position estimate in the script as the speaker reads.

### How the Web Speech API behaves

The API emits results in two forms:

- **Interim results** — unstable, change as the speaker continues. Grow longer and longer as more words are spoken.
- **Final results** — committed, stable. Emitted when the API decides an utterance is complete.
- **Resets** — after a final result, the transcript resets to empty and begins growing again.

So the input stream looks like:

```
"the quick"           ← interim
"the quick brown"     ← interim
"the quick brown fox" ← final
→ RESET
"jumped over"         ← interim
"jumped over the"     ← interim
→ RESET
```

The Web Speech API is cloud-based. Latency is variable — typically 200ms under good conditions but spikes to 500–2000ms on poor network. This means the highlight will always lag behind the speaker to some degree. The UX fix for this is speculative advancement (Priority 1 below), which is separate from and more impactful than the matching algorithm improvements.

### Core product requirements

1. **Continuous position signal** — the tracker must always emit a position estimate. Never undefined. The display must always know where to scroll.
2. **Stable enough to follow** — a human eye needs to track the highlight. Flickering or jumping is unacceptable.
3. **Handles all reading behaviours** — normal forward reading, slowing down, speeding up, re-reading lines (backward), skipping ahead, going off-script entirely.
4. **Unknown script complexity** — scripts may have heavy repetition (choruses, repeated phrases) or none at all. The algorithm cannot assume linear non-repetitive content.

### Problems with the current implementation

The current code (`matchText`) uses a **sliding window + Levenshtein distance + moving average**:

- Makes a fresh hard decision every frame — no memory across frames, causing flickering
- Character-level Levenshtein on joined strings — wrong unit, length-biased
- **1:1 word alignment assumed** — a single ASR insertion or deletion misaligns all subsequent words in the scoring window
- Normalises by transcript length only — should be `max(transcript.length, window.length)`
- Position weight is linear and too weak to beat a strong distant match
- Transcript window bug — long interim results discard accumulated final history
- Moving average smooths output but reports positions between real word boundaries
- Returns `undefined` when confidence is low — calling code has no position to render
- No phonetic normalisation — homophones ("their/there", "to/two") score as mismatches

The sliding window of accumulated finals exists specifically to bridge API resets. The beam search architecture replaces this naturally.

---

## Priority 1 — Speculative Advancement (UX Layer)

**This has more visible UX impact than all matching algorithm improvements combined.**

The Web Speech API's variable cloud latency means the highlight trails the speaker's voice regardless of matching accuracy. The fix is **speculative advancement**: measure the speaker's reading pace and advance the highlight between confirmed transcript results at a fraction of that pace.

```typescript
interface SpeculativeState {
  lastConfirmedPosition: number;
  lastConfirmedAt: number; // timestamp ms
  wordsPerMs: number; // rolling average reading pace
}

function advanceSpeculative(state: SpeculativeState): number {
  const elapsed = Date.now() - state.lastConfirmedAt;
  const speculative = state.lastConfirmedPosition + elapsed * state.wordsPerMs * 0.85;
  // 0.85 = advance at 85% of measured pace so confirmed result usually
  // arrives ahead of the speculative position
  // Cap lookahead at 3 words to limit divergence
  return Math.min(speculative, state.lastConfirmedPosition + 3);
}
```

When a confirmed transcript result arrives:

- Update `lastConfirmedPosition` and `lastConfirmedAt`
- Update `wordsPerMs` rolling average based on actual movement
- Snap display to confirmed position if confirmed is ahead of speculative; otherwise hold

When confidence is low (off-script, ambiguous), slow or stop speculative advancement — the speaker may be improvising and the next confirmed position could be anywhere.

This is a UI layer concern — it sits above the beam search, consuming `{ position, confidence }` and producing a smoothed display position.

---

## Priority 2 — Matching Architecture (Beam Search)

### Core idea

Replace the single-position hard decision with a **beam of position hypotheses**. Each hypothesis is a candidate position in the script with an accumulated score. Every frame, hypotheses are extended, scored against the incoming transcript, and pruned. The leading hypothesis is always reported as the current position.

This gives you:

- **Continuity** — beam always has a best hypothesis, always emits a position
- **Stability** — a hypothesis must earn its place over multiple frames, not just win once
- **Repetition handling** — multiple hypotheses stay alive at different occurrences of repeated phrases
- **Implicit reset bridging** — beam state persists across API resets, short transcripts give weak signal
- **Natural handling of backward reading** — backward transitions are allowed at higher cost, no special casing needed

### Data structures

```typescript
interface Hypothesis {
  position: number; // token index in script (leading edge of match window)
  score: number; // accumulated score, higher is better
  age: number; // frames this hypothesis has been alive
}

interface BeamState {
  hypotheses: Hypothesis[];
  beamSize: number; // adaptive: 3 normally, up to 8 when confidence low
  lastConfidentPosition: number; // tracks consumed transcript boundary
  scriptTokens: PhoneticToken[];
}

interface PhoneticToken extends Token {
  metaphone: string; // Double Metaphone encoding, computed once at parse time
}
```

### Pre-processing at parse time

Compute everything expensive once when the script is loaded. Nothing computed per-frame that can be done upfront.

```typescript
function parseScript(text: string): BeamState {
  const tokens = getTokensFromText(text);

  const phoneticTokens = tokens.map((t) => ({
    ...t,
    metaphone: doubleMetaphone(t.value), // computed once, reused every frame
  }));

  return {
    hypotheses: [{ position: 0, score: 1.0, age: 0 }],
    beamSize: 3,
    lastConfidentPosition: 0,
    scriptTokens: phoneticTokens,
  };
}
```

### Transcript boundary — the double-counting problem

After an API reset, the transcript starts fresh ("jumped over"). But the beam already has position history from the final that just committed. Scoring the full accumulated transcript would double-count evidence already consumed.

Score only the **unconsumed** words — those after the beam's last confident position:

```typescript
function getActiveTranscript(transcript: PhoneticToken[], beam: BeamState): PhoneticToken[] {
  // Only score words the beam hasn't already confirmed.
  // lastConfidentPosition marks the consumed boundary.
  return transcript.filter((t) => t.index > beam.lastConfidentPosition);
}
```

Update `lastConfidentPosition` when a final result is received and beam confidence is high.

### Per-frame update — the main loop

```typescript
function updateBeam(
  beam: BeamState,
  transcript: Token[],
  isFinal: boolean,
): { position: number; confidence: number } {
  const activeTranscript = getActiveTranscript(asPhonetic(transcript), beam);

  // 1. EXPAND  — generate candidate positions around each hypothesis
  // 2. SCORE   — Smith-Waterman alignment against active transcript
  // 3. PRUNE   — keep top beamSize hypotheses with stability rules
  // 4. ADAPT   — adjust beam size based on confidence
  // 5. REPORT  — return best hypothesis position and confidence
}
```

### Step 1 — Expand

```typescript
const OFFSETS = [-3, -2, -1, 0, 1, 2, 3];
// Asymmetric transition costs make forward movement cheaper.
// Backward allowed but penalised — handles re-reading without special casing.
// Large jump offsets (5, 8) excluded — beam reaches distant positions naturally
// over multiple frames. Large single-frame jumps waste beam slots.

function expand(hypotheses: Hypothesis[], scriptLength: number): Hypothesis[] {
  const candidates: Hypothesis[] = [];

  for (const h of hypotheses) {
    for (const offset of OFFSETS) {
      const newPosition = h.position + offset;
      if (newPosition < 0 || newPosition >= scriptLength) continue;

      candidates.push({
        position: newPosition,
        score: h.score + transitionScore(offset),
        age: h.age + 1,
      });
    }
  }

  return candidates;
}
```

### Transition scoring

```typescript
function transitionScore(offset: number): number {
  if (offset >= 0 && offset <= 3) return 0.0; // normal forward reading
  if (offset > 3) return -0.3; // skipping forward
  if (offset < 0 && offset >= -3) return -0.4; // re-reading
  if (offset < -3) return -0.7; // large backward jump
}
```

These are starting points, not final values. Tune empirically against real scripts.

### Step 2 — Score via Smith-Waterman alignment

**Why not 1:1 word pairing:** A single ASR insertion or deletion permanently misaligns all subsequent words in the scoring window. If the script says "the quick brown fox" and ASR outputs "the brown fox" (dropping "quick"), 1:1 pairing scores "brown" against "quick" (miss) and "fox" against "brown" (miss). Smith-Waterman finds the optimal alignment explicitly allowing for gaps, correctly handling ASR insertions and deletions.

At window sizes of 2–5 words, Smith-Waterman is ~10–25 matrix cells — sub-millisecond in JavaScript. Inline the implementation (~30 lines) rather than taking a dependency.

```typescript
const INTERIM_WEIGHT = 0.4;
const FINAL_WEIGHT = 1.0;

function scoreCandidate(
  candidate: Hypothesis,
  transcript: PhoneticToken[],
  scriptTokens: PhoneticToken[],
  isFinal: boolean,
): number {
  const weight = isFinal ? FINAL_WEIGHT : INTERIM_WEIGHT;
  const window = scriptTokens.slice(
    candidate.position,
    candidate.position + transcript.length + 2, // +2 slack for insertions
  );

  const alignmentScore = smithWaterman(transcript, window, {
    match: 1.0,
    mismatch: -0.5,
    gap: -0.3,
    scoreFn: emissionScore, // phonetic matching per word pair
  });

  // Normalise by transcript length so short and long windows are comparable
  return candidate.score + (alignmentScore / transcript.length) * weight;
}
```

### Emission scoring — per word pair

```typescript
// ASR_OVERRIDES handles cases Double Metaphone cannot resolve.
// Directional — ASR tends to substitute in one direction, not symmetrically.
// "a" → "the" is a common ASR error; "the" → "a" is less so.
const ASR_OVERRIDES: Map<string, string> = new Map([
  ["a", "the"], // ASR drops definite articles, replaces with indefinite
  ["an", "and"], // common mishearing
]);

function emissionScore(transcript: PhoneticToken, script: PhoneticToken): number {
  // Stage 1 — exact phonetic match via Double Metaphone
  // Handles: their/there, to/two/too, right/write/rite, peace/piece, etc.
  if (transcript.metaphone === script.metaphone) return 1.0;

  // Stage 2 — directional ASR override table
  if (ASR_OVERRIDES.get(transcript.value) === script.value) return 0.9;

  // Stage 3 — Jaro-Winkler for partial credit
  // Chosen because its prefix bonus matches how STT errors distribute:
  // word beginnings are almost always correct, errors cluster at endings.
  // Threshold 0.75 is a starting point — tune empirically.
  const similarity = jaroWinkler(transcript.value, script.value);
  return similarity >= 0.75 ? similarity * 0.7 : 0;
}
```

### Step 3 — Prune with stability rules

```typescript
const CONTINUITY_BONUS_BASE = 0.15;
const MIN_AGE_TO_LEAD = 2; // ~500ms at 250ms/frame

function prune(
  candidates: Hypothesis[],
  currentLeader: Hypothesis,
  directionHistory: number[], // last N position deltas
  beamSize: number,
): Hypothesis[] {
  // Decay continuity bonus during sustained backward movement.
  // Without decay, -0.4 transition penalty + 0.15 continuity bonus means
  // backward hypotheses need 0.55 more emission score per frame to overtake
  // the leader — too high a bar for genuine re-reading.
  const recentDeltas = directionHistory.slice(-3);
  const sustainedBackward = recentDeltas.every((d) => d < 0);
  const continuityBonus = sustainedBackward
    ? CONTINUITY_BONUS_BASE * 0.3 // decayed during sustained backward reading
    : CONTINUITY_BONUS_BASE;

  const boosted = candidates.map((h) => ({
    ...h,
    score: h.position === currentLeader.position ? h.score + continuityBonus : h.score,
  }));

  const sorted = boosted.sort((a, b) => b.score - a.score);

  // Deduplicate by position, keep top beamSize
  const seen = new Set<number>();
  const pruned = sorted
    .filter((h) => {
      if (seen.has(h.position)) return false;
      seen.add(h.position);
      return true;
    })
    .slice(0, beamSize);

  // Enforce minimum age — new hypotheses serve probation before leading.
  // Override only if no eligible hypothesis exists (beam just initialised).
  const eligibleLeader = pruned.find((h) => h.age >= MIN_AGE_TO_LEAD);
  if (eligibleLeader && pruned[0].age < MIN_AGE_TO_LEAD) {
    const idx = pruned.indexOf(eligibleLeader);
    [pruned[0], pruned[idx]] = [pruned[idx], pruned[0]];
  }

  return pruned;
}
```

### Step 4 — Adaptive beam size

```typescript
function adaptBeamSize(beam: BeamState, confidence: number): void {
  if (confidence < 0.3)
    beam.beamSize = 8; // high ambiguity or off-script
  else if (confidence < 0.6)
    beam.beamSize = 5; // moderate ambiguity
  else beam.beamSize = 3; // confident, stay lean
}
```

### Step 5 — Report

Always return a position and confidence. Never undefined.

Confidence normalised by **per-frame score range**, not accumulated score. Accumulated score grows unbounded — dividing by it makes the same ambiguity look different at frame 2 vs frame 20:

```typescript
function report(
  hypotheses: Hypothesis[],
  transcriptLength: number,
): { position: number; confidence: number } {
  const best = hypotheses[0];
  const second = hypotheses[1];

  // Per-frame range = max possible new emission score this frame.
  // Stable across session length — same ambiguity always produces same confidence.
  const perFrameRange = transcriptLength;

  const confidence = second ? Math.min(1, (best.score - second.score) / perFrameRange) : 1.0;

  return { position: best.position, confidence };
}
```

Low confidence has a specific meaning: two hypotheses are nearly tied. This is the repetition/ambiguity/off-script signal. Use it to slow speculative advancement rather than committing to a potentially wrong position.

---

## What this replaces

| Old component                                    | Replaced by                                        |
| ------------------------------------------------ | -------------------------------------------------- |
| `transcriptWindow` global state                  | Beam hypothesis history                            |
| `resetTranscriptWindow()`                        | Not needed — beam persists across resets           |
| `createTextRegion()`                             | Beam expansion with offset list                    |
| `TEXT_REGION_NEXT / PREVIOUS`                    | Transition costs                                   |
| `calculateMovingAverage()`                       | Continuity bonus + minimum age rule                |
| `resetMovingAverage()`                           | Not needed                                         |
| Threshold cascade (`<= 0.1`, `<= 0.3`, `<= 0.5`) | Continuous beam scoring                            |
| `findBestTextWindow()`                           | Beam expansion + Smith-Waterman emission           |
| 1:1 word alignment                               | Smith-Waterman local alignment                     |
| Character-level Levenshtein on joined string     | Word-level Jaro-Winkler per token pair             |
| `undefined` return when confidence low           | Confidence score alongside always-present position |

---

## What does NOT change

- `getTokensFromText()` and the tokeniser — keep as-is
- The calling code's scroll logic — update to consume `{ position, confidence }` and feed into speculative advancement layer

---

## Implementation order

**Do these sequentially. Validate each step before moving to the next.**

**Step 1 — Speculative advancement (highest UX impact, independent of matching)**

Implement reading pace measurement and speculative position advancement in the UI layer. Validate the highlight feels in sync with speech rather than trailing.

**Step 2 — Phonetic preprocessing**

Add Double Metaphone at parse time. Add directional ASR overrides. Replace character-level Levenshtein with word-level Jaro-Winkler in existing `findBestTextWindow`. Validate homophones match correctly.

**Step 3 — Smith-Waterman alignment**

Replace 1:1 word pairing in scoring with Smith-Waterman. Validate single-word ASR insertions and deletions no longer misalign the scoring window.

**Step 4 — Basic beam with 3 hypotheses, no stability rules**

Replace `matchText` with `updateBeam`. No continuity bonus, no minimum age, fixed beam size. Validate flickering stops and position tracking works across API resets without `transcriptWindow`.

**Step 5 — Add stability rules**

Add continuity bonus with directional decay, minimum age requirement. Validate beam doesn't jump on single noisy frames and backward reading eventually catches up.

**Step 6 — Adaptive beam size**

Add confidence-driven beam size. Test against repetitive scripts — validate beam keeps multiple occurrences of repeated phrases alive.

**Step 7 — Fix confidence normalisation**

Switch to per-frame score range normalisation. Validate confidence is stable across long sessions.

**Step 8 — Tune and delete old code**

Tune transition costs, Jaro-Winkler threshold, speculative advancement fraction against real scripts. Remove `transcriptWindow`, `movingAverage`, `createTextRegion`, `findBestTextWindow`, threshold cascade.

---

## What was deliberately excluded and why

**Velocity tracking** — speculative advancement already handles forward drift. Velocity inside the beam adds a failure mode (wrong velocity after pauses/reversals) without benefit given speculative advancement exists at the UI layer.

**TF-IDF anchoring as primary mechanism** — waiting for rare words breaks the continuous smooth tracking requirement. Useful only as a recovery mechanism after large divergence, not as main signal.

**Large jump offsets (5, 8 tokens)** — beam reaches distant positions over multiple frames. Large single-frame jumps waste beam slots and can cause spurious jumps.

**Explicit on/off-script state machine** — confidence score already signals this. Low confidence = ambiguous or off-script. Speculative advancement slows when confidence is low. No additional state needed.

**Kalman filter** — double-smoothing on top of beam stability mechanisms makes the display laggy. Speculative advancement handles forward interpolation.

**Symmetric ASR overrides** — "the" → "a" is not as common an ASR error as "a" → "the". Symmetric overrides create false matches. Overrides are directional.

---

## Dependencies to add

- `double-metaphone` — npm package, well maintained
- Jaro-Winkler — small, can be inlined or taken from `natural` npm package
- Smith-Waterman — ~30 lines, inline rather than taking a dependency

---

## Open questions for the implementing agent

1. **Speculative advancement during off-script** — when confidence is low, should speculative advancement stop entirely, slow to 50% pace, or continue at full pace? Stopping is safest but jarring if off-script is brief.

2. **Manual seek handling** — if the user clicks a word to reposition manually, should the beam reset entirely to that position, or seed a high-weight hypothesis there and let it compete? Seeding is more graceful but takes a few frames to stabilise.

3. **Jaro-Winkler threshold (0.75)** — needs empirical tuning against real STT output. Too high = no partial credit for legitimate near-misses. Too low = false matches on unrelated words.

4. **Speculative advancement fraction (0.85)** — if the speaker consistently speaks faster than 85% of measured pace, speculative position will fall behind. Consider making this adaptive based on recent confirmed-vs-speculative deltas.

5. **`MIN_AGE_TO_LEAD = 2`** — ~500ms before a new hypothesis can lead. If someone skips a full paragraph, is 500ms lag acceptable? Consider making this adaptive: reduce minimum age when the confidence gap between a new hypothesis and the current leader is very large (clear strong signal).
