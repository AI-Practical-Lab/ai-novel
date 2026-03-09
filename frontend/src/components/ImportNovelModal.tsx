import { useEffect, useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { importNovel, nextImportStep, completeImport, type ImportProgress } from '@/api';
import { useNavigate } from 'react-router-dom';

interface ImportNovelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportNovelModal({ isOpen, onClose, onSuccess }: ImportNovelModalProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoAdvance, setAutoAdvance] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setProgress(null);
      setError(null);
      setIsUploading(false);
    }
  }, [isOpen]);

  // Polling for progress or auto-advance
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (progress && progress.status !== 'completed' && progress.status !== 'error') {
       // If auto-advance is on and we are not in error state
       if (autoAdvance && progress.currentStep !== 'complete') {
           timer = setTimeout(() => {
               handleNextStep();
           }, 1000); // 1 second delay between steps
       }
    }
    return () => clearTimeout(timer);
  }, [progress, autoAdvance]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const startUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await importNovel(formData);
    if (res.success && res.data) {
      setProgress(res.data);
    } else {
      setError(res.error || '上传失败');
      setIsUploading(false);
    }
  };

  const handleNextStep = async (force: boolean = false) => {
      if (!progress) return;
      const res = await nextImportStep(progress.jobId || progress.taskId!, force);
      if (res.success && res.data) {
          setProgress(res.data);
          if (res.data.status === 'completed') {
              handleComplete(res.data.jobId || res.data.taskId!);
          }
      } else {
          setError(res.error || '执行步骤失败');
          // Update progress to show error state if available
          if (res.data) setProgress(res.data);
      }
  };

  const handleComplete = async (taskId: string) => {
      const res = await completeImport(taskId);
      if (res.success && res.data) {
          onClose();
          onSuccess();
          if (res.data.redirect) {
              navigate(res.data.redirect);
          }
      } else {
          setError(res.error || '完成任务失败');
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">导入小说</h3>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!progress ? (
            <div className="space-y-6">
                <div 
                    className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-zinc-900 dark:hover:border-zinc-100 transition-colors cursor-pointer bg-zinc-50 dark:bg-zinc-800/50"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="w-10 h-10 text-zinc-400 mb-4" />
                    <p className="text-zinc-900 dark:text-zinc-100 font-medium mb-1">点击选择文件</p>
                    <p className="text-zinc-500 text-sm">支持 .txt, .md, .docx</p>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept=".txt,.md,.docx" 
                        onChange={handleFileChange}
                    />
                </div>

                {file && (
                    <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="w-10 h-10 bg-white dark:bg-zinc-700 rounded-lg flex items-center justify-center border border-zinc-200 dark:border-zinc-600">
                            <span className="text-xs font-bold text-zinc-500 uppercase">{file.name.split('.').pop()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{file.name}</p>
                            <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                            className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium"
                    >
                        取消
                    </button>
                    <button
                        onClick={startUpload}
                        disabled={!file || isUploading}
                        className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 transition-opacity font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>开始导入</span>
                    </button>
                </div>
            </div>
        ) : (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                        {progress.status === 'completed' ? '导入完成' : '正在处理...'}
                    </h4>
                    <span className="text-sm text-zinc-500">
                        步骤 {progress.stepIndex} / {progress.stepTotal}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ease-out ${
                            progress.status === 'error' ? 'bg-red-500' : 
                            progress.status === 'completed' ? 'bg-green-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${(progress.stepIndex / progress.stepTotal) * 100}%` }}
                    />
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 min-h-[100px] flex flex-col items-center justify-center text-center">
                    {progress.status === 'running' && <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />}
                    {progress.status === 'completed' && <CheckCircle className="w-8 h-8 text-green-500 mb-3" />}
                    {progress.status === 'error' && <AlertCircle className="w-8 h-8 text-red-500 mb-3" />}
                    
                    <p className="text-zinc-900 dark:text-zinc-100 font-medium">{progress.message}</p>
                    {progress.error && <p className="text-sm text-red-500 mt-1">{progress.error}</p>}
                    
                    {progress.generatedType && (
                        <span className="mt-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            生成了 {progress.generatedCount} 个 {
                                {
                                    'outline': '大纲',
                                    'volume_summary': '分卷摘要',
                                    'core': '核心设定',
                                    'world_basics': '世界设定',
                                    'character': '角色档案',
                                    'style': '文风',
                                    'location': '地点',
                                    'power': '力量体系',
                                    'hook': '卖点'
                                }[progress.generatedType] || progress.generatedType
                            }
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={autoAdvance}
                            onChange={e => setAutoAdvance(e.target.checked)}
                            className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900"
                            disabled={progress.status === 'completed'}
                        />
                        自动推进下一步
                    </label>

                    {progress.status === 'error' ? (
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleNextStep(true)}
                                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90"
                            >
                                跳过此步
                            </button>
                            <button
                                onClick={() => handleNextStep(false)}
                                className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            >
                                重试
                            </button>
                        </div>
                    ) : progress.status !== 'completed' && !autoAdvance ? (
                        <button
                            onClick={() => handleNextStep(false)}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90"
                        >
                            下一步
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : null}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}