import { useState } from 'react';
import { Loader2, Wand2, Plus, RefreshCw, X } from 'lucide-react';
import { generateChapterIdeas } from '@/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string, summary?: string) => void;
  volumeTitle: string;
  volumeSummary: string;
  previousChapterTitle?: string;
  previousChapterContent?: string;
}

export default function ChapterGenerationModal({
  isOpen,
  onClose,
  onConfirm,
  volumeTitle,
  volumeSummary,
  previousChapterTitle,
  previousChapterContent
}: Props) {
  const [mode, setMode] = useState<'manual' | 'ai'>('ai');
  const [manualTitle, setManualTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [ideas, setIdeas] = useState<Array<{ title: string; summary: string }>>([]);
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setIdeas([]);
    setSelectedIdeaIndex(null);

    try {
      const res = await generateChapterIdeas({
        volumeTitle,
        volumeSummary,
        previousChapterTitle,
        previousChapterContent
      });

      if (res.success && res.data) {
        setIdeas(res.data);
      } else {
        alert('生成失败，请重试');
      }
    } catch (error) {
      console.error(error);
      alert('生成出错');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirm = () => {
    if (mode === 'manual') {
      if (!manualTitle.trim()) return;
      onConfirm(manualTitle);
    } else {
      if (selectedIdeaIndex === null) return;
      const idea = ideas[selectedIdeaIndex];
      onConfirm(idea.title, idea.summary);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">新建章节</h2>
          <button onClick={onClose} className="p-2 -mr-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === 'manual'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
          >
            手动创建
          </button>
          <button
            onClick={() => {
              setMode('ai');
              if (ideas.length === 0) handleGenerate();
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              mode === 'ai'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50 dark:bg-purple-900/10'
                : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            AI 灵感生成
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'manual' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  章节标题
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="例如：第一章 初入江湖"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-purple-600" />
                  <p>AI 正在根据剧情走向构思章节...</p>
                  <p className="mt-2 text-xs text-zinc-400">
                    将参考当前分卷大纲和上一章结尾内容进行续写构思
                  </p>
                </div>
              ) : ideas.length > 0 ? (
                <div className="grid gap-4">
                  {ideas.map((idea, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedIdeaIndex(index)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedIdeaIndex === index
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{idea.title}</h3>
                        {selectedIdeaIndex === index && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {idea.summary}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-zinc-400 mb-4">暂无生成结果</p>
                  <button
                    onClick={handleGenerate}
                    className="px-4 py-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                  >
                    点击生成
                  </button>
                </div>
              )}

              {ideas.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 text-sm text-zinc-500 hover:text-purple-600 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>换一批灵感</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={mode === 'manual' ? !manualTitle.trim() : selectedIdeaIndex === null}
            className={`px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2 ${
              mode === 'manual'
                ? 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
                : 'bg-purple-600 hover:bg-purple-700 disabled:opacity-50'
            }`}
          >
            <Plus className="w-4 h-4" />
            创建章节
          </button>
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';
