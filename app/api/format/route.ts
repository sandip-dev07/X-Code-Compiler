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

// C++ formatter - Basic implementation
function formatCpp(code: string): string {
  // This is a simplified formatter for C++
  // In a production environment, you would use a proper C++ formatter like clang-format

  const lines = code.split("\n");
  const formattedLines: string[] = [];
  let indentLevel = 0;

  for (const line of lines) {
    // Trim whitespace
    const trimmedLine = line.trim();

    // Decrease indent for closing braces
    if (trimmedLine.startsWith("}") || trimmedLine.startsWith(")")) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Add proper indentation
    if (trimmedLine.length > 0) {
      formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
    } else {
      formattedLines.push("");
    }

    // Increase indent for opening braces
    if (trimmedLine.endsWith("{") || trimmedLine.endsWith("(")) {
      indentLevel++;
    }
  }

  return formattedLines.join("\n");
}

// Python formatter - Basic implementation
function formatPython(code: string): string {
  // This is a simplified formatter for Python
  // In a production environment, you would use a proper Python formatter like black or autopep8

  const lines = code.split("\n");
  const formattedLines: string[] = [];
  let indentLevel = 0;

  for (const line of lines) {
    // Trim whitespace
    const trimmedLine = line.trim();

    // Decrease indent for certain keywords
    if (
      trimmedLine.startsWith("else:") ||
      trimmedLine.startsWith("elif ") ||
      trimmedLine.startsWith("except:") ||
      trimmedLine.startsWith("except ") ||
      trimmedLine.startsWith("finally:")
    ) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Add proper indentation
    if (trimmedLine.length > 0) {
      formattedLines.push("    ".repeat(indentLevel) + trimmedLine);
    } else {
      formattedLines.push("");
    }

    // Increase indent for lines ending with colon
    if (trimmedLine.endsWith(":")) {
      indentLevel++;
    }
  }

  return formattedLines.join("\n");
}

// Java formatter - Basic implementation
function formatJava(code: string): string {
  // This is a simplified formatter for Java
  // In a production environment, you would use a proper Java formatter

  const lines = code.split("\n");
  const formattedLines: string[] = [];
  let indentLevel = 0;

  for (const line of lines) {
    // Trim whitespace
    const trimmedLine = line.trim();

    // Decrease indent for closing braces
    if (trimmedLine.startsWith("}")) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Add proper indentation
    if (trimmedLine.length > 0) {
      formattedLines.push("    ".repeat(indentLevel) + trimmedLine);
    } else {
      formattedLines.push("");
    }

    // Increase indent for opening braces
    if (trimmedLine.endsWith("{")) {
      indentLevel++;
    }
  }

  return formattedLines.join("\n");
}
