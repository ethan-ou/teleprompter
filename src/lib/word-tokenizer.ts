export type TextElement = {
  type: "TOKEN" | "DELIMITER";
  value: string;
  index: number;
  start: number;
  end: number;
};

export const tokenize = (text: string | null) => {
  const results: TextElement[] = [];

  if (text === null) {
    return results;
  }

  let current: TextElement | null = null;
  let i = 0;

  while (i < text.length) {
    let s = text[i];
    let inToken;

    // Special case for text within between [ and ], which I use as hints in my teleprompter text
    if (s === "[") {
      const hintLength = text.substring(i).indexOf("]");
      s =
        hintLength > 0 ? text.substring(i, i + hintLength + 1) : s.substring(i);
      inToken = false;
    } else {
      inToken = /[A-Za-zА-Яа-я0-9_]/.test(s);
    }

    if (current === null) {
      current = {
        type: inToken ? "TOKEN" : "DELIMITER",
        value: s,
        index: 0,
        start: i,
        end: i + 1,
      };
    } else if (
      (current.type === "TOKEN" && inToken) ||
      (current.type === "DELIMITER" && !inToken)
    ) {
      current.value += s;
      current.end += s.length;
    } else if (
      (current.type === "TOKEN" && !inToken) ||
      (current.type === "DELIMITER" && inToken)
    ) {
      results.push(current);

      const lastIndex: number = current.index;
      const lastEnd: number = current.end;
      current = {
        type: inToken ? "TOKEN" : "DELIMITER",
        value: s,
        index: lastIndex + 1,
        start: lastEnd,
        end: lastEnd + 1,
      };
    }

    i += s.length;
  }

  // Don't forget to add the last item
  if (current !== null) {
    results.push(current);
  }

  return results;
};
