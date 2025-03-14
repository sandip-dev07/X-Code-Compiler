"use client";

import type React from "react";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import dynamic from "next/dynamic";
import {
  RotateCcw,
  Maximize2,
  Upload,
  Download,
  Share2,
  Check,
  RefreshCw,
  Wifi,
  WifiOff,
  Users,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { pusherClient } from "@/lib/pusher";
import { nanoid } from "@/lib/nanoid";

import { codeTemplates } from "@/constants/code-templates";
import { languageConfigs } from "@/constants/language-configs";
import { languageIcons } from "@/constants/language-icons";

const SimpleCodeEditor = dynamic(
  () => import("@/components/simple-code-editor"),
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
  const [isPulling, setIsPulling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(1); // Start with 1 (self)
  const [clientId] = useState(nanoid()); // Unique ID for this client
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

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
  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }, []);

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
      500 // Reduced debounce time for more responsive real-time updates
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
        if (newSplit >= 10 && newSplit <= 90) {
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
    setCode(codeTemplates[language as keyof typeof codeTemplates]);
    setOutput("");
    setInput("");
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
  const handleFileSave = () => {
    const config = languageConfigs[language as keyof typeof languageConfigs];
    const fileExtension = config.fileExtension;
    const fileName = `code.${fileExtension}`;

    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Add a new function to pull the latest code changes
  const pullLatestCode = async () => {
    if (!sessionId) return;

    try {
      setIsPulling(true);
      const response = await fetch(`/api/sessions?id=${sessionId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch latest code: ${response.statusText}`);
      }

      const data = await response.json();

      // Update local state with the latest code from the server
      isReceivingUpdate.current = true;
      setLanguage(data.language);
      setCode(data.code);
      setInput(data.input);

      setTimeout(() => {
        isReceivingUpdate.current = false;
      }, 100);

      toast({
        title: "Updated!",
        description: "Successfully pulled the latest code changes.",
      });
    } catch (error) {
      console.error("Error pulling latest code:", error);
      toast({
        title: "Failed to update",
        description: "Couldn't fetch the latest code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPulling(false);
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
      className="h-[98vh] w-[99vw] bg-black text-white overflow-hidden rounded-lg"
    >
      <div className="flex h-full" style={{ flexWrap: "nowrap" }}>
        {/* Left Panel - Code Editor */}
        <div
          className="flex flex-col h-full overflow-hidden"
          style={{ width: `${colSplit}%` }}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 h-12 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center space-x-2">
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-[140px] bg-zinc-800 border-zinc-700">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {languageIcons[language as keyof typeof languageIcons]}
                      {language === "cpp"
                        ? "C++"
                        : language.charAt(0).toUpperCase() + language.slice(1)}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpp">
                    <div className="flex items-center gap-2">
                      {languageIcons.cpp}
                      C++
                    </div>
                  </SelectItem>
                  <SelectItem value="javascript">
                    <div className="flex items-center gap-2">
                      {languageIcons.javascript}
                      JavaScript
                    </div>
                  </SelectItem>
                  <SelectItem value="python">
                    <div className="flex items-center gap-2">
                      {languageIcons.python}
                      Python
                    </div>
                  </SelectItem>
                  <SelectItem value="java">
                    <div className="flex items-center gap-2">
                      {languageIcons.java}
                      Java
                    </div>
                  </SelectItem>
                  <SelectItem value="csharp">
                    <div className="flex items-center gap-2">
                      {languageIcons.csharp}
                      C#
                    </div>
                  </SelectItem>
                  <SelectItem value="ruby">
                    <div className="flex items-center gap-2">
                      {languageIcons.ruby}
                      Ruby
                    </div>
                  </SelectItem>
                  <SelectItem value="go">
                    <div className="flex items-center gap-2">
                      {languageIcons.go}
                      Go
                    </div>
                  </SelectItem>
                  <SelectItem value="rust">
                    <div className="flex items-center gap-2">
                      {languageIcons.rust}
                      Rust
                    </div>
                  </SelectItem>
                  <SelectItem value="php">
                    <div className="flex items-center gap-2">
                      {languageIcons.php}
                      PHP
                    </div>
                  </SelectItem>
                  <SelectItem value="sql">
                    <div className="flex items-center gap-2">
                      {languageIcons.sql}
                      SQL
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* File operations */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".cpp,.cc,.h,.hpp,.js,.mjs,.py,.java,.cs,.rb,.go,.rs,.php,.sql"
              />
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open File</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={handleFileSave}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save File</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {sessionId && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center relative">
                        <div className="flex items-center gap-1">
                          {isConnected ? (
                            <Wifi className="h-4 w-4 text-[#73DC8C]" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-red-500" />
                          )}
                          {isConnected && (
                            <span className="text-xs font-medium bg-zinc-800 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Users className="h-3 w-3" />
                              {connectedUsers}
                            </span>
                          )}
                        </div>
                        {isUpdating && (
                          <div className="flex justify-center absolute -top-1 -right-1">
                            <span className="relative flex h-[6px] w-[6px]">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-300 opacity-75"></span>
                              <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-yellow-400"></span>
                            </span>
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {isConnected
                          ? isUpdating
                            ? "Code updated by another user"
                            : `${connectedUsers} user${
                                connectedUsers !== 1 ? "s" : ""
                              } connected`
                          : "Real-time sync disconnected"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {isSaving && (
                <span className="text-xs text-zinc-500 animate-pulse">
                  Saving...
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={resetCode}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset Code</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={toggleFullscreen}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle Fullscreen</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {sessionId && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        onClick={pullLatestCode}
                        disabled={isPulling}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            isPulling ? "animate-spin" : ""
                          }`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Pull Latest Code</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {sessionId && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        onClick={shareSession}
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Share Editor Link</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <Button
                onClick={compileAndRun}
                disabled={isLoading}
                className="bg-[#73DC8C] hover:bg-[#73DC8C]/90 text-white"
                aria-label="Run code"
              >
                {isLoading ? "Running..." : "Run Code"}
              </Button>
            </div>
          </div>

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

        {/* Rest of the component remains unchanged */}
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
        </div>
      </div>
    </div>
  );
}
