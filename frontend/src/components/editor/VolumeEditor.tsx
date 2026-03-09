import { useState, useEffect } from 'react';
import { Save, Loader2, Book } from 'lucide-react';
import { type Volume } from '@/api';
import { Wand2 } from 'lucide-react';

interface Props {
  volume: Volume;
  onChange: (newVolume: Volume) => void;
  onSave: () => void;
  isSaving: boolean;
  onOptimizeClick?: () => void;
}

export default function VolumeEditor({ volume, onChange, onSave, isSaving, onOptimizeClick }: Props) {
  const [title, setTitle] = useState(volume.title);
  const [summary, setSummary] = useState(volume.summary || '');

  useEffect(() => {
    setTitle(volume.title);
    setSummary(volume.summary || '');
  }, [volume]);

  const handleChange = (field: 'title' | 'summary', value: string) => {
    if (field === 'title') setTitle(value);
    if (field === 'summary') setSummary(value);
    
    onChange({
      ...volume,
      [field]: value
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Book className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">分卷管理</h1>
            <div className="text-sm text-zinc-500">编辑分卷信息与大纲</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={onOptimizeClick}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center gap-2"
            type="button"
          >
            <Wand2 className="w-4 h-4" />
            <span>AI优化分卷大纲</span>
          </button>
          <button 
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>保存修改</span>
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">分卷标题</label>
          <input 
            type="text" 
            value={title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-zinc-900 dark:text-zinc-100"
            placeholder="例如：第一卷 潜龙在渊"
          />
        </div>

        <div className="space-y-2 flex-1 flex flex-col min-h-[400px]">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">分卷大纲 / 摘要</label>
          <div className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-blue-500">
            <textarea 
              value={summary}
              onChange={(e) => handleChange('summary', e.target.value)}
              className="flex-1 w-full p-4 bg-transparent border-none outline-none resize-none text-zinc-800 dark:text-zinc-300 leading-relaxed"
              placeholder="在此输入本卷的剧情大纲、核心冲突或关键节点..."
            />
          </div>
          <p className="text-xs text-zinc-500">
            * 分卷大纲将作为 AI 续写本卷章节时的重要参考依据。
          </p>
        </div>
      </div>
    </div>
  );
}
