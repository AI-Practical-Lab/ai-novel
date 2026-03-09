import { ChevronRight, ChevronLeft, Wand2, Loader2, BookOpen, FileText, Check } from 'lucide-react';
import { type WizardData } from '@/views/CreateWizard';
import { useState, useEffect } from 'react';
import { generateOutline } from '@/api';

interface Props {
  data: WizardData;
  updateData: (data: Partial<WizardData>) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

interface Volume {
  title: string;
  summary: string;
}

export default function Step4Outline({ data, updateData, onSubmit, onBack, isSubmitting }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState('');
  const [volumes, setVolumes] = useState<Volume[]>([]);

  // Parse existing outline if any
  useEffect(() => {
    const outline = data.coreSettings.outline as any;
    if (outline && outline.volumes) {
      setSummary(outline.summary || '');
      setVolumes(outline.volumes);
    } else if (volumes.length === 0 && !isGenerating) {
      // Auto-generate if empty
      handleGenerate();
    }
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await generateOutline({
        title: data.title,
        description: data.description,
        genre: data.genre,
        style: data.style,
        tags: data.tags,
        coreSettings: data.coreSettings
      });
      
      if (res.success && res.data) {
        const result = res.data as any;
        setSummary(result.summary);
        setVolumes(result.volumes);
        // Save to wizard data
        updateData({ 
          coreSettings: {
            ...data.coreSettings,
            outline: {
              ...data.coreSettings.outline,
              summary: result.summary,
              volumes: result.volumes
            }
          } as any
        });
      }
    } catch (error) {
      console.error(error);
      alert('AI 生成大纲失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSummary = (val: string) => {
    setSummary(val);
    updateData({ 
      coreSettings: {
        ...data.coreSettings,
        outline: { ...data.coreSettings.outline, summary: val }
      } as any
    });
  };

  const updateVolume = (index: number, field: keyof Volume, value: string) => {
    const newVolumes = [...volumes];
    newVolumes[index] = { ...newVolumes[index], [field]: value };
    setVolumes(newVolumes);
    updateData({ 
      coreSettings: {
        ...data.coreSettings,
        outline: {
          ...data.coreSettings.outline,
          volumes: newVolumes
        }
      } as any
    });
  };

  return (
    <div className="p-8 md:p-10 h-full flex flex-col">
      <div className="text-center mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">总纲规划</h2>
        <p className="text-zinc-500 mt-2">宏观把控全书走向，分卷规划核心剧情</p>
        
        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="mt-4 px-4 py-2 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-sm font-medium flex items-center gap-2 mx-auto disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          <span>{isGenerating ? 'AI 正在构思...' : '重新生成总纲'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto -mx-4 px-4 space-y-6 custom-scrollbar">
        {/* Book Summary */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
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
        {volumes.map((vol, index) => (
          <div key={index} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm shrink-0">
                {index + 1}
              </div>
              <input 
                type="text"
                value={vol.title}
                onChange={(e) => updateVolume(index, 'title', e.target.value)}
                className="flex-1 bg-transparent border-none outline-none font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                placeholder={`第一卷：卷名`}
              />
            </div>
            <textarea 
              value={vol.summary}
              onChange={(e) => updateVolume(index, 'summary', e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm resize-none h-24 text-zinc-600 dark:text-zinc-400"
              placeholder="本卷核心冲突与剧情走向..."
            />
          </div>
        ))}
        
        {volumes.length === 0 && !isGenerating && (
          <div className="text-center py-12 text-zinc-400">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无总纲，点击上方按钮让 AI 生成</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between shrink-0">
        <button 
          onClick={onBack}
          disabled={isSubmitting}
          className="px-6 py-3 text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-2 disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>上一步</span>
        </button>
        <button 
          onClick={onSubmit}
          disabled={isSubmitting || volumes.length === 0}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{isSubmitting ? '创建中...' : '完成创建'}</span>
        </button>
      </div>
    </div>
  );
}