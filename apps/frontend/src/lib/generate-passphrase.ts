import { EEFLongWordList } from "./word-list";

export function generatePassphrase(options: {
  numWords: number;
  wordSeparator: string;
  capitalize: boolean;
}) {
  const listLength = EEFLongWordList.length - 1;
  const wordList = new Array(options.numWords);

  for (let i = 0; i < options.numWords; i += 1) {
    const wordIndex = randomNumber(0, listLength);
    if (options.capitalize) {
      wordList[i] = capitalize(EEFLongWordList[wordIndex]);
    } else {
      wordList[i] = EEFLongWordList[wordIndex];
    }
  }

  return wordList.join(options.wordSeparator);
}

// Helpers

function randomNumber(min: number, max: number) {
  let rval = 0;
  const range = max - min + 1;
  const bitsNeeded = Math.ceil(Math.log2(range));
  if (bitsNeeded > 53) {
    throw new Error("We cannot generate numbers larger than 53 bits.");
  }

  const bytesNeeded = Math.ceil(bitsNeeded / 8);
  const mask = 2 ** bitsNeeded - 1;
  // 7776 -> (2^13 = 8192) -1 == 8191 or 0x00001111 11111111

  // Fill a byte array with N random numbers
  const byteArray = new Uint8Array(randomBytes(bytesNeeded));

  let p = (bytesNeeded - 1) * 8;
  for (let i = 0; i < bytesNeeded; i += 1) {
    rval += byteArray[i] * 2 ** p;
    p -= 8;
  }

  // Use & to apply the mask and reduce the number of recursive lookups

  rval &= mask;

  if (rval >= range) {
    // Integer out of acceptable range
    return randomNumber(min, max);
  }

  // Return an integer that falls within the range
  return min + rval;
}

function randomBytes(length: number) {
  const arr = new Uint8Array(length);
  window.crypto.getRandomValues(arr);
  return arr.buffer;
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
