import { type TextElement, tokenize } from "./word-tokenizer";
import { levenshteinDistance } from "./levenshtein";
import { getAveragedPositions, resetPositions as resetAveragedPositions } from "./average-position";

/*
  Algorithm used to match transcript to the text is a simple
  sliding window algorithm using Levenshtein Distance to measure
  the difference in text.

  The window with the lowest score is the one that's selected. The
  selection is then smoothed by averaging with the previous selections
  to avoid rapid jumps in text position.
*/

const MIN_WINDOW = 2;
const MATCH_WINDOW = 6;

export function getTokensFromText(text: string) {
  return tokenize(text).filter((element) => element.type === "TOKEN");
}

/*
  Avoid too much backtracking and too much forward prediction since it breaks the stability
  of the matching in its general usage. 
*/
export function createTextRegion(tokens: TextElement[], index: number, next = 40, previous = 10) {
  return tokens
    .slice(index - previous > 0 ? index - previous : 0, index + next)
    .filter((element) => element.type === "TOKEN");
}

export function matchText(transcript: TextElement[], text: TextElement[], isFinal: boolean) {
  const transcriptWindow = transcript.slice(-MATCH_WINDOW);
  if (transcriptWindow.length < MIN_WINDOW) {
    return;
  }

  const textWindow = createTextWindow(text, Math.min(transcriptWindow.length, MATCH_WINDOW));

  let positions: [number, number] | undefined;
  const bestWindow = findBestTextWindow(transcriptWindow, textWindow);
  if (bestWindow) {
    positions = getAveragedPositions(bestWindow.at(0)!.index, bestWindow.at(-1)!.index);
  }

  if (isFinal) {
    resetAveragedPositions();
  }

  if (positions) {
    return positions;
  }
}

function createTextWindow(tokens: TextElement[], length: number) {
  if (tokens.length <= length) {
    return [tokens];
  }

  const slices = [];
  let i = 0;
  while (i < tokens.length - length) {
    slices.push(tokens.slice(i, i + length));
    i++;
  }

  return slices;
}

function findBestTextWindow(transcript: TextElement[], textSlices: TextElement[][]) {
  const transcriptText = transcript.map((text) => text.value).join("");
  const distances = textSlices.map((slice) => {
    const sliceText = slice.map((text) => text.value).join("");
    return levenshteinDistance(transcriptText, sliceText) / transcriptText.length;
  });

  /*
    If there's an obvious high accuracy match, pick that. Otherwise go further
    and further into lower confidence until you skip matching altogether.

    Searching from the beginning of the text gives better stability than
    trying to find a best match in the whole text section. But it does
    rely on having not too much backtracking in the text.
  */
  const lowDistanceIndex = distances.findIndex((distance) => distance < 0.1);
  if (lowDistanceIndex > -1) {
    return textSlices[lowDistanceIndex];
  }

  const midDistanceIndex = distances.findIndex((distance) => distance < 0.3);
  if (midDistanceIndex > -1) {
    return textSlices[midDistanceIndex];
  }

  const highDistanceIndex = distances.findIndex((distance) => distance <= 0.5);
  if (highDistanceIndex > -1) {
    return textSlices[highDistanceIndex];
  }
}
