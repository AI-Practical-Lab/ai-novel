import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { LORE_CATEGORIES } from '@/utils/constants';

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string, type: string) => void;
  title: string;
  placeholder?: string;
  defaultType?: string;
}

export default function InputModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  placeholder = '',
  defaultType = 'character'
}: InputModalProps) {
  const [value, setValue] = useState('');
  const [type, setType] = useState(defaultType);

  // Reset state when modal opens or defaultType changes
  useEffect(() => {
    if (isOpen) {
      setValue('');
      setType(defaultType);
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[70] bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">设定类型</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-zinc-900 dark:text-zinc-100"
            >
              {LORE_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.title} ({cat.id})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">设定标题</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-zinc-900 dark:text-zinc-100"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && value.trim()) {
                  onConfirm(value, type);
                  onClose();
                }
              }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (value.trim()) {
                onConfirm(value, type);
                onClose();
              }
            }}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
