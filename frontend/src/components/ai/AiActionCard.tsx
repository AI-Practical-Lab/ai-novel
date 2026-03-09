import { Bot, Check, Loader2, AlertCircle } from 'lucide-react';
import { AiCommandIntent } from '@/utils/ai-command';

interface Props {
  intent: AiCommandIntent;
  status: 'pending' | 'executing' | 'success' | 'error';
  error?: string;
  onExecute: () => void;
  onCancel: () => void;
}

export default function AiActionCard({ intent, status, error, onExecute, onCancel }: Props) {
  if (status === 'success') {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
          <Check className="w-4 h-4" />
          <span className="font-medium text-sm">执行成功</span>
        </div>
        <div className="text-xs text-green-600 dark:text-green-400">
          指令已完成，编辑器内容已更新。
        </div>
      </div>
    );
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'modify_metadata': return '修改属性';
      case 'rewrite_content': return '内容润色';
      case 'create_lore': return '新建设定';
      default: return '未知操作';
    }
  };

  const getScopeLabel = (type: string) => {
    switch (type) {
      case 'chapter': return '章节';
      case 'lore': return '设定';
      case 'project': return '作品';
      default: return type;
    }
  };

  const renderDetails = () => {
    if (intent.action === 'modify_metadata') {
      const updates = [];
      if (intent.params?.new_title) updates.push(`标题修改为：${intent.params.new_title}`);
      if (intent.params?.new_summary) updates.push(`更新摘要内容`);
      if (intent.params?.new_context) updates.push(`更新正文内容`);
      
      if (updates.length === 0) return <div className="text-zinc-600 dark:text-zinc-400">更新元数据（标题、摘要等）</div>;
      
      return (
        <div className="space-y-1">
          {updates.map((u, i) => (
            <div key={i} className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
              <span>{u}</span>
            </div>
          ))}
        </div>
      );
    }

    if (intent.action === 'rewrite_content') {
      return (
        <div className="text-zinc-700 dark:text-zinc-300">
          <div className="mb-1 text-zinc-500">优化要求：</div>
          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-100 dark:border-zinc-800">
            {intent.instruction}
          </div>
        </div>
      );
    }

    return (
      <div className="text-zinc-700 dark:text-zinc-300">
        {intent.instruction}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-purple-50 dark:bg-purple-900/20 px-3 py-2 border-b border-purple-100 dark:border-purple-800/50 flex items-center gap-2">
        <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
          {status === 'executing' ? '正在执行...' : '操作确认'}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Simplified Intent Display */}
        <div className="text-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
             <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
               {getActionLabel(intent.action)}
             </span>
             <span className="text-zinc-400">|</span>
             <span className="text-zinc-600 dark:text-zinc-400">
               {getScopeLabel(intent.scope.type)}
             </span>
          </div>

          <div className="text-sm">
            {renderDetails()}
          </div>
        </div>

        {/* Error Message */}
        {status === 'error' && error && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-2 rounded">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        {status !== 'executing' && (
          <div className="flex gap-2 justify-end pt-2">
            <button 
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 rounded transition-colors"
            >
              取消
            </button>
            <button 
              onClick={onExecute}
              className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 rounded transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3 h-3" />
              确认执行
            </button>
          </div>
        )}

        {status === 'executing' && (
          <div className="flex items-center justify-center py-2 text-purple-600 dark:text-purple-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
