"use client"

import { useEffect, useState } from "react"
import { EditorView, basicSetup } from "codemirror"
import { cpp } from "@codemirror/lang-cpp"
import { oneDark } from "@codemirror/theme-one-dark"
import { keymap } from "@codemirror/view"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"

interface CodeMirrorEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  height?: string
}

export default function CodeMirrorEditor({ value, onChange, language, height = "100%" }: CodeMirrorEditorProps) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!element) return

    // Set up language support
    const languageSupport = language === "cpp" ? cpp() : cpp()

    // Create the editor
    const view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        languageSupport,
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString())
          }
        }),
        // Add keymap with tab indentation and default shortcuts
        keymap.of([indentWithTab, ...defaultKeymap]),
        // Set editor height
        EditorView.theme({
          "&": {
            height,
            fontSize: "14px",
          },
          ".cm-scroller": {
            overflow: "auto",
          },
        }),
      ],
      parent: element,
    })

    // Clean up
    return () => {
      view.destroy()
    }
  }, [element, language, onChange, value, height])

  return <div ref={setElement} className="h-full w-full" />
}

