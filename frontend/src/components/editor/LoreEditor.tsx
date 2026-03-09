import { useState, useEffect } from 'react';
import { Wand2, Save, Loader2 } from 'lucide-react';
import { refineText } from '../../api';
import DiffViewer from '../ui/DiffViewer';
import CoreSettingsEditor from './CoreSettingsEditor';
import StructureOutlineEditor from './StructureOutlineEditor';

interface Props {
  lore: any;
  allLore: any[];
  onChange: (newLore: any) => void;
  onSave: (overrideData?: any) => void;
  isSaving: boolean;
  externalDiff?: {
    original: string;
    modified: string;
    onApply: (finalText: string) => void;
    onCancel: () => void;
  } | null;
  novel?: any;
}

export default function LoreEditor({ lore, allLore, onChange, onSave, isSaving, externalDiff, novel }: Props) {
  const [content, setContent] = useState('');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isExternalEditing, setIsExternalEditing] = useState(false);
  const [externalBackup, setExternalBackup] = useState<string | null>(null);
  
  // Diff State
  const [newContentCandidate, setNewContentCandidate] = useState<string | null>(null);

  // Initialize content from lore object
  useEffect(() => {
    // Helper to convert structured lore to markdown
    const toMarkdown = (data: any) => {
      if (typeof data === 'string') return data;
      
      // If it's a specific section view (e.g. World > Background)
      if (data._section) {
        const val = data[data._section];
        if (typeof val === 'string') return val;
        return JSON.stringify(val, null, 2);
      }

      // Character Template - Migration for legacy data
      if (data.type === 'character') {
        // If content already exists (saved from markdown), use it directly
        if (data.content !== undefined) return data.content;

        // Migration: Check if we have legacy fields
        const hasLegacyFields = ['age', 'gender', 'role', 'personality', 'background', 'appearance', 'cheat'].some(k => data[k]);
        
        if (hasLegacyFields) {
            const name = data.name || data.title || '未命名角色';
            const parts: string[] = [];
            if (data.role) parts.push(`身份：${data.role}`);
            if (data.personality) parts.push(`性格：${data.personality}`);
            if (data.background) parts.push(`背景：${data.background}`);
            const desc = parts.join('\n');
            return `# ${name}\n\n${desc}\n`;
        }
        
        // No legacy fields, return empty
        return '';
      }

      // Default fallback for other types
      if (data.content !== undefined) return data.content;
      
      // If it's a new item without content, return empty
      // Avoid showing JSON unless it's a complex object we don't know how to handle
      // But for our known types (item, location, etc.), we want empty editor
      if (['item', 'location', 'world', 'plot', 'narrative', 'other'].includes(data.type)) {
          return '';
      }

      return JSON.stringify(data, null, 2);
    };

    setContent(toMarkdown(lore));
    // Reset diff state when lore changes
    setNewContentCandidate(null);
  }, [lore]);

  useEffect(() => {
    setIsExternalEditing(!!externalDiff);
  }, [externalDiff]);

  // Handle content change (manual edit)
  const handleChange = (val: string) => {
    setContent(val);
    if (lore._section) {
       onChange({ ...lore, [lore._section]: val });
    } else {
       onChange({ ...lore, content: val });
    }
  };

  const handleAiSubmit = async () => {
    if (!aiInstruction.trim()) return;
    
    setIsAiProcessing(true);
    try {
      // Prepare context from all lore
      const otherLoreContext = allLore
        .filter(l => l.id !== lore.id)
        .map(l => {
          let content = '';
          if (l.content) {
            content = l.content.slice(0, 300); // Truncate to avoid context limit
          } else if (l.type === 'plot') {
            // Special handling for Plot/Outline
            content = `总纲: ${l.outline?.summary || ''}, 冲突: ${l.conflict || ''}`;
          } else if (l.type === 'world') {
             // Special handling for World
             content = `背景: ${l.background || ''}, 力量: ${l.powerSystem || ''}`;
          } else {
            // Fallback for others
            content = l.summary || l.description || '';
            // Try to extract useful info if flat object
            if (!content && l.type === 'character') {
               content = `姓名:${l.name}, 性格:${l.personality}, 背景:${l.background}`;
            }
          }
          return `- ${l.title || l.name || l.id} (${l.type === 'character' ? '角色' : l.type === 'plot' ? '总纲' : '设定'}): ${content || '暂无描述'}`;
        })
        .join('\n');

      const context = `
当前设定：${lore.title} (${lore.type === 'character' ? '角色' : lore.type === 'narrative' ? '叙事设定' : lore.type === 'plot' ? '剧情' : '世界观'})

项目其他相关设定：
${otherLoreContext || '无'}
`;

      let finalInstruction = aiInstruction;

      // Debug: Check lore properties
      console.log('AI Optimization Debug:', {
        type: lore.type,
        section: lore._section,
        title: lore.title,
        id: lore.id,
        instruction: aiInstruction
      });

      const isNarrative = lore.type === 'narrative' || 
                          lore._section === 'tone' || 
                          (lore.title && (lore.title.includes('文风') || lore.title.includes('基调'))) ||
                          (lore.id && (typeof lore.id === 'string') && (lore.id.includes('narrative_tone') || lore.id.includes('_tone')));

      if (lore.type === 'world' && lore._section === 'timeline') {
        finalInstruction = `【重要】你正在编辑的是“世界时间线”设定。\n请仅以“时间线/事件列表”的形式输出结果：按照时间顺序列出关键事件，每条为简洁的事件描述。\n不要生成分卷大纲结构（如“第一卷：xxx”），也不要写任何章节正文的具体内容。\n在处理用户指令时，始终保持结果是“全书时间线”或“分卷/章节级时间线摘要”，而不是一章一章的正文。\n\n用户指令：${aiInstruction}`;
      } else if (lore.type === 'character') {
        finalInstruction = `【角色设定】你是一位资深小说角色设计专家，正在协助作者优化一个角色档案。
【任务目标】在保留角色核心设定不被篡改的前提下，根据用户指令，对角色档案进行有节制的润色和结构化补全，使人物更加立体、真实、有内在逻辑。
【深度刻画要求】在符合指令的前提下，可以对下列维度进行优化或适度补充（若原文已覆盖某一项，则以润色表达为主）：
1. 核心性格特征：角色的底层性格底色及其矛盾点（如：自卑但渴望认可、表面冷漠实则心软）。
2. 情绪触发机制：什么事情会立刻激怒他？什么让他感到安全？什么让他恐惧？
3. 童年影响事件：塑造当前性格的关键童年经历（原生家庭、重大创伤或高光时刻）。
4. 对话风格特征：口头禅、语速、用词偏好（如：喜欢用反问句、说话吞吞吐吐、满口脏话）。
5. 行为惯性：下意识的小动作或决策偏好（如：紧张时咬手指、遇事第一反应是逃避）。
6. 性格矛盾点：角色身上并存的对立特质（如：残忍的杀手却收养流浪猫、诚实的骗子）。
【硬性约束】
1. 禁止随意更改人物的姓名、性别、身份等硬设定，除非用户指令明确要求调整。
2. 禁止发散创造与该角色无关的新角色或世界观设定。
3. 如果原文中某些设定已经确定，只能在不改变设定事实的前提下润色或细化表达，不得推翻重写。
【用户优化指令】
${aiInstruction}

请直接输出优化后的角色设定正文，不要添加任何解释性文字、列表符号或 Markdown 标记。`;
      } else if (isNarrative) {
        let narrativeType = '文风基调';
        if (lore._section === 'pacing' || (lore.id && typeof lore.id === 'string' && lore.id.includes('pacing'))) narrativeType = '叙事节奏';
        if (lore._section === 'themes' || (lore.id && typeof lore.id === 'string' && lore.id.includes('themes'))) narrativeType = '核心主题';

        console.log('Narrative Prompt Triggered:', narrativeType);

        finalInstruction = `【角色设定】你是一位专业的文学编辑，正在协助作者设定小说的“${narrativeType}”。
【任务目标】根据用户的指令，生成或润色一段关于小说${narrativeType}的说明性文字。
【核心约束】
1. 严禁生成小说正文、对话片段或具体的情节描写。
2. 必须保持客观、概括的描述口吻（例如使用“本文采用...的笔触”、“整体氛围...”）。
3. 如果用户提供了具体的情节作为参考，请不要直接续写该情节，而是提炼该情节体现出的风格特征。

${(narrativeType === '核心主题') ? '【特别要求】请输出一组核心关键词或简短的主题描述，用逗号分隔。' : '【特别要求】请侧重于：语言特色（如华丽/质朴）、情感氛围（如压抑/轻松）、叙事手法（如多线叙事/意识流）等宏观层面的描述。'}

【用户指令】
${aiInstruction}`;
      }

      const res = await refineText({
        text: content,
        context,
        instruction: finalInstruction
      });

      if (res.success && res.data) {
        setNewContentCandidate(res.data);
        setIsAiModalOpen(false); // Close input modal, show diff view
      }
    } catch (e) {
      console.error(e);
      alert('AI 优化失败，请重试');
    } finally {
      setIsAiProcessing(false);
      setAiInstruction('');
    }
  };

  const applyDiff = (finalText: string) => {
    handleChange(finalText);
    setNewContentCandidate(null);
    
    // Construct updated lore to pass to save immediately
    // ensuring the save operation uses the latest content even if state update is pending
    const updatedLore = { ...lore };
    if (lore._section) {
      updatedLore[lore._section] = finalText;
    } else {
      updatedLore.content = finalText;
    }
    onSave(updatedLore);
  };

  const cancelDiff = () => {
    setNewContentCandidate(null);
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{lore.title || lore.name || '未命名设定'}</h1>
          <div className="text-sm text-zinc-500 capitalize flex items-center gap-2 mt-1">
             <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs">
               {lore.type === 'character' ? '角色档案' : 
                lore.type === 'world' ? '世界观' : 
                lore.type === 'plot' ? '剧情设定' : '设定'}
             </span>
             {lore._section && (
               <span className="text-zinc-400">/ {lore.title}</span>
             )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!newContentCandidate && lore.type !== 'core_settings' && !(lore.type === 'outline' && (lore.isPrimary || lore.title === '主大纲')) && (
            <button 
              onClick={() => setIsAiModalOpen(true)}
              disabled={isSaving}
              className="px-4 py-2 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Wand2 className="w-4 h-4" />
              <span>AI 优化</span>
            </button>
          )}
          <button 
            onClick={onSave}
            disabled={isSaving || !!newContentCandidate}
            className="px-5 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50 shadow-sm hover:shadow-md"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>保存</span>
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col relative">
        {externalDiff ? (
          <DiffViewer
            originalContent={externalDiff.original}
            newContent={externalDiff.modified}
            onApply={(final) => {
              externalDiff.onApply(final);
            }}
            onCancel={() => {
              externalDiff.onCancel();
            }}
          />
        ) : lore.type === 'core_settings' ? (
          <CoreSettingsEditor 
            settings={lore}
            onChange={(newSettings) => onChange({ ...lore, ...newSettings })}
          />
        ) : (lore.type === 'outline' && (lore.isPrimary || lore.title === '主大纲')) ? (
          <StructureOutlineEditor 
            lore={lore}
            onChange={(updates) => onChange({ ...lore, ...updates })}
            novelInfo={novel}
          />
        ) : newContentCandidate ? (
          <DiffViewer
            originalContent={content}
            newContent={newContentCandidate}
            onApply={applyDiff}
            onCancel={cancelDiff}
          />
        ) : (lore.type === 'narrative' && lore._section === 'themes') ? (
          <div className="h-full p-6 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto">
              <label className="block text-sm font-medium text-zinc-500 mb-4">核心元素 / 标签</label>
              
              <div className="bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-6">
                <div>
                   <span className="text-sm text-zinc-400 mr-2">推荐：</span>
                   {['规则怪谈', '无限流', 'NPC', '反套路', '强强联手', '系统流', '重生', '克苏鲁'].map(tag => (
                      <button
                        key={tag}
                        onClick={() => {
                           const currentTags = typeof lore.themes === 'string' ? lore.themes.split(',').filter(Boolean) : (Array.isArray(lore.themes) ? lore.themes : []);
                           if (!currentTags.includes(tag)) {
                               onChange({ ...lore, themes: [...currentTags, tag] }); 
                           }
                        }}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 mr-2 mb-2 hover:bg-blue-100 transition-colors"
                      >
                        + {tag}
                      </button>
                   ))}
                </div>

                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {(typeof lore.themes === 'string' ? lore.themes.split(',').filter(Boolean) : (Array.isArray(lore.themes) ? lore.themes : [])).map((tag: string, index: number) => (
                            <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                {tag}
                                <button
                                    onClick={() => {
                                        const currentTags = typeof lore.themes === 'string' ? lore.themes.split(',').filter(Boolean) : (Array.isArray(lore.themes) ? lore.themes : []);
                                        const newTags = currentTags.filter((_: any, i: number) => i !== index);
                                        onChange({ ...lore, themes: newTags });
                                    }}
                                    className="ml-1.5 hover:text-purple-900 dark:hover:text-purple-100"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    
                    <div className="relative">
                        <input
                            type="text"
                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                            placeholder="输入标签（如：赛博朋克、群像），按回车添加"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = e.currentTarget.value.trim();
                                    if (val) {
                                        const currentTags = typeof lore.themes === 'string' ? lore.themes.split(',').filter(Boolean) : (Array.isArray(lore.themes) ? lore.themes : []);
                                        if (!currentTags.includes(val)) {
                                            onChange({ ...lore, themes: [...currentTags, val] });
                                        }
                                        e.currentTarget.value = '';
                                    }
                                }
                            }}
                        />
                         <button 
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-purple-600 font-medium hover:text-purple-700"
                            onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const val = input.value.trim();
                                if (val) {
                                     const currentTags = typeof lore.themes === 'string' ? lore.themes.split(',').filter(Boolean) : (Array.isArray(lore.themes) ? lore.themes : []);
                                     if (!currentTags.includes(val)) {
                                         onChange({ ...lore, themes: [...currentTags, val] });
                                     }
                                     input.value = '';
                                }
                            }}
                         >
                             添加
                         </button>
                    </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          (lore.type === 'character' ||
           lore.type === 'protagonist' ||
           lore.type === 'antagonist' ||
           lore.id === 'protagonist' ||
           lore.id === 'antagonist') ? (
            <textarea 
              className="w-full h-full p-6 bg-transparent border-none outline-none resize-none font-sans text-base leading-loose text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="# 在此输入角色档案...\n\n建议写法：\n# 姓名\n\n（正文驱动的人物描述）"
              spellCheck={false}
            />
          ) : (
            <textarea 
              className="w-full h-full p-6 bg-transparent border-none outline-none resize-none font-sans text-base leading-loose text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="# 在此输入设定详情...\n\n支持 Markdown 格式"
              spellCheck={false}
            />
          )
        )}
      </div>

      {/* AI Input Modal */}
      {isAiModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-500" />
              AI 优化指令
            </h3>
            <textarea
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              className="w-full h-32 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl resize-none outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm mb-4"
              placeholder="请输入优化要求，例如：&#10;- 润色这段文字，使其更有史诗感&#10;- 扩写外貌描写，增加细节&#10;- 把性格改得更冷酷一点"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleAiSubmit}
                disabled={!aiInstruction.trim() || isAiProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isAiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                开始优化
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
