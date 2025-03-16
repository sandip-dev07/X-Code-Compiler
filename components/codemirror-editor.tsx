"use client";

import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
} from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  autocompletion,
  completionKeymap,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { linter, Diagnostic } from "@codemirror/lint";
import { syntaxTree } from "@codemirror/language";
import { Text } from "@codemirror/state";
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

// Enhanced interfaces for variable and function tracking
interface CodeSymbol {
  name: string;
  type: 'variable' | 'function' | 'class' | 'parameter' | 'property';
  from: number;
  to: number;
  scope: {
    from: number;
    to: number;
  };
  detail?: string; // Additional info like type, parameters, etc.
  documentation?: string; // Documentation or comments
}

interface Scope {
  from: number;
  to: number;
  parent?: Scope;
  symbols: Map<string, CodeSymbol>;
}

export default function SimpleCodeEditor({
  value,
  onChange,
  language,
  onCursorChange,
}: SimpleCodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const symbolsRef = useRef<CodeSymbol[]>([]);
  const scopesRef = useRef<Scope[]>([]);

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

  // Enhanced function to extract symbols (variables, functions, etc.) from code
  const extractCodeSymbols = (doc: Text): CodeSymbol[] => {
    const symbols: CodeSymbol[] = [];
    const text = doc.toString();
    
    // Create a global scope
    const globalScope: Scope = {
      from: 0,
      to: text.length,
      symbols: new Map(),
    };
    
    const scopes: Scope[] = [globalScope];
    
    // Track current scope level with braces
    let currentScope = globalScope;
    let braceStack: number[] = [];
    
    if (language === "javascript" || language === "typescript") {
      // Extract variable declarations (var, let, const)
      const varPattern = /(var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=|;|,)/g;
      let match;
      
      while ((match = varPattern.exec(text)) !== null) {
        const type = match[1]; // var, let, or const
        const name = match[2]; // variable name
        const from = match.index + match[0].indexOf(name);
        const to = from + name.length;
        
        const symbol: CodeSymbol = {
          name,
          type: 'variable',
          from,
          to,
          scope: { from: currentScope.from, to: currentScope.to },
          detail: type,
        };
        
        symbols.push(symbol);
        currentScope.symbols.set(name, symbol);
      }
      
      // Extract function declarations
      const funcPattern = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$$([^)]*)$$/g;
      while ((match = funcPattern.exec(text)) !== null) {
        const name = match[1];
        const params = match[2];
        const from = match.index + match[0].indexOf(name);
        const to = from + name.length;
        
        // Find the opening brace to determine function scope
        const funcBodyStart = text.indexOf('{', match.index + match[0].length);
        if (funcBodyStart !== -1) {
          // Create a new scope for the function
          const funcScope: Scope = {
            from: funcBodyStart + 1,
            to: findMatchingBrace(text, funcBodyStart),
            parent: currentScope,
            symbols: new Map(),
          };
          
          scopes.push(funcScope);
          
          const symbol: CodeSymbol = {
            name,
            type: 'function',
            from,
            to,
            scope: { from: currentScope.from, to: currentScope.to },
            detail: `function(${params})`,
          };
          
          symbols.push(symbol);
          currentScope.symbols.set(name, symbol);
          
          // Extract function parameters as variables in the function scope
          const paramList = params.split(',').map(p => p.trim()).filter(Boolean);
          paramList.forEach(param => {
            const paramSymbol: CodeSymbol = {
              name: param,
              type: 'parameter',
              from: -1, // We don't know the exact position
              to: -1,
              scope: { from: funcScope.from, to: funcScope.to },
              detail: 'parameter',
            };
            
            symbols.push(paramSymbol);
            funcScope.symbols.set(param, paramSymbol);
          });
        }
      }
      
      // Extract arrow functions with explicit names (const/let/var assignments)
      const arrowFuncPattern = /(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:$$[^)]*$$|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g;
      while ((match = arrowFuncPattern.exec(text)) !== null) {
        const type = match[1];
        const name = match[2];
        const from = match.index + match[0].indexOf(name);
        const to = from + name.length;
        
        const symbol: CodeSymbol = {
          name,
          type: 'function',
          from,
          to,
          scope: { from: currentScope.from, to: currentScope.to },
          detail: 'arrow function',
        };
        
        symbols.push(symbol);
        currentScope.symbols.set(name, symbol);
      }
      
      // Extract class declarations
      const classPattern = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      while ((match = classPattern.exec(text)) !== null) {
        const name = match[1];
        const from = match.index + match[0].indexOf(name);
        const to = from + name.length;
        
        // Find the opening brace to determine class scope
        const classBodyStart = text.indexOf('{', match.index + match[0].length);
        if (classBodyStart !== -1) {
          // Create a new scope for the class
          const classScope: Scope = {
            from: classBodyStart + 1,
            to: findMatchingBrace(text, classBodyStart),
            parent: currentScope,
            symbols: new Map(),
          };
          
          scopes.push(classScope);
          
          const symbol: CodeSymbol = {
            name,
            type: 'class',
            from,
            to,
            scope: { from: currentScope.from, to: currentScope.to },
            detail: 'class',
          };
          
          symbols.push(symbol);
          currentScope.symbols.set(name, symbol);
          
          // Extract class methods
          const methodPattern = /(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$$([^)]*)$$\s*{/g;
          let methodMatch;
          let methodSearchText = text.substring(classBodyStart, classScope.to);
          let offset = classBodyStart;
          
          while ((methodMatch = methodPattern.exec(methodSearchText)) !== null) {
            const methodName = methodMatch[1];
            const methodParams = methodMatch[2];
            const methodFrom = offset + methodMatch.index;
            const methodTo = methodFrom + methodName.length;
            
            const methodSymbol: CodeSymbol = {
              name: methodName,
              type: 'function',
              from: methodFrom,
              to: methodTo,
              scope: { from: classScope.from, to: classScope.to },
              detail: `method(${methodParams})`,
            };
            
            symbols.push(methodSymbol);
            classScope.symbols.set(methodName, methodSymbol);
          }
        }
      }
      
      // Extract object property access for better autocompletion
      const objPropPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\.([$a-zA-Z_][$a-zA-Z0-9_]*)/g;
      while ((match = objPropPattern.exec(text)) !== null) {
        const objName = match[1];
        const propName = match[2];
        
        // Check if we already know this object
        const objSymbol = symbols.find(s => s.name === objName);
        if (objSymbol) {
          // Add this property to our symbols
          const propSymbol: CodeSymbol = {
            name: `${objName}.${propName}`,
            type: 'property',
            from: match.index,
            to: match.index + match[0].length,
            scope: objSymbol.scope,
            detail: `property of ${objName}`,
          };
          
          symbols.push(propSymbol);
        }
      }
    } else if (language === "python") {
      // Extract Python variable assignments
      const varPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
      let match;
      
      while ((match = varPattern.exec(text)) !== null) {
        const name = match[1];
        const from = match.index;
        const to = from + name.length;
        
        // Skip if it's part of a comparison (if a = b:)
        const nextChar = text.charAt(match.index + match[0].length);
        if (nextChar === '=') continue;
        
        const symbol: CodeSymbol = {
          name,
          type: 'variable',
          from,
          to,
          scope: { from: currentScope.from, to: currentScope.to },
        };
        
        symbols.push(symbol);
        currentScope.symbols.set(name, symbol);
      }
      
      // Extract Python function definitions
      const funcPattern = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$$([^)]*)$$:/g;
      while ((match = funcPattern.exec(text)) !== null) {
        const name = match[1];
        const params = match[2];
        const from = match.index + match[0].indexOf(name);
        const to = from + name.length;
        
        // Find the function body by indentation
        const lineStart = text.lastIndexOf('\n', match.index) + 1;
        const indentLevel = match.index - lineStart;
        const funcBodyStart = match.index + match[0].length;
        
        // Find the end of the function by looking for a line with the same or less indentation
        let funcBodyEnd = text.length;
        const lines = text.substring(funcBodyStart).split('\n');
        let lineIndex = 1; // Skip the first line (def line)
        
        while (lineIndex < lines.length) {
          const line = lines[lineIndex];
          // Check if this line has less or equal indentation and is not empty
          if (line.trim() !== '' && line.search(/\S/) <= indentLevel) {
            funcBodyEnd = funcBodyStart + lines.slice(0, lineIndex).join('\n').length;
            break;
          }
          lineIndex++;
        }
        
        // Create a new scope for the function
        const funcScope: Scope = {
          from: funcBodyStart,
          to: funcBodyEnd,
          parent: currentScope,
          symbols: new Map(),
        };
        
        scopes.push(funcScope);
        
        const symbol: CodeSymbol = {
          name,
          type: 'function',
          from,
          to,
          scope: { from: currentScope.from, to: currentScope.to },
          detail: `def ${name}(${params})`,
        };
        
        symbols.push(symbol);
        currentScope.symbols.set(name, symbol);
        
        // Extract function parameters as variables in the function scope
        const paramList = params.split(',').map(p => p.trim()).filter(Boolean);
        paramList.forEach(param => {
          // Handle default values
          const paramName = param.split('=')[0].trim();
          
          const paramSymbol: CodeSymbol = {
            name: paramName,
            type: 'parameter',
            from: -1, // We don't know the exact position
            to: -1,
            scope: { from: funcScope.from, to: funcScope.to },
            detail: 'parameter',
          };
          
          symbols.push(paramSymbol);
          funcScope.symbols.set(paramName, paramSymbol);
        });
      }
      
      // Extract Python class definitions
      const classPattern = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
      while ((match = classPattern.exec(text)) !== null) {
        const name = match[1];
        const from = match.index + match[0].indexOf(name);
        const to = from + name.length;
        
        // Find the class body by indentation (similar to function)
        const lineStart = text.lastIndexOf('\n', match.index) + 1;
        const indentLevel = match.index - lineStart;
        const classBodyStart = text.indexOf(':', match.index) + 1;
        
        // Find the end of the class by looking for a line with the same or less indentation
        let classBodyEnd = text.length;
        const lines = text.substring(classBodyStart).split('\n');
        let lineIndex = 1; // Skip the first line (class line)
        
        while (lineIndex < lines.length) {
          const line = lines[lineIndex];
          // Check if this line has less or equal indentation and is not empty
          if (line.trim() !== '' && line.search(/\S/) <= indentLevel) {
            classBodyEnd = classBodyStart + lines.slice(0, lineIndex).join('\n').length;
            break;
          }
          lineIndex++;
        }
        
        // Create a new scope for the class
        const classScope: Scope = {
          from: classBodyStart,
          to: classBodyEnd,
          parent: currentScope,
          symbols: new Map(),
        };
        
        scopes.push(classScope);
        
        const symbol: CodeSymbol = {
          name,
          type: 'class',
          from,
          to,
          scope: { from: currentScope.from, to: currentScope.to },
          detail: 'class',
        };
        
        symbols.push(symbol);
        currentScope.symbols.set(name, symbol);
      }
    } else if (language === "cpp" || language === "c" || language === "java") {
      // Extract variable declarations with types
      const varPattern = /\b(?:int|float|double|char|bool|string|auto|void|long|short)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
      let match;
      
      while ((match = varPattern.exec(text)) !== null) {
        const name = match[1];
        const from = match.index + match[0].indexOf(name);
        const to = from + name.length;
        
        const symbol: CodeSymbol = {
          name,
          type: 'variable',
          from,
          to,
          scope: { from: currentScope.from, to: currentScope.to },
          detail: match[0].substring(0, match[0].indexOf(name)).trim(), // Type info
        };
        
        symbols.push(symbol);
        currentScope.symbols.set(name, symbol);
      }
      
      // Extract function declarations
      const funcPattern = /\b(?:int|float|double|char|bool|string|auto|void|long|short)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$$([^)]*)$$/g;
      while ((match = funcPattern.exec(text)) !== null) {
        const name = match[1];
        const params = match[2];
        const from = match.index + match[0].indexOf(name);
        const to = from + name.length;
        
        // Find the opening brace to determine function scope
        const funcBodyStart = text.indexOf('{', match.index + match[0].length);
        if (funcBodyStart !== -1) {
          // Create a new scope for the function
          const funcScope: Scope = {
            from: funcBodyStart + 1,
            to: findMatchingBrace(text, funcBodyStart),
            parent: currentScope,
            symbols: new Map(),
          };
          
          scopes.push(funcScope);
          
          const returnType = match[0].substring(0, match[0].indexOf(name)).trim();
          
          const symbol: CodeSymbol = {
            name,
            type: 'function',
            from,
            to,
            scope: { from: currentScope.from, to: currentScope.to },
            detail: `${returnType} ${name}(${params})`,
          };
          
          symbols.push(symbol);
          currentScope.symbols.set(name, symbol);
          
          // Extract function parameters as variables in the function scope
          const paramList = params.split(',').map(p => p.trim()).filter(Boolean);
          paramList.forEach(param => {
            // Handle type information
            const parts = param.split(' ');
            const paramName = parts[parts.length - 1].replace('*', '').trim();
            const paramType = parts.slice(0, -1).join(' ');
            
            const paramSymbol: CodeSymbol = {
              name: paramName,
              type: 'parameter',
              from: -1, // We don't know the exact position
              to: -1,
              scope: { from: funcScope.from, to: funcScope.to },
              detail: paramType,
            };
            
            symbols.push(paramSymbol);
            funcScope.symbols.set(paramName, paramSymbol);
          });
        }
      }
      
      // Extract class declarations
      const classPattern = /\bclass\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
      while ((match = classPattern.exec(text)) !== null) {
        const name = match[1];
        const from = match.index + match[0].indexOf(name);
        const to = from + name.length;
        
        // Find the opening brace to determine class scope
        const classBodyStart = text.indexOf('{', match.index + match[0].length);
        if (classBodyStart !== -1) {
          // Create a new scope for the class
          const classScope: Scope = {
            from: classBodyStart + 1,
            to: findMatchingBrace(text, classBodyStart),
            parent: currentScope,
            symbols: new Map(),
          };
          
          scopes.push(classScope);
          
          const symbol: CodeSymbol = {
            name,
            type: 'class',
            from,
            to,
            scope: { from: currentScope.from, to: currentScope.to },
            detail: 'class',
          };
          
          symbols.push(symbol);
          currentScope.symbols.set(name, symbol);
        }
      }
    }
    
    // Store scopes for later use
    scopesRef.current = scopes;
    
    return symbols;
  };
  
  // Helper function to find matching closing brace
  const findMatchingBrace = (text: string, openBracePos: number): number => {
    let count = 1;
    let pos = openBracePos + 1;
    
    while (count > 0 && pos < text.length) {
      const char = text.charAt(pos);
      if (char === '{') count++;
      else if (char === '}') count--;
      pos++;
    }
    
    return pos;
  };
  
  // Find the scope at a given position
  const findScopeAtPosition = (pos: number): Scope | undefined => {
    // Sort scopes by size (smallest first) to find the most specific scope
    const sortedScopes = [...scopesRef.current].sort((a, b) => 
      (a.to - a.from) - (b.to - b.from)
    );
    
    return sortedScopes.find(scope => 
      pos >= scope.from && pos <= scope.to
    );
  };

  // Find symbols visible at a given position
  const getVisibleSymbolsAtPosition = (pos: number): CodeSymbol[] => {
    const currentScope = findScopeAtPosition(pos);
    if (!currentScope) return [];
    
    const visibleSymbols: CodeSymbol[] = [];
    
    // Add symbols from current scope
    currentScope.symbols.forEach(symbol => {
      visibleSymbols.push(symbol);
    });
    
    // Add symbols from parent scopes
    let parentScope = currentScope.parent;
    while (parentScope) {
      parentScope.symbols.forEach(symbol => {
        // Don't add if we already have a symbol with this name
        if (!visibleSymbols.some(s => s.name === symbol.name)) {
          visibleSymbols.push(symbol);
        }
      });
      parentScope = parentScope.parent;
    }
    
    return visibleSymbols;
  };

  // Function to find duplicate variable declarations
  const findDuplicateDeclarations = (
    symbols: CodeSymbol[]
  ): Diagnostic[] => {
    const diagnostics: Diagnostic[] = [];
    const symbolsByScope = new Map<string, Map<string, CodeSymbol[]>>();
    
    // Group symbols by scope and name
    symbols.forEach(symbol => {
      const scopeKey = `${symbol.scope.from}-${symbol.scope.to}`;
      
      if (!symbolsByScope.has(scopeKey)) {
        symbolsByScope.set(scopeKey, new Map());
      }
      
      const scopeSymbols = symbolsByScope.get(scopeKey)!;
      
      if (!scopeSymbols.has(symbol.name)) {
        scopeSymbols.set(symbol.name, []);
      }
      
      scopeSymbols.get(symbol.name)!.push(symbol);
    });
    
    // Find duplicates within each scope
    symbolsByScope.forEach(scopeSymbols => {
      scopeSymbols.forEach((symbolsWithSameName, name) => {
        if (symbolsWithSameName.length > 1) {
          // Only consider duplicates of the same type (variable, function, etc.)
          const variableDuplicates = symbolsWithSameName.filter(s => s.type === 'variable');
          const functionDuplicates = symbolsWithSameName.filter(s => s.type === 'function');
          
          if (variableDuplicates.length > 1) {
            for (let i = 1; i < variableDuplicates.length; i++) {
              diagnostics.push({
                from: variableDuplicates[i].from,
                to: variableDuplicates[i].to,
                severity: "error",
                message: `Duplicate variable '${name}'. Previously declared at line ${
                  viewRef.current?.state.doc.lineAt(variableDuplicates[0].from).number
                }.`,
              });
            }
          }
          
          if (functionDuplicates.length > 1) {
            for (let i = 1; i < functionDuplicates.length; i++) {
              diagnostics.push({
                from: functionDuplicates[i].from,
                to: functionDuplicates[i].to,
                severity: "error",
                message: `Duplicate function '${name}'. Previously declared at line ${
                  viewRef.current?.state.doc.lineAt(functionDuplicates[0].from).number
                }.`,
              });
            }
          }
        }
      });
    });
    
    return diagnostics;
  };

  // Custom linter for variable duplicates
  const symbolLinter = linter((view) => {
    if (!view) return [];

    const symbols = extractCodeSymbols(view.state.doc);
    symbolsRef.current = symbols; // Store for autocompletion

    return findDuplicateDeclarations(symbols);
  });

  // Enhanced completion source for declared variables and functions
  const symbolCompletions = (
    context: CompletionContext
  ): CompletionResult | null => {
    const word = context.matchBefore(/[\w.]+/);
    if (!word || word.from === word.to) return null;

    const text = word.text.toLowerCase();
    const pos = context.pos;
    
    // Check if we're typing a property access
    const isDotCompletion = text.includes('.');
    
    if (isDotCompletion) {
      // Handle property access (obj.prop)
      const [objName, propPrefix] = text.split('.');
      
      // Find all properties for this object
      const objProperties = symbolsRef.current
        .filter(s => s.type === 'property' && s.name.startsWith(`${objName}.`))
        .map(s => ({
          label: s.name.split('.')[1], // Just the property name
          type: 'property',
          detail: s.detail,
          boost: 99,
        }));
      
      if (objProperties.length > 0) {
        return {
          from: word.from + objName.length + 1, // Start after the dot
          options: objProperties.filter(opt => 
            !propPrefix || opt.label.toLowerCase().startsWith(propPrefix)
          ),
          filter: false,
        };
      }
    }
    
    // Get symbols visible at the current position
    const visibleSymbols = getVisibleSymbolsAtPosition(pos);
    
    // Convert to completion options
    const options = visibleSymbols.map(symbol => {
      let iconType = 'variable';
      
      switch (symbol.type) {
        case 'function':
          iconType = 'function';
          break;
        case 'class':
          iconType = 'class';
          break;
        case 'parameter':
          iconType = 'variable';
          break;
        case 'property':
          iconType = 'property';
          break;
      }
      
      return {
        label: symbol.name,
        type: iconType,
        detail: symbol.detail,
        boost: 99, // Higher priority than language keywords
      };
    });
    
    return {
      from: word.from,
      options: options.filter(opt => 
        opt.label.toLowerCase().startsWith(text)
      ),
      filter: false,
    };
  };

  // Decoration for highlighting duplicate variables
  const duplicateHighlighter = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.getDuplicateDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.getDuplicateDecorations(update.view);
        }
      }

      getDuplicateDecorations(view: EditorView) {
        const symbols = extractCodeSymbols(view.state.doc);
        const duplicates = findDuplicateDeclarations(symbols);

        return Decoration.set(
          duplicates.map((d) =>
            Decoration.mark({
              class: "cm-duplicate-variable",
            }).range(d.from, d.to)
          )
        );
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  // Decoration for highlighting symbol references
  const symbolReferenceHighlighter = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      lastSelectedSymbol: string | null = null;

      constructor(view: EditorView) {
        this.decorations = Decoration.none;
      }

      update(update: ViewUpdate) {
        if (update.selectionSet) {
          this.decorations = this.getSymbolReferenceDecorations(update.view);
        }
      }

      getSymbolReferenceDecorations(view: EditorView) {
        const selection = view.state.selection.main;
        if (selection.empty) return Decoration.none;
        
        // Get the word at the current selection
        const word = view.state.doc.sliceString(selection.from, selection.to);
        if (!word || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(word)) return Decoration.none;
        
        this.lastSelectedSymbol = word;
        
        // Find all occurrences of this symbol
        const text = view.state.doc.toString();
        const decorations: any[] = [];
        
        // Use a regex to find all occurrences of the word
        const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
        let match;
        
        while ((match = wordRegex.exec(text)) !== null) {
          decorations.push(
            Decoration.mark({
              class: "cm-symbol-reference",
            }).range(match.index, match.index + word.length)
          );
        }
        
        return Decoration.set(decorations);
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

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
        autocompletion({
          override: [
            // Custom completion for declared symbols
            symbolCompletions,
            // Language-specific suggestions
            (context) => {
              const word = context.matchBefore(/\w*/);
              if (!word) return null;

              return {
                from: word.from,
                options: suggestions.filter((opt) =>
                  opt.label.toLowerCase().startsWith(word.text.toLowerCase())
                ),
              };
            },
          ],
        }),
        // Add linter for duplicate variables
        symbolLinter,
        // Add decoration for highlighting duplicates
        duplicateHighlighter,
        // Add decoration for highlighting symbol references
        symbolReferenceHighlighter,
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
          // Style for duplicate variable highlights
          ".cm-duplicate-variable": {
            backgroundColor: "rgba(255, 0, 0, 0.2)",
            textDecoration: "wavy underline red",
          },
          // Style for symbol reference highlights
          ".cm-symbol-reference": {
            backgroundColor: "rgba(65, 105, 225, 0.2)",
            outline: "1px solid rgba(65, 105, 225, 0.5)",
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
