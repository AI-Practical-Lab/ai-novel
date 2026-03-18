import { ChevronRight, ChevronLeft, Tag, Wand2, Loader2 } from 'lucide-react';
import { type WizardData } from '@/views/CreateWizard';
import { useState, useEffect, useRef } from 'react';
import { recommendTags } from '@/api';

interface Props {
  data: WizardData;
  updateData: (data: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const GENRES = ['玄幻', '科幻', '都市', '悬疑', '历史', '游戏', '奇幻', '仙侠', '轻小说'];
const STYLES = ['严肃', '幽默', '暗黑', '热血', '轻松', '悲剧', '正剧'];

export default function Step2GenreStyle({ data, updateData, onNext, onBack }: Props) {
  const [customTag, setCustomTag] = useState('');
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendedTags, setRecommendedTags] = useState<string[]>([]);
  const initialSnapshotRef = useRef<string>('');

  // Capture initial state on mount
  useEffect(() => {
    const snapshot = JSON.stringify({
      title: data.title,
      description: data.description,
      genre: data.genre,
      style: data.style,
      tags: data.tags
    });
    initialSnapshotRef.current = snapshot;
  }, []);

  // Auto-recommend when entering this step if fields are empty
  useEffect(() => {
    if (data.title && !data.genre && !data.style && !data.coreSettings.protagonist.name && !isRecommending && recommendedTags.length === 0) {
      handleRecommend();
    }
  }, []);

  const handleNextStep = () => {
    const currentSnapshot = JSON.stringify({
      title: data.title,
      description: data.description,
      genre: data.genre,
      style: data.style,
      tags: data.tags
    });

    const hasChanges = currentSnapshot !== initialSnapshotRef.current;
    // Check if Step 3 (Core Settings) has substantial content
    const hasCoreSettings = !!(
        data.coreSettings.protagonist.name ||
        data.coreSettings.world.background ||
        data.coreSettings.outline.mainConflict
    );

    if (hasChanges && hasCoreSettings) {
      if (window.confirm('检测到基础设定已变更，是否重置后续的核心设定（主角、世界观等）以便重新生成？\n\n【确定】重置核心设定\n【取消】保留现有设定')) {
        updateData({
          coreSettings: {
            protagonist: { name: '', gender: '', age: '', personality: '', cheat: '' },
            antagonist: { name: '', role: '', personality: '' },
            world: { background: '', powerSystem: '', forces: '' },
            outline: { mainConflict: '' }
          }
        });
      }
    }

    onNext();
  };

  const handleRecommend = async () => {
    setIsRecommending(true);
    try {
      const res = await recommendTags(data.title, data.description);
      if (res.success && res.data) {
        const recTags: string[] = Array.isArray(res.data.tags) ? res.data.tags : [];
        const currentTags = Array.isArray(data.tags) ? data.tags : [];
        // 合并全部推荐标签到已选标签，去重
        const mergedTags = Array.from(new Set([...currentTags, ...recTags]));

        updateData({
          genre: res.data.genre,
          style: res.data.style,
          tags: mergedTags
        });
        setRecommendedTags(recTags);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsRecommending(false);
    }
  };

  const handleAddTag = (tagToAdd?: string) => {
    const tag = tagToAdd || customTag;
    if (tag.trim()) {
      const currentTags = data.tags || [];
      if (!currentTags.includes(tag.trim())) {
        updateData({
          tags: [...currentTags, tag.trim()]
        });
      }
      if (!tagToAdd) setCustomTag('');
    }
  };

  const removeTag = (tag: string) => {
    const currentTags = data.tags || [];
    updateData({
      tags: currentTags.filter(t => t !== tag)
    });
  };

  const tags = data.tags || [];

  return (
      <div className="p-8 md:p-10">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">题材与风格</h2>
          <p className="text-zinc-500 mt-2">定义小说的基调，帮助 AI 更好地理解你的创作意图</p>

          {/* Manual Trigger for Recommendation */}
          <button
              onClick={handleRecommend}
              disabled={isRecommending}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1.5 mx-auto"
          >
            {isRecommending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            <span>{isRecommending ? '分析中...' : 'AI 智能推荐'}</span>
          </button>
        </div>

        <div className="space-y-8">
          {/* Genre Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              主要题材 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                  <button
                      key={g}
                      onClick={() => updateData({ genre: g })}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                          data.genre === g
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500'
                      }`}
                  >
                    {g}
                  </button>
              ))}
              <input
                  type="text"
                  placeholder="自定义"
                  value={!GENRES.includes(data.genre) ? data.genre : ''}
                  onChange={(e) => updateData({ genre: e.target.value })}
                  className={`px-4 py-2 rounded-full text-sm bg-transparent border outline-none w-24 focus:w-32 transition-all ${
                      !GENRES.includes(data.genre) && data.genre
                          ? 'border-blue-600 text-blue-600'
                          : 'border-zinc-200 dark:border-zinc-700 focus:border-blue-500'
                  }`}
              />
            </div>
          </div>

          {/* Style Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              文风基调
            </label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map(s => (
                  <button
                      key={s}
                      onClick={() => updateData({ style: s })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          data.style === s
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-purple-400 dark:hover:border-purple-500'
                      }`}
                  >
                    {s}
                  </button>
              ))}
              <input
                  type="text"
                  placeholder="自定义"
                  value={!STYLES.includes(data.style) ? data.style : ''}
                  onChange={(e) => updateData({ style: e.target.value })}
                  className={`px-4 py-2 rounded-lg text-sm bg-transparent border outline-none w-24 focus:w-32 transition-all ${
                      !STYLES.includes(data.style) && data.style
                          ? 'border-purple-600 text-purple-600'
                          : 'border-zinc-200 dark:border-zinc-700 focus:border-purple-500'
                  }`}
              />
            </div>
          </div>

          {/* Tags / Core Settings */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              核心元素 / 标签
            </label>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm text-zinc-700 dark:text-zinc-300">
                  <Tag className="w-3 h-3 text-zinc-400" />
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-1 hover:text-red-500">×</button>
                </span>
                ))}
              </div>

              {/* Recommended Tags */}
              {recommendedTags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="text-xs text-zinc-400 py-1">推荐：</span>
                    {recommendedTags.filter(t => !tags.includes(t)).map(tag => (
                        <button
                            key={tag}
                            onClick={() => { handleAddTag(tag); }}
                            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors border border-blue-100"
                        >
                          + {tag}
                        </button>
                    ))}
                  </div>
              )}

              <div className="flex gap-2">
                <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const val = customTag.trim(); if (val) { handleAddTag(); } } }}
                    placeholder="输入标签（如：系统流、重生、克苏鲁）然后回车"
                    className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
                <button
                    onClick={() => { const val = customTag.trim(); if (val) { handleAddTag(); } }}
                    disabled={!customTag.trim()}
                    className="text-sm font-medium text-blue-600 disabled:opacity-50 hover:text-blue-700"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-10 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between">
          <button
              onClick={onBack}
              className="px-6 py-3 text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>上一步</span>
          </button>
          <button
              onClick={handleNextStep}
              disabled={!data.genre}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>下一步：核心设定</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
  );
}
