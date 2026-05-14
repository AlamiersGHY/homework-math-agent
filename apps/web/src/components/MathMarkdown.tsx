"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export function MathMarkdown({
  children,
  inverted = false
}: {
  children: string;
  inverted?: boolean;
}) {
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
        {children}
      </ReactMarkdown>
    </div>
  );
}

