export type TokenType = "TOKEN" | "DELIMITER";

export type Token = {
  type: TokenType;
  value: string;
  index: number;
};

export const tokenize = (text: string | null) => {
  const results: Token[] = [];

  if (text === null) {
    return results;
  }

  let current: Token | null = null;
  let i = 0;

  while (i < text.length) {
    let s = text[i];
    let inToken;

    // Special case for text within between [ and ], which I use as hints in my teleprompter text
    if (s === "[") {
      const hintLength = text.substring(i).indexOf("]");
      s = hintLength > 0 ? text.substring(i, i + hintLength + 1) : s.substring(i);
      inToken = false;
    } else {
      inToken = /[A-Za-zА-Яа-я0-9_]/.test(s);
    }

    if (current === null) {
      current = {
        type: inToken ? "TOKEN" : "DELIMITER",
        value: s,
        index: 0,
      };
    } else if (
      (current.type === "TOKEN" && inToken) ||
      (current.type === "DELIMITER" && !inToken)
    ) {
      current.value += s;
    } else if (
      (current.type === "TOKEN" && !inToken) ||
      (current.type === "DELIMITER" && inToken)
    ) {
      let lastIndex: number = current.index;
      results.push(current);
      current = {
        type: inToken ? "TOKEN" : "DELIMITER",
        value: s,
        index: lastIndex + 1,
      };
    }

    i += s.length;
  }

  // Don't forget to add the last one, whatever it was...
  if (current !== null) {
    results.push(current);
  }

  return results;
};

export const getPrevSentence = (tokens: Token[], index: number) => {
  let i = index - 1;
  let prevToken: Token | undefined;
  while (i >= 0 && i < tokens.length) {
    const token = tokens[i];
    if (token.type === "TOKEN") {
      prevToken = token;
    }
    if (
      token.type === "DELIMITER" &&
      (token.value.includes(".") || token.value.includes("\n")) &&
      prevToken
    ) {
      return prevToken;
    }
    i--;
  }

  return tokens.at(0);
};

export const getNextSentence = (tokens: Token[], index: number) => {
  let i = index + 1;
  let nextToken = false;
  while (i >= 0 && i < tokens.length) {
    const token = tokens[i];
    if (token.type === "DELIMITER" && (token.value.includes(".") || token.value.includes("\n"))) {
      nextToken = true;
    }
    if (token.type === "TOKEN" && nextToken) {
      return token;
    }
    i++;
  }

  return tokens.at(-1);
};
