import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, FileText, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { generateOutline } from '@/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  novelInfo: {
    title: string;
    description?: string;
    genre?: string;
    style?: string;
  };
  onConfirm: (outlineData: any) => void;
}

export default function OutlineGeneratorModal({ isOpen, onClose, novelInfo, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genre: '',
    style: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: novelInfo.title || '',
        description: novelInfo.description || '',
        genre: novelInfo.genre || '玄幻',
        style: novelInfo.style || ''
      });
      setResult(null);
    }
  }, [isOpen, novelInfo]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateOutline(formData);
      if (res.success && res.data) {
        let data = res.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {
            console.error('Failed to parse result', e);
          }
        }
        setResult(data);
      } else {
        alert('生成失败: ' + (res.error || '未知错误'));
      }
    } catch (error) {
      console.error(error);
      alert('生成出错');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (result) {
      onConfirm(result);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">AI 智能大纲生成</h3>
              <p className="text-xs text-zinc-500">基于小说设定自动规划全书架构</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left: Inputs */}
          <div className="w-full md:w-1/3 p-4 border-r border-zinc-100 dark:border-zinc-800 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">小说标题</label>
                <input
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">类型/题材</label>
                <input
                  value={formData.genre}
                  onChange={e => setFormData({...formData, genre: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                  placeholder="如：玄幻、都市、言情"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">核心简介/创意</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm min-h-[120px]"
                  placeholder="输入小说的核心创意、主线故事或特殊设定..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">文风要求 (可选)</label>
                <input
                  value={formData.style}
                  onChange={e => setFormData({...formData, style: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                  placeholder="如：热血、轻松、暗黑"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !formData.title}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? '正在构思中...' : '开始生成大纲'}
              </button>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 p-4 overflow-y-auto bg-white dark:bg-zinc-900">
            {!result ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p>在左侧输入信息，点击生成开始规划</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Summary */}
                <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    核心梗概
                  </h4>
                  <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                    {result.summary}
                  </p>
                </div>

                {/* Volumes */}
                <div className="space-y-4">
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                    <span>分卷规划</span>
                    <span className="text-xs font-normal text-zinc-500">{result.volumes?.length || 0} 卷</span>
                  </h4>
                  
                  {result.volumes?.map((vol: any, index: number) => (
                    <div key={index} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:border-purple-300 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs rounded font-mono">
                          Volume {index + 1}
                        </span>
                        <h5 className="font-semibold text-zinc-800 dark:text-zinc-200">{vol.title}</h5>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed pl-1">
                        {vol.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
           <div className="text-xs text-zinc-500">
              {result ? '生成完成，点击保存应用到设定集' : ''}
           </div>
           <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!result}
                className="px-6 py-2 text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                保存大纲
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
