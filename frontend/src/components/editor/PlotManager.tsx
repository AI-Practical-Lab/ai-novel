import { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Wand2, Loader2, ArrowRight, CheckCircle2, User, Users, Sparkles, X } from 'lucide-react';
import { type Milestone, type Volume, generateMilestones, generateBridgeBeats, createChapter, updateVolume, getNovel, suggestPlotCharacters, generateChaptersFromMilestone, batchCreateChapters, getVolumeMilestones, replaceVolumeMilestones, type VolumeMilestone } from '@/api';

type RichMilestone = Milestone & {
  cool_points?: string[];
  reversals?: string[];
  foreshadows?: { description?: string; recover_at?: string }[];
};

interface Props {
  volume: Volume;
  novelId: string;
  characters?: any[];
  onUpdate: (updatedVolume: Volume) => void;
}

export default function PlotManager({ volume, novelId, characters = [], onUpdate }: Props) {
  const [milestones, setMilestones] = useState<RichMilestone[]>((volume.milestones as RichMilestone[]) || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingBridgeIndex, setGeneratingBridgeIndex] = useState<number | null>(null);
  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null);
  const [suggestingMilestoneId, setSuggestingMilestoneId] = useState<string | null>(null);
  const [volumeTotalChapters, setVolumeTotalChapters] = useState<number>(100);

  useEffect(() => {
    setMilestones((volume.milestones as RichMilestone[]) || []);
  }, [volume.milestones]);

  useEffect(() => {
    const loadMilestones = async () => {
      try {
        const res = await getVolumeMilestones(novelId, volume.id);
        if (res.success && res.data && res.data.length > 0) {
          const serverMilestones: RichMilestone[] = res.data.map((item: VolumeMilestone) => {
            let characterIds: string[] | undefined;
            let coolPoints: string[] | undefined;
            let reversals: string[] | undefined;
            let foreshadows: { description?: string; recover_at?: string }[] | undefined;
            if (item.characterIds) {
              try {
                const parsed = JSON.parse(item.characterIds);
                if (Array.isArray(parsed)) {
                  characterIds = parsed.map(String);
                }
              } catch {
                characterIds = undefined;
              }
            }
            if (item.coolPoints) {
              try {
                const parsed = JSON.parse(item.coolPoints);
                if (Array.isArray(parsed)) {
                  coolPoints = parsed.map(String);
                }
              } catch {
                coolPoints = undefined;
              }
            }
            if (item.reversals) {
              try {
                const parsed = JSON.parse(item.reversals);
                if (Array.isArray(parsed)) {
                  reversals = parsed.map(String);
                }
              } catch {
                reversals = undefined;
              }
            }
            if (item.foreshadows) {
              try {
                const parsed = JSON.parse(item.foreshadows);
                if (Array.isArray(parsed)) {
                  foreshadows = parsed as { description?: string; recover_at?: string }[];
                }
              } catch {
                foreshadows = undefined;
              }
            }
            return {
              id: String(item.id),
              title: item.title,
              description: item.description || '',
              percentage: 0,
              chapterId: item.startChapterId ? String(item.startChapterId) : undefined,
              summary: item.description || '',
              characterIds,
              type: item.type || 'milestone',
              estimated_chapters: item.estimatedChapters || undefined,
              pace_type: item.paceType || undefined,
              cool_points: coolPoints,
              reversals,
              foreshadows
            };
          });
          setMilestones(serverMilestones);
          onUpdate({ ...volume, milestones: serverMilestones });
        }
      } catch (error) {
        console.error('加载分卷路标失败', error);
      }
    };
    loadMilestones();
  }, [novelId, volume.id]);

  const [chapterCounts, setChapterCounts] = useState<Record<string, number>>({});
  const [generatingChapterIds, setGeneratingChapterIds] = useState<Set<string>>(new Set());

  const handleGenerateChapters = async (milestone: Milestone, index: number) => {
    // Cast milestone to MilestoneWithMeta to access estimated_chapters
    const count = chapterCounts[milestone.id] || milestone.estimated_chapters || 3;
    const prevMilestone = index > 0 ? milestones[index - 1] : undefined;
    const nextMilestone = index < milestones.length - 1 ? milestones[index + 1] : undefined;
    
    setGeneratingChapterIds(prev => new Set(prev).add(milestone.id));
    try {
      const res = await generateChaptersFromMilestone({
        milestoneTitle: milestone.title,
        milestoneSummary: milestone.summary || '',
        count,
        volumeContext: volume.summary,
        characters: characters.map(c => ({
          id: c.id || c._id,
          name: c.name || c.title,
          title: c.title,
          role: c.role,
          content: typeof c.content === 'string' ? c.content.slice(0, 300) : '',
          description: typeof c.content === 'string'
            ? c.content.slice(0, 300)
            : (typeof c.description === 'string' ? c.description.slice(0, 300) : '')
        })),
        prevMilestone: prevMilestone ? { title: prevMilestone.title, summary: prevMilestone.summary || '' } : undefined,
        nextMilestone: nextMilestone ? { title: nextMilestone.title, summary: nextMilestone.summary || '' } : undefined
      });
      
      if (res.success && res.data) {
        const createRes = await batchCreateChapters(novelId, volume.id, res.data);
        
        if (createRes.success) {
          window.dispatchEvent(new CustomEvent('novel-data-reload'));
          // Optionally update local milestone state if we can get the ID, 
          // but since we created multiple chapters, linking one milestone to multiple chapters 
          // requires milestone schema change or just relying on "has chapters in this range" logic.
          // For now, reload is enough.
        } else {
          alert('保存章节失败');
        }
      } else {
        alert('生成失败，请重试');
      }
    } catch (e) {
      console.error(e);
      alert('操作失败');
    } finally {
      setGeneratingChapterIds(prev => {
        const next = new Set(prev);
        next.delete(milestone.id);
        return next;
      });
    }
  };

  const handleGenerateMilestones = async () => {
    if (milestones.length > 0 && !confirm('当前已有路标，重新生成将覆盖现有内容，确定吗？')) return;
    
    const chaptersForPrompt = (volume.chapters || []).map((c, index) => ({
      title: c.title || `第${index + 1}章`,
      summary: c.summary || ''
    }));

    let timeline: string | undefined = undefined;
    try {
      const novelRes = await getNovel(novelId);
      if (novelRes.success && novelRes.data && Array.isArray(novelRes.data.lore)) {
        const worldLore = novelRes.data.lore.find((l: any) => l.type === 'world' && (l.id === 'world' || (l as any)._id === 'world'));
        if (worldLore) {
          const raw = (worldLore as any).timeline;
          if (Array.isArray(raw)) {
            timeline = raw.join('\n');
          } else if (typeof raw === 'string') {
            timeline = raw;
          }
        }
      }
    } catch (e) {
      console.error('加载世界时间线失败', e);
    }

    setIsGenerating(true);
    try {
      const res = await generateMilestones({
        volumeTitle: volume.title,
        volumeSummary: volume.summary || '',
        chapters: chaptersForPrompt,
        timeline,
        volumeTotalChapters
      });
      
      if (res.success && res.data) {
        const newMilestones = res.data.map((m, i) => ({ ...m, id: `m_${Date.now()}_${i}` }));
        setMilestones(newMilestones);
        await saveMilestones(newMilestones);
      } else {
        alert(res.error || '生成路标失败');
      }
    } catch (error) {
      console.error(error);
      alert('生成路标失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateBridge = async (index: number) => {
    setGeneratingBridgeIndex(index);
    try {
      const start = milestones[index];
      const end = milestones[index + 1];
      
      const res = await generateBridgeBeats({
        startMilestone: start,
        endMilestone: end
      });
      
      console.log('Bridge generation response:', res); // Debug log

      if (res.success && res.data) {
        const newBeats = res.data.map((b, i) => ({ ...b, id: `b_${Date.now()}_${i}` }));
        
        // Insert beats between start and end
        const newMilestones = [...milestones];
        newMilestones.splice(index + 1, 0, ...newBeats);
        
        setMilestones(newMilestones);
        await saveMilestones(newMilestones);
      }
    } catch (error) {
      console.error(error);
      alert('生成过渡剧情失败');
    } finally {
      setGeneratingBridgeIndex(null);
    }
  };

  const handleConvertToChapter = async (milestone: Milestone) => {
    // Check if chapter actually exists
    const chapterExists = milestone.chapterId && volume.chapters.some(c => c.id === milestone.chapterId);
    if (chapterExists) return; 
    
    // Create chapter
    const res = await createChapter(novelId, volume.id, milestone.title, milestone.summary, milestone.characterIds);
    if (res.success) {
      // Mark as linked
      const newMilestones = milestones.map(m => 
        m.id === milestone.id ? { ...m, chapterId: res.data.id } : m
      );
      setMilestones(newMilestones);
      await saveMilestones(newMilestones);
      
      // Refresh volume data in parent to show new chapter in sidebar
      // Note: We need to refetch novel or manually update volume state in parent
      // For simplicity, we just notify parent about milestones update, 
      // but parent also needs to know about new chapters.
      // Ideally, parent should reload novel data.
      window.dispatchEvent(new CustomEvent('novel-data-reload'));
    }
  };

  const saveMilestones = async (newMilestones: Milestone[]) => {
    await updateVolume(novelId, volume.id, { milestones: newMilestones });
    await replaceVolumeMilestones(novelId, volume.id, newMilestones);
    onUpdate({ ...volume, milestones: newMilestones });
  };

  const handleDelete = async (index: number) => {
    const newMilestones = milestones.filter((_, i) => i !== index);
    setMilestones(newMilestones);
    await saveMilestones(newMilestones);
  };

  const handleUpdateCharacters = async (index: number, charIds: string[]) => {
    const newMilestones = [...milestones];
    newMilestones[index] = { ...newMilestones[index], characterIds: charIds };
    setMilestones(newMilestones);
    await saveMilestones(newMilestones);
  };

  const handleAiSuggestCharacters = async (milestone: Milestone, index: number) => {
    setSuggestingMilestoneId(milestone.id);
    try {
        const res = await suggestPlotCharacters({
            plotTitle: milestone.title,
            plotSummary: milestone.summary,
            characters: characters.map(c => ({ 
                id: c.id, 
                name: c.name || c.title, 
                role: c.role,
                content: (c.content || '').slice(0, 300)
            }))
        });

        if (res.success && res.data) {
            const suggestedIds = res.data;
            const currentIds = milestone.characterIds || [];
            const newIds = Array.from(new Set([...currentIds, ...suggestedIds]));
            
            if (newIds.length > currentIds.length) {
                handleUpdateCharacters(index, newIds);
            }
        }
    } catch (e) {
        console.error(e);
        alert('AI 选角失败');
    } finally {
        setSuggestingMilestoneId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">剧情规划板</h3>
          <p className="text-sm text-zinc-500">动态规划分卷路标与过渡剧情</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5">
            <span>本卷预计</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={volumeTotalChapters}
              onChange={(e) => setVolumeTotalChapters(parseInt(e.target.value) || 100)}
              className="w-12 bg-transparent text-center font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none"
            />
            <span>章</span>
          </div>
          <button
            onClick={handleGenerateMilestones}
            disabled={isGenerating}
            className="px-3 py-1.5 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span>{milestones.length > 0 ? '重新生成路标' : '生成关键路标'}</span>
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto relative">
          {/* Vertical Line */}
          {milestones.length > 0 && (
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-zinc-200 dark:bg-zinc-700" />
          )}

          {milestones.map((milestone, index) => {
            const rich = milestone as RichMilestone;
            const coolCount = rich.cool_points && Array.isArray(rich.cool_points) ? rich.cool_points.length : 0;
            const reversalCount = rich.reversals && Array.isArray(rich.reversals) ? rich.reversals.length : 0;
            const foreshadowCount = rich.foreshadows && Array.isArray(rich.foreshadows) ? rich.foreshadows.length : 0;
            const isLinked = milestone.chapterId && volume.chapters.some(c => c.id === milestone.chapterId);
            return (
            <div key={milestone.id} className="relative mb-8 group">
              {/* Dot */}
              <div className={`absolute left-4 w-4 h-4 rounded-full border-2 z-10 ${
                milestone.type === 'milestone' 
                  ? 'bg-blue-500 border-white dark:border-zinc-900 w-5 h-5 left-[1.125rem]' 
                  : 'bg-zinc-400 border-white dark:border-zinc-900'
              }`} />

              {/* Card */}
              <div className="ml-16 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative">
                {/* Actions */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleDelete(index)}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    milestone.type === 'milestone' 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {milestone.type === 'milestone' ? '关键路标' : '过渡剧情'}
                  </span>
                  {isLinked && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      已转章节
                    </span>
                  )}
                </div>

                <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{milestone.title}</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{milestone.summary}</p>
                {(milestone.estimated_chapters || milestone.pace_type || coolCount > 0 || reversalCount > 0 || foreshadowCount > 0) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                    {typeof milestone.estimated_chapters === 'number' && milestone.estimated_chapters > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-50 dark:bg-zinc-700/50 border border-zinc-200 dark:border-zinc-600">
                        预计 {milestone.estimated_chapters} 章
                      </span>
                    )}
                    {milestone.pace_type && (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-50 dark:bg-zinc-700/50 border border-zinc-200 dark:border-zinc-600">
                        节奏：{milestone.pace_type}
                      </span>
                    )}
                    {coolCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                        爽点×{coolCount}
                      </span>
                    )}
                    {reversalCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-700">
                        反转×{reversalCount}
                      </span>
                    )}
                    {foreshadowCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">
                        伏笔×{foreshadowCount}
                      </span>
                    )}
                  </div>
                )}

                {/* Convert Button */}
                {!isLinked && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex items-center bg-zinc-50 dark:bg-zinc-700/50 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1">
                       <span className="text-xs text-zinc-500 mr-2">拆分为</span>
                       <input 
                         type="number" 
                         min="1" 
                         max="20"
                         className="w-8 bg-transparent text-center text-sm font-medium focus:outline-none dark:text-zinc-200"
                         value={chapterCounts[milestone.id] || milestone.estimated_chapters || 3}
                         onChange={(e) => {
                             const val = parseInt(e.target.value);
                             setChapterCounts(prev => ({...prev, [milestone.id]: isNaN(val) ? 1 : val}));
                         }}
                       />
                       <span className="text-xs text-zinc-500 ml-1">章</span>
                    </div>
                    
                    <button 
                      onClick={() => handleGenerateChapters(milestone, index)}
                      disabled={generatingChapterIds.has(milestone.id)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1"
                    >
                      {generatingChapterIds.has(milestone.id) ? (
                         <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                         <Wand2 className="w-3 h-3" />
                      )}
                      生成章节
                    </button>
                  </div>
                )}

                {/* Characters Section */}
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center gap-2 flex-wrap">
                    <div className="text-xs text-zinc-400 flex items-center gap-1 mr-2">
                        <Users className="w-3 h-3" />
                        <span>出场:</span>
                    </div>
                    
                    {milestone.characterIds?.map(charId => {
                        const char = characters.find(c => c.id === charId);
                        if (!char) return null;
                        return (
                            <div key={charId} className="group/char relative flex items-center gap-1 px-2 py-1 bg-zinc-50 dark:bg-zinc-700 rounded-full border border-zinc-200 dark:border-zinc-600">
                                 <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px]">
                                    {(char.name || '?')[0]}
                                 </div>
                                 <span className="text-xs text-zinc-700 dark:text-zinc-300">{char.name || '未知角色'}</span>
                                 
                                 <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newIds = milestone.characterIds?.filter(id => id !== charId) || [];
                                        handleUpdateCharacters(index, newIds);
                                    }}
                                    className="ml-1 p-0.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-full opacity-0 group-hover/char:opacity-100 transition-all"
                                 >
                                    <X className="w-3 h-3" />
                                 </button>
                            </div>
                        );
                    })}

                    <button 
                        onClick={() => handleAiSuggestCharacters(milestone, index)}
                        disabled={suggestingMilestoneId === milestone.id}
                        className="w-6 h-6 rounded-full border border-purple-200 bg-purple-50 flex items-center justify-center text-purple-600 hover:bg-purple-100 transition-all mr-1"
                        title="AI 自动分析出场角色"
                    >
                        {suggestingMilestoneId === milestone.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Sparkles className="w-3 h-3" />
                        )}
                    </button>

                    <button 
                        onClick={() => setActiveMilestoneId(milestone.id)}
                        className="w-6 h-6 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all"
                        title="关联角色"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                </div>
              </div>

              {/* Bridge Generator (Between nodes) */}
              {index < milestones.length - 1 && (
                <div className="absolute left-6 -bottom-6 w-6 h-6 flex items-center justify-center z-20 group-hover:opacity-100 transition-opacity -ml-3">
                  <button
                    onClick={() => handleGenerateBridge(index)}
                    disabled={generatingBridgeIndex === index}
                    className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 border border-purple-200 flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                    title="生成过渡剧情"
                  >
                    {generatingBridgeIndex === index ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ); })}

          {milestones.length === 0 && (
            <div className="text-center py-20 text-zinc-400">
              <p>暂无路标，请点击右上角生成</p>
            </div>
          )}
        </div>
      </div>

      {/* Character Selection Modal */}
      {activeMilestoneId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setActiveMilestoneId(null)}>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-xl w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100">选择出场角色</h3>
                <div className="space-y-2">
                    {characters.map(char => {
                        const milestone = milestones.find(m => m.id === activeMilestoneId);
                        const isSelected = milestone?.characterIds?.includes(char.id);
                        return (
                            <div 
                                key={char.id}
                                onClick={() => {
                                    const mIndex = milestones.findIndex(m => m.id === activeMilestoneId);
                                    if (mIndex === -1) return;
                                    const currentIds = milestone?.characterIds || [];
                                    const newIds = isSelected 
                                        ? currentIds.filter(id => id !== char.id)
                                        : [...currentIds, char.id];
                                    handleUpdateCharacters(mIndex, newIds);
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
                                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{char.name}</div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{char.role}</div>
                                </div>
                                {isSelected && <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400 ml-auto" />}
                            </div>
                        );
                    })}
                </div>
                 <div className="mt-4 flex justify-end">
                    <button 
                        onClick={() => setActiveMilestoneId(null)}
                        className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium"
                    >
                        完成
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
