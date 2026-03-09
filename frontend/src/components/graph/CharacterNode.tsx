import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { User } from 'lucide-react';

interface CharacterNodeProps {
  data: {
    label: string;
    role?: string;
    gender?: string;
    age?: string;
  };
  selected?: boolean;
}

export default memo(({ data, selected }: CharacterNodeProps) => {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-white dark:bg-zinc-800 border-2 transition-colors min-w-[150px] ${
      selected 
        ? 'border-purple-500 ring-2 ring-purple-500/20' 
        : 'border-zinc-200 dark:border-zinc-700 hover:border-purple-400'
    }`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-zinc-400" />
      
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
          <User className="w-4 h-4" />
        </div>
        <div className="flex flex-col overflow-hidden">
            <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{data.label}</div>
            {data.role && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{data.role}</div>
            )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-zinc-400" />
    </div>
  );
});
