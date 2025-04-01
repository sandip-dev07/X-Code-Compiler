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
import { ChevronsLeftRight } from "lucide-react";

const SimpleCodeEditor = dynamic(
  () => import("@/components/codemirror-editor"),
  {
    ssr: false,
    loading: () => <div className="h-screen bg-zinc-800 animate-pulse" />,
  }
);

interface CodeCompilerProps {
  initialLanguage?: string;
  initialCode?: string;
  initialInput?: string;
  sessionId?: string;
}

// Add these constants at the top of the file
const API_ENDPOINTS = {
  COMPILE: '/api/compile',
  SESSIONS: '/api/sessions',
  PRESENCE: '/api/sessions/presence',
} as const;

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const UPDATE_ANIMATION_DURATION = 2000; // 2 seconds
const DEBOUNCE_DELAY = 1000; // 1 second

// Add these interfaces for API responses
interface CompileResponse {
  compile_error?: string;
  run_error?: string;
  output?: string;
}

interface CodeUpdateData {
  source: string;
  language: string;
  code: string;
  input: string;
}

interface PresenceUpdateData {
  count: number;
}

// Add these utility functions
const makeApiRequest = async <T,>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

const handleApiError = (error: unknown, toast: any) => {
  console.error('API Error:', error);
  toast({
    title: 'Error',
    description: error instanceof Error ? error.message : 'An unknown error occurred',
    variant: 'destructive',
  });
};

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

  // Optimize session saving with better debouncing
  const saveSession = useCallback(
    (sessionId: string, language: string, code: string, input: string) => {
      if (isReceivingUpdate.current) return;

      debounce(async () => {
        try {
          setIsSaving(true);
          await makeApiRequest(API_ENDPOINTS.SESSIONS, {
            method: 'PUT',
            body: JSON.stringify({
              sessionId,
              language,
              code,
              input,
              source: clientId,
            }),
          });
        } catch (error) {
          handleApiError(error, toast);
        } finally {
          setIsSaving(false);
        }
      }, DEBOUNCE_DELAY)();
    },
    [toast, clientId, debounce]
  );

  // Optimize compile and run function
  const compileAndRun = async () => {
    setIsLoading(true);
    try {
      const config = languageConfigs[language as keyof typeof languageConfigs];
      const data = await makeApiRequest<CompileResponse>(API_ENDPOINTS.COMPILE, {
        method: 'POST',
        body: JSON.stringify({
          language: config.language,
          version: config.version,
          fileExtension: config.fileExtension,
          code,
          stdin: input,
        }),
      });

      if (data.compile_error) {
        setOutput(`Compilation Error:\n${data.compile_error}`);
      } else if (data.run_error) {
        setOutput(`Runtime Error:\n${data.run_error}`);
      } else {
        setOutput(data.output || 'No output');
      }
    } catch (error) {
      handleApiError(error, toast);
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Optimize presence handling
  const handlePresence = async (action: 'join' | 'leave' | 'heartbeat') => {
    if (!sessionId) return;

    try {
      await makeApiRequest(API_ENDPOINTS.PRESENCE, {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          clientId,
          action,
        }),
      });
    } catch (error) {
      console.error(`Error handling presence (${action}):`, error);
    }
  };

  // Optimize Pusher setup
  useEffect(() => {
    if (!sessionId || !mounted) return;

    const channel = pusherClient.subscribe(`session-${sessionId}`);
    let heartbeatInterval: NodeJS.Timeout;

    const setupPusher = async () => {
      // Set up heartbeat
      heartbeatInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          handlePresence('heartbeat');
        }
      }, HEARTBEAT_INTERVAL);

      // Announce presence
      await handlePresence('join');

      // Set up event listeners
      channel.bind('pusher:subscription_succeeded', () => {
        setIsConnected(true);
        toast({
          title: 'Connected!',
          description: "You'll now see real-time updates from other users.",
        });
      });

      channel.bind('pusher:subscription_error', () => {
        setIsConnected(false);
        toast({
          title: 'Connection failed',
          description: 'Could not connect to real-time updates.',
          variant: 'destructive',
        });
      });

      channel.bind('code-updated', (data: CodeUpdateData) => {
        if (data.source === clientId) return;

        isReceivingUpdate.current = true;
        setLanguage(data.language);
        setCode(data.code);
        setInput(data.input);
        setIsUpdating(true);

        setTimeout(() => {
          setIsUpdating(false);
          isReceivingUpdate.current = false;
        }, UPDATE_ANIMATION_DURATION);
      });

      channel.bind('presence-update', (data: PresenceUpdateData) => {
        setConnectedUsers(data.count);
      });
    };

    setupPusher();

    // Cleanup function
    return () => {
      clearInterval(heartbeatInterval);
      handlePresence('leave');
      pusherClient.unsubscribe(`session-${sessionId}`);
    };
  }, [sessionId, mounted, toast, clientId]);

  // Optimize file handling
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const extensionToLanguage: Record<string, string> = {
      cpp: 'cpp', cc: 'cpp', h: 'cpp', hpp: 'cpp',
      js: 'javascript', mjs: 'javascript',
      py: 'python',
      java: 'java',
      cs: 'csharp',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      php: 'php',
      sql: 'sql',
    };

    if (fileExtension && extensionToLanguage[fileExtension]) {
      setLanguage(extensionToLanguage[fileExtension]);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCode(e.target?.result as string);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Optimize file saving
  const handleFileSave = useCallback(async () => {
    const config = languageConfigs[language as keyof typeof languageConfigs];
    const fileExtension = config.fileExtension;
    const suggestedName = `main.${fileExtension}`;

    try {
      if ('showSaveFilePicker' in window) {
        // @ts-ignore
        const fileHandle = await window.showSaveFilePicker({
          suggestedName,
          types: [{
            description: 'Text Files',
            accept: { 'text/plain': [`.${fileExtension}`] },
          }],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(code);
        await writable.close();

        toast({
          title: 'File saved!',
          description: 'Your code has been saved successfully.',
        });
      } else {
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'File downloaded',
          description: 'Your code has been downloaded.',
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        handleApiError(error, toast);
      }
    }
  }, [code, language, toast]);

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

  // Start column resize - Modified to only be triggered by the icon
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
          className="w-1 h-full bg-zinc-800 relative flex items-center justify-center"
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
          {/* Icon wrapper - only this triggers resize */}
          <div
            className="absolute flex items-center justify-center w-5 h-6 -ml-1 cursor-col-resize bg-zinc-700 rounded-sm group z-10"
            onMouseDown={startColResize}
          >
            <ChevronsLeftRight className="w-4 h-4 text-[#73DC8C]" />
          </div>
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
