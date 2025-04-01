import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { language, code } = await request.json();

    let formattedCode = code;

    switch (language) {
      case "cpp":
        formattedCode = formatCpp(code);
        break;
      case "python":
        formattedCode = formatPython(code);
        break;
      case "java":
        formattedCode = formatJava(code);
        break;
      default:
        return NextResponse.json(
          { error: `Formatting not supported for ${language}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ formattedCode });
  } catch (error) {
    console.error("Error in format API:", error);
    return NextResponse.json(
      { error: "Failed to format code" },
      { status: 500 }
    );
  }
}

// C++ formatter - Enhanced implementation
function formatCpp(code: string): string {
  const lines = code.split("\n");
  const formattedLines: string[] = [];
  let indentLevel = 0;
  let inNamespace = false;
  let inClass = false;
  let inFunction = false;
  let inIfBlock = false;
  let inElseBlock = false;
  let inForLoop = false;
  let inWhileLoop = false;
  let inSwitchBlock = false;
  let inCaseBlock = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    let currentIndent = indentLevel;

    // Handle special cases for indentation
    if (trimmedLine.startsWith("}")) {
      // Decrease indent for closing braces
      currentIndent = Math.max(0, indentLevel - 1);
      if (trimmedLine === "}") {
        // Reset block flags when closing a block
        inNamespace = false;
        inClass = false;
        inFunction = false;
        inIfBlock = false;
        inElseBlock = false;
        inForLoop = false;
        inWhileLoop = false;
        inSwitchBlock = false;
        inCaseBlock = false;
      }
    }

    // Add proper indentation
    if (trimmedLine.length > 0) {
      // Add extra indentation for namespace content
      if (inNamespace) {
        currentIndent++;
      }
      // Add extra indentation for class content
      if (inClass) {
        currentIndent++;
      }
      // Add extra indentation for function content
      if (inFunction) {
        currentIndent++;
      }
      // Add extra indentation for control structures
      if (inIfBlock || inElseBlock || inForLoop || inWhileLoop || inSwitchBlock || inCaseBlock) {
        currentIndent++;
      }

      formattedLines.push("  ".repeat(currentIndent) + trimmedLine);
    } else {
      formattedLines.push("");
    }

    // Update block flags
    if (trimmedLine.includes("namespace")) {
      inNamespace = true;
    } else if (trimmedLine.includes("class")) {
      inClass = true;
    } else if (trimmedLine.includes("(") && trimmedLine.includes(")")) {
      inFunction = true;
    } else if (trimmedLine.startsWith("if")) {
      inIfBlock = true;
    } else if (trimmedLine.startsWith("else")) {
      inElseBlock = true;
    } else if (trimmedLine.startsWith("for")) {
      inForLoop = true;
    } else if (trimmedLine.startsWith("while")) {
      inWhileLoop = true;
    } else if (trimmedLine.startsWith("switch")) {
      inSwitchBlock = true;
    } else if (trimmedLine.startsWith("case")) {
      inCaseBlock = true;
    }

    // Update indent level for next line
    if (trimmedLine.endsWith("{")) {
      indentLevel++;
    }
  }

  return formattedLines.join("\n");
}

// Python formatter - Enhanced implementation
function formatPython(code: string): string {
  const lines = code.split("\n");
  const formattedLines: string[] = [];
  let indentLevel = 0;
  let inFunction = false;
  let inClass = false;
  let inIfBlock = false;
  let inElseBlock = false;
  let inElifBlock = false;
  let inForLoop = false;
  let inWhileLoop = false;
  let inTryBlock = false;
  let inExceptBlock = false;
  let inFinallyBlock = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    let currentIndent = indentLevel;

    // Handle special cases for indentation
    if (
      trimmedLine.startsWith("else:") ||
      trimmedLine.startsWith("elif ") ||
      trimmedLine.startsWith("except:") ||
      trimmedLine.startsWith("except ") ||
      trimmedLine.startsWith("finally:")
    ) {
      currentIndent = Math.max(0, indentLevel - 1);
      // Reset block flags
      inIfBlock = false;
      inElseBlock = false;
      inElifBlock = false;
      inTryBlock = false;
      inExceptBlock = false;
      inFinallyBlock = false;
    }

    // Add proper indentation
    if (trimmedLine.length > 0) {
      // Add extra indentation for class content
      if (inClass) {
        currentIndent++;
      }
      // Add extra indentation for function content
      if (inFunction) {
        currentIndent++;
      }
      // Add extra indentation for control structures
      if (inIfBlock || inElseBlock || inElifBlock || inForLoop || inWhileLoop || inTryBlock || inExceptBlock || inFinallyBlock) {
        currentIndent++;
      }

      formattedLines.push("    ".repeat(currentIndent) + trimmedLine);
    } else {
      formattedLines.push("");
    }

    // Update block flags
    if (trimmedLine.startsWith("class ")) {
      inClass = true;
    } else if (trimmedLine.startsWith("def ")) {
      inFunction = true;
    } else if (trimmedLine.startsWith("if ")) {
      inIfBlock = true;
    } else if (trimmedLine.startsWith("else:")) {
      inElseBlock = true;
    } else if (trimmedLine.startsWith("elif ")) {
      inElifBlock = true;
    } else if (trimmedLine.startsWith("for ")) {
      inForLoop = true;
    } else if (trimmedLine.startsWith("while ")) {
      inWhileLoop = true;
    } else if (trimmedLine.startsWith("try:")) {
      inTryBlock = true;
    } else if (trimmedLine.startsWith("except")) {
      inExceptBlock = true;
    } else if (trimmedLine.startsWith("finally:")) {
      inFinallyBlock = true;
    }

    // Update indent level for next line
    if (trimmedLine.endsWith(":")) {
      indentLevel++;
    }
  }

  return formattedLines.join("\n");
}

// Java formatter - Enhanced implementation
function formatJava(code: string): string {
  const lines = code.split("\n");
  const formattedLines: string[] = [];
  let indentLevel = 0;
  let inClass = false;
  let inMethod = false;
  let inIfBlock = false;
  let inElseBlock = false;
  let inForLoop = false;
  let inWhileLoop = false;
  let inSwitchBlock = false;
  let inCaseBlock = false;
  let inTryBlock = false;
  let inCatchBlock = false;
  let inFinallyBlock = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    let currentIndent = indentLevel;

    // Handle special cases for indentation
    if (trimmedLine.startsWith("}")) {
      currentIndent = Math.max(0, indentLevel - 1);
      // Reset block flags
      inClass = false;
      inMethod = false;
      inIfBlock = false;
      inElseBlock = false;
      inForLoop = false;
      inWhileLoop = false;
      inSwitchBlock = false;
      inCaseBlock = false;
      inTryBlock = false;
      inCatchBlock = false;
      inFinallyBlock = false;
    }

    // Add proper indentation
    if (trimmedLine.length > 0) {
      // Add extra indentation for class content
      if (inClass) {
        currentIndent++;
      }
      // Add extra indentation for method content
      if (inMethod) {
        currentIndent++;
      }
      // Add extra indentation for control structures
      if (inIfBlock || inElseBlock || inForLoop || inWhileLoop || inSwitchBlock || inCaseBlock || inTryBlock || inCatchBlock || inFinallyBlock) {
        currentIndent++;
      }

      formattedLines.push("    ".repeat(currentIndent) + trimmedLine);
    } else {
      formattedLines.push("");
    }

    // Update block flags
    if (trimmedLine.startsWith("class ")) {
      inClass = true;
    } else if (trimmedLine.includes("(") && trimmedLine.includes(")")) {
      inMethod = true;
    } else if (trimmedLine.startsWith("if ")) {
      inIfBlock = true;
    } else if (trimmedLine.startsWith("else ")) {
      inElseBlock = true;
    } else if (trimmedLine.startsWith("for ")) {
      inForLoop = true;
    } else if (trimmedLine.startsWith("while ")) {
      inWhileLoop = true;
    } else if (trimmedLine.startsWith("switch ")) {
      inSwitchBlock = true;
    } else if (trimmedLine.startsWith("case ")) {
      inCaseBlock = true;
    } else if (trimmedLine.startsWith("try ")) {
      inTryBlock = true;
    } else if (trimmedLine.startsWith("catch ")) {
      inCatchBlock = true;
    } else if (trimmedLine.startsWith("finally ")) {
      inFinallyBlock = true;
    }

    // Update indent level for next line
    if (trimmedLine.endsWith("{")) {
      indentLevel++;
    }
  }

  return formattedLines.join("\n");
}
