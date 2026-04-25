import { tokenize } from "./word-tokenizer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScriptToken = {
  value: string;
  index: number; // full-sequence token index (same space as token.index in the renderer)
};

export type MatchState = {
  buffer: ScriptToken[]; // cross-utterance rolling window; spans API resets
  currentWordPos: number; // word-array index of the start of the last matched window
  recentPositions: number[]; // last N matched full-sequence indices for moving average
  lastPosition: number; // smoothed full-sequence index — held when no match
  confirmedIndex: number; // full-sequence index of last committed word (forward-only)
};

// ─── Script preprocessing ─────────────────────────────────────────────────────

export function parseScript(text: string): ScriptToken[] {
  return tokenize(text)
    .filter((t) => t.type === "TOKEN")
    .map((t) => ({ value: t.value, index: t.index }));
}

// ─── Initialisation ───────────────────────────────────────────────────────────

export function initMatch(): MatchState {
  return {
    buffer: [],
    currentWordPos: 0,
    recentPositions: [],
    lastPosition: -1,
    confirmedIndex: -1,
  };
}

export function seekMatch(fullSeqIndex: number, scriptTokens: ScriptToken[]): MatchState {
  let wordPos = 0;
  for (let i = 0; i < scriptTokens.length; i++) {
    if (scriptTokens[i].index <= fullSeqIndex) wordPos = i;
    else break;
  }
  return {
    ...initMatch(),
    currentWordPos: wordPos,
    lastPosition: fullSeqIndex,
    confirmedIndex: fullSeqIndex,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUFFER_SIZE = 6;
const MIN_WINDOW = 3;
const REGION_BACK = 20;
const REGION_FORWARD = 80;
const POSITION_PENALTY = 0.03;

const HIGH_THRESHOLD = 0.1; // ≤10% normalised edit distance
const MID_THRESHOLD = 0.3;
const LOW_THRESHOLD = 0.5;

const AVG_WINDOW = 3;
const AVG_MIN = 2;
const MAX_MOMENTUM = 3;

// ─── Main update ──────────────────────────────────────────────────────────────

export function updateMatch(
  state: MatchState,
  transcriptWords: string[],
  scriptTokens: ScriptToken[],
  isFinal: boolean,
): { state: MatchState; position: number } {
  const noChange = { state, position: state.lastPosition };

  if (scriptTokens.length === 0 || transcriptWords.length === 0) return noChange;

  const transcriptTokens: ScriptToken[] = transcriptWords.map((w, i) => ({ value: w, index: i }));

  const scoringWindow = [...state.buffer, ...transcriptTokens].slice(-BUFFER_SIZE);
  if (scoringWindow.length < MIN_WINDOW) return noChange;

  const transcriptText = scoringWindow
    .map((t) => t.value)
    .join(" ")
    .toLowerCase();

  // Centre search on matchStart + 2: the speaker is typically ~2 words ahead of
  // where the last window started.
  const expectedPos = state.currentWordPos + 2;
  const regionStart = Math.max(0, expectedPos - REGION_BACK);
  const regionEnd = Math.min(
    scriptTokens.length - scoringWindow.length,
    expectedPos + REGION_FORWARD,
  );

  type Candidate = { wordPos: number; score: number };
  const candidates: Candidate[] = [];

  const maxDist = Math.max(REGION_BACK, REGION_FORWARD);
  for (let dist = 0; dist <= maxDist; dist++) {
    for (const pos of dist === 0 ? [expectedPos] : [expectedPos + dist, expectedPos - dist]) {
      if (pos < regionStart || pos > regionEnd) continue;
      const scriptText = scriptTokens
        .slice(pos, pos + scoringWindow.length)
        .map((t) => t.value)
        .join(" ")
        .toLowerCase();
      const normalised = levenshteinDistance(transcriptText, scriptText) / transcriptText.length;
      const weighted = normalised * (1 + dist * POSITION_PENALTY);
      candidates.push({ wordPos: pos, score: weighted });
    }
  }

  const match = firstQualifying(candidates);
  if (!match) return noChange;

  const matchEnd = match.wordPos + scoringWindow.length - 1;
  const rawPosition = scriptTokens[Math.min(matchEnd, scriptTokens.length - 1)]?.index ?? -1;

  const recentPositions = [...state.recentPositions, rawPosition].slice(-AVG_WINDOW);
  const smoothed =
    recentPositions.length < AVG_MIN
      ? state.lastPosition
      : Math.max(Math.ceil(weightedMovingAverage(recentPositions)), 0);
  const position = Math.max(smoothed, state.lastPosition);

  let { confirmedIndex, buffer } = state;

  if (isFinal) {
    buffer = [...state.buffer, ...transcriptTokens].slice(-BUFFER_SIZE);
    if (rawPosition > confirmedIndex) confirmedIndex = rawPosition;
  }

  return {
    state: {
      buffer,
      currentWordPos: match.wordPos,
      recentPositions,
      lastPosition: position,
      confirmedIndex,
    },
    position,
  };
}

// ─── Threshold cascade ────────────────────────────────────────────────────────

function firstQualifying(candidates: { wordPos: number; score: number }[]) {
  for (const threshold of [HIGH_THRESHOLD, MID_THRESHOLD, LOW_THRESHOLD]) {
    const idx = candidates.findIndex((c) => c.score <= threshold);
    if (idx !== -1) return candidates[idx];
  }
  return null;
}

// ─── Moving average ───────────────────────────────────────────────────────────

// Recency-weighted average with capped forward momentum. Momentum prevents
// oscillation between adjacent positions — once movement starts it pushes
// the average through rather than letting it snap back.
function weightedMovingAverage(positions: number[]): number {
  let total = 0;
  let count = 0;
  let prev: number | undefined;

  for (let i = 0; i < positions.length; i++) {
    const bias = prev !== undefined ? Math.min(Math.max(positions[i] - prev, 0), MAX_MOMENTUM) : 0;
    const weight = positions.length - i;
    total += (positions[i] + bias) * weight;
    count += weight;
    prev = positions[i];
  }

  return total / count;
}

// ─── Levenshtein distance ─────────────────────────────────────────────────────

// Space-optimised O(m*n) implementation. Scoring on joined word strings means
// partial words (common in ASR interim results) contribute proportionally to the
// total distance rather than causing binary match failures.
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }

  return dp[n];
}
