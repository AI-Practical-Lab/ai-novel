import { useState, useEffect } from 'react';
import { Save, Loader2, Wand2, Plus, GripVertical, Trash2 } from 'lucide-react';
import { generateBeatSheet, generateBeat, getChapterBeatSheet, type BeatSheet, type Chapter, type CoreSettings } from '@/api';

type SceneForeshadows = {
  reuse?: string[];
  new?: string[];
};

type SceneInfo = {
  index?: number;
  location?: string;
  characters?: string[];
  summary?: string;
  function?: 'setup' | 'foreshadowing' | 'climax' | 'twist' | 'aftermath' | string;
  tension?: '平' | '中' | '高' | string;
  emotion_curve?: string;
  cool_points?: string[];
  reversals?: string[];
  foreshows?: SceneForeshadows;
  foreshadows?: SceneForeshadows;
};

type RichBeatSheet = BeatSheet & {
  emotion_target?: string;
  scenes?: SceneInfo[];
};

interface Props {
  chapter: Chapter;
  onSave: (beatSheet: BeatSheet) => Promise<void>;
  isSaving: boolean;
  previousContext?: string;
  previousChapterContent?: string;
  previousChapterId?: string | number;
  previousChapterTitle?: string;
  volumeSummary?: string;
  characters?: any[];
  coreSettings?: CoreSettings;
  milestoneContext?: any;
}

export default function BeatSheetEditor({ chapter, onSave, isSaving, previousContext, previousChapterContent, previousChapterId, previousChapterTitle, volumeSummary, characters, coreSettings, milestoneContext }: Props) {
  const [beatSheet, setBeatSheet] = useState<RichBeatSheet>({
    beats: [],
    goal: '',
    conflict: '',
    hook: ''
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingBeat, setIsAddingBeat] = useState(false);
  const [newBeatInstruction, setNewBeatInstruction] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (chapter.beatSheet) {
      if (typeof chapter.beatSheet === 'string') {
        try {
          const parsed = JSON.parse(chapter.beatSheet) as any;
          const beats = Array.isArray(parsed.beats) ? parsed.beats : [];
          const next: RichBeatSheet = {
            beats,
            goal: parsed.goal || '',
            conflict: parsed.conflict || '',
            hook: parsed.hook || '',
            emotion_target: parsed.emotion_target,
            scenes: Array.isArray(parsed.scenes) ? parsed.scenes : undefined
          };
          setBeatSheet(next);
        } catch {
          setBeatSheet({
            beats: [],
            goal: '',
            conflict: '',
            hook: ''
          });
        }
      } else {
        setBeatSheet(chapter.beatSheet as RichBeatSheet);
      }
    } else {
      setBeatSheet({
        beats: [],
        goal: '',
        conflict: '',
        hook: ''
      });
    }
  }, [chapter.id, chapter.beatSheet]);

  const handleGenerate = async () => {
    setErrorMessage(null);
    setIsGenerating(true);
    try {
      let enrichedPreviousContext = previousContext || '';
      if (previousChapterId && !enrichedPreviousContext.includes('上一章章纲（JSON）：')) {
        try {
          const res = await getChapterBeatSheet(previousChapterId);
          if (res.success && res.data) {
            let prevBeatSheet: any = res.data;
            if (typeof prevBeatSheet === 'string') {
              try {
                prevBeatSheet = JSON.parse(prevBeatSheet);
              } catch {
                prevBeatSheet = null;
              }
            }
            if (prevBeatSheet) {
              const parts: string[] = [];
              const titleLine = `上一章标题：${previousChapterTitle || ''}`.trim();
              if (titleLine !== '上一章标题：') parts.push(titleLine);
              const emotionTarget = prevBeatSheet.emotion_target ?? prevBeatSheet.emotionTarget;
              const scenes: any[] | undefined = Array.isArray(prevBeatSheet.scenes) ? prevBeatSheet.scenes : undefined;
              const beatsCount = Array.isArray(prevBeatSheet.beats) ? prevBeatSheet.beats.length : 0;
              const rhythmLines: string[] = [];
              if (typeof emotionTarget === 'string' && emotionTarget.trim()) {
                rhythmLines.push(`情绪目标：${emotionTarget.trim()}`);
              }
              if (Array.isArray(scenes) && scenes.length > 0) {
                const sceneLines = scenes.map((s, idx) => {
                  const location = typeof s?.location === 'string' ? s.location.trim() : '';
                  const func = typeof s?.function === 'string' ? s.function.trim() : '';
                  const tension = typeof s?.tension === 'string' ? s.tension.trim() : '';
                  const emotion = typeof s?.emotion_curve === 'string' ? s.emotion_curve.trim() : '';
                  const summary = typeof s?.summary === 'string' ? s.summary.trim() : '';
                  const chars = Array.isArray(s?.characters) ? s.characters.filter((c: unknown) => typeof c === 'string' && c.trim()).join('、') : '';
                  const fields = [
                    location ? `地点=${location}` : '',
                    chars ? `角色=${chars}` : '',
                    func ? `功能=${func}` : '',
                    tension ? `张力=${tension}` : '',
                    emotion ? `情绪=${emotion}` : '',
                    summary ? `摘要=${summary}` : ''
                  ].filter(Boolean);
                  return `${idx + 1}. ${fields.join('；')}`.trim();
                }).filter(Boolean);
                if (sceneLines.length > 0) {
                  rhythmLines.push(`场景节奏（按场景）：\n${sceneLines.join('\n')}`);
                }
              } else if (beatsCount > 0) {
                rhythmLines.push(`场景节奏：上一章共有 ${beatsCount} 个剧情点（未提供 scenes 结构化场景）。`);
              }
              if (rhythmLines.length > 0) {
                parts.push(`上一章场景节奏与情绪：\n${rhythmLines.join('\n\n')}`);
              }
              parts.push(`上一章章纲（JSON）：\n${JSON.stringify(prevBeatSheet, null, 2)}`);
              enrichedPreviousContext = [enrichedPreviousContext, parts.join('\n\n')].filter(Boolean).join('\n\n').trim();
            }
          }
        } catch {
        }
      }

      const payload: any = {
        title: chapter.title,
        summary: chapter.summary,
        previousContext: enrichedPreviousContext,
        previousChapterContent,
        volumeSummary,
        characters,
        coreSettings,
        milestoneContext
      };
      const res = await generateBeatSheet(payload);
      
      if (res.success && res.data) {
        const raw = res.data as any;
        const scenes: SceneInfo[] | undefined = Array.isArray(raw.scenes) ? raw.scenes : undefined;
        const beats: string[] = Array.isArray(raw.beats)
          ? raw.beats
          : Array.isArray(scenes)
            ? scenes.map((s, idx) => s.summary || `场景 ${idx + 1}`)
            : [];
        const nextBeatSheet: RichBeatSheet = {
          beats,
          goal: raw.goal || '',
          conflict: raw.conflict || '',
          hook: raw.hook || '',
          emotion_target: raw.emotion_target,
          scenes
        };
        setBeatSheet(nextBeatSheet);
        await onSave(nextBeatSheet);
      } else {
        setErrorMessage('生成章纲失败，请重试');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('生成出错');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateBeat = (index: number, value: string) => {
    const newBeats = [...beatSheet.beats];
    newBeats[index] = value;
    setBeatSheet(prev => ({ ...prev, beats: newBeats }));
  };

  const handleInsertBeatBefore = (index: number) => {
    setBeatSheet(prev => {
      const beats = [...prev.beats];
      const insertIndex = index < 0 ? 0 : index;
      beats.splice(insertIndex, 0, '');
      return { ...prev, beats };
    });
  };

  const handleInsertBeatAfter = (index: number) => {
    setBeatSheet(prev => {
      const beats = [...prev.beats];
      beats.splice(index + 1, 0, '');
      return { ...prev, beats };
    });
  };

  const handleAddBeat = async () => {
    const trimmed = newBeatInstruction.trim();

    if (!trimmed) {
      setBeatSheet(prev => ({
        ...prev,
        beats: [...prev.beats, '']
      }));
      setNewBeatInstruction('');
      return;
    }

    setErrorMessage(null);
    setIsAddingBeat(true);
    try {
      const res = await generateBeat({
        chapterTitle: chapter.title,
        chapterSummary: chapter.summary,
        instruction: trimmed,
        previousBeats: beatSheet.beats
      });

      const beatText = res.success && res.data ? res.data : '';
      setBeatSheet(prev => ({
        ...prev,
        beats: [...prev.beats, beatText || '']
      }));
      setNewBeatInstruction('');
    } catch (error) {
      console.error(error);
      setErrorMessage('AI 生成剧情点失败，请重试或手动填写');
      setBeatSheet(prev => ({
        ...prev,
        beats: [...prev.beats, '']
      }));
    } finally {
      setIsAddingBeat(false);
    }
  };

  const handleDeleteBeat = (index: number) => {
    const newBeats = beatSheet.beats.filter((_, i) => i !== index);
    setBeatSheet(prev => ({ ...prev, beats: newBeats }));
  };

  const handleSaveManual = () => {
    onSave(beatSheet);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">章纲编排</h3>
          <p className="text-sm text-zinc-500">规划本章的详细剧情点</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-3 py-1.5 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span>AI 生成章纲</span>
          </button>
          <button
            onClick={handleSaveManual}
            disabled={isSaving}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>保存</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {errorMessage && (
          <div className="px-3 py-2 rounded-md bg-red-50 text-red-600 text-xs border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-3 text-red-400 hover:text-red-600 text-xs"
            >
              关闭
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">本章目标 (Goal)</label>
            <textarea
              value={beatSheet.goal}
              onChange={e => setBeatSheet(prev => ({ ...prev, goal: e.target.value }))}
              className="w-full h-24 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="主角想要达成什么？"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">核心冲突 (Conflict)</label>
            <textarea
              value={beatSheet.conflict}
              onChange={e => setBeatSheet(prev => ({ ...prev, conflict: e.target.value }))}
              className="w-full h-24 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="遇到什么阻碍？"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">结尾钩子 (Hook)</label>
            <textarea
              value={beatSheet.hook}
              onChange={e => setBeatSheet(prev => ({ ...prev, hook: e.target.value }))}
              className="w-full h-24 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="如何吸引读者看下一章？"
            />
          </div>
          <div className="space-y-2">
            {beatSheet.emotion_target && (
              <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-50 text-xs text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-700">
                <span className="mr-1">情绪目标</span>
                <span className="font-semibold">{beatSheet.emotion_target}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">剧情点 (Beats)</label>
          </div>
          
          <div className="space-y-2">
            {beatSheet.beats.map((beat, index) => (
              <div key={index} className="flex gap-3 group">
                <div className="pt-1 text-zinc-400 flex flex-col items-center">
                  {index === 0 && (
                    <button
                      onClick={() => handleInsertBeatBefore(0)}
                      className="mb-1 text-zinc-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                  <div className="cursor-move pt-2">
                    <GripVertical className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1">
                  <textarea
                    value={beat}
                    onChange={e => handleUpdateBeat(index, e.target.value)}
                    className="w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none min-h-[60px]"
                    placeholder={`剧情点 ${index + 1}`}
                  />
                </div>
                <div className="flex items-center gap-2 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleInsertBeatAfter(index)}
                    className="text-zinc-400 hover:text-blue-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBeat(index)}
                    className="text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <textarea
              value={newBeatInstruction}
              onChange={e => setNewBeatInstruction(e.target.value)}
              className="w-full p-2 text-sm rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none min-h-[48px]"
              placeholder="可选：输入简单需求，AI 将生成约100字的剧情点；留空则新增一个空白剧情点"
            />
            <button
              onClick={handleAddBeat}
              disabled={isAddingBeat}
              className="w-full py-3 flex items-center justify-center gap-2 text-zinc-500 hover:text-blue-600 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors disabled:opacity-50"
            >
              {isAddingBeat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>添加剧情点（支持AI生成）</span>
            </button>
          </div>

          {beatSheet.scenes && beatSheet.scenes.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">场景节奏与情绪</div>
              {beatSheet.scenes.map((scene, index) => {
                const foreshadows = scene.foreshows || scene.foreshadows;
                const reuseCount = foreshadows?.reuse?.length || 0;
                const newCount = foreshadows?.new?.length || 0;
                return (
                  <div
                    key={scene.index ?? index}
                    className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-white/60 dark:bg-zinc-900/40"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-400">S{scene.index ?? index + 1}</span>
                        {scene.function && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                            {scene.function}
                          </span>
                        )}
                        {scene.tension && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] border ${
                              scene.tension === '高'
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800'
                                : scene.tension === '中'
                                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                            }`}
                          >
                            张力：{scene.tension}
                          </span>
                        )}
                      </div>
                      {scene.emotion_curve && (
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          情绪：{scene.emotion_curve}
                        </div>
                      )}
                    </div>

                    {scene.summary && (
                      <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed mb-2">
                        {scene.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-1 text-[11px]">
                      {scene.cool_points && scene.cool_points.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                          爽点×{scene.cool_points.length}
                        </span>
                      )}
                      {scene.reversals && scene.reversals.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-700">
                          反转×{scene.reversals.length}
                        </span>
                      )}
                      {reuseCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                          回收伏笔×{reuseCount}
                        </span>
                      )}
                      {newCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">
                          新埋伏笔×{newCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
