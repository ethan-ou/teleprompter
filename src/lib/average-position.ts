const MIN_AVERAGE = 3;
const NUM_AVERAGE = 5;

let positions: [number, number][] = [];

export function getAveragedPositions(start: number, end: number): [number, number] | undefined {
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
    Math.max(Math.ceil(recentlyWeighedAverage(startValues)), 0),
    Math.max(Math.ceil(recentlyWeighedAverage(endValues)), 0),
  ];
}

export function resetPositions() {
  positions = [];
}

function recentlyWeighedAverage(array: number[]) {
  let total = 0;
  let count = 0;

  for (let i = 0; i < array.length; i++) {
    const weighting = array.length - i;
    total += array[i] * weighting;
    count += weighting;
  }

  // A hack to weigh averages closer to the last transcribed index.
  const bias = (array.at(-1)! - array.at(0)!) * array.length;
  return (total + bias) / count;
}
