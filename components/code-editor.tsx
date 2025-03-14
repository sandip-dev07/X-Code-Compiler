"use client";

import { useEffect, useRef } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  height?: string;
}

export default function CodeEditor({
  value,
  onChange,
  language,
  height = "500px",
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Handle editor mount and configure it
  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;

    // Enable clipboard operations
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
      // This will trigger the browser's paste operation
      document.execCommand("paste");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
      // This will trigger the browser's copy operation
      document.execCommand("copy");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
      // This will trigger the browser's cut operation
      document.execCommand("cut");
    });

    // Configure editor settings
    editor.updateOptions({
      autoIndent: "full",
      formatOnPaste: true,
      formatOnType: true,
      autoClosingBrackets: "always",
      autoClosingQuotes: "always",
      autoClosingOvertype: "always",
      autoSurround: "languageDefined",
      tabSize: 2,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      suggestOnTriggerCharacters: true,
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true,
      },
      acceptSuggestionOnCommitCharacter: true,
      acceptSuggestionOnEnter: "on",
      wordBasedSuggestions: "allDocuments",
      parameterHints: {
        enabled: true,
      },
    });

    // Focus the editor to ensure it can receive clipboard events
    editor.focus();
  };

  // Add a useEffect to handle clipboard permissions
  useEffect(() => {
    // Check if clipboard API is available and request permission if needed
    if (navigator.clipboard && navigator.permissions) {
      navigator.permissions
        .query({ name: "clipboard-write" as PermissionName })
        .then((result) => {
          if (result.state === "granted" || result.state === "prompt") {
            // Permission granted or will be prompted
          }
        })
        .catch((err) => {
          console.warn("Clipboard permissions API not available", err);
        });
    }
  }, []);

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme="vs-dark"
      onChange={(value) => onChange(value || "")}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        tabSize: 2,
        automaticLayout: true,
        // Explicitly enable clipboard operations
        find: {
          addExtraSpaceOnTop: false,
        },
        // These settings help with copy-paste
        copyWithSyntaxHighlighting: true,
        mouseWheelZoom: true,
        // Ensure the editor is editable
        readOnly: false,
      }}
    />
  );
}
