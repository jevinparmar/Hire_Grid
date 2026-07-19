import React, { useMemo, useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import DOMPurify from "dompurify";

mermaid.initialize({ startOnLoad: false, theme: "default" });

function MermaidDiagram({ code, className }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: svgCode } = await mermaid.render(id, code);
        if (isMounted) {
          setSvg(DOMPurify.sanitize(svgCode));
        }
      } catch (err) {
        console.error("Mermaid error:", err);
        if (isMounted) {
          setSvg(
            `<div class="text-red-500 text-sm p-4 border border-red-200 rounded">Failed to render Mermaid diagram</div>`,
          );
        }
      }
    };
    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [code]);

  return (
    <div
      className={`flex justify-center bg-white border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm overflow-x-auto w-full [&>svg]:max-w-full [&>svg]:h-auto ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function CircuitikzDiagram({ code, className }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.type = "text/tikz";

    let finalCode = code;
    // ensure circuitikz package is declared
    if (
      finalCode.includes("\\begin{circuitikz}") &&
      !finalCode.includes("\\usepackage{circuitikz}")
    ) {
      finalCode = `\\usepackage{circuitikz}\n${finalCode}`;
    }

    script.textContent = finalCode;
    containerRef.current.appendChild(script);

    // Fallback manual trigger if needed, though tikzjax usually has a MutationObserver
    if (window.process_tikz) {
      // window.process_tikz might be available in some forks
    }
  }, [code]);

  return (
    <div
      ref={containerRef}
      className={`flex justify-center bg-white border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm overflow-x-auto w-full [&>svg]:max-w-full [&>svg]:h-auto ${className || ""}`}
    />
  );
}

export function SvgDiagram({
  svgCode,
  className = "max-h-[300px]",
  containerClassName = "mb-5",
}) {
  if (!svgCode) return null;

  const content = useMemo(() => {
    try {
      // Check if it's our new JSON format for Mermaid/Circuitikz
      const parsed = JSON.parse(svgCode);
      if (parsed.diagram_type && parsed.diagram_code) {
        return { type: parsed.diagram_type, data: parsed.diagram_code };
      }
    } catch (e) {
      // Not JSON, continue to fallback checks
    }
    try {
      // If it's our base64 encoded SVG
      if (svgCode.startsWith("data:image/svg+xml;base64,")) {
        const base64Data = svgCode.split(",")[1];
        // Safely decode from base64 back to UTF-8
        const decodedSvg = decodeURIComponent(escape(atob(base64Data)));
        return { type: "svg", data: decodedSvg };
      }

      // If it's raw SVG
      if (svgCode.trim().startsWith("<svg")) {
        return { type: "svg", data: svgCode };
      }

      // If it's a URL or regular image data URL
      return { type: "image", data: svgCode };
    } catch (e) {
      console.error("Failed to parse svgCode", e);
      return { type: "image", data: svgCode }; // Fallback
    }
  }, [svgCode]);

  if (content.type === "mermaid") {
    return (
      <div className={`${containerClassName} flex justify-center`}>
        <MermaidDiagram code={content.data} className={className} />
      </div>
    );
  }

  if (content.type === "circuitikz") {
    return (
      <div className={`${containerClassName} flex justify-center`}>
        <CircuitikzDiagram code={content.data} className={className} />
      </div>
    );
  }

  if (content.type === "svg") {
    return (
      <div className={`${containerClassName} flex justify-center`}>
        <div
          className={`q-diagram flex justify-center bg-white border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm overflow-x-auto w-full [&>svg]:max-w-full [&>svg]:h-auto ${className}`}
          dangerouslySetInnerHTML={{ __html: content.data }}
        />
      </div>
    );
  }

  return (
    <div className={`${containerClassName} flex justify-center`}>
      <img
        src={content.data}
        alt="Question figure"
        className={`rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 object-contain bg-white w-full ${className}`}
      />
    </div>
  );
}
