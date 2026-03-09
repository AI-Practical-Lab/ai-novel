import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Send, Sparkles, BookOpen, User, ScrollText, FileText, Square } from 'lucide-react';
import { cn } from '@/utils';

// Types for Reference
export interface ReferenceOption {
  id: string;
  type: 'chapter' | 'lore' | 'bio' | 'summary';
  label: string;
  data: any; // The actual object (Chapter or Lore)
}

interface SmartTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void; // New callback for stopping generation
  isLoading?: boolean;
  placeholder?: string;
  references: ReferenceOption[]; // Available references to search from
  onReferenceAdd?: (ref: ReferenceOption) => void; // Callback when a reference is added
}

export const SmartTextarea = forwardRef<HTMLTextAreaElement, SmartTextareaProps>(({
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
  placeholder,
  references,
  onReferenceAdd
}, ref) => {
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorIndex, setCursorIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeMentionRef = useRef<HTMLButtonElement | null>(null);
  
  // Expose internal ref to parent
  useImperativeHandle(ref, () => textareaRef.current!);

  // Auto-resize effect when value changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
      
      // Ensure cursor is visible
      if (cursorIndex === value.length) {
         textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }
  }, [value]);

  useEffect(() => {
    if (activeMentionRef.current) {
      activeMentionRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [mentionIndex, showMentionList]);

  const filteredReferences = references.filter(ref => 
    ref.label.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const getIcon = (type: string) => {
      switch (type) {
          case 'chapter': return <BookOpen className="w-3 h-3" />;
          case 'bio': return <User className="w-3 h-3" />;
          case 'lore': return <ScrollText className="w-3 h-3" />;
          default: return <FileText className="w-3 h-3" />;
      }
  };

  const getTypeName = (type: string) => {
    switch (type) {
        case 'chapter': return '章节';
        case 'bio': return '人物';
        case 'lore': return '设定';
        default: return '资料';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorIndex = e.target.selectionStart;
    
    onChange(newValue);
    setCursorIndex(newCursorIndex);

    // Auto-resize is handled by useEffect now
    // Check for @ trigger
    const textBeforeCursor = newValue.slice(0, newCursorIndex);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const query = textBeforeCursor.slice(lastAtSymbol + 1);
      
      // If query contains whitespace or newline, close menu (unless we want to support multi-word search which is complex)
      // For now, simple implementation: close if space
      if (/\s/.test(query) || query.length > 20) {
        setShowMentionList(false);
      } else {
        setMentionQuery(query);
        setShowMentionList(true);
        setMentionIndex(0);
      }
    } else {
      setShowMentionList(false);
    }
  };

  const insertReference = (ref: ReferenceOption) => {
    const textBeforeCursor = value.slice(0, cursorIndex);
    const textAfterCursor = value.slice(cursorIndex);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
        const prefix = textBeforeCursor.slice(0, lastAtSymbol);
        
        // We insert just the name for display, but notify parent to track the reference
        const newValue = prefix + `@${ref.label} ` + textAfterCursor;
        onChange(newValue);
        setCursorIndex(newValue.length);
        setShowMentionList(false);
        
        if (onReferenceAdd) {
            onReferenceAdd(ref);
        }
        
        // Reset focus and cursor
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const len = newValue.length;
                try {
                  textareaRef.current.setSelectionRange(len, len);
                } catch {
                }
            }
        }, 0);
    }
  };
  
  // Handle Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (showMentionList && filteredReferences.length > 0) {
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setMentionIndex(prev => (prev + 1) % filteredReferences.length);
          } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setMentionIndex(prev => (prev - 1 + filteredReferences.length) % filteredReferences.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              insertReference(filteredReferences[mentionIndex]);
          } else if (e.key === 'Escape') {
              setShowMentionList(false);
          }
      } else if (e.key === 'Enter' && !e.shiftKey) {
          // Prevent send when using IME (Input Method Editor)
          if ((e.nativeEvent as any).isComposing) {
              return;
          }
          e.preventDefault();
          onSend();
      }
  };

  return (
    <div className="relative w-full">
      {/* Mention List Popup */}
      {showMentionList && filteredReferences.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-2 text-xs font-medium text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
             引用上下文
          </div>
          {filteredReferences.map((ref, idx) => (
            <button
              key={ref.id}
              ref={idx === mentionIndex ? activeMentionRef : undefined}
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors",
                idx === mentionIndex 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
              )}
              onClick={() => insertReference(ref)}
            >
               <span className="shrink-0 opacity-70">{getIcon(ref.type)}</span>
               <span className="truncate flex-1">{ref.label}</span>
               <span className="text-[10px] uppercase opacity-40 font-mono tracking-wider">{getTypeName(ref.type)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "输入消息... (输入 @ 引用)"}
          className="w-full bg-transparent border-0 resize-none focus:ring-0 p-0 min-h-12 max-h-40 text-sm leading-relaxed scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700"
          rows={1}
          disabled={isLoading}
        />
        
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (isLoading && onStop) {
                onStop();
            } else {
                onSend();
            }
          }}
          disabled={(!value.trim() && !isLoading)}
          className={cn(
            "p-2 rounded-lg shrink-0 transition-all",
            (value.trim() || isLoading)
              ? (isLoading ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow') 
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
          )}
        >
          {isLoading ? <Square className="w-4 h-4 fill-current" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
});

SmartTextarea.displayName = 'SmartTextarea';
