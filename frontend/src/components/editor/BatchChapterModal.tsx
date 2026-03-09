import { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, Plus, Trash2, Wand2 } from 'lucide-react';
import { suggestChapters } from '@/api';

interface ChapterDraft {
  title: string;
  summary: string;
  reason?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (chapters: Array<{ title: string, summary?: string }>) => Promise<void>;
  isProcessing: boolean;
  volumeData?: { 
    title: string, 
    summary: string, 
    existingChapters?: string[], 
    outlineContext?: string,
    previousChapterCount?: number
  };
}

export default function BatchChapterModal({ isOpen, onClose, onConfirm, isProcessing, volumeData }: Props) {
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(5);
  const [startChapter, setStartChapter] = useState(1);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
        setChapters([]);
        setGenerateCount(5);
        // Calculate default start chapter
        const defaultStart = (volumeData?.previousChapterCount || 0) + (volumeData?.existingChapters?.length || 0) + 1;
        setStartChapter(defaultStart);
    }
  }, [isOpen, volumeData]);

  const handleGenerate = async () => {
    if (!volumeData) return;
    setIsGenerating(true);
    
    // Calculate effective start index: User's start chapter + already generated drafts
    // startChapter is 1-based. Convert to 0-based index by subtracting 1.
    const effectiveStartIndex = (startChapter - 1) + chapters.length;

    try {
      const res = await suggestChapters(
        volumeData.title,
        volumeData.summary,
        volumeData.existingChapters || [],
        volumeData.outlineContext || '', // 传入设定集大纲作为上下文
        generateCount, // use selected count
        volumeData.previousChapterCount || 0,
        effectiveStartIndex
      );

      if (res.success && Array.isArray(res.data)) {
        setChapters(prev => [...prev, ...res.data]);
      }
    } catch (error) {
      console.error('Failed to generate chapters:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddManual = () => {
    setChapters(prev => [...prev, { title: '', summary: '', reason: 'Manual' }]);
  };

  const handleRemove = (index: number) => {
    setChapters(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, field: keyof ChapterDraft, value: string) => {
    setChapters(prev => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">批量规划章节</h3>
            {volumeData && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {volumeData.title}
                </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {chapters.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center space-y-4 text-center py-12">
                <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                    <Wand2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-100">智能规划章节</h4>
                    <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                        AI 将根据【{volumeData?.title}】的大纲和现有章节，为您自动规划后续剧情。
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full max-w-sm">
                    {/* Start Chapter Input */}
                    <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1.5">起始章节</label>
                        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                             <span className="text-sm text-zinc-500">第</span>
                             <input 
                                type="number"
                                min={1}
                                value={startChapter}
                                onChange={(e) => setStartChapter(Math.max(1, parseInt(e.target.value) || 1))}
                                className="flex-1 w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none text-center"
                             />
                             <span className="text-sm text-zinc-500">章</span>
                        </div>
                    </div>

                    {/* Count Input */}
                    <div className="flex-1">
                        <label className="block text-xs text-zinc-500 mb-1.5">生成数量 (Max 20)</label>
                        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                             <input 
                                type="number"
                                min={1}
                                max={20}
                                value={generateCount}
                                onChange={(e) => setGenerateCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="w-full bg-transparent text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none text-center"
                             />
                             <span className="text-xs text-zinc-400">章</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    开始智能生成
                </button>
             </div>
          ) : (
            <div className="space-y-4">
                {chapters.map((chapter, index) => (
                    <div key={index} className="group relative bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700/50 p-4 transition-all hover:border-blue-500/50 hover:shadow-sm">
                        <button 
                            onClick={() => handleRemove(index)}
                            className="absolute top-3 right-3 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <div className="space-y-3 pr-6">
                            <input 
                                value={chapter.title}
                                onChange={(e) => handleUpdate(index, 'title', e.target.value)}
                                placeholder="章节标题"
                                className="w-full bg-transparent font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
                            />
                            <textarea
                                value={chapter.summary}
                                onChange={(e) => handleUpdate(index, 'summary', e.target.value)}
                                placeholder="章节剧情概述..."
                                className="w-full bg-transparent text-sm text-zinc-600 dark:text-zinc-400 placeholder-zinc-400/70 focus:outline-none resize-none min-h-[60px]"
                            />
                            {chapter.reason && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                        {chapter.reason.includes('大纲') ? '提取自大纲' : 'AI 续写'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                <div className="flex items-center justify-between pt-4 pb-2 px-1">
                     <span className="text-xs text-zinc-400">单次生成数量 (Max 20)</span>
                     <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 px-2">
                        <input 
                            type="number"
                            min={1}
                            max={20}
                            value={generateCount}
                            onChange={(e) => setGenerateCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                            className="w-16 bg-transparent text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none text-center"
                        />
                        <span className="text-xs text-zinc-400">章</span>
                     </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <button
                        onClick={handleAddManual}
                        className="flex-1 py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:border-zinc-400 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        手动添加一行
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="flex-1 py-2 border border-dashed border-purple-200 dark:border-purple-800/50 rounded-lg text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center justify-center gap-2"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        生成更多
                    </button>
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="text-xs text-zinc-400">
             {chapters.length > 0 && `已规划 ${chapters.length} 章`}
          </div>
          <div className="flex items-center gap-3">
            <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
                取消
            </button>
            <button
                onClick={() => onConfirm(chapters)}
                disabled={isProcessing || chapters.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isProcessing ? '创建中...' : '确认创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
