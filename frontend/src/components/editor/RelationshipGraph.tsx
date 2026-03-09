import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Loader2, Save, RefreshCw, Layout, Trash2, Check, X, Sparkles } from 'lucide-react';

import CharacterNode from '@/components/graph/CharacterNode';
import CustomEdge from '@/components/graph/CustomEdge';
import InputModal from '@/components/ui/InputModal';
import { getRelations, updateRelations, analyzeRelations, getNovel, saveCharacterKnowledge, refineText } from '@/api';

interface Props {
  novelId: string;
  characters: any[];
}

const nodeTypes = {
  character: CharacterNode,
};

const edgeTypes = {
  default: CustomEdge,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 180, height: 80 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - 90,
      y: nodeWithPosition.y - 40,
    };

    return node;
  });

  return { nodes: layoutedNodes, edges };
};

export default function RelationshipGraph({ novelId, characters }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [analyzeStatus, setAnalyzeStatus] = useState<{
      state: 'idle' | 'analyzing' | 'success' | 'error';
      message?: string;
  }>({ state: 'idle' });
  const [initStatus, setInitStatus] = useState<{
    state: 'idle' | 'initializing' | 'success' | 'error';
    message?: string;
  }>({ state: 'idle' });
  const [edgeModal, setEdgeModal] = useState({
    isOpen: false,
    edgeId: '',
    label: ''
  });

  // Initialize Graph Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await getRelations(novelId);
        const savedData = (res.success && res.data && res.data.edges && res.data.positions) ? res.data : { edges: [], positions: {} };
        if (typeof savedData.positions === 'string') {
            savedData.positions = JSON.parse(savedData.positions);
        }
        if (typeof savedData.edges === 'string') {
            savedData.edges = JSON.parse(savedData.edges);
        }
        // 1. Convert Characters to Nodes
        const newNodes: Node[] = characters.map(char => {
            const charId = String(char.id);
            const savedPos = savedData.positions?.[charId];
            return {
                id: charId,
                type: 'character',
                position: savedPos || { x: 0, y: 0 }, // Default, will be layouted if 0,0
                data: { 
                    label: char.name || char.title,
                    role: char.role,
                    gender: char.gender,
                    age: char.age
                }
            };
        });

        // 2. Load Edges
        // Filter edges to only include existing characters
        const charIds = new Set(characters.map(c => String(c.id)));
        const validEdges = (savedData.edges || []).filter((e: Edge) => 
            charIds.has(String(e.source)) && charIds.has(String(e.target))
        ).map((e: Edge) => ({
            ...e,
            type: 'default',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
            label: e.label || '' // Ensure label shows
        }));

        // 3. Apply Layout if no saved positions or forced
        if (!savedData.positions || Object.keys(savedData.positions).length === 0) {
            const layouted = getLayoutedElements(newNodes, validEdges);
            setNodes(layouted.nodes);
            setEdges(layouted.edges);
        } else {
            setNodes(newNodes);
            setEdges(validEdges);
        }

      } catch (error) {
        console.error('Failed to load graph:', error);
      } finally {
        setLoading(false);
      }
    };

    if (novelId) {
        loadData();
    }
  }, [novelId, characters.length]); // Reload when char count changes

  const onConnect = useCallback(
    (params: Connection) => {
        const id = `e_${params.source}_${params.target}_${Date.now()}`;
        setEdges((eds) => addEdge({ 
            ...params, 
            id,
            type: 'default',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
            label: '新关系'
        }, eds));
        
        // Open modal to edit label immediately
        setEdgeModal({ isOpen: true, edgeId: id, label: '' });
    },
    [setEdges],
  );

  const onEdgeClick = (event: any, edge: Edge) => {
      setEdgeModal({ isOpen: true, edgeId: edge.id, label: (edge.label as string) || '' });
  };

  const handleDeleteEdge = () => {
      if (edgeModal.edgeId) {
          setEdges(eds => eds.filter(e => e.id !== edgeModal.edgeId));
          setEdgeModal(prev => ({ ...prev, isOpen: false }));
      }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
        const positions = nodes.reduce((acc, node) => ({
            ...acc,
            [node.id]: node.position
        }), {});

        const edgesData = edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label
        }));

        await updateRelations(novelId, {
            positions,
            edges: edgesData
        });
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleAutoLayout = () => {
      const layouted = getLayoutedElements(nodes, edges);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);
  };

  const parseKnowledgeText = (text: string) => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const result = {
      known: [] as string[],
      mis: [] as string[],
      susp: [] as string[],
    };
    let current: 'known' | 'mis' | 'susp' | null = null;
    lines.forEach((line) => {
      if (line.startsWith('已知事实')) {
        current = 'known';
        const v = line.replace(/^已知事实[:：]?\s*/, '');
        if (v) result.known.push(v);
        return;
      }
      if (line.startsWith('误解')) {
        current = 'mis';
        const v = line.replace(/^误解[:：]?\s*/, '');
        if (v) result.mis.push(v);
        return;
      }
      if (line.startsWith('怀疑') || line.startsWith('猜测') || line.startsWith('预感')) {
        current = 'susp';
        const v = line.replace(/^(怀疑|猜测|预感)[:：]?\s*/, '');
        if (v) result.susp.push(v);
        return;
      }
      if (!current) {
        return;
      }
      if (current === 'known') {
        result.known.push(line);
      } else if (current === 'mis') {
        result.mis.push(line);
      } else if (current === 'susp') {
        result.susp.push(line);
      }
    });
    return result;
  };

  const handleInitKnowledge = async () => {
    if (!novelId) {
      return;
    }
    if (!characters || characters.length === 0) {
      setInitStatus({ state: 'error', message: '当前没有可初始化的人物' });
      setTimeout(() => setInitStatus({ state: 'idle' }), 3000);
      return;
    }
    setInitStatus({ state: 'initializing' });
    try {
      const projectRes = await getNovel(novelId);
      if (!projectRes.success || !projectRes.data) {
        setInitStatus({ state: 'error', message: '获取小说信息失败' });
        setTimeout(() => setInitStatus({ state: 'idle' }), 3000);
        return;
      }
      const data = projectRes.data as any;
      const lore = Array.isArray(data.lore) ? data.lore : [];
      const coreSettings = data.coreSettings;
      const coreSettingsText = coreSettings ? (() => {
        try {
          return JSON.stringify(coreSettings, null, 2);
        } catch {
          return String(coreSettings);
        }
      })() : '';
      const primaryOutline = lore.find((l: any) => (l?.type === 'outline' || l?.type === 'plot') && (l?.isPrimary || l?.title === '主大纲'));
      const outlineText = primaryOutline ? String(primaryOutline.content || primaryOutline.summary || '') : '';
      const world = lore.find((l: any) => l?.type === 'world' && (l?.id === 'world' || l?._id === 'world'));
      const worldText = world ? (() => {
        if (typeof world.content === 'string') return world.content;
        const parts: string[] = [];
        if (world.background) parts.push(`背景：${String(world.background)}`);
        if (world.powerSystem) parts.push(`力量体系：${String(world.powerSystem)}`);
        if (world.forces) parts.push(`阵营势力：${String(world.forces)}`);
        return parts.join('\n');
      })() : '';
      const volumes = Array.isArray(data.volumes) ? data.volumes : [];
      const volumesOutlineText = volumes
        .map((v: any) => {
          const t = String(v?.title || '').trim();
          const s = String(v?.summary || '').trim();
          if (!t && !s) return '';
          if (t && s) return `【${t}】\n${s}`;
          return t ? `【${t}】` : s;
        })
        .filter(Boolean)
        .join('\n\n');
      const storyContextParts: string[] = [];
      const title = String(data.title || '').trim();
      const description = String(data.description || '').trim();
      const genre = String(data.genre || '').trim();
      const style = String(data.style || '').trim();
      if (title) storyContextParts.push(`书名：${title}`);
      if (description) storyContextParts.push(`简介：${description}`);
      if (genre) storyContextParts.push(`题材：${genre}`);
      if (style) storyContextParts.push(`风格：${style}`);
      const storyContext = storyContextParts.join('\n');
      let firstChapterId: string | null = null;
      for (const vol of volumes) {
        const chs = Array.isArray(vol.chapters) ? vol.chapters : [];
        if (chs.length > 0) {
          const sorted = [...chs].sort((a, b) => {
            const ia = typeof a.orderIndex === 'number' ? a.orderIndex : 0;
            const ib = typeof b.orderIndex === 'number' ? b.orderIndex : 0;
            return ia - ib;
          });
          firstChapterId = String(sorted[0].id);
          break;
        }
      }
      if (!firstChapterId) {
        setInitStatus({ state: 'error', message: '请先创建至少一个章节' });
        setTimeout(() => setInitStatus({ state: 'idle' }), 3000);
        return;
      }
      let successCount = 0;
      for (const char of characters) {
        const charId = char.loreId != null ? String(char.loreId) : String(char.id ?? '');
        if (!charId) {
          continue;
        }
        if (!/^\d+$/.test(charId.trim())) {
          continue;
        }
        const name = char.name || char.title || '';
        const role = char.role || '';
        const gender = char.gender || '';
        const age = char.age || '';
        const content = char.content || '';
        const baseText = '请生成“故事发生之前（第一章开头之前）”的角色认知。';
        const pieces: string[] = [];
        if (storyContext) pieces.push(`【小说信息】\n${storyContext}`);
        if (coreSettingsText) pieces.push(`【核心设定（作者资料，仅用于理解世界与类型，不代表角色已知）】\n${coreSettingsText}`);
        if (worldText) pieces.push(`【世界观（作者资料，仅用于理解世界规则，不代表角色已知）】\n${worldText}`);
        if (outlineText) pieces.push(`【大纲（作者资料，仅用于理解故事方向，不代表角色已知；大纲内事件均尚未发生）】\n${outlineText}`);
        if (!outlineText && volumesOutlineText) pieces.push(`【分卷概览（作者资料，仅用于理解故事方向，不代表角色已知；概览内事件均尚未发生）】\n${volumesOutlineText}`);
        if (name) pieces.push(`姓名：${name}`);
        if (role) pieces.push(`身份角色：${role}`);
        if (gender) pieces.push(`性别：${gender}`);
        if (age) pieces.push(`年龄：${age}`);
        if (content) pieces.push(`人物设定：${content}`);
        const context = pieces.join('\n');
        const instruction =
          '你将为“故事发生之前（第一章开头之前）”的该人物生成主观认知，分为三类：' +
          '1）已知事实：该角色在故事开始前合理能知道的客观事实；' +
          '2）误解：该角色基于有限信息得出的错误理解；' +
          '3）怀疑或预感：尚未证实的猜测、隐约的不安或直觉。' +
          '重要规则：即使你阅读了作者大纲/分卷概览，你也绝对不能把其中“尚未发生”的事件写进角色的已知事实、误解或怀疑里。角色只可能知道故事开始前的经历、背景、传闻与当下现状。' +
          '请严格从角色视角出发，不泄露读者视角的幕后真相，不使用“读者”“作者”等表述。' +
          '输出格式示例：' +
          '已知事实：' +
          '- ...' +
          '误解：' +
          '- ...' +
          '怀疑：' +
          '- ...';
        const aiRes = await refineText({
          text: baseText,
          context,
          instruction,
        });
        if (!aiRes.success || !aiRes.data) {
          continue;
        }
        const parsed = parseKnowledgeText(String(aiRes.data));
        const knownFacts = parsed.known.join('\n');
        const misunderstandings = parsed.mis.join('\n');
        const suspicions = parsed.susp.join('\n');
        const saveRes = await saveCharacterKnowledge(novelId, firstChapterId, {
          characterLoreId: charId,
          knownFacts,
          misunderstandings,
          suspicions,
          extra: undefined,
        });
        if (saveRes.success) {
          successCount += 1;
        }
      }
      if (successCount > 0) {
        setInitStatus({ state: 'success', message: `已为 ${successCount} 个角色生成初始认知` });
      } else {
        setInitStatus({ state: 'error', message: '未能为任何角色生成认知' });
      }
      setTimeout(() => setInitStatus({ state: 'idle' }), 4000);
    } catch (e) {
      setInitStatus({ state: 'error', message: '初始化失败' });
      setTimeout(() => setInitStatus({ state: 'idle' }), 3000);
    }
  };

  const handleAiAnalyze = async () => {
    setAnalyzeStatus({ state: 'analyzing' });
    try {
        const charData = characters.map(c => ({
            id: c.id,
            name: c.name || c.title,
            content: c.content || ''
        }));

        const res = await analyzeRelations(charData);
        if (res.success) {
            const newEdges = res.data;
            let addedCount = 0;
            
            const currentEdgeKeys = new Set(edges.map(e => `${e.source}-${e.target}`));
            const edgesToAdd: Edge[] = [];
            
            newEdges.forEach((e: any) => {
                const key = `${e.source}-${e.target}`;
                if (!currentEdgeKeys.has(key)) {
                    edgesToAdd.push({
                        id: `e_ai_${e.source}_${e.target}_${Date.now()}_${Math.random()}`,
                        source: e.source,
                        target: e.target,
                        label: e.label,
                        type: 'default',
                        markerEnd: { type: MarkerType.ArrowClosed },
                        style: { strokeWidth: 2, strokeDasharray: '5,5' },
                        animated: true
                    });
                    addedCount++;
                }
            });
            
            if (addedCount > 0) {
                setEdges(prev => [...prev, ...edgesToAdd]);
                setAnalyzeStatus({ state: 'success', message: `发现 ${addedCount} 条关系` });
            } else {
                setAnalyzeStatus({ state: 'success', message: '无新关系' });
            }
        } else {
            setAnalyzeStatus({ state: 'error', message: '分析失败' });
        }
    } catch (e: any) {
        console.error('AI Analysis Error:', e);
        setAnalyzeStatus({ state: 'error', message: '分析出错' });
    } finally {
        setTimeout(() => setAnalyzeStatus({ state: 'idle' }), 3000);
    }
  };

  if (loading) {
      return (
          <div className="h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span className="ml-2 text-zinc-500">加载图谱...</span>
          </div>
      );
  }

  return (
    <div className="h-full w-full bg-zinc-50 dark:bg-zinc-900 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-zinc-50 dark:bg-zinc-900"
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
        
        <Panel position="top-right" className="flex gap-2">
            <button 
                onClick={handleAiAnalyze}
                disabled={analyzeStatus.state !== 'idle'}
                className={`px-3 py-2 shadow-md rounded-lg text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-100 min-w-[140px] justify-center
                    ${analyzeStatus.state === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200' :
                      analyzeStatus.state === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200' :
                      'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700'
                    } border`}
            >
                {analyzeStatus.state === 'analyzing' ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        AI 思考中...
                    </>
                ) : analyzeStatus.state === 'success' ? (
                    <>
                        <Sparkles className="w-4 h-4" />
                        {analyzeStatus.message}
                    </>
                ) : analyzeStatus.state === 'error' ? (
                    <>
                        <X className="w-4 h-4" />
                        {analyzeStatus.message}
                    </>
                ) : (
                    <>
                        <Sparkles className="w-4 h-4" />
                        AI 分析关系
                    </>
                )}
            </button>
            <button
                onClick={handleInitKnowledge}
                disabled={initStatus.state === 'initializing' || !characters.length}
                className={`px-3 py-2 shadow-md rounded-lg text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-80 min-w-[170px] justify-center
                    ${initStatus.state === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200' :
                      initStatus.state === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200' :
                      'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700'
                    } border`}
            >
                {initStatus.state === 'initializing' ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        初始化中...
                    </>
                ) : initStatus.state === 'success' ? (
                    <>
                        <Sparkles className="w-4 h-4" />
                        {initStatus.message || '初始化完成'}
                    </>
                ) : initStatus.state === 'error' ? (
                    <>
                        <X className="w-4 h-4" />
                        {initStatus.message || '初始化失败'}
                    </>
                ) : (
                    <>
                        <Sparkles className="w-4 h-4" />
                        AI 初始化人物认知
                    </>
                )}
            </button>
            <button 
                onClick={handleAutoLayout}
                className="px-3 py-2 bg-white dark:bg-zinc-800 shadow-md rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors border border-zinc-200 dark:border-zinc-700"
            >
                <Layout className="w-4 h-4" />
                自动布局
            </button>
            <button 
                onClick={handleSave}
                disabled={saveStatus !== 'idle'}
                className={`px-3 py-2 shadow-md rounded-lg text-sm font-medium text-white flex items-center gap-2 transition-colors disabled:opacity-80 ${
                    saveStatus === 'success' ? 'bg-green-600 hover:bg-green-700' :
                    saveStatus === 'error' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-purple-600 hover:bg-purple-700'
                }`}
            >
                {saveStatus === 'saving' ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        保存中...
                    </>
                ) : saveStatus === 'success' ? (
                    <>
                        <Check className="w-4 h-4" />
                        已保存
                    </>
                ) : saveStatus === 'error' ? (
                    <>
                        <X className="w-4 h-4" />
                        保存失败
                    </>
                ) : (
                    <>
                        <Save className="w-4 h-4" />
                        保存关系图谱
                    </>
                )}
            </button>
        </Panel>
      </ReactFlow>

      {/* Edge Edit Modal */}
      <InputModal
        isOpen={edgeModal.isOpen}
        title="编辑关系"
        defaultType="text" 
        onClose={() => setEdgeModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={(val) => {
            setEdges(eds => eds.map(e => e.id === edgeModal.edgeId ? { ...e, label: val } : e));
            setEdgeModal(prev => ({ ...prev, isOpen: false }));
        }}
        placeholder={edgeModal.label || "输入关系名称..."}
      />
      
      {/* Delete Button for Edge */}
      {edgeModal.isOpen && (
           <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-[80px] z-[60]">
                <button
                   onClick={handleDeleteEdge}
                   className="px-4 py-2 bg-red-50 text-red-600 rounded-lg shadow-sm border border-red-200 hover:bg-red-100 flex items-center gap-2"
                >
                    <Trash2 className="w-4 h-4" />
                    删除此关系
                </button>
           </div>
       )}
    </div>
  );
}
