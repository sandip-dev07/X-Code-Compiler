"use client";

import { useState } from "react";
import { X, Plus, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { languageConfigs } from "@/constants/language-configs";
import { languageIcons } from "@/constants/language-icons";

export interface TabFile {
  id: string;
  name: string;
  language: string;
  code: string;
  isActive: boolean;
}

interface EditorTabsProps {
  tabs: TabFile[];
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabAdd: () => void;
  onTabRename: (tabId: string, newName: string) => void;
}

export function EditorTabs({
  tabs,
  onTabChange,
  onTabClose,
  onTabAdd,
  onTabRename,
}: EditorTabsProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  const handleDoubleClick = (tab: TabFile) => {
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  };

  const handleRenameBlur = () => {
    if (editingTabId && editingName.trim()) {
      onTabRename(editingTabId, editingName);
    }
    setEditingTabId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameBlur();
    } else if (e.key === "Escape") {
      setEditingTabId(null);
    }
  };

  const getFileIcon = (language: string) => {
    return (
      languageIcons[language as keyof typeof languageIcons] || (
        <FileCode className="h-4 w-4" />
      )
    );
  };

  return (
    <div className="flex items-center bg-zinc-900 border-b border-zinc-800 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex items-center min-w-[120px] max-w-[200px] h-9 px-3 border-r border-zinc-800 cursor-pointer group ${
            tab.isActive ? "bg-zinc-800" : "hover:bg-zinc-800/50"
          }`}
          onClick={() => handleTabClick(tab.id)}
          onDoubleClick={() => handleDoubleClick(tab)}
        >
          <div className="mr-2">{getFileIcon(tab.language)}</div>

          {editingTabId === tab.id ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleRenameBlur}
              onKeyDown={handleRenameKeyDown}
              className="bg-zinc-700 text-white px-1 py-0.5 text-sm w-full outline-none"
              autoFocus
            />
          ) : (
            <span className="text-sm truncate flex-1">{tab.name}</span>
          )}

          {tab.isActive && (
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}

      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 ml-1"
              onClick={onTabAdd}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>New File</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
