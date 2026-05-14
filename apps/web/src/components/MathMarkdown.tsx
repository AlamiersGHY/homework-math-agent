"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { normalizeMathMarkdown } from "@/lib/math/normalizeMathMarkdown";

export function MathMarkdown({
  children,
  inverted = false
}: {
  children: string;
  inverted?: boolean;
}) {
  const normalizedContent = normalizeMathMarkdown(children);

  return (
    <div className={inverted ? "math-markdown math-markdown-inverted" : "math-markdown"}>
      <ReactMarkdown
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkMath]}
        components={{
          a: ({ children: linkChildren, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer">
              {linkChildren}
            </a>
          )
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
