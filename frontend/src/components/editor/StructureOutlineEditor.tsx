import { useState } from 'react';
import { BookOpen, Loader2, Wand2, Plus, Trash2 } from 'lucide-react';
import { generateOutline } from '@/api';

interface Volume {
  title: string;
  summary: string;
}

interface Props {
  lore: {
    title?: string;
    summary?: string;
    volumes?: Volume[];
    [key: string]: any;
  };
  onChange: (updates: any) => void;
  novelInfo?: {
    title: string;
    description?: string;
    genre?: string;
    style?: string;
    tags?: string[];
    coreSettings?: any;
  };
}

export default function StructureOutlineEditor({ lore, onChange, novelInfo }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  const summary = lore.summary || '';
  const volumes = lore.volumes || [];

  const doGenerate = async (instruction?: string) => {
    if (!novelInfo) return;
    
    setIsGenerating(true);
    try {
      const res = await generateOutline({
        title: novelInfo.title,
        description: novelInfo.description || '',
        genre: novelInfo.genre || '',
        style: novelInfo.style || '',
        tags: novelInfo.tags || [],
        coreSettings: {
          ...(novelInfo.coreSettings || {}),
          outline: {
            ...((novelInfo.coreSettings || {}).outline || {}),
            summary
          },
          userInstruction: instruction || ''
        }
      });
      
      if (res.success && res.data) {
        const result = res.data as any;
        onChange({
          summary: result.summary,
          volumes: result.volumes
        });
      }
    } catch (error) {
      console.error(error);
      alert('AI 生成大纲失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleGenerateClick = () => {
    setPromptText('');
    setIsPromptOpen(true);
  };
  
  const handleConfirmPrompt = async () => {
    const text = promptText.trim();
    setIsPromptOpen(false);
    await doGenerate(text);
  };

  const updateSummary = (val: string) => {
    onChange({ summary: val });
  };

  const updateVolume = (index: number, field: keyof Volume, value: string) => {
    const newVolumes = [...volumes];
    newVolumes[index] = { ...newVolumes[index], [field]: value };
    onChange({ volumes: newVolumes });
  };

  const addVolume = () => {
    const newVolumes = [...volumes, { title: '', summary: '' }];
    onChange({ volumes: newVolumes });
  };

  const removeVolume = (index: number) => {
    const newVolumes = volumes.filter((_, i) => i !== index);
    onChange({ volumes: newVolumes });
  };

  return (
    <div className="h-full overflow-y-auto p-6 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Section similar to Step4Outline but adapted for editor */}
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">总纲规划</h2>
            <p className="text-zinc-500 mt-2">宏观把控全书走向，分卷规划核心剧情</p>
            
            {novelInfo && (
                <button 
                onClick={handleGenerateClick}
                disabled={isGenerating}
                className="mt-4 px-4 py-2 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-sm font-medium flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                <span>{isGenerating ? 'AI 正在构思...' : 'AI 重新生成总纲'}</span>
                </button>
            )}
        </div>

        {/* Book Summary */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span>全书核心梗概</span>
          </div>
          <textarea 
            value={summary}
            onChange={(e) => updateSummary(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm resize-none h-24 text-zinc-600 dark:text-zinc-400"
            placeholder="一句话概括全书主线..."
          />
        </div>

        {/* Volumes */}
        <div className="space-y-4">
            {volumes.map((vol: Volume, index: number) => (
            <div key={index} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 relative group">
                <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm shrink-0">
                    {index + 1}
                </div>
                <input 
                    type="text"
                    value={vol.title}
                    onChange={(e) => updateVolume(index, 'title', e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-0"
                    placeholder={`第一卷：卷名`}
                />
                <button 
                    onClick={() => removeVolume(index)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                    title="删除分卷"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                </div>
                <textarea 
                value={vol.summary}
                onChange={(e) => updateVolume(index, 'summary', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm resize-none h-24 text-zinc-600 dark:text-zinc-400"
                placeholder="本卷核心冲突与剧情走向..."
                />
            </div>
            ))}
        </div>

        {/* Add Volume Button */}
        <button
            onClick={addVolume}
            className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2 font-medium"
        >
            <Plus className="w-4 h-4" />
            <span>添加分卷</span>
        </button>

        {volumes.length === 0 && !isGenerating && (
          <div className="text-center py-12 text-zinc-400">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无总纲，点击上方按钮让 AI 生成，或手动添加分卷</p>
          </div>
        )}
      </div>
      
      {isPromptOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">描述你的生成要求</h3>
              <p className="text-xs text-zinc-500 mt-1">可选：说明风格、重点、避免事项等。将与“全书核心梗概”一起提供给 AI。</p>
            </div>
            <div className="p-4">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="w-full h-28 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm text-zinc-900 dark:text-zinc-100"
                placeholder="例如：分卷结构控制在4卷；强调成长线与主线冲突；避免过度铺垫。"
              />
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
              <button
                onClick={() => setIsPromptOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmPrompt}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                提交并生成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
