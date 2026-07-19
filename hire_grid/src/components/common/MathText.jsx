import React, { useEffect, useState, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
});

function MermaidChart({ chart }) {
  const [svg, setSvg] = useState("");
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    let isMounted = true;
    mermaid
      .render(`mermaid-${id}`, chart)
      .then((res) => {
        if (isMounted) setSvg(res.svg);
      })
      .catch((e) => {
        console.error(e);
        if (isMounted)
          setSvg(
            `<div class="text-red-500 text-sm p-4 border border-red-200 rounded">Error rendering diagram: ${e.message}</div>`,
          );
      });
    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      className="flex justify-center my-4 overflow-x-auto bg-white dark:bg-slate-800 p-4 rounded-xl"
    />
  );
}

export function MathText({ content }) {
  let processedContent = content || "";

  // Replace common LaTeX delimiters with markdown-compatible ones
  processedContent = processedContent.replace(/\\\((.*?)\\\)/g, "$$$1$$");
  processedContent = processedContent.replace(/\\\[(.*?)\\\]/g, "$$$$$1$$$$");

  // Heuristic: If it looks like a pure math expression (has ^, _, or \ command) and no $
  if (!processedContent.includes("$") && /[\^\_\\]/.test(processedContent)) {
    const textWithoutCommands = processedContent.replace(/\\[a-zA-Z]+/g, "");
    const hasEnglishWords = /[a-zA-Z]{2,}/.test(textWithoutCommands);
    // Check if it has markdown things like images or links before wrapping
    const hasMarkdownLinks = /\[.*\]\(.*\)/.test(processedContent);
    const hasHtmlTags = /<.*>/.test(processedContent);

    if (!hasEnglishWords && !hasMarkdownLinks && !hasHtmlTags) {
      // Auto-wrap as math
      processedContent = `$${processedContent}$`;
    }
  }

  const components = {
    code(props) {
      const { children, className, node, ...rest } = props;
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";

      if (language === "mermaid") {
        return <MermaidChart chart={String(children).replace(/\n$/, "")} />;
      }

      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className="math-text prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
