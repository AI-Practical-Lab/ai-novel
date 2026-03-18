import { ChevronRight, ChevronLeft, Wand2, Loader2, User, Globe, Sword, Users } from 'lucide-react';
import { type WizardData } from '@/views/CreateWizard';
import { useState, useEffect, useRef } from 'react';
import { generateCoreSettings } from '@/api';

interface Props {
  data: WizardData;
  updateData: (data: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3CoreSettings({ data, updateData, onNext, onBack }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const initialSnapshotRef = useRef<string>('');

  type OutlineVolume = {
    title?: string;
    summary?: string;
    [key: string]: unknown;
  };
  type OutlineShape = {
    summary?: string;
    volumes?: OutlineVolume[];
  };

  // Use data.coreSettings directly as it is now an object
  const settings = data.coreSettings;

  // Capture initial state on mount
  useEffect(() => {
    const { outline, ...rest } = data.coreSettings;
    const snapshot = JSON.stringify({
      title: data.title,
      description: data.description,
      genre: data.genre,
      style: data.style,
      tags: data.tags,
      ...rest,
      mainConflict: outline?.mainConflict || ''
    });
    initialSnapshotRef.current = snapshot;
  }, []); // Only run once on mount

  const handleNextStep = () => {
    // Check if critical settings have changed
    const { outline, ...rest } = data.coreSettings;
    const currentSnapshot = JSON.stringify({
      title: data.title,
      description: data.description,
      genre: data.genre,
      style: data.style,
      tags: data.tags,
      ...rest,
      mainConflict: outline?.mainConflict || ''
    });

    const hasChanges = currentSnapshot !== initialSnapshotRef.current;
    const hasExistingOutline = outline?.volumes && outline.volumes.length > 0;

    if (hasChanges && hasExistingOutline) {
      if (window.confirm('检测到核心设定（或基础设定）已变更，是否根据新设定重新生成大纲？\n\n【确定】重新生成（覆盖现有大纲）\n【取消】保留现有大纲')) {
        // Clear outline volumes and summary to trigger regeneration in Step 4
        updateData({
          coreSettings: {
            ...data.coreSettings,
            outline: {
              ...data.coreSettings.outline,
              summary: undefined,
              volumes: undefined
            }
          }
        });
      }
    }

    onNext();
  };

  const updateSettings = (section: keyof typeof settings, field: string, value: string) => {
    let newSettings: typeof settings = {
      ...settings,
      [section]: { ...settings[section], [field]: value }
    };

    if (section === 'protagonist' && field === 'name') {
      const oldName = settings.protagonist.name;
      const newName = value;

      if (oldName && newName && oldName !== newName) {
        const currentOutline = settings.outline;

        if (currentOutline) {
          const updatedOutline: OutlineShape = { ...currentOutline } as OutlineShape;

          if (typeof updatedOutline.summary === 'string') {
            updatedOutline.summary = updatedOutline.summary.split(oldName).join(newName);
          }

          if (Array.isArray(updatedOutline.volumes)) {
            updatedOutline.volumes = updatedOutline.volumes.map((vol) => {
              const v: OutlineVolume = { ...vol };
              if (typeof v.title === 'string') {
                v.title = v.title.split(oldName).join(newName);
              }
              if (typeof v.summary === 'string') {
                v.summary = v.summary.split(oldName).join(newName);
              }
              return v;
            });
          }

          newSettings = {
            ...newSettings,
            outline: updatedOutline
          };
        }
      }
    }

    updateData({ coreSettings: newSettings });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await generateCoreSettings({
        title: data.title,
        description: data.description,
        genre: data.genre,
        style: data.style,
        tags: data.tags
      });

      if (res.success && res.data) {
        // Merge with existing settings
        updateData({
          coreSettings: {
            ...settings,
            ...res.data
          }
        });
      }
    } catch (error) {
      console.error(error);
      alert('AI 生成设定失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
      <div className="p-8 md:p-10 h-full flex flex-col">
        <div className="text-center mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">核心设定</h2>
          <p className="text-zinc-500 mt-2">构建小说的主角与世界观，为故事注入灵魂</p>

          <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mt-4 px-4 py-2 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-sm font-medium flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span>{isGenerating ? 'AI 正在构思...' : 'AI 一键生成设定'}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-4 px-4 space-y-8 custom-scrollbar">
          {/* Protagonist Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <User className="w-5 h-5 text-blue-500" />
              <span>主角档案</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">姓名</label>
                <input
                    type="text"
                    value={settings.protagonist.name}
                    onChange={(e) => updateSettings('protagonist', 'name', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm"
                    placeholder="主角名字"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">性别/年龄</label>
                <input
                    type="text"
                    value={settings.protagonist.age}
                    onChange={(e) => updateSettings('protagonist', 'age', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm"
                    placeholder="例如：男，18岁"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">核心性格</label>
              <input
                  type="text"
                  value={settings.protagonist.personality}
                  onChange={(e) => updateSettings('protagonist', 'personality', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm"
                  placeholder="例如：腹黑、热血、冷静、苟道中人..."
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">金手指 / 特殊能力</label>
              <textarea
                  value={settings.protagonist.cheat}
                  onChange={(e) => updateSettings('protagonist', 'cheat', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm resize-none h-20"
                  placeholder="例如：随身老爷爷、加点系统、无限重生..."
              />
            </div>
          </div>

          {/* Antagonist Section (New) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <Sword className="w-5 h-5 text-red-500" />
              <span>反派 / 对手</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">姓名/代号</label>
                <input
                    type="text"
                    value={settings.antagonist.name}
                    onChange={(e) => updateSettings('antagonist', 'name', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm"
                    placeholder="反派名字"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">身份/定位</label>
                <input
                    type="text"
                    value={settings.antagonist.role}
                    onChange={(e) => updateSettings('antagonist', 'role', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm"
                    placeholder="例如：魔教教主、宿命之敌"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">性格与动机</label>
              <textarea
                  value={settings.antagonist.personality}
                  onChange={(e) => updateSettings('antagonist', 'personality', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm resize-none h-16"
                  placeholder="为什么与主角为敌？"
              />
            </div>
          </div>

          {/* World Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <Globe className="w-5 h-5 text-purple-500" />
              <span>世界观设定</span>
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">世界背景</label>
              <textarea
                  value={settings.world.background}
                  onChange={(e) => updateSettings('world', 'background', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm resize-none h-20"
                  placeholder="例如：2077年的赛博都市，公司掌控一切..."
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">力量体系 / 核心规则</label>
              <textarea
                  value={settings.world.powerSystem}
                  onChange={(e) => updateSettings('world', 'powerSystem', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm resize-none h-20"
                  placeholder="例如：练气-筑基-金丹、异能等级SABC..."
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-500 mb-1">主要势力 / 组织</label>
              <textarea
                  value={settings.world.forces}
                  onChange={(e) => updateSettings('world', 'forces', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm resize-none h-20"
                  placeholder="例如：联邦政府、荒坂公司、反抗军..."
              />
            </div>
          </div>

          {/* Outline Section (Main Conflict) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <Users className="w-5 h-5 text-green-500" />
              <span>主线冲突</span>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">全书终极目标</label>
              <textarea
                  value={settings.outline.mainConflict}
                  onChange={(e) => updateSettings('outline', 'mainConflict', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 text-sm resize-none h-16"
                  placeholder="主角最终要解决什么问题？（例如：推翻公司统治、证道成神）"
              />
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between shrink-0">
          <button
              onClick={onBack}
              className="px-6 py-3 text-zinc-600 dark:text-zinc-400 font-medium hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>上一步</span>
          </button>
          <button
              onClick={handleNextStep}
              disabled={isGenerating}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>下一步：大纲预览</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
  );
}
