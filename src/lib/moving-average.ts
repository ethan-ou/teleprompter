const MIN_AVERAGE = 2;
const NUM_AVERAGE = 3;

let positions: [number, number][] = [];

export function calculateMovingAverage(start: number, end: number): [number, number] | undefined {
  positions.push([start, end]);
  positions = positions.slice(-NUM_AVERAGE);

  if (positions.length < MIN_AVERAGE) {
    return;
  }

  const startValues = [];
  const endValues = [];
  for (const index of positions) {
    const [start, end] = index;
    startValues.push(start);
    endValues.push(end);
  }

  return [
    Math.max(Math.ceil(weightedMovingAverage(startValues)), 0),
    Math.max(Math.ceil(weightedMovingAverage(endValues)), 0),
  ];
}

export function resetMovingAverage() {
  positions = [];
}

/* Calculate average with more recent items being weighed
   more heavily than previous items. */
function weightedMovingAverage(array: number[]) {
  let total = 0;
  let count = 0;
  let prev;

  for (let i = 0; i < array.length; i++) {
    // A hack to weigh averages closer to the last transcribed index.
    let bias = prev !== undefined ? array[i] - prev : 0;

    const weighting = array.length - i;
    total += (array[i] + bias) * weighting;
    count += weighting;

    prev = array[i];
  }

  return total / count;
}
