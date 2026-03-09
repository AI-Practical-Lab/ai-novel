import { useState, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { diffArrays, type Change } from 'diff';

// --- Types ---

interface DiffGroup {
  id: string;
  type: 'unchanged' | 'replace' | 'insert' | 'delete';
  originalValues: string[];
  modifiedValues: string[];
}

interface Props {
  originalContent: string;
  newContent: string;
  onApply: (finalContent: string) => void;
  onCancel: () => void;
  title?: string;
}

// --- Tokenizer: 按段落（行）切分 ---

const tokenizeSentences = (text: string): string[] => {
  if (!text) return [];
  const lines = text.split(/\n/);
  return lines.map((line, idx) =>
    idx < lines.length - 1 ? `${line}\n` : line
  );
};

export default function DiffViewer({ 
  originalContent, 
  newContent, 
  onApply, 
  onCancel, 
  title = 'AI 优化预览'
}: Props) {
  // State
  const [diffGroups, setDiffGroups] = useState<DiffGroup[]>([]);
  const [decisions, setDecisions] = useState<Record<number, 'accept' | 'reject' | 'pending'>>({});
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  
  // --- 1. Compute Diff & Groups ---
  
  useEffect(() => {
    // 1. Tokenize
    const oldTokens = tokenizeSentences(originalContent);
    const newTokens = tokenizeSentences(newContent);
    
    // 2. Diff Arrays (Sentence Level)
    const changes = diffArrays(oldTokens, newTokens);
    
    // 3. Group Changes (Merge adjacent Remove+Add into Replace, but split large blocks)
    const groups: DiffGroup[] = [];
    let i = 0;
    
    while (i < changes.length) {
      const current = changes[i];
      const idPrefix = `diff-${i}-${Date.now()}`;
      
      // Unchanged
      if (!current.added && !current.removed) {
        groups.push({
          id: `${idPrefix}-unchanged`,
          type: 'unchanged',
          originalValues: current.value,
          modifiedValues: current.value
        });
        i++;
        continue;
      }
      
      // Check for Replace (Remove followed by Add)
      if (current.removed && i + 1 < changes.length && changes[i + 1].added) {
        const next = changes[i + 1];
        const removedLines = current.value;
        const addedLines = next.value;
        
        // Interleave the replace block to avoid "Giant Red Block then Giant Green Block"
        // We map them 1-to-1 as much as possible.
        const maxLen = Math.max(removedLines.length, addedLines.length);
        
        for (let k = 0; k < maxLen; k++) {
          const originalPart = k < removedLines.length ? [removedLines[k]] : [];
          const modifiedPart = k < addedLines.length ? [addedLines[k]] : [];
          
          // Determine subtype based on what we have
          let subtype: 'replace' | 'delete' | 'insert' = 'replace';
          if (originalPart.length === 0) subtype = 'insert';
          else if (modifiedPart.length === 0) subtype = 'delete';
          
          groups.push({
            id: `${idPrefix}-replace-${k}`,
            type: subtype, // Visually it's part of a replace flow, but we can be specific
            originalValues: originalPart,
            modifiedValues: modifiedPart
          });
        }
        
        i += 2;
        continue;
      }
      
      // Pure Delete
      if (current.removed) {
        groups.push({
          id: `${idPrefix}-delete`,
          type: 'delete',
          originalValues: current.value,
          modifiedValues: []
        });
        i++;
        continue;
      }
      
      // Pure Insert
      if (current.added) {
        groups.push({
          id: `${idPrefix}-insert`,
          type: 'insert',
          originalValues: [],
          modifiedValues: current.value
        });
        i++;
        continue;
      }
      
      i++;
    }
    
    setDiffGroups(groups);
    
    // Default Decisions: Pending
    const initialDecisions: Record<number, 'accept' | 'reject' | 'pending'> = {};
    groups.forEach((g, idx) => {
      if (g.type !== 'unchanged') {
        initialDecisions[idx] = 'pending';
      }
    });
    setDecisions(initialDecisions);
    
    // Set initial focus to first change
    const firstChange = groups.findIndex(g => g.type !== 'unchanged');
    setCurrentIdx(firstChange === -1 ? 0 : firstChange);
    
  }, [originalContent, newContent]);

  // --- 2. Actions ---

  const handleDecision = (idx: number, decision: 'accept' | 'reject') => {
    setDecisions(prev => ({ ...prev, [idx]: decision }));
    // Auto jump to next
    setTimeout(() => {
        goNext();
    }, 50);
  };

  const handleApplyAll = () => {
    let finalContent = '';
    diffGroups.forEach((group, idx) => {
      const decision = decisions[idx] || 'pending';
      if (group.type === 'unchanged') {
        finalContent += group.originalValues.join('');
      } else if (decision === 'accept' || decision === 'pending') {
        finalContent += group.modifiedValues.join('');
      } else {
        finalContent += group.originalValues.join('');
      }
    });
    onApply(finalContent);
  };

  const handleAcceptAllAndApply = () => {
    const next: Record<number, 'accept' | 'reject' | 'pending'> = {};
    diffGroups.forEach((g, idx) => {
      if (g.type !== 'unchanged') {
        next[idx] = 'accept';
      }
    });
    setDecisions(next);
    let finalContent = '';
    diffGroups.forEach(group => {
      if (group.type === 'unchanged') {
        finalContent += group.originalValues.join('');
      } else {
        finalContent += group.modifiedValues.join('');
      }
    });
    onApply(finalContent);
  };

  const setAllDecisions = (decision: 'accept' | 'reject') => {
    const next = { ...decisions };
    diffGroups.forEach((g, idx) => {
      if (g.type !== 'unchanged') {
        next[idx] = decision;
      }
    });
    setDecisions(next);
  };

  // --- 3. Navigation ---

  const goNext = () => {
    // We need to find the next *change* group
    // But since we use currentIdx (state) which might be stale in a closure if not careful,
    // we should use the functional update or just rely on the fact that handleDecision calls this.
    // However, handleDecision is a closure. 'currentIdx' is the value at render time.
    // If user clicks idx=5. currentIdx might be 5. Next is >5.
    // So logic is: find first change group > idx passed? 
    // Actually handleDecision doesn't pass next idx.
    // Let's rely on setCurrentIdx updater to be safe? 
    // No, goNext reads `currentIdx`.
    
    // Better implementation for "Jump to NEXT CHANGE from CURRENT":
    setCurrentIdx(prev => {
        let next = prev + 1;
        while (next < diffGroups.length && diffGroups[next].type === 'unchanged') {
          next++;
        }
        if (next < diffGroups.length) {
          // Side effect in setState updater is bad practice usually, but scrolling is UI.
          // Better: use useEffect to scroll when currentIdx changes?
          // But we only want to scroll on user action.
          // Let's do the scroll outside.
          setTimeout(() => {
             document.getElementById(`diff-group-${next}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 0);
          return next;
        }
        return -1; // Deselect if no more
    });
  };

  const goPrev = () => {
    setCurrentIdx(prev => {
        let p = prev === -1 ? diffGroups.length - 1 : prev - 1;
        while (p >= 0 && diffGroups[p].type === 'unchanged') {
          p--;
        }
        if (p >= 0) {
           setTimeout(() => {
             document.getElementById(`diff-group-${p}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
           }, 0);
           return p;
        }
        return prev;
    });
  };


  // --- 4. Render Helpers ---
  
  const stats = useMemo(() => {
    const total = diffGroups.filter(g => g.type !== 'unchanged').length;
    const accepted = Object.entries(decisions).filter(([idx, d]) => {
      const g = diffGroups[parseInt(idx)];
      return g && g.type !== 'unchanged' && d === 'accept';
    }).length;
    return { total, accepted };
  }, [diffGroups, decisions]);

  return (
    <div className="absolute inset-0 z-10 bg-white dark:bg-zinc-900 flex flex-col animate-in fade-in duration-200">
      <div className="flex flex-col border-b border-zinc-200 dark:border-zinc-800 bg-purple-50/50 dark:bg-purple-900/10 shadow-sm z-20 shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              {title}
              <span className="text-xs font-normal text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                {stats.accepted} / {stats.total} 变更
              </span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={goPrev}
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                title="上一个"
              >
                <ArrowUp className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </button>
              <button
                onClick={goNext}
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                title="下一个"
              >
                <ArrowDown className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-4 border-r border-zinc-300 dark:border-zinc-700 pr-4">
              <button
                onClick={() => setAllDecisions('reject')}
                className="text-xs font-medium text-zinc-500 hover:text-red-600 transition-colors"
              >
                全部拒绝
              </button>
              <button
                onClick={handleAcceptAllAndApply}
                className="text-xs font-medium text-zinc-500 hover:text-green-600 transition-colors"
              >
                全部接受
              </button>
            </div>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleApplyAll}
              className="px-4 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              应用修改
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="min-h-full px-6 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 tracking-wide flex items-center justify-between">
              <span>原文</span>
              <span className="text-[10px] text-zinc-400">AI 不会改动此列内容</span>
            </div>
            <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 tracking-wide flex items-center justify-between">
              <span>AI 修改后</span>
              <span className="text-[10px] text-zinc-400">此列显示应用 AI 建议后的版本</span>
            </div>
            {diffGroups.map((group, idx) => {
              const isCurrent = currentIdx === idx;
              const decision = decisions[idx] || 'pending';
              const isPending = decision === 'pending';
              const isAccepted = decision === 'accept';
              const isRejected = decision === 'reject';

              if (group.type === 'unchanged') {
                return (
                  <div
                    key={group.id}
                    className="col-span-2 grid grid-cols-2 gap-6 text-sm text-zinc-500 whitespace-pre-wrap"
                  >
                    <div>{group.originalValues.join('')}</div>
                    <div>{group.modifiedValues.join('')}</div>
                  </div>
                );
              }

              const rowClasses = [
                'col-span-2',
                'grid grid-cols-2 gap-6',
                'py-3 px-3',
                'rounded-lg',
                'cursor-pointer',
                'whitespace-pre-wrap',
                'transition-colors'
              ];

              if (isAccepted) {
                rowClasses.push('bg-emerald-50 dark:bg-emerald-900/20', 'border', 'border-emerald-300/70');
              } else if (isRejected) {
                rowClasses.push('bg-red-50 dark:bg-red-900/20', 'border', 'border-red-300/70');
              } else if (isPending) {
                rowClasses.push('bg-amber-50 dark:bg-amber-900/20', 'border', 'border-amber-300/70');
              }

              if (isCurrent) {
                rowClasses.push('shadow-sm');
              }

              return (
                <div
                  key={group.id}
                  id={`diff-group-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIdx(idx);
                  }}
                  className={rowClasses.join(' ')}
                >
                  <div className="text-sm text-zinc-800 dark:text-zinc-200">
                    {group.originalValues.length > 0 ? group.originalValues.join('') : '—'}
                  </div>
                  <div className="relative text-sm text-zinc-800 dark:text-zinc-200">
                    <span
                      className={
                        group.modifiedValues.length > 0
                          ? isAccepted
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : isRejected
                            ? 'text-zinc-500 dark:text-zinc-400 line-through'
                            : 'text-emerald-700 dark:text-emerald-300'
                          : 'text-zinc-400'
                      }
                    >
                      {group.modifiedValues.length > 0 ? group.modifiedValues.join('') : '—'}
                    </span>
                    {isCurrent && (
                      <div className="absolute -top-2 right-0 translate-y-[-100%] flex items-center gap-1 bg-white dark:bg-zinc-800 shadow-xl rounded-lg p-1 border border-zinc-200 dark:border-zinc-700 z-50 whitespace-nowrap">
                        <div className="px-2 py-1 text-xs font-bold text-zinc-500 uppercase border-r border-zinc-200 dark:border-zinc-700 mr-1">
                          {group.type === 'replace' ? '修改' : group.type === 'insert' ? '新增' : '删除'}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDecision(idx, 'accept');
                          }}
                          className={`p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors ${
                            isAccepted ? 'text-green-600 bg-green-50' : 'text-zinc-400'
                          }`}
                          title="接受 (保留新内容)"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDecision(idx, 'reject');
                          }}
                          className={`p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors ${
                            isRejected ? 'text-red-600 bg-red-50' : 'text-zinc-400'
                          }`}
                          title="拒绝 (保留旧内容)"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
