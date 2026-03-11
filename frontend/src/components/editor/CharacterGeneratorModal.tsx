import { useState } from 'react';
import { X, Sparkles, Loader2, Check, User } from 'lucide-react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

export interface GeneratedCharacter {
  name: string;
  description: string;
  selected?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, count: number) => Promise<GeneratedCharacter[]>;
  onConfirm: (characters: GeneratedCharacter[]) => void;
}

export default function CharacterGeneratorModal({ isOpen, onClose, onGenerate, onConfirm }: Props) {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState<number | string>(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedCharacter[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setResults([]);
    setSelectedIndices(new Set());
    setHasSaved(false);

    try {
      // Ensure count is a valid number, default to 3
      const numCount = typeof count === 'number' ? count : (parseInt(count) || 3);
      const chars = await onGenerate(prompt, numCount);
      setResults(chars);
      // Default select all
      setSelectedIndices(new Set(chars.map((_, i) => i)));
    } catch (e) {
      alert('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSelect = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  const handleConfirm = () => {
    const selectedChars = results.filter((_, i) => selectedIndices.has(i));
    onConfirm(selectedChars);
    setHasSaved(true);
    onClose();
  };

  const handleRequestClose = () => {
    if (!hasSaved && results.length > 0 && selectedIndices.size > 0) {
      setIsCloseConfirmOpen(true);
      return;
    }
    onClose();
  };

  return (
      <div className="absolute inset-0 z-[80] bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div
            className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">AI 角色批量生成</h3>
            </div>
            <button onClick={handleRequestClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Input Section */}
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">生成要求</label>
                  <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="例如：生成三个反派组织的核心成员，一个是智囊型，一个是打手型，一个是卧底..."
                      className="w-full h-24 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  />
                </div>
                <div className="w-32 space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">生成数量</label>
                  <input
                      type="number"
                      min={1}
                      max={10}
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      正在构思角色...
                    </>
                ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      开始生成
                    </>
                )}
              </button>
            </div>

            {/* Results Section */}
            {results.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-100">生成结果 ({results.length})</h4>
                    <div className="text-sm text-zinc-500">已选择 {selectedIndices.size} 个</div>
                  </div>

                  <div className="text-xs px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800">
                    提示：生成的角色尚未保存，请点击右下角“保存选中的角色”完成保存，保存后才能在“选择出场角色”中使用。
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.map((char, idx) => (
                        <div
                            key={idx}
                            onClick={() => toggleSelect(idx)}
                            className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                selectedIndices.has(idx)
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10'
                                    : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
                            }`}
                        >
                          {selectedIndices.has(idx) && (
                              <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white">
                                <Check className="w-3 h-3" />
                              </div>
                          )}

                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-zinc-500" />
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{char.name}</span>
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-line line-clamp-6">
                            {(char.description && char.description.trim().length > 0)
                                ? char.description
                                : (() => {
                                  const anyChar: any = char as any;
                                  const parts: string[] = [];
                                  if (anyChar.role) parts.push(`身份：${anyChar.role}`);
                                  if (anyChar.personality) parts.push(`性格：${anyChar.personality}`);
                                  if (anyChar.background) parts.push(`背景：${anyChar.background}`);
                                  const fallback = parts.join('\n');
                                  return fallback || '（暂无描述）';
                                })()
                            }
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 shrink-0">
            <button
                onClick={handleRequestClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
                onClick={handleConfirm}
                disabled={selectedIndices.size === 0}
                className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              保存选中的角色 ({selectedIndices.size})
            </button>
          </div>

          <ConfirmationModal
              isOpen={isCloseConfirmOpen}
              onClose={() => {
                setIsCloseConfirmOpen(false);
                onClose();
              }}
              onConfirm={() => {
                setIsCloseConfirmOpen(false);
                handleConfirm();
              }}
              title="尚未保存"
              message="生成的角色尚未保存。是否保存选中的角色后关闭？"
              confirmText="保存并关闭"
              cancelText="直接关闭"
              variant="warning"
          />
        </div>
      </div>
  );
}
