import { User, Globe, Sword, Users } from 'lucide-react';

export interface CoreSettings {
  protagonist: {
    name: string;
    age: string;
    personality: string;
    cheat: string;
  };
  antagonist: {
    name: string;
    role: string;
    personality: string;
  };
  world: {
    background: string;
    powerSystem: string;
    forces: string;
  };
  outline: {
    mainConflict: string;
  };
}

interface Props {
  settings: CoreSettings;
  onChange: (newSettings: CoreSettings) => void;
}

export default function CoreSettingsEditor({ settings, onChange }: Props) {
  
  const updateSettings = (section: keyof CoreSettings, field: string, value: string) => {
    const newSettings = {
      ...settings,
      [section]: { ...settings[section], [field]: value }
    };
    onChange(newSettings);
  };

  // Ensure sections exist to prevent crashes if data is incomplete
  const protagonist = settings.protagonist || { name: '', age: '', personality: '', cheat: '' };
  const antagonist = settings.antagonist || { name: '', role: '', personality: '' };
  const world = settings.world || { background: '', powerSystem: '', forces: '' };
  const outline = settings.outline || { mainConflict: '' };

  return (
    <div className="h-full overflow-y-auto p-6 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8 pb-10">
        
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">核心设定</h2>
            <p className="text-zinc-500 mt-2">构建小说的主角与世界观，为故事注入灵魂</p>
        </div>

        {/* Protagonist Section */}
        <div className="space-y-4 bg-white dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold border-b border-zinc-100 dark:border-zinc-700/50 pb-3">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                <User className="w-5 h-5" />
            </div>
            <span>主角档案</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">姓名</label>
              <input 
                type="text"
                value={protagonist.name}
                onChange={(e) => updateSettings('protagonist', 'name', e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                placeholder="主角名字"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">性别/年龄</label>
              <input 
                type="text"
                value={protagonist.age}
                onChange={(e) => updateSettings('protagonist', 'age', e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                placeholder="例如：男，18岁"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">核心性格</label>
            <input 
              type="text"
              value={protagonist.personality}
              onChange={(e) => updateSettings('protagonist', 'personality', e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
              placeholder="例如：腹黑、热血、冷静、苟道中人..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">金手指 / 特殊能力</label>
            <textarea 
              value={protagonist.cheat}
              onChange={(e) => updateSettings('protagonist', 'cheat', e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm resize-none h-24"
              placeholder="例如：随身老爷爷、加点系统、无限重生..."
            />
          </div>
        </div>

        {/* Antagonist Section */}
        <div className="space-y-4 bg-white dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold border-b border-zinc-100 dark:border-zinc-700/50 pb-3">
            <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                <Sword className="w-5 h-5" />
            </div>
            <span>反派 / 对手</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">姓名/代号</label>
              <input 
                type="text"
                value={antagonist.name}
                onChange={(e) => updateSettings('antagonist', 'name', e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                placeholder="反派名字"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">身份/定位</label>
              <input 
                type="text"
                value={antagonist.role}
                onChange={(e) => updateSettings('antagonist', 'role', e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                placeholder="例如：魔教教主、宿命之敌"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">性格与动机</label>
            <textarea 
              value={antagonist.personality}
              onChange={(e) => updateSettings('antagonist', 'personality', e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm resize-none h-20"
              placeholder="为什么与主角为敌？"
            />
          </div>
        </div>

        {/* World Section */}
        <div className="space-y-4 bg-white dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold border-b border-zinc-100 dark:border-zinc-700/50 pb-3">
            <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                <Globe className="w-5 h-5" />
            </div>
            <span>世界观设定</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">世界背景</label>
            <textarea 
              value={world.background}
              onChange={(e) => updateSettings('world', 'background', e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm resize-none h-24"
              placeholder="例如：2077年的赛博都市，公司掌控一切..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">力量体系 / 核心规则</label>
            <textarea 
              value={world.powerSystem}
              onChange={(e) => updateSettings('world', 'powerSystem', e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm resize-none h-24"
              placeholder="例如：练气-筑基-金丹、异能等级SABC..."
            />
          </div>
           
           <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">主要势力 / 组织</label>
            <textarea 
              value={world.forces}
              onChange={(e) => updateSettings('world', 'forces', e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm resize-none h-24"
              placeholder="例如：联邦政府、荒坂公司、反抗军..."
            />
          </div>
        </div>

         {/* Outline Section (Main Conflict) Removed
        <div className="space-y-4 bg-white dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold border-b border-zinc-100 dark:border-zinc-700/50 pb-3">
            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                <Users className="w-5 h-5" />
            </div>
            <span>主线冲突</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">全书终极目标</label>
            <textarea 
              value={outline.mainConflict}
              onChange={(e) => updateSettings('outline', 'mainConflict', e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm resize-none h-20"
              placeholder="主角最终要解决什么问题？（例如：推翻公司统治、证道成神）"
            />
          </div>
        </div>
        */}

      </div>
    </div>
  );
}