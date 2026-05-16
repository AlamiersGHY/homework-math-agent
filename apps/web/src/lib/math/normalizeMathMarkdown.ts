type SegmentKind = "text" | "math" | "code";

type Segment = {
  kind: SegmentKind;
  value: string;
  display?: boolean;
};

const LATEX_COMMANDS = [
  "arccos",
  "arcsin",
  "arctan",
  "approx",
  "begin",
  "beta",
  "cdot",
  "cos",
  "delta",
  "dfrac",
  "epsilon",
  "end",
  "frac",
  "gamma",
  "ge",
  "geq",
  "iiint",
  "iint",
  "in",
  "infty",
  "int",
  "lambda",
  "le",
  "left",
  "leq",
  "lim",
  "ln",
  "log",
  "mathbb",
  "mathbf",
  "nabla",
  "neq",
  "oint",
  "Omega",
  "partial",
  "pi",
  "prod",
  "right",
  "Sigma",
  "sin",
  "sqrt",
  "sum",
  "tan",
  "tfrac",
  "theta",
  "times",
  "to",
  "varphi",
  "varepsilon",
  "vec"
];

const LATEX_COMMAND_PATTERN = new RegExp(String.raw`\\(?:${LATEX_COMMANDS.join("|")})(?=[^A-Za-z]|$)`);
const BARE_MATH_LINE_PATTERN =
  /^[-+*/=().,\s\dA-Za-z\\{}_^]+(?:=|<=|>=|\\le|\\ge|\\frac|\\sqrt|\\int|\^|_)[-+*/=().,\s\dA-Za-z\\{}_^]*$/;
const WORD_BOUNDARY_PATTERN = /[\s,.;:!?，。；：！？、)\]}]/;

export function normalizeMathMarkdown(source: string): string {
  return tokenize(source)
    .map((segment) => renderSegment(segment))
    .join("");
}

function tokenize(source: string): Segment[] {
  const segments: Segment[] = [];
  let index = 0;
  let textStart = 0;

  while (index < source.length) {
    const code = readCode(source, index);
    if (code) {
      pushText(segments, source.slice(textStart, index));
      segments.push({ kind: "code", value: code.value });
      index = code.end;
      textStart = index;
      continue;
    }

    const math = readMath(source, index);
    if (math) {
      pushText(segments, source.slice(textStart, index));
      segments.push({ kind: "math", value: math.value, display: math.display });
      index = math.end;
      textStart = index;
      continue;
    }

    index += 1;
  }

  pushText(segments, source.slice(textStart));
  return segments;
}

function readCode(source: string, index: number) {
  if (source.startsWith("```", index)) {
    const end = source.indexOf("```", index + 3);
    if (end >= 0) {
      return { value: source.slice(index, end + 3), end: end + 3 };
    }
  }

  if (source[index] === "`") {
    const end = source.indexOf("`", index + 1);
    if (end >= 0) {
      return { value: source.slice(index, end + 1), end: end + 1 };
    }
  }

  return null;
}

function readMath(source: string, index: number) {
  if (source.startsWith("\\[", index)) {
    const end = source.indexOf("\\]", index + 2);
    if (end >= 0) {
      return { value: source.slice(index + 2, end), end: end + 2, display: true };
    }
  }

  if (source.startsWith("\\(", index)) {
    const end = source.indexOf("\\)", index + 2);
    if (end >= 0) {
      return { value: source.slice(index + 2, end), end: end + 2, display: false };
    }
  }

  if (source.startsWith("$$", index)) {
    const end = source.indexOf("$$", index + 2);
    if (end >= 0) {
      return { value: source.slice(index + 2, end), end: end + 2, display: true };
    }
  }

  if (source[index] === "$" && source[index + 1] !== "$" && isLikelyOpeningDollar(source, index)) {
    const end = findInlineDollarEnd(source, index + 1);
    if (end >= 0) {
      return { value: source.slice(index + 1, end), end: end + 1, display: false };
    }
  }

  return null;
}

function findInlineDollarEnd(source: string, start: number): number {
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "\n") {
      return -1;
    }
    if (source[index] === "$" && source[index + 1] !== "$" && source[index - 1] !== "\\") {
      return index;
    }
  }
  return -1;
}

function isLikelyOpeningDollar(source: string, index: number): boolean {
  const previous = source[index - 1] ?? "";
  const next = source[index + 1] ?? "";
  if (!next || /\s|\d/.test(next)) {
    return false;
  }
  return !/[A-Za-z0-9]/.test(previous);
}

function pushText(segments: Segment[], value: string): void {
  if (value) {
    segments.push({ kind: "text", value });
  }
}

function renderSegment(segment: Segment): string {
  if (segment.kind === "code") {
    return segment.value;
  }

  if (segment.kind === "math") {
    const body = normalizeMathBody(segment.value);
    if (!body) {
      return "";
    }
    return segment.display ? `\n\n$$\n${body}\n$$\n\n` : `$${body}$`;
  }

  return normalizeText(segment.value);
}

function normalizeText(text: string): string {
  return text
    .split(/(\n+)/)
    .map((part) => (part.startsWith("\n") ? part : normalizeTextLine(part)))
    .join("");
}

function normalizeTextLine(line: string): string {
  const danglingDisplay = line.match(/^(\s*)(.+?)\s*\$\$\s*(.*)$/);
  if (danglingDisplay && isLikelyMath(danglingDisplay[2])) {
    const [, leading, math, rest] = danglingDisplay;
    const suffix = rest ? ` ${normalizeTextLine(rest)}` : "";
    return `${leading}$$\n${normalizeMathBody(math)}\n$$${suffix ? `\n${suffix.trimStart()}` : ""}`;
  }

  const bracketed = line.trim().match(/^\[\s*([\s\S]+?)\s*\]$/);
  if (bracketed && isLikelyMath(bracketed[1])) {
    return line.replace(line.trim(), `$$\n${normalizeMathBody(bracketed[1])}\n$$`);
  }

  if (isStandaloneMathLine(line)) {
    return line.replace(line.trim(), `$$\n${normalizeMathBody(line.trim())}\n$$`);
  }

  return wrapBareMathRuns(line);
}

function wrapBareMathRuns(line: string): string {
  let output = "";
  let index = 0;

  while (index < line.length) {
    const run = readBareMathRun(line, index);
    if (run) {
      output += `$${normalizeMathBody(run.value)}$`;
      index = run.end;
      continue;
    }

    output += line[index];
    index += 1;
  }

  return output;
}

function readBareMathRun(line: string, index: number) {
  const commandMatch = line.slice(index).match(LATEX_COMMAND_PATTERN);
  const plainStart = findPlainFormulaStart(line, index);
  let start = -1;

  if (commandMatch?.index === 0) {
    start = index;
  } else if (plainStart === index) {
    start = index;
  }

  if (start < 0) {
    return null;
  }

  let end = start;
  let braceDepth = 0;
  while (end < line.length) {
    const char = line[end];
    if (char === "{") {
      braceDepth += 1;
    } else if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    }

    if (braceDepth === 0 && shouldStopBareRun(line, end)) {
      break;
    }
    end += 1;
  }

  const raw = line.slice(start, end);
  const trailing = raw.match(/[\s,.;:!?，。；：！？、]+$/)?.[0] ?? "";
  const value = raw.slice(0, raw.length - trailing.length);
  if (!isLikelyMath(value)) {
    return null;
  }

  return { value, end: start + value.length };
}

function shouldStopBareRun(line: string, index: number): boolean {
  const char = line[index];
  if (/[\u4e00-\u9fff]/.test(char)) {
    return true;
  }
  if (char === "$" || char === "`") {
    return true;
  }
  if (WORD_BOUNDARY_PATTERN.test(char)) {
    const rest = line.slice(index + 1).trimStart();
    if (/^[A-Za-z]{2,}\b/.test(rest) && !LATEX_COMMAND_PATTERN.test(rest)) {
      return true;
    }
  }
  return false;
}

function findPlainFormulaStart(line: string, index: number): number {
  const slice = line.slice(index);
  const match = slice.match(/[A-Za-z][A-Za-z0-9_{}]*\s*(?:\^|_|=|<=|>=)/);
  if (!match || match.index !== 0) {
    return -1;
  }
  const previous = line[index - 1] ?? "";
  return /[A-Za-z0-9]/.test(previous) ? -1 : index;
}

function isStandaloneMathLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) {
    return false;
  }
  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return false;
  }
  if (LATEX_COMMAND_PATTERN.test(trimmed) && /^[\\\s\dA-Za-z{}_^+\-*/=().,]+$/.test(trimmed)) {
    return true;
  }
  return BARE_MATH_LINE_PATTERN.test(trimmed) && /[=^_]/.test(trimmed);
}

function isLikelyMath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 2) {
    return false;
  }
  if (LATEX_COMMAND_PATTERN.test(trimmed)) {
    return true;
  }
  return /[=^_]/.test(trimmed) && /[A-Za-z0-9]/.test(trimmed);
}

function normalizeMathBody(source: string): string {
  return repairMixedDollarDelimiters(source)
    .trim()
    .replace(/\\\\(?=(?:[A-Za-z]+))/g, "\\")
    .replace(/\\{3,}(?=[^A-Za-z]|$)/g, "\\\\")
    .replace(/\s+/g, " ");
}

function repairMixedDollarDelimiters(source: string): string {
  return source.replace(/\${1,2}/g, "").trim();
}
