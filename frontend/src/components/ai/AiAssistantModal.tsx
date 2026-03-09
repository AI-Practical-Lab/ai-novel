import { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Loader2, Sparkles, Wand2, Check, AlertCircle, Play, Pause, StopCircle, Eye, Save } from 'lucide-react';
import { parseAiCommand, AiCommandIntent } from '@/utils/ai-command';
import { updateChapter, updateLore, refineText } from '@/api';
import DiffViewer from '../ui/DiffViewer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectData: any;
  onSave: () => void; // Callback when batch changes are applied
}

interface BatchItem {
  id: string;
  type: 'chapter' | 'lore';
  title: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'reviewing' | 'saved';
  message?: string;
  originalContent?: string;
  modifiedContent?: string;
  newTitle?: string;
}

export default function AiAssistantModal({ isOpen, onClose, projectData, onSave }: Props) {
  const [input, setInput] = useState('');
  const [processingStage, setProcessingStage] = useState<'idle' | 'parsing' | 'reviewing' | 'executing'>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedIntent, setParsedIntent] = useState<AiCommandIntent | null>(null);
  
  // Batch Execution State
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [isBatchPaused, setIsBatchPaused] = useState(false);
  const [reviewItem, setReviewItem] = useState<BatchItem | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) {
        // Reset state on close
        setProcessingStage('idle');
        setInput('');
        setParsedIntent(null);
        setBatchItems([]);
        setCurrentBatchIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setProcessingStage('parsing');
    setParsedIntent(null);
    
    try {
      const intent = await parseAiCommand(input, projectData);
      setParsedIntent(intent);
      
      // Prepare Batch Items
      const targetIds = (intent.scope.ids && intent.scope.ids.length > 0)
        ? intent.scope.ids
        : (intent.scope.type === 'chapter' && Array.isArray(projectData?.volumes)
            ? projectData.volumes.flatMap((v: any) => (v.chapters || []).map((c: any) => c.id))
            : intent.scope.type === 'lore' && Array.isArray(projectData?.lore)
              ? projectData.lore.map((l: any) => l.id || l._id)
              : []);
            
      // Filter if needed (e.g. by scope filter text, implemented in parseAiCommand usually, but here we double check if needed)
      
      const items: BatchItem[] = [];
      const allChapters = projectData.volumes?.flatMap((v: any) => v.chapters || []) || [];
      const allLore = projectData.lore || [];
      
      targetIds.forEach((id: string) => {
          const chapter = allChapters.find((c: any) => c.id === id);
          if (chapter) {
              items.push({
                  id: chapter.id,
                  type: 'chapter',
                  title: chapter.title,
                  status: 'pending'
              });
              return;
          }
          
          const lore = allLore.find((l: any) => (l.id || l._id) === id);
          if (lore) {
              items.push({
                  id: lore.id || lore._id,
                  type: 'lore',
                  title: lore.title || lore.name,
                  status: 'pending'
              });
          }
      });
      
      setBatchItems(items);
      setProcessingStage('reviewing');
    } catch (error: any) {
      console.error('Parse failed:', error);
      alert('指令解析失败: ' + (error.message || '未知错误'));
      setProcessingStage('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  const executeBatch = async () => {
    if (!parsedIntent || batchItems.length === 0) return;
    
    setProcessingStage('executing');
    setIsProcessing(true);
    setIsBatchPaused(false);
    abortControllerRef.current = new AbortController();

    const novelId = projectData?.id;
    if (!novelId) return;

    // Continue from current index
    for (let i = currentBatchIndex; i < batchItems.length; i++) {
        if (abortControllerRef.current?.signal.aborted) break;
        if (isBatchPaused) {
            break; // Pause loop, state is preserved
        }

        setCurrentBatchIndex(i);
        setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'running' } : item));

        const item = batchItems[i];
        
        try {
            // 1. Modify Metadata (Title)
            if (parsedIntent.action === 'modify_metadata') {
                 const newTitle = parsedIntent.params?.new_title;
                 if (!newTitle) throw new Error('缺少 new_title 参数');
                 
                 if (item.type === 'chapter') {
                    await updateChapter(novelId, item.id, { title: newTitle });
                 } else if (item.type === 'lore') {
                    await updateLore(novelId, item.id, { title: newTitle, name: newTitle });
                 }
            } 
            // 2. Rewrite Content
            else if (parsedIntent.action === 'rewrite_content') {
                 let contentToRefine = '';
                 let contextStr = '';
                 
                 if (item.type === 'chapter') {
                     const allChapters = projectData.volumes.flatMap((v: any) => v.chapters || []);
                     const idx = allChapters.findIndex((c: any) => c.id === item.id);
                     const currentChapter = allChapters[idx];
                     contentToRefine = currentChapter.content || '';
                     
                     contextStr = `当前章节: ${currentChapter.title}`;
                     
                     if (idx > 0) {
                       const prev = allChapters[idx - 1];
                       const prevEnd = prev.content ? prev.content.slice(-500) : '';
                       contextStr = `上一章(${prev.title})结尾:\n${prevEnd}\n\n` + contextStr;
                     }
                     
                     if (idx < allChapters.length - 1) {
                       const next = allChapters[idx + 1];
                       const nextStart = next.content ? next.content.slice(0, 500) : '';
                       contextStr = contextStr + `\n\n下一章(${next.title})开头:\n${nextStart}`;
                     }
                } else if (item.type === 'lore') {
                     const allLore = projectData.lore || [];
                     const loreItem = allLore.find((l: any) => (l.id || l._id) === item.id);
                     if (!loreItem) throw new Error('未找到设定项');
                     
                     contentToRefine = loreItem.content || loreItem.summary || loreItem.description || '';
                     contextStr = `设定名称: ${loreItem.title || loreItem.name}\n类型: ${loreItem.type}`;
                 }

                 const baseInstruction = parsedIntent.instruction || '';
                 const editPlan =
                   parsedIntent.params && typeof parsedIntent.params.edit_plan === 'string'
                     ? parsedIntent.params.edit_plan
                     : '';

                 const hasEditPlan = !!editPlan;
                 const templateHeader = hasEditPlan
                   ? '你是一名执行型写作者。现在有【当前文本】和一份【参考修改方案】。你的任务不是提出新建议，而是严格根据参考修改方案，对当前文本进行具体改写。'
                   : '你是一名执行型写作者。现在有【当前文本】和一条【修改指令】。你的任务不是提出新建议，而是直接根据指令，对当前文本进行具体改写。';
                 const templateBody =
                   '具体要求：\n' +
                   '1. 不要再输出新的方案、点评或说明，只输出改写后的文本本身。\n' +
                   '2. 不要省略参考内容中已经明确写出的重要要点或设定，只能用更具体的方式写出来。\n' +
                   '3. 可以补充必要的过渡和细节，但不得改变原有设定的方向。\n' +
                   '4. 最终只返回改写后的完整文本，不要解释过程。';
                 const mergedInstruction = hasEditPlan
                   ? `${templateHeader}\n\n${templateBody}\n\n【参考修改方案】:\n${editPlan}\n\n【具体改写指令】:\n${baseInstruction}`
                   : `${templateHeader}\n\n${templateBody}\n\n【具体改写指令】:\n${baseInstruction}`;

                 const res = await refineText({
                     text: contentToRefine,
                     instruction: mergedInstruction,
                     context: contextStr
                 });

                 if (!res.success || !res.data) throw new Error(res.error || '优化失败');
                 
                 // Store for review
                 setBatchItems(prev => prev.map((it, idx) => idx === i ? { 
                     ...it, 
                     status: 'reviewing',
                     originalContent: contentToRefine,
                     modifiedContent: res.data
                 } : it));
                 continue; // Skip the default success update
            }
            
            setBatchItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'success' } : it));
            
        } catch (e: any) {
            console.error(`Item ${item.id} failed:`, e);
            setBatchItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', message: e.message } : it));
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsProcessing(false);
    onSave(); // Trigger reload
  };
  
  const handleApplyItem = async (item: BatchItem, finalContent?: string) => {
      const novelId = projectData?.id;
      if (!novelId) return;
      
      try {
          if (item.type === 'chapter') {
            await updateChapter(novelId, item.id, { content: finalContent || item.modifiedContent });
          } else if (item.type === 'lore') {
            await updateLore(novelId, item.id, { content: finalContent || item.modifiedContent });
          }
          setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'saved' } : it));
          setReviewItem(null);
          onSave(); 
      } catch (e) {
          alert('保存失败');
      }
  };

  const handleApplyAll = async () => {
      const reviewingItems = batchItems.filter(i => i.status === 'reviewing');
      if (!confirm(`确定要应用 ${reviewingItems.length} 个项目的修改吗？`)) return;
      
      setIsProcessing(true);
      for (const item of reviewingItems) {
          if (item.type === 'chapter') {
            await updateChapter(projectData.id, item.id, { content: item.modifiedContent });
          } else if (item.type === 'lore') {
            await updateLore(projectData.id, item.id, { content: item.modifiedContent });
          }
          setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'saved' } : it));
      }
      setIsProcessing(false);
      onSave();
  };
  
  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
      }
      setIsProcessing(false);
      setProcessingStage('reviewing'); // Go back to review
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI 编剧助手</h2>
              <p className="text-xs text-zinc-500">批量修改、指令执行与全局优化</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6 bg-zinc-50/50 dark:bg-black/20 relative">
            {processingStage === 'idle' && (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-4 opacity-50">
                    <Wand2 className="w-16 h-16 stroke-1" />
                    <p>输入指令以开始，例如：“把第一章的标题改为《初入江湖》” 或 “把所有章节的对话改为严肃风格”</p>
                </div>
            )}
            
            {processingStage === 'parsing' && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    <p className="text-zinc-500 text-sm">正在分析指令意图...</p>
                </div>
            )}

            {(processingStage === 'reviewing' || processingStage === 'executing') && parsedIntent && (
                <div className="space-y-6 max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-300">
                    {/* Intent Summary */}
                    <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400">
                            <Bot className="w-5 h-5" />
                            <h3 className="font-medium">识别到的意图</h3>
                        </div>
                        
                        <div className="grid grid-cols-[100px_1fr] gap-4 text-sm mb-4">
                            <span className="text-zinc-500">操作类型</span>
                            <span className="font-medium px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded inline-block w-fit">
                                {parsedIntent.action}
                            </span>

                            <span className="text-zinc-500">执行指令</span>
                            <span className="text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-100 dark:border-zinc-800">
                                {parsedIntent.instruction}
                            </span>
                        </div>
                        
                        {/* Batch List */}
                        <div className="border-t border-zinc-100 dark:border-zinc-700 pt-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    执行队列 ({batchItems.filter(i => i.status === 'success').length}/{batchItems.length})
                                </h4>
                            </div>
                            <div className="max-h-[300px] overflow-auto space-y-2 pr-2">
                                {batchItems.map((item, idx) => (
                                    <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                                        item.status === 'running' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' :
                                        item.status === 'success' ? 'border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10' :
                                        item.status === 'error' ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10' :
                                        'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                                    }`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-400 w-6">#{idx + 1}</span>
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.status === 'pending' && <span className="text-xs text-zinc-400">等待中</span>}
                                            {item.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
                                            {item.status === 'success' && <Check className="w-4 h-4 text-green-500" />}
                                            {item.status === 'saved' && <span className="text-xs text-green-500 flex items-center gap-1"><Check className="w-3 h-3" /> 已保存</span>}
                                            {item.status === 'reviewing' && (
                                                <button 
                                                    onClick={() => setReviewItem(item)}
                                                    className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 flex items-center gap-1 transition-colors"
                                                >
                                                    <Eye className="w-3 h-3" />
                                                    审查
                                                </button>
                                            )}
                                            {item.status === 'error' && (
                                                <div className="flex items-center gap-1 text-red-500" title={item.message}>
                                                    <AlertCircle className="w-4 h-4" />
                                                    <span className="text-xs">失败</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end">
                        {processingStage === 'reviewing' ? (
                            <>
                                <button 
                                    onClick={() => {
                                        setProcessingStage('idle');
                                        setParsedIntent(null);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    取消 / 修改
                                </button>
                                <button 
                                    onClick={executeBatch}
                                    className="px-4 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                >
                                    <Play className="w-4 h-4" />
                                    开始执行
                                </button>
                            </>
                        ) : (
                            <>
                                {batchItems.some(i => i.status === 'reviewing') && (
                                    <button 
                                        onClick={handleApplyAll}
                                        className="px-4 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        应用全部待审查
                                    </button>
                                )}
                                <button 
                                    onClick={handleStop}
                                    className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                >
                                    <StopCircle className="w-4 h-4" />
                                    {isProcessing ? '停止执行' : '返回'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Diff Review Modal */}
        {reviewItem && (
            <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-zinc-900 w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col relative border border-zinc-200 dark:border-zinc-800">
                     <DiffViewer
                         originalContent={reviewItem.originalContent || ''}
                         newContent={reviewItem.modifiedContent || ''}
                         onApply={(content) => handleApplyItem(reviewItem, content)}
                         onCancel={() => setReviewItem(null)}
                         title={`审查修订: ${reviewItem.title}`}
                     />
                </div>
            </div>
        )}

        {/* Input Area - Only show when idle */}
        {processingStage === 'idle' && (
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="输入您的指令..."
              className="w-full h-24 pl-4 pr-14 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl resize-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-sm transition-all"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isProcessing}
              className="absolute bottom-3 right-3 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400 px-1">
             <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Enter</span> 发送
             <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Shift + Enter</span> 换行
          </div>
        </div>
        )}

      </div>
    </div>
  );
}
