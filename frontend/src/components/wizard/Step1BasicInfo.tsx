 import { useState, useEffect } from 'react';
import { Wand2, Loader2, ChevronRight } from 'lucide-react';
import { type WizardData } from '@/views/CreateWizard';
 import { generateInspiration, getNovels } from '@/api';

interface Props {
  data: WizardData;
  updateData: (data: Partial<WizardData>) => void;
  onNext: () => void;
  inspiration: string;
  setInspiration: (value: string) => void;
}

export default function Step1BasicInfo({ data, updateData, onNext, inspiration, setInspiration }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [existingTitles, setExistingTitles] = useState<string[]>([]);
  const [duplicateTitle, setDuplicateTitle] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await getNovels();
      if (mounted && res.success && Array.isArray(res.data)) {
        setExistingTitles(res.data.map(n => (n.title || '').trim()));
      }
    })();
    return () => { mounted = false };
  }, []);

  useEffect(() => {
    const t = data.title?.trim() || '';
    setDuplicateTitle(!!t && existingTitles.includes(t));
  }, [data.title, existingTitles]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await generateInspiration(inspiration);
      if (res.success && res.data) {
        updateData({
          title: res.data.title,
          description: res.data.description,
          genre: res.data.genre, // AI might suggest genre too
        });
      }
    } catch (error) {
      console.error(error);
      alert('AI 灵感生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-8 md:p-10">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Wand2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">从灵感开始</h2>
        <p className="text-zinc-500 mt-2">输入你的灵感碎片，或者什么都不写，让 AI 给你惊喜</p>
      </div>

      {/* AI Inspiration Input */}
      <div className="mb-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl blur-xl" />
        <div className="relative bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm p-2 flex gap-2">
          <input 
            type="text" 
            value={inspiration}
            onChange={(e) => setInspiration(e.target.value)}
            placeholder="例如：一个古代人穿越到现代做直播的故事..."
            className="flex-1 bg-transparent border-none outline-none px-4 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span>{inspiration ? '生成创意' : '随机灵感'}</span>
          </button>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            小说标题 <span className="text-red-500">*</span>
          </label>
          <input 
            type="text" 
            value={data.title}
            onChange={(e) => updateData({ title: e.target.value })}
            className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border outline-none transition-colors ${duplicateTitle ? 'border-red-500 focus:border-red-500 dark:border-red-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-blue-500'}`}
            placeholder="输入标题"
          />
          {duplicateTitle && (
            <div className="mt-2 text-sm text-red-600">该标题已存在，请更换标题</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            一句话简介
          </label>
          <textarea 
            value={data.description}
            onChange={(e) => updateData({ description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 transition-colors resize-none h-24"
            placeholder="这本小说主要讲了什么..."
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end pb-2">
        <button 
          onClick={onNext}
          disabled={!data.title.trim() || duplicateTitle}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span>下一步：题材与风格</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
