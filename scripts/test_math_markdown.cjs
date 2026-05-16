const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("../apps/web/node_modules/typescript");

const sourcePath = path.join(
  __dirname,
  "..",
  "apps",
  "web",
  "src",
  "lib",
  "math",
  "normalizeMathMarkdown.ts"
);
const source = fs.readFileSync(sourcePath, "utf-8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "math-markdown-"));
const compiledPath = path.join(tempDir, "normalizeMathMarkdown.cjs");
fs.writeFileSync(compiledPath, compiled.outputText, "utf-8");
const { normalizeMathMarkdown } = require(compiledPath);

const cases = [
  {
    name: "repairs mixed dollar delimiter",
    input: "x^4 + y^4 + z^4 = 1 $$ 定义了一个超椭球。",
    mustInclude: ["$$\nx^4 + y^4 + z^4 = 1\n$$", "定义了一个超椭球"],
    mustNotInclude: ["$ 定义", "$$ 定义"],
  },
  {
    name: "normalizes doubled latex commands inside inline math",
    input: "散度为 $\\\\frac{\\\\partial P}{\\\\partial x}$。",
    mustInclude: ["$\\frac{\\partial P}{\\partial x}$"],
    mustNotInclude: ["\\\\frac", "$\\$"],
  },
  {
    name: "converts bracket display math",
    input: "\\[ \\iiint_\\Omega f(x,y,z)\\,dV \\]",
    mustInclude: ["$$\n\\iiint_\\Omega f(x,y,z)\\,dV\n$$"],
    mustNotInclude: ["\\[", "\\]"],
  },
  {
    name: "wraps bare latex command run",
    input: "因此 \\lim_{x\\to0}\\frac{\\sin x}{x}=1，结论成立。",
    mustInclude: ["$\\lim_{x\\to0}\\frac{\\sin x}{x}=1$"],
    mustNotInclude: ["\\\\lim"],
  },
  {
    name: "keeps code blocks untouched",
    input: "`$not_math$` and ```js\nconst x = '$still_not_math$';\n```",
    mustInclude: ["`$not_math$`", "```js\nconst x = '$still_not_math$';\n```"],
    mustNotInclude: ["`$$"],
  },
  {
    name: "does not treat money as math",
    input: "The fee is $5 and not a formula.",
    mustInclude: ["$5 and not a formula"],
    mustNotInclude: ["$$\n5"],
  },
];

for (const current of cases) {
  const output = normalizeMathMarkdown(current.input);
  for (const token of current.mustInclude) {
    assert(
      output.includes(token),
      `${current.name}: expected output to include ${JSON.stringify(token)}\nOutput:\n${output}`
    );
  }
  for (const token of current.mustNotInclude) {
    assert(
      !output.includes(token),
      `${current.name}: expected output not to include ${JSON.stringify(token)}\nOutput:\n${output}`
    );
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });
console.log(`Math Markdown normalization passed: ${cases.length} cases`);
