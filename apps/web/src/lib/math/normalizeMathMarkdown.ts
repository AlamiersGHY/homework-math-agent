const latexCommandPattern =
  /^\\(?:frac|lim|sin|cos|tan|arcsin|arccos|arctan|ln|log|sqrt|to|infty|pi|approx|le|leq|ge|geq|neq|cdot|times|alpha|beta|gamma|delta|epsilon|varepsilon|theta|int|sum|prod)(?=[^A-Za-z]|$)/;

const cjkOrHardStopPattern = /[\u4e00-\u9fff，。；：！？、\n\r]/;

export function normalizeMathMarkdown(source: string): string {
  return source
    .replace(
      /\\\[([\s\S]*?)\\\]/g,
      (_, content: string) => "$" + "$" + content.trim() + "$" + "$"
    )
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, content: string) => `$${content.trim()}$`)
    .split("\n")
    .map(normalizeLine)
    .join("\n");
}

function normalizeLine(line: string): string {
  const trimmed = line.trim();
  const bracketedMath = trimmed.match(/^\[\s*(.+?)\s*\]$/);

  if (bracketedMath && containsLatexCommand(bracketedMath[1])) {
    return line.replace(trimmed, "$" + "$" + bracketedMath[1].trim() + "$" + "$");
  }

  return preserveExistingMath(line, normalizeBareLatexRuns);
}

function preserveExistingMath(
  source: string,
  normalizeText: (segment: string) => string
): string {
  const parts = source.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith("$")) {
        return part;
      }

      return normalizeText(part);
    })
    .join("");
}

function normalizeBareLatexRuns(segment: string): string {
  const withParenthesizedMath = segment.replace(
    /\(([^()\n]*\\[A-Za-z][^()\n]*)\)/g,
    (_, content: string) => `$${content.trim()}$`
  );

  return preserveExistingMath(withParenthesizedMath, wrapLatexCommandRuns);
}

function wrapLatexCommandRuns(segment: string): string {
  let output = "";
  let index = 0;

  while (index < segment.length) {
    if (segment[index] === "\\" && latexCommandPattern.test(segment.slice(index))) {
      const { latex, nextIndex } = readLatexRun(segment, index);
      output += `$${latex.trim()}$`;
      index = nextIndex;
      continue;
    }

    output += segment[index];
    index += 1;
  }

  return output.replace(/\(([^()\n]*\\[A-Za-z][^()\n]*)\)/g, (_, content: string) => {
    return `$${content.trim()}$`;
  });
}

function readLatexRun(segment: string, startIndex: number) {
  let index = startIndex;

  while (index < segment.length && !cjkOrHardStopPattern.test(segment[index])) {
    index += 1;
  }

  const raw = segment.slice(startIndex, index);
  const trailing = raw.match(/([\s,.;:!?，。；：！？、)）]+)$/)?.[0] ?? "";
  const latex = raw.slice(0, raw.length - trailing.length);

  return {
    latex,
    nextIndex: startIndex + latex.length
  };
}

function containsLatexCommand(source: string): boolean {
  return /\\[A-Za-z]+/.test(source);
}
