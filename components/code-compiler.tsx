"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useToast } from "@/hooks/use-toast";
import { pusherClient } from "@/lib/pusher";
import { nanoid } from "@/lib/nanoid";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { codeTemplates } from "@/constants/code-templates";
import { languageConfigs } from "@/constants/language-configs";
import { EditorNavbar } from "./editor-navbar";
import { OutputPanel } from "./output-panel";
import { useDebounce } from "@/hooks/use-debounce";

const SimpleCodeEditor = dynamic(
  () => import("@/components/codemirror-editor"),
  {
    ssr: false,
    loading: () => <div className="h-screen bg-slate-800 animate-pulse" />,
  }
);

interface CodeCompilerProps {
  initialLanguage?: string;
  initialCode?: string;
  initialInput?: string;
  sessionId?: string;
}

export default function CodeCompiler({
  initialLanguage = "cpp",
  initialCode = codeTemplates.cpp,
  initialInput = "",
  sessionId,
}: CodeCompilerProps) {
  const [language, setLanguage] = useState(initialLanguage);
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState("");
  const [input, setInput] = useState(initialInput);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(1); // Start with 1 (self)
  const [clientId] = useState(nanoid()); // Unique ID for this client
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // Resize state
  const [colSplit, setColSplit] = useState(55); // Percentage split between editor and output
  const [rowSplit, setRowSplit] = useState(66); // Percentage split between output and input
  const [isColResizing, setIsColResizing] = useState(false);
  const [isRowResizing, setIsRowResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Flag to prevent infinite loops when receiving updates
  const isReceivingUpdate = useRef(false);

  // Debounce function to avoid too many API calls
  const debounce = useDebounce();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Set up Pusher connection for real-time updates
  useEffect(() => {
    if (!sessionId || !mounted) return;

    const channel = pusherClient.subscribe(`session-${sessionId}`);

    // Send heartbeat every 30 seconds to keep presence active
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetch("/api/sessions/presence", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            clientId,
            action: "heartbeat",
          }),
        }).catch((error) => console.error("Heartbeat error:", error));
      }
    }, 30000); // 30 seconds

    // Announce this client's presence when joining
    const announcePresence = async () => {
      try {
        await fetch("/api/sessions/presence", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            clientId,
            action: "join",
          }),
        });
      } catch (error) {
        console.error("Error announcing presence:", error);
      }
    };

    // Set connected status when subscription succeeds
    channel.bind("pusher:subscription_succeeded", () => {
      setIsConnected(true);
      announcePresence();
      toast({
        title: "Connected!",
        description: "You'll now see real-time updates from other users.",
      });
    });

    // Handle connection errors
    channel.bind("pusher:subscription_error", () => {
      setIsConnected(false);
      toast({
        title: "Connection failed",
        description: "Could not connect to real-time updates.",
        variant: "destructive",
      });
    });

    // Listen for code updates from other clients
    channel.bind("code-updated", (data: any) => {
      // Skip if this update came from the current client
      if (data.source === clientId) return;

      isReceivingUpdate.current = true;

      // Update local state with the received data
      setLanguage(data.language);
      setCode(data.code);
      setInput(data.input);

      // Set a temporary flag to show the pulse animation
      setIsUpdating(true);

      // Clear the updating flag after 2 seconds
      setTimeout(() => {
        setIsUpdating(false);
        isReceivingUpdate.current = false;
      }, 2000);
    });

    // Listen for user presence updates
    channel.bind("presence-update", (data: { count: number }) => {
      setConnectedUsers(data.count);
    });

    // Handle beforeunload to ensure we announce departure
    const handleBeforeUnload = () => {
      fetch("/api/sessions/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          clientId,
          action: "leave",
        }),
        // Use keepalive to ensure the request completes even if the page is unloading
        keepalive: true,
      }).catch((error) => console.error("Error announcing departure:", error));
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Also handle visibility change to update presence when tab becomes visible/hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Tab is now visible, announce presence
        announcePresence();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Clean up on unmount
    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      // Announce departure
      fetch("/api/sessions/presence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          clientId,
          action: "leave",
        }),
      }).catch((error) => console.error("Error announcing departure:", error));

      pusherClient.unsubscribe(`session-${sessionId}`);
    };
  }, [sessionId, mounted, toast, clientId]);

  // Save session state when code, language, or input changes
  const saveSession = useCallback(
    debounce(
      async (
        sessionId: string,
        language: string,
        code: string,
        input: string
      ) => {
        try {
          // Don't save if we're currently receiving an update from another client
          if (isReceivingUpdate.current) return;

          setIsSaving(true);
          await fetch("/api/sessions", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId,
              language,
              code,
              input,
              source: clientId, // Include the client ID to identify the source
            }),
          });
        } catch (error) {
          console.error("Error saving session:", error);
          toast({
            title: "Failed to save",
            description: "Your changes couldn't be saved. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsSaving(false);
        }
      },
      1000 // Reduced debounce time for more responsive real-time updates
    ),
    [toast, clientId, debounce]
  );

  // Update session when code, language, or input changes
  useEffect(() => {
    if (sessionId && mounted && !isReceivingUpdate.current) {
      saveSession(sessionId, language, code, input);
    }
  }, [language, code, input, sessionId, mounted, saveSession]);

  // Add keyboard shortcut for compiling and running code
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl + Shift + Enter
      if (event.ctrlKey && event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        compileAndRun();
      }
    };

    // Add event listener
    window.addEventListener("keydown", handleKeyDown);

    // Clean up
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [code, language, input]); // Add dependencies for compileAndRun

  // Column resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isColResizing && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newSplit =
          ((e.clientX - containerRect.left) / containerRect.width) * 100;

        // Limit the resize range (10% to 90%)
        if (newSplit >= 5 && newSplit <= 95) {
          setColSplit(newSplit);
        }
      }

      if (isRowResizing && rightPanelRef.current) {
        const panelRect = rightPanelRef.current.getBoundingClientRect();
        const newSplit = ((e.clientY - panelRect.top) / panelRect.height) * 100;

        // Limit the resize range (20% to 80%)
        if (newSplit >= 20 && newSplit <= 80) {
          setRowSplit(newSplit);
        }
      }
    };

    const handleMouseUp = () => {
      setIsColResizing(false);
      setIsRowResizing(false);
    };

    if (isColResizing || isRowResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      // Add a cursor style to the body during resize
      document.body.style.cursor = isColResizing ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isColResizing, isRowResizing]);

  // Update code when language changes
  const handleLanguageChange = (newLanguage: string) => {
    // Only reset code if it's the default template for the current language
    const isCurrentDefault =
      code === codeTemplates[language as keyof typeof codeTemplates];

    setLanguage(newLanguage);

    if (isCurrentDefault) {
      setCode(codeTemplates[newLanguage as keyof typeof codeTemplates]);
    }

    setOutput("");
  };

  const compileAndRun = async () => {
    setIsLoading(true);
    try {
      const config = languageConfigs[language as keyof typeof languageConfigs];

      const response = await fetch("/api/compile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: config.language,
          version: config.version,
          fileExtension: config.fileExtension,
          code,
          stdin: input,
        }),
      });

      const data = await response.json();

      if (data.compile_error) {
        setOutput(`Compilation Error:\n${data.compile_error}`);
      } else if (data.run_error) {
        setOutput(`Runtime Error:\n${data.run_error}`);
      } else {
        setOutput(data.output || "No output");
      }
    } catch (error) {
      setOutput(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const resetCode = () => {
    setIsResetDialogOpen(true);
  };

  const handleResetConfirm = () => {
    setCode(codeTemplates[language as keyof typeof codeTemplates]);
    setOutput("");
    setInput("");
    setIsResetDialogOpen(false);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension and set language if possible
    const fileName = file.name;
    const fileExtension = fileName.split(".").pop()?.toLowerCase();

    // Map file extension to language
    const extensionToLanguage: Record<string, string> = {
      cpp: "cpp",
      cc: "cpp",
      h: "cpp",
      hpp: "cpp",
      js: "javascript",
      mjs: "javascript",
      py: "python",
      java: "java",
      cs: "csharp",
      rb: "ruby",
      go: "go",
      rs: "rust",
      php: "php",
      sql: "sql",
    };

    if (fileExtension && extensionToLanguage[fileExtension]) {
      setLanguage(extensionToLanguage[fileExtension]);
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCode(content);
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle file save
  const handleFileSave = async () => {
    const config = languageConfigs[language as keyof typeof languageConfigs];
    const fileExtension = config.fileExtension;
    const suggestedName = `main.${fileExtension}`;
    const content = code;

    // Try to use the File System Access API if available
    if ("showSaveFilePicker" in window) {
      try {
        // @ts-ignore - TypeScript might not recognize showSaveFilePicker
        const fileHandle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "Text Files",
              accept: { "text/plain": [`.${fileExtension}`] },
            },
          ],
        });

        // Create a writable stream and write the content
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        toast({
          title: "File saved!",
          description: "Your code has been saved successfully.",
        });
      } catch (err) {
        // User cancelled or error occurred
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Error saving file:", err);
          toast({
            title: "Save failed",
            description: "There was an error saving your file.",
            variant: "destructive",
          });
        }
      }
    } else {
      // Fallback for browsers that don't support the File System Access API
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "File downloaded",
        description: "Your code has been downloaded.",
      });
    }
  };

  // Share the current session
  const shareSession = () => {
    if (!sessionId) return;

    const url = `${window.location.origin}/${sessionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      toast({
        title: "Link copied!",
        description:
          "Share this link with others to collaborate on the same code.",
      });

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };

  // Start column resize
  const startColResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsColResizing(true);
  };

  // Start row resize
  const startRowResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsRowResizing(true);
  };

  return (
    <div
      ref={containerRef}
      className="h-[99%] w-[99.5%] bg-black text-white overflow-hidden rounded-md"
    >
      <div className="flex h-full" style={{ flexWrap: "nowrap" }}>
        {/* Left Panel - Code Editor */}
        <div
          className="flex flex-col h-full overflow-hidden"
          style={{ width: `${colSplit}%` }}
        >
          {/* Top Bar */}
          <EditorNavbar
            language={language}
            isLoading={isLoading}
            isSaving={isSaving}
            isCopied={isCopied}
            isConnected={isConnected}
            isUpdating={isUpdating}
            connectedUsers={connectedUsers}
            sessionId={sessionId}
            clientId={clientId}
            fileInputRef={fileInputRef}
            handleLanguageChange={handleLanguageChange}
            resetCode={resetCode}
            toggleFullscreen={toggleFullscreen}
            handleFileUpload={handleFileUpload}
            handleFileSave={handleFileSave}
            shareSession={shareSession}
            compileAndRun={compileAndRun}
          />

          {/* Code Editor - Full height with scroll */}
          <div className="flex-1 overflow-hidden relative">
            {mounted && (
              <div className="absolute inset-0">
                <SimpleCodeEditor
                  value={code}
                  onChange={setCode}
                  language={language}
                />
              </div>
            )}
          </div>
        </div>

        {/* Column Resize Handle */}
        <div
          className="w-1 h-full bg-zinc-800 hover:bg-[#73DC8C] cursor-col-resize flex-shrink-0 relative group"
          onMouseDown={startColResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize code editor"
          tabIndex={0}
          onKeyDown={(e) => {
            // Allow keyboard control of the resize handle
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setColSplit(Math.max(10, colSplit - 1));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              setColSplit(Math.min(90, colSplit + 1));
            }
          }}
        >
          <div className="absolute inset-0 w-4 -left-2 group-hover:bg-transparent" />
        </div>

        {/* Right Panel - Output and Input */}
        <div
          ref={rightPanelRef}
          className="flex flex-col h-full overflow-hidden"
          style={{ width: `${100 - colSplit}%` }}
        >
          <OutputPanel
            output={output}
            input={input}
            rowSplit={rowSplit}
            startRowResize={startRowResize}
            setInput={setInput}
            setRowSplit={setRowSplit}
          />
        </div>
      </div>
      {/* Reset Confirmation Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent className="bg-zinc-900 border border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Code?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will reset your code to the default template for{" "}
              {language === "cpp" ? "C++" : language}. Any unsaved changes will
              be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
