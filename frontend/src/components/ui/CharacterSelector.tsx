import React from 'react';
import { User, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  characters: any[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
}

export default function CharacterSelector({ isOpen, onClose, characters, selectedIds, onSelect }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-xl w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100">选择出场角色</h3>
            <div className="space-y-2">
                {characters.map(char => {
                    const isSelected = selectedIds.includes(char.id);
                    return (
                        <div 
                            key={char.id}
                            onClick={() => {
                                const newIds = isSelected 
                                    ? selectedIds.filter(id => id !== char.id)
                                    : [...selectedIds, char.id];
                                onSelect(newIds);
                            }}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                                isSelected 
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                                    : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                        >
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <User className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-zinc-900 dark:text-zinc-100">{char.name || char.title}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">{char.role}</div>
                            </div>
                            {isSelected && <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400 ml-auto" />}
                        </div>
                    );
                })}
            </div>
             <div className="mt-4 flex justify-end">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium"
                >
                    完成
                </button>
            </div>
        </div>
    </div>
  );
}