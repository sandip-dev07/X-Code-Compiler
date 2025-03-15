"use client";

import type React from "react";

interface OutputPanelProps {
  output: string;
  input: string;
  rowSplit: number;
  startRowResize: (e: React.MouseEvent) => void;
  setInput: (value: string) => void;
  setRowSplit: (value: number) => void;
}

export function OutputPanel({
  output,
  input,
  rowSplit,
  startRowResize,
  setInput,
  setRowSplit,
}: OutputPanelProps) {
  return (
    <>
      {/* Output Section */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: `${rowSplit}%` }}
      >
        <div className="flex items-center px-4 h-12 bg-zinc-900 border-b border-zinc-800">
          <h2 className="text-sm font-medium">Output</h2>
        </div>
        <div
          className="flex-1 bg-zinc-900 p-4 font-mono text-sm overflow-auto"
          aria-live="polite"
          aria-label="Code execution output"
        >
          <pre className="whitespace-pre-wrap">
            {output || "Run your code to see output here"}
          </pre>
        </div>
      </div>

      {/* Row Resize Handle */}
      <div
        className="h-1 w-full bg-zinc-800 hover:bg-[#73DC8C] cursor-row-resize flex-shrink-0 relative group"
        onMouseDown={startRowResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize output section"
        tabIndex={0}
        onKeyDown={(e) => {
          // Allow keyboard control of the resize handle
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setRowSplit(Math.max(20, rowSplit - 1));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setRowSplit(Math.min(80, rowSplit + 1));
          }
        }}
      >
        <div className="absolute inset-0 h-4 -top-2 group-hover:bg-transparent" />
      </div>

      {/* Custom Input Section */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: `${100 - rowSplit}%` }}
      >
        <div className="flex items-center px-4 h-12 bg-zinc-900 border-b border-zinc-800">
          <h2 className="text-sm font-medium">Custom Input</h2>
        </div>
        <div className="flex-1 bg-zinc-900 p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full h-full bg-zinc-800 text-white font-mono text-sm p-2 rounded border border-zinc-700 resize-none focus:outline-none focus:ring-1 focus:ring-[#73DC8C]"
            placeholder="Enter input for your program..."
            spellCheck={false}
            aria-label="Custom input for code execution"
          />
        </div>
      </div>
    </>
  );
}
