"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RotateCcw,
  Maximize2,
  Upload,
  Download,
  Share2,
  Check,
  Wifi,
  WifiOff,
  Users,
} from "lucide-react";
import { languageIcons } from "@/constants/language-icons";
import type { RefObject } from "react";
import { VoiceChat } from "./voice-chat";

interface EditorNavbarProps {
  language: string;
  isLoading: boolean;
  isSaving: boolean;
  isCopied: boolean;
  isConnected: boolean;
  isUpdating: boolean;
  connectedUsers: number;
  sessionId?: string;
  clientId: string;
  fileInputRef: RefObject<HTMLInputElement>;
  handleLanguageChange: (newLanguage: string) => void;
  resetCode: () => void;
  toggleFullscreen: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileSave: () => void;
  shareSession: () => void;
  compileAndRun: () => void;
}

export function EditorNavbar({
  language,
  isLoading,
  isSaving,
  isCopied,
  isConnected,
  isUpdating,
  connectedUsers,
  sessionId,
  clientId,
  fileInputRef,
  handleLanguageChange,
  resetCode,
  toggleFullscreen,
  handleFileUpload,
  handleFileSave,
  shareSession,
  compileAndRun,
}: EditorNavbarProps) {
  return (
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
                      : `${connectedUsers} user${connectedUsers !== 1 ? "s" : ""} connected`
                    : "Real-time sync disconnected"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {isSaving && (
          <span className="text-xs text-zinc-500 animate-pulse">Saving...</span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {/* Voice Chat Component - Add it here */}
        {sessionId && <VoiceChat sessionId={sessionId} clientId={clientId} />}

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
  );
}
