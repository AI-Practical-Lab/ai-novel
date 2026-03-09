import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { analyzeLore } from '@/api';
import { toast } from 'sonner';

interface Suggestion {
  id: string;
  title: string;
  type: string;
  issue: string;
  suggestion: string;
  severity?: 'minor' | 'medium' | 'major';
}

interface Props {
  novelId: string;
  onLocate: (loreId: string, field?: string, title?: string) => void;
  suggestions?: Suggestion[] | null;
  onUpdateSuggestions?: (list: Suggestion[]) => void;
  onApplyChanges?: (loreId: string, changes: Array<{ field: string; before?: string; after?: string; mode?: 'replace' | 'append' | 'delete' }>) => void;
}

export default function LoreAuditPanel({ novelId, onLocate, suggestions: initialSuggestions, onUpdateSuggestions, onApplyChanges }: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions || []);

  const load = async () => {
    if (!novelId) return;
    setLoading(true);
    try {
      const res = await analyzeLore(novelId);
      if (res.success && Array.isArray(res.data)) {
        setSuggestions(res.data);
        if (onUpdateSuggestions) onUpdateSuggestions(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialSuggestions || initialSuggestions.length === 0) {
      load();
    } else {
      setSuggestions(initialSuggestions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novelId, initialSuggestions]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <div className="p-1.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">设定冲突审查</span>
          <span className="text-xs text-zinc-500">AI 分析设定集并给出修改建议</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-sm bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            刷新分析
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {suggestions.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400">
            {loading ? '分析中...' : '暂无建议'}
          </div>
        ) : (
          suggestions.map((s, i) => {
            const firstChange = Array.isArray((s as any).changes) && (s as any).changes.length > 0 ? (s as any).changes[0] : null;
            const rawField = firstChange && typeof firstChange.field === 'string' ? firstChange.field.trim() : '';
            const fieldParts = rawField.split('_');
            const fieldCore = fieldParts.length > 1 ? fieldParts.slice(1).join('_') : rawField;
            let displayTitle = s.title || '未命名设定';
            const sectionTitleMap: Record<string, string> = {
              content: '世界观设定',
              background: '世界背景',
              powerSystem: '力量体系',
              forces: '势力分布',
              locations: '空间设置',
              timeline: '时间线',
              conflict: '主线冲突',
              hooks: '钩子',
              twists: '转折',
              tone: '文风基调',
              pacing: '节奏',
              themes: '主题'
            };
            if (fieldCore && sectionTitleMap[fieldCore]) {
              displayTitle = sectionTitleMap[fieldCore];
            }
            return (
              <div
                key={`${s.id || i}-${s.title || ''}-${i}`}
                className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50/60 dark:bg-zinc-900/40"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{displayTitle}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      {s.type}
                    </span>
                    {s.severity && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        s.severity === 'major' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300' :
                        s.severity === 'medium' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {s.severity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* <button
                      onClick={() => {
                        const firstField = Array.isArray((s as any).changes) && (s as any).changes.length > 0 ? (s as any).changes[0].field : undefined;
                        if (onApplyChanges && Array.isArray((s as any).changes) && (s as any).changes.length > 0) {
                          onApplyChanges(s.id, (s as any).changes);
                        } else {
                          onLocate(s.id, firstField);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      定位并修改
                    </button> */}
                  </div>
                </div>
                <div className="text-xs text-zinc-500 mb-1">{s.issue}</div>
                <div className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-line">
                  {s.suggestion}
                </div>
                {Array.isArray((s as any).changes) && (s as any).changes.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs text-zinc-500">明确修改：</div>
                    {(s as any).changes.slice(0, 5).map((chg: any, idx: number) => (
                      <div key={idx} className="rounded border border-zinc-200 dark:border-zinc-800 p-2">
                        <div className="text-xs text-zinc-500 mb-1">
                          目标字段：{chg.field}（{chg.mode || 'replace'}）
                        </div>
                        {chg.mode !== 'delete' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-xs text-zinc-500">原文片段</div>
                              <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">{chg.before || '（未提供）'}</pre>
                            </div>
                            <div>
                              <div className="text-xs text-zinc-500">替换为</div>
                              <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">{chg.after || '（未提供）'}</pre>
                            </div>
                          </div>
                        )}
                        {chg.mode === 'delete' && (
                          <div>
                            <div className="text-xs text-zinc-500">删除片段</div>
                            <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">{chg.before || '（未提供）'}</pre>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          {chg.after && (
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(chg.after || '');
                                } catch {}
                              }}
                              className="px-2 py-1 text-xs rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                            >
                              复制替换文本
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if ((chg as any).after) {
                                navigator.clipboard.writeText((chg as any).after);
                                toast.success('已复制修改建议');
                              }
                              // Clean title by removing prefixes like "主角：" or "反派："
                              const cleanTitle = (s.title || '').replace(/^(主角|反派|配角|人物)[：:]\s*/, '').trim();
                              onLocate((s as any).id, chg.field, cleanTitle);
                            }}
                            className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            去修改
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(s as any).fixSteps && Array.isArray((s as any).fixSteps) && (
                  <div className="mt-2">
                    <div className="text-xs text-zinc-500">执行步骤：</div>
                    <ul className="list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-200">
                      {(s as any).fixSteps.slice(0, 5).map((step: string, idx: number) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(s as any).detail && (
                  <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-line">
                    {(s as any).detail}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
    </div>
  );
}
