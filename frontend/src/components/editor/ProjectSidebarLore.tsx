import { useState, useMemo, useRef } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, FileText, Sparkles, Network, Upload, Loader2, Check, AlertTriangle } from 'lucide-react';
import { LORE_CATEGORIES } from '@/utils/constants';
import { useParams } from 'react-router-dom';
import { importLore } from '@/api';

interface LoreItem {
  id: string;
  title: string;
  type: string;
  icon?: any;
  children?: LoreItem[];
  data?: any; // The actual lore data
  isDeletable?: boolean;
}

interface Props {
  loreFiles: any[];
  coreSettings?: any;
  onSelect: (item: any) => void;
  selectedId?: string;
  onCreate: (type: string) => void;
  onDelete: (id: string) => void;
  onAiGenerate?: (type: string) => void;
  onOpenGraph?: () => void;
  pendingDiffIds?: string[];
}

export default function ProjectSidebarLore({ loreFiles, coreSettings, onSelect, selectedId, onCreate, onDelete, onAiGenerate, onOpenGraph, pendingDiffIds }: Props) {
  // Use category IDs from constants for initial expansion
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root', 'core_settings', ...LORE_CATEGORIES.map(c => c.id)]));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; warnings: string[]; type: string } | null>(null);
  const params = useParams();
  const novelId = (params as any).id as string | undefined;

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  // Transform flat lore files into a tree structure
  const loreTree = useMemo(() => {
    // Initialize tree with categories from constants
    const tree: LoreItem[] = LORE_CATEGORIES.map(cat => ({
      id: cat.id,
      title: cat.title,
      type: 'category',
      icon: cat.icon,
      children: []
    }));

    if (coreSettings) {
      tree.unshift({
        id: 'core_settings',
        title: '核心设定',
        type: 'core_settings',
        icon: Sparkles,
        data: { ...coreSettings, title: '核心设定', type: 'core_settings' }
      });
    }

    // Helper to find category node
    const getCat = (id: string) => tree.find(n => n.id === id);
    // Helper to add item to category
    const addToCat = (catId: string, item: LoreItem) => {
        const cat = getCat(catId);
        if (cat) {
            cat.children = cat.children || [];
            cat.children.push(item);
        } else {
            // Fallback to 'other' if category not found
            getCat('other')?.children?.push(item);
        }
    };

    loreFiles.forEach(file => {
      // Handle Core Files (world.json, plot.json, narrative.json) specifically
      // because they contain sub-sections that need to be broken out.
      
      // 1. World Core File
      if (file.type === 'world' && file.id === 'world') {
         // addToCat('world', { id: `${file.id}_content`, title: '世界观设定', type: 'world', data: { ...file, _section: 'content', title: '世界观设定', type: 'world' } });
         if (file.background) addToCat('world', { id: `${file.id}_background`, title: '世界背景', type: 'world', data: { ...file, _section: 'background', title: '世界背景', type: 'world' } });
         // if (file.locations) addToCat('world', { id: `${file.id}_locations`, title: '空间设置', type: 'world', data: { ...file, _section: 'locations', title: '空间设置', type: 'world' } });
         if (file.powerSystem) addToCat('world', { id: `${file.id}_powerSystem`, title: '力量体系', type: 'world', data: { ...file, _section: 'powerSystem', title: '力量体系', type: 'world' } });
         if (file.forces) addToCat('world', { id: `${file.id}_forces`, title: '势力分布', type: 'world', data: { ...file, _section: 'forces', title: '势力分布', type: 'world' } });
         // if (file.timeline) addToCat('world', { id: `${file.id}_timeline`, title: '时间线', type: 'world', data: { ...file, _section: 'timeline', title: '时间线', type: 'world' } });
         return;
      }

      // 2. Plot Core File
      if (file.type === 'plot' && file.id === 'plot') {
         if (file.conflict) addToCat('plot', { id: `${file.id}_conflict`, title: '主线冲突', type: 'plot', data: { ...file, _section: 'conflict', title: '主线冲突', type: 'plot' } });
         if (file.hooks) addToCat('plot', { id: `${file.id}_hooks`, title: '钩子', type: 'plot', data: { ...file, _section: 'hooks', title: '钩子', type: 'plot' } });
         if (file.twists) addToCat('plot', { id: `${file.id}_twists`, title: '转折', type: 'plot', data: { ...file, _section: 'twists', title: '转折', type: 'plot' } });
         return;
      }

      // 3. Narrative Core File
      if (file.type === 'narrative' && file.id === 'narrative') {
         addToCat('narrative', { id: `${file.id}_tone`, title: '文风基调', type: 'narrative', data: { ...file, _section: 'tone', title: '文风基调', type: 'narrative' } });
         addToCat('narrative', { id: `${file.id}_pacing`, title: '主题', type: 'narrative', data: { ...file, _section: 'pacing', title: '主题', type: 'narrative' } });
         // addToCat('narrative', { id: `${file.id}_topic`, title: '主题', type: 'narrative', data: { ...file, _section: 'topic', title: '主题', type: 'narrative' } });
         // if (file.pacing) addToCat('narrative', { id: `${file.id}_pacing`, title: '节奏', type: 'narrative', data: { ...file, _section: 'pacing', title: '节奏', type: 'narrative' } });
         if (file.themes) addToCat('narrative', { id: `${file.id}_themes`, title: '核心元素', type: 'narrative', data: { ...file, _section: 'themes', title: '核心元素', type: 'narrative' } });
         return;
      }

      // 4. All other files (Custom Lore)
      // Map file.type directly to category ID
      // If file.type is 'character', it goes to 'character' category.
      // If file.type is 'item', it goes to 'item' category.
      // If file.type is unknown, it goes to 'other'.
      
      // Filter out unwanted "Setting" items in Plot if they exist as custom files
      if (file.type === 'plot' && (file.title === '设定' || file.title === 'Setting')) return;

      const targetCatId = LORE_CATEGORIES.some(c => c.id === file.type) ? file.type : 'other';
      
      addToCat(targetCatId, {
          id: file.id,
          title: file.title || file.name || '未命名',
          type: file.type,
          data: file,
          isDeletable: true
      });
    });

    return tree;
  }, [loreFiles, coreSettings]);

  const renderNode = (node: LoreItem, depth: number = 0) => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedId === node.id || (node.data && selectedId === node.data.id && (!node.data._section || selectedId === `${node.data.id}_${node.data._section}`));
    const isCategory = node.type === 'category';

    const Icon = node.icon || FileText;

    // Check if this category allows adding new items
    // All categories in LORE_CATEGORIES allow adding
    const canAdd = isCategory;

    return (
      <div key={node.id}>
        <div 
          data-lore-id={node.id}
          className={`group/item flex items-center justify-between px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
            isSelected 
              ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 font-medium' 
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
          onClick={() => {
            if (isCategory) {
              toggleExpand(node.id);
            } else if (node.data) {
              onSelect({ ...node.data, _id: node.id });
            }
          }}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            {isCategory ? (
                <div className="p-0.5">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </div>
            ) : (
                <span className="w-4"></span>
            )}
            
            <Icon className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
            <span className="truncate flex items-center gap-1">
              <span className="truncate">{node.title}</span>
              {!isCategory && node.type === 'outline' && node.data?.isPrimary && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 flex-shrink-0">
                  主大纲
                </span>
              )}
              {!isCategory && pendingDiffIds?.includes(node.id) && (
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              )}
            </span>
          </div>

          <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity">
            {isCategory && node.id === 'character' && onOpenGraph && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenGraph();
                    }}
                    className="p-1 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded mr-0.5"
                    title="人物关系图谱"
                >
                    <Network className="w-3.5 h-3.5" />
                </button>
            )}

            {isCategory && (node.id === 'character' /* || node.id === 'outline' */ || node.id === 'location') && onAiGenerate && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAiGenerate(node.id);
                    }}
                    className="p-1 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded mr-0.5"
                    title={
                      node.id === 'outline'
                        ? "AI生成大纲"
                        : node.id === 'character'
                        ? "AI批量生成角色"
                        : "AI拆分地点"
                    }
                >
                    <Sparkles className="w-3.5 h-3.5" />
                </button>
            )}
            {/* Import Button Removed
            {(isCategory && (LORE_CATEGORIES.some(c => c.id === node.id)) && node.id !== 'outline' && node.id !== 'world' && node.id !== 'plot' && node.id !== 'narrative') && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setImportType(node.id);
                        fileInputRef.current?.click();
                    }}
                    className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded mr-0.5"
                    title={`导入${node.title}`}
                >
                    <Upload className="w-3.5 h-3.5" />
                </button>
            )}
            */}

            {canAdd && node.id !== 'plot' && node.id !== 'narrative' && node.id !== 'world' && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onCreate(node.id); // Pass category type ID
                    }}
                    className="p-1 hover:text-blue-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                    title={`新建${node.title}`}
                >
                    <Plus className="w-3 h-3" />
                </button>
            )}
            {node.isDeletable && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(node.id);
                    }}
                    className="p-1 hover:text-red-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                    title="删除"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            )}
          </div>
        </div>
        
        {isCategory && isExpanded && node.children && (
          <div className="mt-0.5">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-2 select-none relative">
      {/* Import Status Overlay */}
      {isImporting && (
        <div className="absolute inset-0 z-50 bg-white/80 dark:bg-zinc-900/80 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-4 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            <div className="text-sm font-medium">正在智能解析设定...</div>
            <div className="text-xs text-zinc-500">可能需要几十秒，请稍候</div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => window.location.reload()}>
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-1">导入完成</h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  成功识别并创建了 <span className="font-bold text-purple-600">{importResult.count}</span> {
                    importResult.type === 'character' ? '个人物' :
                    importResult.type === 'world' ? '条世界设定' :
                    importResult.type === 'item' ? '个物品' :
                    importResult.type === 'location' ? '个地点' :
                    importResult.type === 'plot' ? '个剧情节点' :
                    importResult.type === 'narrative' ? '条叙事策略' :
                    '个设定'
                  }
                </p>
                {importResult.warnings.length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-left text-sm">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-medium mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      注意
                    </div>
                    <ul className="list-disc list-inside text-yellow-600 dark:text-yellow-500 text-xs space-y-1">
                      {importResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
              >
                确定并刷新
              </button>
            </div>
          </div>
        </div>
      )}

      {loreTree.map(node => renderNode(node))}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".txt,.md,.docx,.pdf"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !importType || !novelId) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
          
          setIsImporting(true);
          try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('type', importType);
            const res = await importLore(novelId, fd);
            
            if (res.success) {
              const count = res.data?.count ?? 1;
              const warnings = res.data?.warnings || [];
              setImportResult({ count, warnings, type: importType });
            } else {
              alert('导入设定失败: ' + (res.error || '未知错误'));
              window.location.reload(); // Reload on error to clear state
            }
          } catch (err: any) {
            alert('导入设定出错');
            window.location.reload();
          } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
            setImportType(null);
            setIsImporting(false);
          }
        }}
      />
    </div>
  );
}
