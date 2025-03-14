import { NextResponse } from "next/server";

interface CompileRequest {
  language: string;
  version: string;
  fileExtension: string;
  code: string;
  stdin: string;
}

// Mark this route as dynamic to prevent static generation
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { language, version, fileExtension, code, stdin } =
      (await request.json()) as CompileRequest;

    // Call Piston API
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language,
        version,
        files: [
          {
            name: `main.${fileExtension}`,
            content: code,
          },
        ],
        stdin: stdin || "",
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to compile code" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      output: data.run.stdout,
      compile_error: data.compile?.stderr || "",
      run_error: data.run.stderr || "",
    });
  } catch (error) {
    console.error("Error in compile API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
