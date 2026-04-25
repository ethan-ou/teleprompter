# Matching Algorithm Analysis

## The Problem

A teleprompter needs to track where a speaker is in a script in real time, using the Web Speech API as the input source.

**Key constraints that shape the algorithm:**

1. The speaker is always moving *forward* through the script — never backward unless they explicitly seek
2. The Web Speech API produces *interim* results that grow word by word mid-utterance, with the last word always being a partial fragment
3. The API resets periodically (every ~10–15 seconds), so the interim stream is not continuous — a cross-utterance buffer is needed
4. Finals are reliable; interims are noisy (partial words, misrecognitions)
5. The script text is known in advance; the transcript is not

---

## What We Tried: SW + Double Metaphone + Jaro-Winkler

We replaced the original Levenshtein matcher with:
- **Smith-Waterman** local sequence alignment (designed for biological sequences)
- **Double Metaphone** phonetic encoding per word
- **Jaro-Winkler** string similarity for non-phonetic fallback

### Why it failed

**The partial word problem.** ASR interim sends partial words — "asym", "asymm", "asymmet" before "asymmetric". Double Metaphone encodes these fragments differently to the full word, or returns empty codes. This makes the score for the correct position unstable as the word grows, causing the display to jump to a nearby wrong position and then snap back when the word completes.

**Levenshtein handles partial words for free.** `"the idea of an asym"` vs `"the idea of an asymmetric"` has a small character edit distance relative to the total string length — the partial word is just a few characters out of 25. The algorithm naturally degrades gracefully without any special handling.

**SW is designed for stable complete sequences.** It finds the best local alignment between arbitrary sequences with no assumptions about ordering or continuity. Gap penalties and mismatch penalties interact with partial words in unpredictable ways.

**Thresholds became uncalibrated.** With Levenshtein, thresholds of 0.1/0.3/0.5 map directly to "90%/70%/50% character match" — interpretable and tunable. With normalised SW scores through a phonetic scoring function, the scale is unclear. In practice, the emissionScore function caps Jaro-Winkler matches at `sim * 0.7` (max ~0.7), meaning a "perfect" match on a near-exact word only scores 0.7, not 1.0. The HIGH_THRESHOLD of 0.8 was therefore rarely triggered for legitimate matches.

---

## What the Old System Did Right

The original `speech-matcher.ts` used **character-level Levenshtein on joined word strings**:

```
"the idea of an asymmetric" vs "the idea of an asymmetric"
→ distance = 0 → normalised = 0.0 → clears HIGH threshold
```

Key properties:
- **Partial word tolerance**: partial word = small fraction of total edit distance
- **Word splitting tolerance**: "crypto system" vs "cryptosystem" = small distance
- **Interpretable thresholds**: distance ≤ 0.1 / 0.3 / 0.5 maps to match quality directly
- **`currentIndex + 2` forward bias**: empirically correct — the speaker is typically 2 words ahead of the last confirmed position
- **Moving average with momentum**: the delta between consecutive positions was added as a bias term, preventing oscillation between adjacent positions (flashing). Without momentum, a position that alternates between N and N+1 stays flickering. With momentum, once it starts moving to N+1, the delta pushes the average through and it stabilises.
- **`matchStart` for position tracking**: the old system tracked the *start* of the matched window, not the end. Combined with `+2` bias, this put the expected search position at `matchStart + 2`.

---

## What the New System Added That's Worth Keeping

- **Distance-ordered candidate search**: iterating candidates by distance from expectedPos (nearest first, forward-biased at equal distance) prevents a distant backward position from winning just because it has a slightly better score. The old system searched linearly from regionStart, which also happened to produce this behaviour given a small enough region.
- **Cross-utterance buffer**: both systems have this; the new system made it explicit as part of the match state.

---

## The Real Failure Mode: LOW Tier Oscillation

Observable in console logs: when a proper noun is misrecognised (e.g., "Whitfield" → "Woody field"), two candidate positions trade places at nearly equal LOW-tier scores (0.26–0.35) on successive interim events. The smooth position oscillates backward and forward — this is the "flashing" the user sees.

The forward-only constraint (never let display go backward) masks this but doesn't fix it. The root cause is accepting matches at LOW confidence.

---

## Recommended Path Forward

**Restore the old Levenshtein core, keep the structural improvements from the new system:**

1. **Character-level Levenshtein on joined strings** as the scoring function
2. **Threshold cascade**: distance ≤ 0.1, ≤ 0.3, ≤ 0.5 (lower = better match, normalised by transcript string length)
3. **Position penalty**: `1 + |expectedPos - candidatePos| * 0.03`, centred on `currentWordPos + 2`
4. **Distance-ordered candidate search** (from the new system — worth keeping)
5. **Moving average with capped forward momentum**: restore the old `bias = prev[i] - prev[i-1]` term, but cap at ~3 to prevent large jumps from overshooting
6. **Cross-utterance buffer**: same concept, already in both systems
7. **Small normalization pass** before matching: lowercase, strip punctuation, map common homophones ("to/two/too", "their/there/they're", "a/an" → normalise) — this covers the phonetic edge cases without full phonetic encoding

**What not to do:**
- Don't use word-level phonetic encoding (Double Metaphone) on interim results — partial words break it
- Don't use Smith-Waterman — it's the wrong tool for this problem
- Don't score every interim word including the last partial fragment without handling partial words explicitly (Levenshtein handles this implicitly)

---

## Open Questions

- Whether the `+2` forward bias should be `+1` or `+2` — depends on whether `currentWordPos` tracks window start or end. Old system tracked window start, so `+2` put expectedPos at the *third word of the last matched window*, which is roughly "where the speaker is right now." If tracking window end, `+2` might overshoot.
- Whether the small homophone normalization table is worth the maintenance cost vs. just accepting occasional off-by-one on homophones.
- Whether the LOW threshold (0.5 in the old system) should be tightened to reduce noise — the old system rarely hit LOW for normal prose.
