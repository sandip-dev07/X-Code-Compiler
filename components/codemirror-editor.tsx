"use client";

import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  // autocompletion,
  completionKeymap,
} from "@codemirror/autocomplete";
import prettier from "prettier/standalone";
import parserBabel from "prettier/parser-babel";
import parserHtml from "prettier/parser-html";
import parserCss from "prettier/parser-postcss";
import parserMarkdown from "prettier/parser-markdown";
import parserTypescript from "prettier/parser-typescript";

// Import language support
import { cpp } from "@codemirror/lang-cpp";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { sql } from "@codemirror/lang-sql";
import { php } from "@codemirror/lang-php";
import { rust } from "@codemirror/lang-rust";

interface SimpleCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  onCursorChange?: (position: {
    x: number;
    y: number;
    line: number;
    ch: number;
  }) => void;
}

export default function SimpleCodeEditor({
  value,
  onChange,
  language,
  onCursorChange,
}: SimpleCodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Get language support based on selected language
  const getLanguageSupport = (lang: string) => {
    switch (lang) {
      case "cpp":
        return cpp();
      case "javascript":
        return javascript();
      case "python":
        return python();
      case "java":
        return java();
      case "php":
        return php();
      case "sql":
        return sql();
      case "rust":
        return rust();
      // For languages without specific support, fallback to a similar one
      case "csharp":
        return cpp(); // C# syntax is somewhat similar to C++
      case "ruby":
        return python(); // Ruby syntax is somewhat similar to Python
      case "go":
        return cpp(); // Go syntax is somewhat similar to C++
      default:
        return javascript(); // Default fallback
    }
  };

  // Format code using Prettier and language-specific formatters
  const formatCode = async () => {
    if (!viewRef.current) return;

    const currentCode = viewRef.current.state.doc.toString();
    let formattedCode = currentCode;

    try {
      switch (language) {
        case "javascript":
          // Format JavaScript with Prettier
          formattedCode = await prettier.format(currentCode, {
            parser: "babel",
            plugins: [parserBabel],
            printWidth: 80,
            tabWidth: 2,
            useTabs: false,
            semi: true,
            singleQuote: false,
            trailingComma: "es5",
            bracketSpacing: true,
            arrowParens: "always",
          });
          break;

        case "cpp":
          // Format C++ code using the formatting API
          formattedCode = await formatWithAPI("cpp", currentCode);
          break;

        case "python":
          // Format Python code using the formatting API
          formattedCode = await formatWithAPI("python", currentCode);
          break;

        case "java":
          // Format Java code using the formatting API
          formattedCode = await formatWithAPI("java", currentCode);
          break;

        default:
          // Try to use Prettier for other languages if possible
          try {
            let parser;
            if (language === "typescript" || language === "tsx") {
              parser = "typescript";
            } else if (language === "html") {
              parser = "html";
            } else if (language === "css") {
              parser = "css";
            } else if (language === "markdown") {
              parser = "markdown";
            } else {
              parser = "babel"; // Default
            }

            formattedCode = await prettier.format(currentCode, {
              parser: "babel",
              plugins: [parserBabel],
              printWidth: 80,
              tabWidth: 2,
              useTabs: false,
              semi: true,
              singleQuote: false,
              trailingComma: "es5",
              bracketSpacing: true,
              arrowParens: "always",
            });
          } catch (error) {
            console.warn(`Formatting not supported for ${language}`);
          }
          break;
      }

      // Update the editor content if formatting was successful
      if (formattedCode !== currentCode) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentCode.length,
            insert: formattedCode,
          },
        });

        // Notify parent component of the change
        onChange(formattedCode);
      }
    } catch (error) {
      console.error("Error formatting code:", error);
    }
  };

  // Format code using a server-side API for languages not supported by Prettier
  const formatWithAPI = async (
    language: string,
    code: string
  ): Promise<string> => {
    try {
      const response = await fetch("/api/format", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          code,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.formattedCode || code;
    } catch (error) {
      console.error(`Error formatting ${language} code:`, error);
      return code; // Return original code if formatting fails
    }
  };

  // Get language-specific suggestions
  const getLanguageSuggestions = (lang: string) => {
    const commonSuggestions = [
      { label: "if", type: "keyword" },
      { label: "else", type: "keyword" },
      { label: "for", type: "keyword" },
      { label: "while", type: "keyword" },
      { label: "return", type: "keyword" },
      { label: "function", type: "keyword" },
      { label: "class", type: "keyword" },
    ];

    const languageSpecificSuggestions: Record<
      string,
      Array<{ label: string; type: string }>
    > = {
      cpp: [
        { label: "include", type: "keyword" },
        { label: "iostream", type: "variable" },
        { label: "vector", type: "class" },
        { label: "string", type: "class" },
        { label: "int", type: "keyword" },
        { label: "float", type: "keyword" },
        { label: "double", type: "keyword" },
        { label: "char", type: "keyword" },
        { label: "bool", type: "keyword" },
        { label: "void", type: "keyword" },
        { label: "struct", type: "keyword" },
        { label: "namespace", type: "keyword" },
        { label: "std::cout", type: "function" },
        { label: "std::cin", type: "function" },
        { label: "std::endl", type: "variable" },
      ],
      javascript: [
        { label: "const", type: "keyword" },
        { label: "let", type: "keyword" },
        { label: "var", type: "keyword" },
        { label: "function", type: "keyword" },
        { label: "console.log", type: "function" },
        { label: "document", type: "variable" },
        { label: "window", type: "variable" },
        { label: "Promise", type: "class" },
        { label: "async", type: "keyword" },
        { label: "await", type: "keyword" },
        { label: "import", type: "keyword" },
        { label: "export", type: "keyword" },
      ],
      python: [
        { label: "def", type: "keyword" },
        { label: "import", type: "keyword" },
        { label: "from", type: "keyword" },
        { label: "class", type: "keyword" },
        { label: "print", type: "function" },
        { label: "input", type: "function" },
        { label: "range", type: "function" },
        { label: "len", type: "function" },
        { label: "str", type: "class" },
        { label: "int", type: "class" },
        { label: "list", type: "class" },
        { label: "dict", type: "class" },
      ],
      java: [
        { label: "public", type: "keyword" },
        { label: "private", type: "keyword" },
        { label: "protected", type: "keyword" },
        { label: "static", type: "keyword" },
        { label: "void", type: "keyword" },
        { label: "int", type: "keyword" },
        { label: "String", type: "class" },
        { label: "System.out.println", type: "function" },
        { label: "System.out.print", type: "function" },
        { label: "new", type: "keyword" },
        { label: "extends", type: "keyword" },
        { label: "implements", type: "keyword" },
      ],
      sql: [
        { label: "SELECT", type: "keyword" },
        { label: "FROM", type: "keyword" },
        { label: "WHERE", type: "keyword" },
        { label: "JOIN", type: "keyword" },
        { label: "GROUP BY", type: "keyword" },
        { label: "ORDER BY", type: "keyword" },
        { label: "INSERT INTO", type: "keyword" },
        { label: "UPDATE", type: "keyword" },
        { label: "DELETE FROM", type: "keyword" },
        { label: "CREATE TABLE", type: "keyword" },
        { label: "ALTER TABLE", type: "keyword" },
        { label: "DROP TABLE", type: "keyword" },
      ],
    };

    return [...commonSuggestions, ...(languageSpecificSuggestions[lang] || [])];
  };

  useEffect(() => {
    if (!editorRef.current) return;

    // Clean up previous instance
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const languageSupport = getLanguageSupport(language);
    const suggestions = getLanguageSuggestions(language);

    // Create a new editor state
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageSupport,
        oneDark,
        closeBrackets(),
        // autocompletion({
        //   override: [
        //     (context) => {
        //       const word = context.matchBefore(/\w*/);
        //       if (!word) return null;

        //       return {
        //         from: word.from,
        //         options: suggestions.filter((opt) =>
        //           opt.label.toLowerCase().startsWith(word.text.toLowerCase())
        //         ),
        //       };
        //     },
        //   ],
        // }),
        keymap.of([
          ...defaultKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
          indentWithTab,
          // Add keyboard shortcut for formatting
          {
            key: "Alt-Shift-f",
            run: () => {
              formatCode();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }

          // Track cursor position changes if callback is provided
          if (onCursorChange && update.selectionSet) {
            const selection = update.state.selection.main;
            const line = update.state.doc.lineAt(selection.head);
            const ch = selection.head - line.from;

            // Get cursor coordinates
            const coords = viewRef.current?.coordsAtPos(selection.head);
            if (coords) {
              onCursorChange({
                x: coords.left,
                y: coords.top,
                line: line.number - 1, // 0-based line number
                ch,
              });
            }
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
          },
          ".cm-content": {
            fontFamily: "monospace",
            minHeight: "100%",
            whiteSpace: "pre-wrap", // Enable line wrapping
            wordBreak: "break-word", // Break words at any character
          },
          ".cm-scroller": {
            overflow: "auto",
            maxHeight: "100%",
          },
          "&.cm-editor": {
            height: "100%",
            overflow: "hidden",
          },
          ".cm-gutters": {
            backgroundColor: "transparent",
            border: "none",
          },
          ".cm-gutter": {
            minWidth: "32px",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "transparent",
          },
          // Add styles for wrapped lines
          ".cm-line": {
            padding: "0 2px",
          },
        }),
      ],
    });

    // Create and mount the editor view
    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    // Store the view for cleanup
    viewRef.current = view;

    // Focus the editor
    setTimeout(() => {
      view.focus();
    }, 100);

    return () => {
      view.destroy();
    };
  }, [language, onCursorChange]); // Recreate editor when language or cursor callback changes

  // Update the editor content when value prop changes
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (value !== currentValue) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
        });
      }
    }
  }, [value]);

  return <div ref={editorRef} className="h-full w-full overflow-hidden" />;
}
