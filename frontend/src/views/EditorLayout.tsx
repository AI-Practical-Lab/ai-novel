import { useParams, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Home, BookOpen, Settings, History, Bot, Wand2, Loader2, Send, Save, CheckCircle2, Plus, MoreVertical, ChevronDown, ChevronRight, ChevronUp, Sparkles, Trash2, Copy, Square, Network, Users, ArrowUp, ArrowDown, Map as MapIcon, Flag, Activity, List, ChevronLeft, AlignLeft, RotateCcw, X, Download, Video, Info } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { chatWithAIStream, chatWithAI, getNovel, updateChapter, updateLore,postLore, updateVolume, createVolume, createChapter, batchCreateChapters, deleteVolume, deleteChapter, createLore, createLorePost, deleteLore, generateChapterContent, generateCharacters, reorderChapters, refineText, updateForeshadowing, getForeshadowingList, analyzeForeshadowing, importLore, exportNovelLore, exportNovelChapters, getChapterContent, getChapterBeatSheet, type NovelDetail, type Chapter, type Volume, type ReferenceItem, type Foreshadowing, createLorePostObj, updateNovel, saveCharacterKnowledge, getChapterCharacterKnowledge, getCharacterKnowledgeTimeline, getProgressChapters } from '@/api';
import { LORE_CATEGORIES } from '@/utils/constants';
import { SmartTextarea, type ReferenceOption } from '@/components/ui/SmartTextarea';
import { useNovelReferences } from '@/hooks/useNovelReferences';
import { parseAiCommand, AiCommandIntent } from '@/utils/ai-command';
import AiActionCard from '@/components/ai/AiActionCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import DiffViewer from '@/components/ui/DiffViewer';
import ProjectSidebarLore from '@/components/editor/ProjectSidebarLore';
import LoreEditor from '@/components/editor/LoreEditor';
import RelationshipGraph from '@/components/editor/RelationshipGraph';
import LoreAuditPanel from '@/components/editor/LoreAuditPanel';
import VolumeEditor from '@/components/editor/VolumeEditor';
import BeatSheetEditor from '@/components/editor/BeatSheetEditor';
import PlotManager from '@/components/editor/PlotManager';
import ChapterGenerationModal from '@/components/editor/ChapterGenerationModal';
import BatchChapterModal from '@/components/editor/BatchChapterModal';
import CharacterGeneratorModal, { type GeneratedCharacter } from '@/components/editor/CharacterGeneratorModal';
import OutlineGeneratorModal from '@/components/editor/OutlineGeneratorModal';
import ChapterEvaluator from '@/components/editor/ChapterEvaluator';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import InputModal from '@/components/ui/InputModal';
import CharacterSelector from '@/components/ui/CharacterSelector';
import { useUserStore } from '@/store/userStore';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'action_confirm';
  actionData?: {
    intent: AiCommandIntent;
    status: 'pending' | 'executing' | 'success' | 'error';
    error?: string;
  };
}

export default function EditorLayout() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('editor');
  // Chapter View Mode: 'beat' | 'write' | 'review'
  const [chapterViewMode, setChapterViewMode] = useState<'beat' | 'write' | 'pov' | 'foreshadowing'>('write');
  // Volume View Mode: 'edit' | 'plot'
  const [volumeViewMode, setVolumeViewMode] = useState<'edit' | 'plot'>('plot'); // Default to plot for better planning
  
  const [isAiOpen, setIsAiOpen] = useState(true);
  const [isOutlinePanelOpen, setIsOutlinePanelOpen] = useState(false); // New: Outline Panel Toggle
  
  // Sidebar State
  const [sidebarMode, setSidebarMode] = useState<'split' | 'resources' | 'lore'>('split');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideOpenMap, setGuideOpenMap] = useState<Record<string, boolean>>({});

  // Data State
  const [novel, setNovel] = useState<NovelDetail | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [currentLore, setCurrentLore] = useState<any | null>(null);
  const [currentVolume, setCurrentVolume] = useState<Volume | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const userInfo = useUserStore(state => state.userInfo);

  const encryptAES = async (plaintext: string, keyStr: string) => {
    const enc = new TextEncoder();
    const keyBytes = await crypto.subtle.digest('SHA-256', enc.encode(keyStr));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    const toBase64 = (buf: ArrayBuffer | Uint8Array) => {
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    };
    return `${toBase64(iv)}:${toBase64(cipherBuf)}`;
  };

  const handleGenerateVideo = useCallback(async () => {
    if (!currentChapter || !novel) {
      toast.error('请先选择并编辑章节');
      return;
    }
    if (!userInfo?.mobile) {
      toast.error('未获取到手机号，请重新登录后再试');
      return;
    }
    const apiUrl = localStorage.getItem('externalScriptApiUrl') || (import.meta as any).env?.VITE_EXTERNAL_SCRIPT_API_URL;
    const aesKey = localStorage.getItem('aesSecretKey') || (import.meta as any).env?.VITE_AES_SECRET;
    if (!apiUrl) {
      toast.error('未配置视频生成接口地址');
      return;
    }
    if (!aesKey) {
      toast.error('未配置 AES 密钥');
      return;
    }

    try {
      setIsGeneratingVideo(true);
      const encUsername = await encryptAES(userInfo.mobile, aesKey);
      const volume = (novel.volumes || []).find(v => v.chapters?.some(c => c.id === currentChapter.id));
      const volumeName = volume?.title || '未命名卷';

      const payload = {
        username: encUsername,
        script_name: novel.title || '未命名小说',
        secondary_node_name: volumeName,
        tertiary_node_name: currentChapter.title || '未命名章节',
        tertiary_node_content: currentChapter.content || ''
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        toast.error('生成视频请求失败');
        setIsGeneratingVideo(false);
        return;
      }
      let msg = '请求已发送';
      try {
        const json = await res.json();
        if (json && (json.message || json.msg)) {
          msg = json.message || json.msg;
        }
      } catch {}
      toast.success(msg);
    } catch (e) {
      toast.error('网络异常，生成失败');
    } finally {
      setIsGeneratingVideo(false);
    }
  }, [currentChapter, novel, userInfo]);
  
  // AI Chat State
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'assistant', content: '你好！我是你的 AI 写作助手。有什么我可以帮你的吗？' }
  ]);
  const [input, setInput] = useState('');
  const [loreAuditSuggestions, setLoreAuditSuggestions] = useState<any[] | null>(null);
  const [isCommandMode, setIsCommandMode] = useState(false);
  const novelReferences = useNovelReferences(novel);
  const [selectedReferences, setSelectedReferences] = useState<ReferenceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatAbortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastBeatSheetLoadedChapterIdRef = useRef<string | null>(null);
  const lastPrevBeatSheetLoadedChapterIdRef = useRef<string | null>(null);
  const [historyRounds, setHistoryRounds] = useState<number>(5);
  const [enableSummarize, setEnableSummarize] = useState<boolean>(false);
  const [summarizeMode, setSummarizeMode] = useState<'none' | 'simple' | 'detailed' | 'auto'>('none');
  const [summaryPreview, setSummaryPreview] = useState<string>('');
  const [assistantGuideMsgId, setAssistantGuideMsgId] = useState<string | null>(null);

  const [isKnowledgePanelOpen, setIsKnowledgePanelOpen] = useState<boolean>(false);
  const [knowledgeCharacterId, setKnowledgeCharacterId] = useState<string>('');
  const [knowledgeKnownFacts, setKnowledgeKnownFacts] = useState<string>('');
  const [knowledgeMisunderstandings, setKnowledgeMisunderstandings] = useState<string>('');
  const [knowledgeSuspicions, setKnowledgeSuspicions] = useState<string>('');
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState<boolean>(false);
  const [isSavingKnowledge, setIsSavingKnowledge] = useState<boolean>(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState<boolean>(false);
  const [knowledgeTimeline, setKnowledgeTimeline] = useState<Array<{ chapterId?: number; knownFacts?: string; misunderstandings?: string; suspicions?: string }>>([]);
  const [isGeneratingKnowledge, setIsGeneratingKnowledge] = useState<boolean>(false);
  const [initAllKnowledgeStatus, setInitAllKnowledgeStatus] = useState<{ state: 'idle' | 'initializing' | 'success' | 'error'; message?: string }>({ state: 'idle' });
  const [updateChapterKnowledgeStatus, setUpdateChapterKnowledgeStatus] = useState<{ state: 'idle' | 'updating' | 'success' | 'error'; message?: string }>({ state: 'idle' });

  const resolveKnowledgeCharacterLoreIdForSave = useCallback(
    (characterKey: string) => {
      const v = String(characterKey || '').trim();
      if (!v) return '';
      if (v === 'protagonist' || v === 'antagonist') {
        const item = (novel?.lore || []).find((l) => {
          const obj = l as Record<string, unknown> | null | undefined;
          const idVal = obj ? (obj['id'] ?? obj['_id']) : undefined;
          return String(idVal ?? '') === v;
        }) as Record<string, unknown> | undefined;
        const loreId = item?.['loreId'];
        if (typeof loreId === 'number' || typeof loreId === 'string') return String(loreId);
      }
      return v;
    },
    [novel]
  );

  type KnowledgeTimelineItem = {
    chapterId?: number | string | null;
    knownFacts?: string;
    misunderstandings?: string;
    suspicions?: string;
  };

  const selectLatestKnowledgeSnapshot = (list: unknown[], currentChapterId: string): KnowledgeTimelineItem | null => {
    const chapterIdNum = Number(currentChapterId);
    const isChapterIdValid = !Number.isNaN(chapterIdNum);
    return list.reduce<KnowledgeTimelineItem | null>((best, rawItem) => {
      if (!rawItem || typeof rawItem !== 'object') return best;
      const item = rawItem as KnowledgeTimelineItem;
      const rawChapterId = item.chapterId;
      const itemChapterIdNum =
        rawChapterId === null || rawChapterId === undefined || rawChapterId === '' ? -1 : Number(rawChapterId);
      if (Number.isNaN(itemChapterIdNum)) return best;
      if (isChapterIdValid && itemChapterIdNum > chapterIdNum) return best;
      if (!best) return item;
      const bestRawChapterId = best.chapterId;
      const bestChapterIdNum =
        bestRawChapterId === null || bestRawChapterId === undefined || bestRawChapterId === '' ? -1 : Number(bestRawChapterId);
      if (Number.isNaN(bestChapterIdNum)) return item;
      return itemChapterIdNum >= bestChapterIdNum ? item : best;
    }, null);
  };

  const fetchKnowledgeTimelineList = useCallback(async (projectId: string, characterId: string): Promise<unknown[]> => {
    console.log('fetchKnowledgeTimelineList params:', { projectId, characterId });
    const res = await getCharacterKnowledgeTimeline(projectId, characterId);
    console.log('fetchKnowledgeTimelineList response:', res);
    if (!res.success) {
      throw new Error(res.error || '时间线加载失败');
    }
    return (res.data || []) as unknown[];
  }, []);

  const handleLoadKnowledgeTimeline = useCallback(async () => {
    if (!id || !knowledgeCharacterId) {
      toast.error('请选择角色');
      return;
    }
    try {
      setIsLoadingTimeline(true);
      const list = await fetchKnowledgeTimelineList(String(id), String(knowledgeCharacterId));
      type KnowledgeTimelineStateItem = {
        chapterId?: number;
        knownFacts?: string;
        misunderstandings?: string;
        suspicions?: string;
      };
      const mapped: KnowledgeTimelineStateItem[] = list
        .map((raw) => {
          if (!raw || typeof raw !== 'object') return null;
          const obj = raw as Record<string, unknown>;
          const chapterIdVal = obj['chapterId'];
          const chapterIdNum =
            typeof chapterIdVal === 'number'
              ? chapterIdVal
              : typeof chapterIdVal === 'string' && chapterIdVal.trim() !== ''
                ? Number(chapterIdVal)
                : undefined;
          const chapterId = typeof chapterIdNum === 'number' && !Number.isNaN(chapterIdNum) ? chapterIdNum : undefined;
          const knownFacts = typeof obj['knownFacts'] === 'string' ? obj['knownFacts'] : undefined;
          const misunderstandings = typeof obj['misunderstandings'] === 'string' ? obj['misunderstandings'] : undefined;
          const suspicions = typeof obj['suspicions'] === 'string' ? obj['suspicions'] : undefined;
          return { chapterId, knownFacts, misunderstandings, suspicions };
        })
        .filter((x): x is KnowledgeTimelineStateItem => Boolean(x));
      setKnowledgeTimeline(mapped);
    } catch (e: unknown) {
      console.error('加载角色认知时间线失败:', e);
      toast.error(e instanceof Error ? e.message : '网络错误');
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [id, knowledgeCharacterId, fetchKnowledgeTimelineList]);

  const handleLoadKnowledge = useCallback(
    async (targetCharacterId?: string) => {
      const charId = targetCharacterId ?? knowledgeCharacterId;
      console.log('handleLoadKnowledge called:', { id, currentChapterId: currentChapter?.id, charId });
      if (!id || !currentChapter?.id || !charId) {
        toast.error('请先选择章节与角色');
        return;
      }
      try {
        setIsLoadingKnowledge(true);
        const list = await fetchKnowledgeTimelineList(String(id), String(charId));
        const selected = selectLatestKnowledgeSnapshot(list, String(currentChapter.id));
        if (selected && (selected.knownFacts || selected.misunderstandings || selected.suspicions)) {
          setKnowledgeKnownFacts(selected.knownFacts || '');
          setKnowledgeMisunderstandings(selected.misunderstandings || '');
          setKnowledgeSuspicions(selected.suspicions || '');
        } else {
          setKnowledgeKnownFacts('');
          setKnowledgeMisunderstandings('');
          setKnowledgeSuspicions('');
          setKnowledgeTimeline([]);
          toast.error('未找到此角色认知记录。');
        }
      } catch (e: unknown) {
        console.error('加载角色认知失败:', e);
        const errMsg = e instanceof Error ? e.message : '网络错误';
        toast.error(`加载失败: ${errMsg}`);
      } finally {
        setIsLoadingKnowledge(false);
      }
    },
    [id, currentChapter, knowledgeCharacterId, fetchKnowledgeTimelineList]
  );

  const handleSaveKnowledge = useCallback(async () => {
    if (!id || !currentChapter?.id || !knowledgeCharacterId) {
      toast.error('请先选择章节与角色');
      return;
    }
    try {
      setIsSavingKnowledge(true);
      const saveLoreId = resolveKnowledgeCharacterLoreIdForSave(knowledgeCharacterId);
      if (!saveLoreId) {
        toast.error('角色 ID 无效');
        return;
      }
      const res = await saveCharacterKnowledge(id, currentChapter.id, {
        characterLoreId: saveLoreId,
        knownFacts: knowledgeKnownFacts,
        misunderstandings: knowledgeMisunderstandings,
        suspicions: knowledgeSuspicions,
        extra: undefined
      });
      if (res.success) {
        toast.success('认知已保存');
      } else {
        toast.error(res.error || '保存失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setIsSavingKnowledge(false);
    }
  }, [id, currentChapter, knowledgeCharacterId, knowledgeKnownFacts, knowledgeMisunderstandings, knowledgeSuspicions, resolveKnowledgeCharacterLoreIdForSave]);

  const handleGenerateKnowledge = useCallback(async () => {
    if (!id || !currentChapter?.id || !knowledgeCharacterId) {
      toast.error('请先选择章节与角色');
      return;
    }
    if (!novel) {
      toast.error('未加载小说数据');
      return;
    }
    try {
      setIsGeneratingKnowledge(true);
      const characters = (novel.lore || []).filter((l: any) => l.type === 'character');
      const character = characters.find((l: any) => String(l.id ?? l._id ?? '') === String(knowledgeCharacterId));
      const lore = Array.isArray((novel as any).lore) ? (novel as any).lore : [];
      const world = (novel.lore || []).find(
        (l: any) => l.type === 'world' && (l.id === 'world' || (l as any)._id === 'world')
      );

      const allChapters: Array<{ id: string; title?: string; summary?: string }> = [];
      for (const v of (novel.volumes || [])) {
        for (const c of (v.chapters || [])) {
          allChapters.push({ id: String((c as any).id), title: (c as any).title, summary: (c as any).summary });
        }
      }
      const currentIndex = allChapters.findIndex((c) => c.id === String(currentChapter.id));
      const isBeforeStoryStart = currentIndex <= 0 && !currentChapter.content?.trim();
      let progressText = '';
      if (!isBeforeStoryStart) {
        try {
          const progressRes = await getProgressChapters(String(id), String(currentChapter.id));
          const isUnknownArray = (v: unknown): v is unknown[] => Array.isArray(v);
          const toBrief = (v: unknown): { id: string; title?: string; summary?: string } | null => {
            if (!v || typeof v !== 'object') return null;
            const obj = v as Record<string, unknown>;
            const idVal = obj.id;
            const titleVal = obj.title;
            const summaryVal = obj.summary;
            const idStr = String(idVal ?? '').trim();
            if (!idStr) return null;
            return {
              id: idStr,
              title: typeof titleVal === 'string' ? titleVal : undefined,
              summary: typeof summaryVal === 'string' ? summaryVal : undefined,
            };
          };
          const progressData: unknown = progressRes.data;
          if (progressRes.success && isUnknownArray(progressData)) {
            const prevOnly = progressData
              .map(toBrief)
              .filter((c): c is { id: string; title?: string; summary?: string } => Boolean(c && c.id && c.id !== String(currentChapter.id)));
            const prevTail = prevOnly.slice(Math.max(0, prevOnly.length - 8));
            progressText = prevTail
              .map((c, idx) => {
                const t = String(c.title || '').trim();
                const s = String(c.summary || '').trim();
                const label = t
                  ? `第${prevOnly.length - prevTail.length + idx + 1}章：${t}`
                  : `第${prevOnly.length - prevTail.length + idx + 1}章`;
                if (s) return `${label}\n- 摘要：${s}`;
                return `${label}`;
              })
              .filter(Boolean)
              .join('\n\n');
          }
        } catch {
        }
      }

      let baseKnowledgeText = '';
      if (!isBeforeStoryStart) {
        try {
          const list = await fetchKnowledgeTimelineList(String(id), String(knowledgeCharacterId));
          const latest = selectLatestKnowledgeSnapshot(list, String(currentChapter.id));
          if (latest && typeof latest === 'object') {
            const knownFacts = String(latest.knownFacts || '').trim();
            const misunderstandings = String(latest.misunderstandings || '').trim();
            const suspicions = String(latest.suspicions || '').trim();
            if (knownFacts || misunderstandings || suspicions) {
              baseKnowledgeText =
                `已知事实：\n${knownFacts || '（空）'}\n\n` +
                `误解：\n${misunderstandings || '（空）'}\n\n` +
                `怀疑/预感：\n${suspicions || '（空）'}`;
            }
          }
        } catch {
        }
      }

      const parts: string[] = [];
      if (character) {
        const name = (character as any).title || (character as any).name || '';
        const role = (character as any).role || '';
        const personality = (character as any).personality || '';
        const background = (character as any).background || '';
        const baseLines: string[] = [];
        if (name) baseLines.push(`姓名：${name}`);
        if (role) baseLines.push(`身份：${role}`);
        if (personality) baseLines.push(`性格：${personality}`);
        if (background) baseLines.push(`背景：${background}`);
        const base = baseLines.join('\n');
        const content = (character as any).content || '';
        parts.push(`角色设定：\n${base || content || '（暂无详细角色设定）'}`);
      }

      if (progressText) {
        parts.push(`已发生剧情进度（仅供判断角色现在可能知道什么，不代表角色全知）：\n${progressText}`);
      }

      if (!isBeforeStoryStart) {
        if (baseKnowledgeText) {
          parts.push(`数据库中的角色认知快照（截至当前章节或之前）：\n${baseKnowledgeText}`);
        } else {
          parts.push('数据库中的角色认知快照：\n（空：未找到该角色任何已保存的认知记录）');
        }
      }

      if (world) {
        const background = (world as any).background || '';
        const powerSystem = (world as any).powerSystem || '';
        const forces = (world as any).forces || '';
        const worldLines: string[] = [];
        if (background) worldLines.push(`世界背景：${background}`);
        if (powerSystem) worldLines.push(`力量体系：${powerSystem}`);
        if (forces) worldLines.push(`势力分布：${forces}`);
        if (worldLines.length) {
          parts.push(worldLines.join('\n'));
        }
      }

      if (!isBeforeStoryStart && currentChapter.content?.trim()) {
        parts.push(`本章正文（仅供参考，不要逐字复述）：\n${currentChapter.content.trim()}`);
      }

      const context = parts.join('\n\n');
      const baseText = isBeforeStoryStart
        ? '当前章节为第一章且正文为空：故事尚未开始，任何剧情事件均未发生。请设想该角色被“放回”到所有故事都尚未发生的时间点：基于人物设定与世界观规则信息，推导该角色在第一卷开头（第一章开头）之前的主观认知。'
        : '请根据提供的“已发生剧情进度”“数据库中的角色认知快照”和“本章正文”，更新该角色在本章结束时的主观认知。';

      const instruction = isBeforeStoryStart
        ? (
            '你将为“第一卷故事发生之前（第一章开头之前）”的该人物生成主观认知，分为三类：\n' +
            '1）已知事实：该角色在故事开始前合理能知道的客观事实；\n' +
            '2）误解：该角色基于有限信息得出的错误理解；\n' +
            '3）怀疑/预感：尚未证实的猜测、隐约的不安或直觉。\n\n' +
            '重要规则：\n' +
            '- 故事尚未开始：人物对剧情中的任何事情一律不清楚，因为它们都还没有发生；\n' +
            '- 只允许基于人物设定与世界规则类信息反推“开篇前的起点认知”（例如人物背景、关系格局、动机、偏见、社会常识、传闻与当下处境），绝对不能写任何未来剧情为已发生事实；\n' +
            '- 只允许写故事开始之前已经存在的经历、背景、传闻与当下现状；绝对不要写任何“故事开始之后才会发生”的事件、冲突、转折、任务、线索与关系变化；\n' +
            '- 如果信息不足，请输出更保守、更少的条目，允许为空；\n' +
            '- 严格从角色视角出发，不要使用上帝视角，不要输出“读者/作者”等表述；\n' +
            '- 严格基于提供内容，不要编造设定中不存在的事实。\n\n' +
            '输出模板：\n' +
            '已知事实：\n' +
            '- ...\n' +
            '误解：\n' +
            '- ...\n' +
            '怀疑/预感：\n' +
            '- ...'
          )
        : (
            '你是一位小说剧情逻辑校对专家。\n\n' +
            '请先阅读“数据库中的角色认知快照”（如果为空则视为无基础认知），再根据“已发生剧情进度”和“本章正文”更新该角色在本章结束时的主观认知，分为三类：\n' +
            '1）已知事实：角色已经确认的客观事实；\n' +
            '2）误解：角色坚信但实际上是错误的判断或信息；\n' +
            '3）怀疑/预感：角色有所怀疑、模糊直觉或尚未证实的猜测。\n\n' +
            '重要规则：\n' +
            '- 角色只可能知道已经发生过、并且角色合理能够接触到的信息；\n' +
            '- 如果已发生剧情中与该角色没有任何直接或间接关联，则不要凭空新增与剧情有关的认知条目，可保持更保守的更新；\n' +
            '- 绝对不要写“尚未发生”的事件；\n' +
            '- 不要使用上帝视角，不要输出“读者/作者”等表述；\n' +
            '- 严格基于提供内容，不要编造设定中不存在的事实；\n' +
            '- 使用简体中文，分条列出，每条不超过一到两句话。\n\n' +
            '输出模板：\n' +
            '已知事实：\n' +
            '- ...\n' +
            '误解：\n' +
            '- ...\n' +
            '怀疑/预感：\n' +
            '- ...'
          );

      const res = await refineText({
        text: baseText,
        context,
        instruction,
        model: isBeforeStoryStart ? 'deepseek-reasoner' : undefined
      });

      if (!res.success || !res.data) {
        toast.error(res.error || '生成失败');
        return;
      }

      const raw = String(res.data);
      const lines = raw.split('\n');
      let section: 'known' | 'mis' | 'susp' | null = null;
      let known: string[] = [];
      let mis: string[] = [];
      let susp: string[] = [];

      for (const origin of lines) {
        const line = origin.trim();
        if (!line) continue;
        if (line.startsWith('已知事实')) {
          section = 'known';
          continue;
        }
        if (line.startsWith('误解')) {
          section = 'mis';
          continue;
        }
        if (line.startsWith('怀疑') || line.startsWith('预感')) {
          section = 'susp';
          continue;
        }
        if (line.startsWith('-')) {
          const content = line.replace(/^-\s*/, '');
          if (section === 'known') known.push(content);
          else if (section === 'mis') mis.push(content);
          else if (section === 'susp') susp.push(content);
        } else {
          if (section === 'known') known.push(line);
          else if (section === 'mis') mis.push(line);
          else if (section === 'susp') susp.push(line);
        }
      }

      if (!known.length && !mis.length && !susp.length) {
        setKnowledgeKnownFacts(raw);
        setKnowledgeMisunderstandings('');
        setKnowledgeSuspicions('');
      } else {
        setKnowledgeKnownFacts(known.join('\n'));
        setKnowledgeMisunderstandings(mis.join('\n'));
        setKnowledgeSuspicions(susp.join('\n'));
      }

      toast.success('已根据当前上下文生成角色认知，请确认后点击“保存认知”。');
    } catch {
      toast.error('AI 生成失败，请稍后重试');
    } finally {
      setIsGeneratingKnowledge(false);
    }
  }, [id, currentChapter, knowledgeCharacterId, novel, fetchKnowledgeTimelineList]);

  const handleInitAllCharacterKnowledge = useCallback(async () => {
    if (!id) {
      toast.error('未加载小说 ID');
      return;
    }
    if (!novel) {
      toast.error('未加载小说数据');
      return;
    }

    const characters = (novel.lore || []).filter((l: any) => l?.type === 'character');
    if (!characters.length) {
      setInitAllKnowledgeStatus({ state: 'error', message: '当前没有可初始化的人物' });
      window.setTimeout(() => setInitAllKnowledgeStatus({ state: 'idle' }), 3000);
      return;
    }

    let firstChapterId: string | null = null;
    for (const vol of (novel.volumes || [])) {
      const chs = Array.isArray((vol as any).chapters) ? (vol as any).chapters : [];
      if (chs.length > 0) {
        const sorted = [...chs].sort((a: any, b: any) => {
          const ia = typeof a.orderIndex === 'number' ? a.orderIndex : 0;
          const ib = typeof b.orderIndex === 'number' ? b.orderIndex : 0;
          return ia - ib;
        });
        firstChapterId = String(sorted[0].id);
        break;
      }
    }
    if (!firstChapterId) {
      setInitAllKnowledgeStatus({ state: 'error', message: '请先创建至少一个章节' });
      window.setTimeout(() => setInitAllKnowledgeStatus({ state: 'idle' }), 3000);
      return;
    }

    setInitAllKnowledgeStatus({ state: 'initializing' });
    try {
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
          if (!current) return;
          if (current === 'known') result.known.push(line);
          else if (current === 'mis') result.mis.push(line);
          else if (current === 'susp') result.susp.push(line);
        });
        return result;
      };

      const lore = Array.isArray((novel as any).lore) ? (novel as any).lore : [];
      const coreSettings = (novel as any).coreSettings;
      const coreSettingsText = coreSettings
        ? (() => {
            const safeVal =
              coreSettings && typeof coreSettings === 'object' && !Array.isArray(coreSettings)
                ? (() => {
                    const v = coreSettings as Record<string, unknown>;
                    const { outline: _outline, ...rest } = v;
                    return rest;
                  })()
                : coreSettings;
            try {
              return JSON.stringify(safeVal, null, 2);
            } catch {
              return String(safeVal);
            }
          })()
        : '';
      const world = lore.find((l: any) => l?.type === 'world' && (l?.id === 'world' || l?._id === 'world'));
      const worldText = world
        ? (() => {
            const parts: string[] = [];
            if (world.background) parts.push(`背景：${String(world.background)}`);
            if (world.powerSystem) parts.push(`力量体系：${String(world.powerSystem)}`);
            if (world.forces) parts.push(`阵营势力：${String(world.forces)}`);
            return parts.join('\n');
          })()
        : '';
      const storyContextParts: string[] = [];
      const title = String((novel as any).title || '').trim();
      const description = String((novel as any).description || '').trim();
      const genre = String((novel as any).genre || '').trim();
      const style = String((novel as any).style || '').trim();
      if (title) storyContextParts.push(`书名：${title}`);
      if (description) storyContextParts.push(`简介：${description}`);
      if (genre) storyContextParts.push(`题材：${genre}`);
      if (style) storyContextParts.push(`风格：${style}`);
      const storyContext = storyContextParts.join('\n');

      const instruction =
        '你将为“故事发生之前（第一章开头之前）”的该人物生成主观认知，分为三类：' +
        '1）已知事实：该角色在故事开始前合理能知道的客观事实；' +
        '2）误解：该角色基于有限信息得出的错误理解；' +
        '3）怀疑或预感：尚未证实的猜测、隐约的不安或直觉。' +
        '重要规则：故事尚未开始：人物对剧情中的任何事情一律不清楚，因为它们都还没有发生。' +
        '只允许基于人物设定与世界规则类信息反推“开篇前的起点认知”，绝对不能写任何未来剧情为已发生事实。' +
        '只允许写“故事开始之前”已经存在的经历、背景、传闻与当下现状；绝对不要写任何“故事开始之后才会发生”的事件、冲突、转折、任务、线索与关系变化。' +
        '如果信息不足，请输出更保守、更少的条目，允许为空。' +
        '请严格从角色视角出发，不泄露读者视角的幕后真相，不使用“读者”“作者”等表述。' +
        '输出格式示例：' +
        '已知事实：' +
        '- ...' +
        '误解：' +
        '- ...' +
        '怀疑：' +
        '- ...';

      let successCount = 0;
      let replacedCount = 0;
      let insertedCount = 0;
      let unknownCount = 0;
      for (const char of characters) {
        const rawId = (char as any).loreId != null ? String((char as any).loreId) : String((char as any).id ?? (char as any)._id ?? '');
        const charId = resolveKnowledgeCharacterLoreIdForSave(rawId);
        if (!charId || !/^\d+$/.test(charId.trim())) continue;

        let hadExistingRecord: boolean | null = null;
        try {
          const existingRes = await getChapterCharacterKnowledge(id, firstChapterId, charId);
          if (existingRes.success) {
            const d = existingRes.data;
            if (Array.isArray(d)) hadExistingRecord = d.length > 0;
            else hadExistingRecord = !!d;
          } else {
            hadExistingRecord = null;
          }
        } catch {
          hadExistingRecord = null;
        }

        const name = (char as any).name || (char as any).title || '';
        const role = (char as any).role || '';
        const gender = (char as any).gender || '';
        const age = (char as any).age || '';
        const content = (char as any).content || '';
        const baseText = '请生成“故事发生之前（第一章开头之前）”的角色认知。';
        const pieces: string[] = [];
        if (storyContext) pieces.push(`【小说信息】\n${storyContext}`);
        if (coreSettingsText) pieces.push(`【核心设定（作者资料，仅用于理解世界与类型，不代表角色已知）】\n${coreSettingsText}`);
        if (worldText) pieces.push(`【世界观（作者资料，仅用于理解世界规则，不代表角色已知）】\n${worldText}`);
        if (name) pieces.push(`姓名：${name}`);
        if (role) pieces.push(`身份角色：${role}`);
        if (gender) pieces.push(`性别：${gender}`);
        if (age) pieces.push(`年龄：${age}`);
        if (content) pieces.push(`人物设定：${content}`);
        const context = pieces.join('\n');

        const aiRes = await refineText({
          text: baseText,
          context,
          instruction,
        });
        if (!aiRes.success || !aiRes.data) continue;

        const parsed = parseKnowledgeText(String(aiRes.data));
        const knownFacts = parsed.known.join('\n');
        const misunderstandings = parsed.mis.join('\n');
        const suspicions = parsed.susp.join('\n');
        const saveRes = await saveCharacterKnowledge(id, firstChapterId, {
          characterLoreId: charId,
          knownFacts,
          misunderstandings,
          suspicions,
          extra: undefined,
        });
        if (saveRes.success) {
          successCount += 1;
          if (hadExistingRecord === true) replacedCount += 1;
          else if (hadExistingRecord === false) insertedCount += 1;
          else unknownCount += 1;
        }
      }

      if (successCount > 0) {
        const message = `已为 ${successCount} 个角色生成初始认知（覆盖 ${replacedCount}，新增 ${insertedCount}${unknownCount ? `，未知 ${unknownCount}` : ''}）`;
        setInitAllKnowledgeStatus({ state: 'success', message });
        toast.success(message);
      } else {
        const message = '未能为任何角色生成认知';
        setInitAllKnowledgeStatus({ state: 'error', message });
        toast.error(message);
      }
      window.setTimeout(() => setInitAllKnowledgeStatus({ state: 'idle' }), 4000);
    } catch {
      setInitAllKnowledgeStatus({ state: 'error', message: '初始化失败' });
      toast.error('初始化失败');
      window.setTimeout(() => setInitAllKnowledgeStatus({ state: 'idle' }), 3000);
    }
  }, [id, novel, resolveKnowledgeCharacterLoreIdForSave]);

  const handleUpdateChapterAllCharacterKnowledge = useCallback(async () => {
    if (!id) {
      toast.error('未加载小说 ID');
      return;
    }
    if (!novel) {
      toast.error('未加载小说数据');
      return;
    }
    if (!currentChapter?.id) {
      toast.error('请先选择章节');
      return;
    }
    if (!currentChapter.content?.trim()) {
      toast.error('当前章节正文为空');
      return;
    }

    const characterIdsRaw = Array.isArray(currentChapter.characterIds) ? currentChapter.characterIds : [];
    const characterIds = Array.from(new Set(characterIdsRaw.map((x: any) => String(x ?? '').trim()).filter(Boolean)));
    if (!characterIds.length) {
      toast.error('本章未关联任何角色');
      return;
    }

    setUpdateChapterKnowledgeStatus({ state: 'updating' });
    try {
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
          if (!current) return;
          if (line.startsWith('-')) {
            const v = line.replace(/^-\s*/, '');
            if (!v) return;
            if (current === 'known') result.known.push(v);
            else if (current === 'mis') result.mis.push(v);
            else result.susp.push(v);
            return;
          }
          if (current === 'known') result.known.push(line);
          else if (current === 'mis') result.mis.push(line);
          else result.susp.push(line);
        });
        return result;
      };

      const world = (novel.lore || []).find(
        (l: any) => l.type === 'world' && (l.id === 'world' || (l as any)._id === 'world')
      );

      let progressText = '';
      try {
        const progressRes = await getProgressChapters(String(id), String(currentChapter.id));
        const isUnknownArray = (v: unknown): v is unknown[] => Array.isArray(v);
        const toBrief = (v: unknown): { id: string; title?: string; summary?: string } | null => {
          if (!v || typeof v !== 'object') return null;
          const obj = v as Record<string, unknown>;
          const idVal = obj.id;
          const titleVal = obj.title;
          const summaryVal = obj.summary;
          const idStr = String(idVal ?? '').trim();
          if (!idStr) return null;
          return {
            id: idStr,
            title: typeof titleVal === 'string' ? titleVal : undefined,
            summary: typeof summaryVal === 'string' ? summaryVal : undefined,
          };
        };
        const progressData: unknown = progressRes.data;
        if (progressRes.success && isUnknownArray(progressData)) {
          const prevOnly = progressData
            .map(toBrief)
            .filter((c): c is { id: string; title?: string; summary?: string } => Boolean(c && c.id && c.id !== String(currentChapter.id)));
          const prevTail = prevOnly.slice(Math.max(0, prevOnly.length - 8));
          progressText = prevTail
            .map((c, idx) => {
              const t = String(c.title || '').trim();
              const s = String(c.summary || '').trim();
              const label = t
                ? `第${prevOnly.length - prevTail.length + idx + 1}章：${t}`
                : `第${prevOnly.length - prevTail.length + idx + 1}章`;
              if (s) return `${label}\n- 摘要：${s}`;
              return `${label}`;
            })
            .filter(Boolean)
            .join('\n\n');
        }
      } catch {
      }

      const instruction =
        '你是一位小说剧情逻辑与人物认知校对专家。\n\n' +
        '系统会对本章所有出场角色逐个调用你：每次调用时，你只需要专注于当前这个角色。\n\n' +
        '请先阅读“数据库中的角色认知快照”（如果为空则视为无基础认知），再根据“已发生剧情进度”和“本章正文”推导该角色在本章结束时的最新主观认知，并输出一份完整的认知清单，分为三类：\n' +
        '1）已知事实：角色此时确信的客观情况、自我定位、人际关系与局势判断；\n' +
        '2）误解：角色坚信但实际上是错误或严重偏差的判断、刻板印象、对他人/事件的误读；\n' +
        '3）怀疑/预感：角色有所怀疑、隐约不安或尚未证实的猜测，包括对既有怀疑强度的变化。\n\n' +
        '重要规则：\n' +
        '- 每一章都视为一次认知刷新：即使本章只带来了细微变化（例如情绪、态度、信任/警惕程度的变化），也要在认知清单中体现；\n' +
        '- 输出的是当前章节结束时的完整清单，而不是只列出变化部分，可以在原有认知基础上增删和重写条目；\n' +
        '- 角色只可能知道已经发生过、并且角色合理能够接触到的信息，绝对不要写“尚未发生”的事件；\n' +
        '- 不要使用上帝视角，不要输出“读者/作者”等表述；\n' +
        '- 严格基于提供内容，不要编造设定中不存在的事实；\n' +
        '- 使用简体中文，分条列出，每条不超过一到两句话。\n\n' +
        '输出模板：\n' +
        '已知事实：\n' +
        '- ...\n' +
        '误解：\n' +
        '- ...\n' +
        '怀疑/预感：\n' +
        '- ...';

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;
      for (const cid of characterIds) {
        const saveLoreId = resolveKnowledgeCharacterLoreIdForSave(cid);
        if (!saveLoreId) {
          skippedCount += 1;
          continue;
        }

        const character = (novel.lore || []).find((l: any) => {
          const idVal = String(l?.id ?? l?._id ?? '');
          const loreIdVal = String((l as any)?.loreId ?? '');
          return idVal === cid || idVal === saveLoreId || loreIdVal === saveLoreId;
        });

        let baseKnowledgeText = '';
        try {
          const timelineRes = await getCharacterKnowledgeTimeline(id, cid);
          if (timelineRes.success && Array.isArray(timelineRes.data)) {
            const list = timelineRes.data;
            const curIdNum = Number(currentChapter.id);
            let latest: any = null;
            for (const item of list) {
              if (!item || typeof item !== 'object') continue;
              const chapterId = (item as any).chapterId;
              if (chapterId == null) {
                latest = item;
              } else if (!Number.isNaN(curIdNum) && Number(chapterId) <= curIdNum) {
                latest = item;
              }
            }
            if (latest && typeof latest === 'object') {
              const knownFacts = String((latest as any).knownFacts || '').trim();
              const misunderstandings = String((latest as any).misunderstandings || '').trim();
              const suspicions = String((latest as any).suspicions || '').trim();
              if (knownFacts || misunderstandings || suspicions) {
                baseKnowledgeText =
                  `已知事实：\n${knownFacts || '（空）'}\n\n` +
                  `误解：\n${misunderstandings || '（空）'}\n\n` +
                  `怀疑/预感：\n${suspicions || '（空）'}`;
              }
            }
          }
        } catch {
        }

        const parts: string[] = [];
        if (character) {
          const name = (character as any).title || (character as any).name || '';
          const role = (character as any).role || '';
          const personality = (character as any).personality || '';
          const background = (character as any).background || '';
          const baseLines: string[] = [];
          if (name) baseLines.push(`姓名：${name}`);
          if (role) baseLines.push(`身份：${role}`);
          if (personality) baseLines.push(`性格：${personality}`);
          if (background) baseLines.push(`背景：${background}`);
          const base = baseLines.join('\n');
          const content = (character as any).content || '';
          parts.push(`角色设定：\n${base || content || '（暂无详细角色设定）'}`);
        } else {
          parts.push(`角色设定：\n（未找到该角色的设定信息，角色ID：${cid}）`);
        }

        if (progressText) {
          parts.push(`已发生剧情进度（仅供判断角色现在可能知道什么，不代表角色全知）：\n${progressText}`);
        }

        if (baseKnowledgeText) {
          parts.push(`数据库中的角色认知快照（截至当前章节或之前）：\n${baseKnowledgeText}`);
        } else {
          parts.push('数据库中的角色认知快照：\n（空：未找到该角色任何已保存的认知记录）');
        }

        if (world) {
          const background = (world as any).background || '';
          const powerSystem = (world as any).powerSystem || '';
          const forces = (world as any).forces || '';
          const worldLines: string[] = [];
          if (background) worldLines.push(`世界背景：${background}`);
          if (powerSystem) worldLines.push(`力量体系：${powerSystem}`);
          if (forces) worldLines.push(`势力分布：${forces}`);
          if (worldLines.length) {
            parts.push(worldLines.join('\n'));
          }
        }

        const context = parts.join('\n\n');
        const res = await refineText({
          text: currentChapter.content,
          context,
          instruction
        });

        if (!res.success || !res.data) {
          failCount += 1;
          continue;
        }

        const parsed = parseKnowledgeText(String(res.data));
        if (
          (!parsed.known || parsed.known.length === 0) &&
          (!parsed.mis || parsed.mis.length === 0) &&
          (!parsed.susp || parsed.susp.length === 0)
        ) {
          failCount += 1;
          continue;
        }
        const knownFacts = parsed.known.join('\n');
        const misunderstandings = parsed.mis.join('\n');
        const suspicions = parsed.susp.join('\n');

        let identityText = '';
        let speechStyleArr: string[] = [];
        if (character) {
          const role = (character as any).role || '';
          const nameOrTitle = (character as any).title || (character as any).name || '';
          identityText = role || nameOrTitle || '';
          const p = (character as any).personality || '';
          if (p) {
            const arr = String(p).split(/[，、,\/\s]+/).filter(Boolean).slice(0, 2);
            speechStyleArr = arr;
          }
        }
        const goalText = String(currentChapter.summary || '').trim();
        const writingCard = {
          version: '1.0',
          identity: identityText,
          relationToProtagonist: '',
          goalThisChapter: goalText,
          stateThisChapter: '',
          speechStyle: speechStyleArr,
          bottomLine: '',
          triggers: [],
          updatedAt: new Date().toISOString()
        };
        const saveRes = await saveCharacterKnowledge(id, currentChapter.id, {
          characterLoreId: saveLoreId,
          knownFacts,
          misunderstandings,
          suspicions,
          extra: JSON.stringify({ writingCard })
        });
        if (saveRes.success) {
          successCount += 1;
        } else {
          failCount += 1;
        }
      }

      if (successCount > 0) {
        const message = `已更新 ${successCount} 个角色认知${failCount ? `，其中 ${failCount} 个角色本次未产生可用的认知更新` : ''}${skippedCount ? `，跳过 ${skippedCount}` : ''}`;
        setUpdateChapterKnowledgeStatus({ state: 'success', message });
        toast.success(message);
      } else {
        const message = `本次未对任何角色的认知进行更新${failCount ? `，${failCount} 个角色的认知被判断为本章无有效升级` : ''}${skippedCount ? `，跳过 ${skippedCount}` : ''}`;
        setUpdateChapterKnowledgeStatus({ state: 'error', message });
        toast.error(message);
      }

      window.setTimeout(() => setUpdateChapterKnowledgeStatus({ state: 'idle' }), 4000);
    } catch {
      setUpdateChapterKnowledgeStatus({ state: 'error', message: '更新失败' });
      toast.error('更新失败');
      window.setTimeout(() => setUpdateChapterKnowledgeStatus({ state: 'idle' }), 3000);
    }
  }, [currentChapter, id, novel, resolveKnowledgeCharacterLoreIdForSave]);

  // Diff State
  const [diffData, setDiffData] = useState<{
    original: string;
    modified: string;
    onAccept: (finalContent: string) => Promise<void>;
    onReject: () => void;
  } | null>(null);
  const [pendingLoreDiffs, setPendingLoreDiffs] = useState<Record<string, { original: string; modified: string }>>({});

  // Modal State
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [isEvaluatorOpen, setIsEvaluatorOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [modalVolumeId, setModalVolumeId] = useState<string | null>(null);
  const [modalVolumeData, setModalVolumeData] = useState<{
    title: string; 
    summary: string; 
    existingChapters?: string[]; 
    outlineContext?: string;
    previousChapterCount?: number;
  } | null>(null);
  
  // AI Writer Modal State
  const [isAiWriterModalOpen, setIsAiWriterModalOpen] = useState(false);
  const [aiWriterInstruction, setAiWriterInstruction] = useState('');
  const [isAiWriting, setIsAiWriting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isOptimizeVolumeOpen, setIsOptimizeVolumeOpen] = useState(false);
  const [optimizeInstruction, setOptimizeInstruction] = useState('');
  const [isOptimizingVolume, setIsOptimizingVolume] = useState(false);
  const [optimizeWordCount, setOptimizeWordCount] = useState<number | ''>('');

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'volume' | 'chapter' | 'lore' | null;
    id: string | null;
    title: string;
  }>({
    isOpen: false,
    type: null,
    id: null,
    title: ''
  });

  // Lore Input Modal State
  const [loreModal, setLoreModal] = useState<{
    isOpen: boolean;
    type: string;
    title: string;
  }>({
    isOpen: false,
    type: 'character',
    title: ''
  });

  const [isAiCharacterModalOpen, setIsAiCharacterModalOpen] = useState(false);
  const [isAiOutlineModalOpen, setIsAiOutlineModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationPrompt, setLocationPrompt] = useState('');
  const [isLocationGenerating, setIsLocationGenerating] = useState(false);
  const [isCharSelectorOpen, setIsCharSelectorOpen] = useState(false);
  const [isForeshadowingLoading, setIsForeshadowingLoading] = useState(false);
  const [isForeshadowingCollapsed, setIsForeshadowingCollapsed] = useState(false);
  const [isForeshadowingModalOpen, setIsForeshadowingModalOpen] = useState(false);
  const [allForeshadowingList, setAllForeshadowingList] = useState<Foreshadowing[]>([]);
  const [isForeshadowingListLoading, setIsForeshadowingListLoading] = useState(false);
  const [evaluatorChapterId, setEvaluatorChapterId] = useState<string | null>(null);

  // Create Volume Dialog State
  const [isCreateVolumeOpen, setIsCreateVolumeOpen] = useState(false);
  const [newVolumeTitle, setNewVolumeTitle] = useState('');
  const [isCreatingVolume, setIsCreatingVolume] = useState(false);

  // Character Tooltip State
  const [tooltipState, setTooltipState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    char: any | null;
  }>({ visible: false, x: 0, y: 0, char: null });

  const [copyToastMessage, setCopyToastMessage] = useState('');

  // AI Sidebar Resize State
  const [aiSidebarWidth, setAiSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  
  const defaultGenre = novel?.genre || '';
  let defaultDescription = novel?.description || '';
  // 如果小说没有简介，就依次尝试：
  // 1. 找一条类型为“plot”且 _section 为“outline”或标题含“纲”的 lore，拿它的 content/summary 当简介
  // 2. 否则把所有分卷 summary 拼起来当简介
  if (!defaultDescription) {
    const plotOutline = novel?.lore?.find((l: any) => l.type === 'plot' && ((l as any)._section === 'outline' || /纲/.test(l.title || '')));
    if (plotOutline && ((plotOutline as any).content || (plotOutline as any).summary)) {
      defaultDescription = (plotOutline as any).content || (plotOutline as any).summary || '';
    } else {
      const summaries = (novel?.volumes || []).map(v => v.summary).filter(Boolean).join('\n');
      if (summaries) defaultDescription = summaries;
    }
  }
  let defaultStyle = novel?.style || '';
// 若小说尚未指定全局 style，则尝试从 lore 中读取“叙事策略”里专门记录文风/基调/风格的部分：
// 1. 先找 type=narrative 且 _section==='tone' 的段落；
// 2. 若无，再模糊匹配标题含“文风|基调|风格”的 narrative 条目；
// 3. 命中后依次取 tone、content、summary 字段作为 defaultStyle。
if (!defaultStyle) {
  const narrativeTone = novel?.lore?.find(
    (l: any) =>
      l.type === 'narrative' &&
      ((l as any)._section === 'tone' || /文风|基调|风格/.test(l.title || ''))
  );
  if (narrativeTone) {
    defaultStyle =
      (narrativeTone as any).tone ||
      (narrativeTone as any).content ||
      (narrativeTone as any).summary ||
      '';
  }
}

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 250 && newWidth <= 800) {
        setAiSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (id) {
      setIsLoadingData(true);
      getNovel(id).then(async res => {
        if (res.success && res.data) {
          // Ensure narrative view reflects database style/genre on initial load
          try {
            const freshLoreList = res.data.lore || [];
            const narrativeLore = freshLoreList.find((l: any) => l.type === 'narrative');
            if (narrativeLore) {
              if (res.data.style) (narrativeLore as any).tone = res.data.style;
              if (res.data.genre) (narrativeLore as any).pacing = res.data.genre;
            }
          } catch {}
          setNovel(res.data);
          // Auto select first chapter if available
          const firstChapter = res.data.volumes?.[0]?.chapters?.[0];
          if (firstChapter) {
            setCurrentChapter(firstChapter);
            // Fetch content for the first chapter
            try {
              const contentRes = await getChapterContent(firstChapter.id);
              if (contentRes.success) {
                setCurrentChapter(prev => prev ? { ...prev, content: contentRes.data || '' } : prev);
              }
            } catch (error) {
              console.error('Failed to load first chapter content:', error);
            }
          }
          
          // Pre-fetch foreshadowing list to ensure counts are accurate
          try {
             const foreshadowingRes = await getForeshadowingList(id);
             if (foreshadowingRes.success && foreshadowingRes.data) {
                setAllForeshadowingList(foreshadowingRes.data);
                setNovel(prev => prev ? { ...prev, foreshadowing: foreshadowingRes.data } : prev);
             }
          } catch (e) {
             console.error('Failed to pre-fetch foreshadowing list:', e);
          }

        }
      }).finally(() => setIsLoadingData(false));
    }
  }, [id]);

  useEffect(() => {
    const handleReload = () => {
      if (!id) return;
      const currentChapterId = currentChapter?.id;
      const currentLoreId = currentLore?._id || currentLore?.id;
      getNovel(id).then(res => {
        if (res.success && res.data) {
          setNovel(res.data);
          if (currentVolume) {
            const updatedVol = res.data.volumes.find(v => v.id === currentVolume.id);
            if (updatedVol) {
              const mergedMilestones = (currentVolume as { milestones?: unknown }).milestones;
              setCurrentVolume({ ...updatedVol, milestones: mergedMilestones } as typeof updatedVol);
            }
          }
          if (currentChapterId) {
            const allChapters = res.data.volumes?.flatMap((v: any) => v.chapters || []) || [];
            const updatedChapter = allChapters.find((c: any) => c.id === currentChapterId);
            if (updatedChapter) setCurrentChapter(updatedChapter);
          }
          if (currentLoreId) {
            const allLore = res.data.lore || [];
            let updatedLore = allLore.find((l: any) => (l._id || l.id) === currentLoreId);
            if (!updatedLore && currentLore && currentLore._section) {
              const baseLore = allLore.find((l: any) => (l._id || l.id) === currentLore.id);
              if (baseLore) {
                updatedLore = {
                  ...baseLore,
                  _id: currentLore._id,
                  _section: currentLore._section,
                  title: currentLore.title || baseLore.title,
                  type: baseLore.type
                };
              }
            }
            if (updatedLore) setCurrentLore(updatedLore);
          }
        }
      });
    };
    
    window.addEventListener('novel-data-reload', handleReload);
    return () => window.removeEventListener('novel-data-reload', handleReload);
  }, [id, currentVolume, currentChapter, currentLore]);

  
  // Default narrative section to 'tone' to avoid falling back to legacy content
  useEffect(() => {
    if (activeTab === 'lore' && currentLore && (currentLore as any).type === 'narrative' && !(currentLore as any)._section) {
      setCurrentLore(prev => {
        if (!prev) return prev;
        return { ...(prev as any), _section: 'tone' };
      });
    }
  }, [activeTab, currentLore]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (chapterViewMode !== 'beat') return;
    if (!currentChapter?.id) return;

    const chapterId = String(currentChapter.id);
    if (lastBeatSheetLoadedChapterIdRef.current === chapterId) return;

    const bs: any = (currentChapter as any).beatSheet;
    const hasBeatSheet =
      Boolean(bs && (bs.goal || bs.conflict || (Array.isArray(bs.beats) && bs.beats.length > 0)));
    if (hasBeatSheet) {
      lastBeatSheetLoadedChapterIdRef.current = chapterId;
      return;
    }

    const rawChapterId = currentChapter.id;
    let cancelled = false;
    (async () => {
      try {
        const res = await getChapterBeatSheet(rawChapterId);
        if (cancelled) return;
        if (res.success) {
          lastBeatSheetLoadedChapterIdRef.current = chapterId;
        }
        if (res.success && res.data) {
          let beatData: any = res.data;
          if (typeof beatData === 'string') {
            try {
              beatData = JSON.parse(beatData);
            } catch {
              beatData = null;
            }
          }
          if (beatData) {
            setCurrentChapter(prev => prev?.id === rawChapterId ? { ...prev, beatSheet: beatData } : prev);
          }
        }
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chapterViewMode, currentChapter?.id]);

  useEffect(() => {
    if (chapterViewMode !== 'beat') return;
    if (!novel || !currentChapter?.id) return;

    let prevChapter: Chapter | null = null;
    for (let i = 0; i < novel.volumes.length; i++) {
      const vol = novel.volumes[i];
      const idx = vol.chapters.findIndex(c => c.id === currentChapter.id);
      if (idx !== -1) {
        if (idx > 0) {
          prevChapter = vol.chapters[idx - 1] as any;
        } else if (i > 0) {
          const prevVol = novel.volumes[i - 1];
          if (prevVol.chapters.length > 0) {
            prevChapter = prevVol.chapters[prevVol.chapters.length - 1] as any;
          }
        }
        break;
      }
    }
    if (!prevChapter?.id) return;

    const prevIdStr = String(prevChapter.id);
    if (lastPrevBeatSheetLoadedChapterIdRef.current === prevIdStr) return;

    const prevBs: any = (prevChapter as any).beatSheet;
    const prevHasBeatSheet =
      Boolean(prevBs && (prevBs.goal || prevBs.conflict || (Array.isArray(prevBs.beats) && prevBs.beats.length > 0)));
    if (prevHasBeatSheet) {
      lastPrevBeatSheetLoadedChapterIdRef.current = prevIdStr;
      return;
    }

    const rawPrevId = prevChapter.id;
    let cancelled = false;
    (async () => {
      try {
        const res = await getChapterBeatSheet(rawPrevId);
        if (cancelled) return;
        if (res.success) {
          lastPrevBeatSheetLoadedChapterIdRef.current = prevIdStr;
        }
        if (res.success && res.data) {
          let beatData: any = res.data;
          if (typeof beatData === 'string') {
            try {
              beatData = JSON.parse(beatData);
            } catch {
              beatData = null;
            }
          }
          if (beatData) {
            setNovel(prev => {
              if (!prev) return prev;
              const newVolumes = prev.volumes.map(v => ({
                ...v,
                chapters: v.chapters.map(c => c.id === rawPrevId ? ({ ...c, beatSheet: beatData } as any) : c)
              }));
              return { ...prev, volumes: newVolumes };
            });
          }
        }
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chapterViewMode, novel, currentChapter?.id]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>;
      const detail = (customEvent.detail ?? {}) as { type?: string; message?: string };
      const message = detail.message || '已复制到剪贴板';
      setCopyToastMessage(message);
      window.setTimeout(() => {
        setCopyToastMessage('');
      }, 1500);
    };

    window.addEventListener('ainovel:toast', handler);
    return () => {
      window.removeEventListener('ainovel:toast', handler);
    };
  }, []);

  useEffect(() => {
    if (!enableSummarize && summarizeMode === 'none') {
      setSummaryPreview('');
      return;
    }
    const all = [...messages];
    const olderMessages = all.slice(0, Math.max(0, all.length - historyRounds * 2));
    if (olderMessages.length === 0) {
      setSummaryPreview('');
      return;
    }
    let perMsg = 120;
    let maxTotal = 800;
    let titleText = '对话摘要：';
    if (summarizeMode === 'simple') {
      perMsg = 80;
      maxTotal = 600;
      titleText = '摘要：';
    } else if (summarizeMode === 'detailed') {
      perMsg = 160;
      maxTotal = 1200;
      titleText = '详细摘要：';
    } else if (summarizeMode === 'auto') {
      if (historyRounds > 10) {
        perMsg = 60;
        maxTotal = 500;
        titleText = '摘要：';
      } else {
        perMsg = 120;
        maxTotal = 900;
        titleText = '摘要：';
      }
    }
    const parts: string[] = [];
    for (const m of olderMessages) {
      const head = `${m.role === 'user' ? '用户' : '助手'}: `;
      const txt = (m.content || '').replace(/\s+/g, ' ').slice(0, perMsg);
      parts.push(head + txt);
      if (parts.join('\n').length >= maxTotal) break;
    }
    const summaryText = parts.join('\n');
    setSummaryPreview(`${titleText}\n${summaryText}`);
  }, [messages, enableSummarize, summarizeMode, historyRounds]);

  const handleBatchCreate = async (chapters: Array<string | { title: string, summary?: string }>) => {
    if (!novel || !modalVolumeId) return;
    setIsBatchProcessing(true);
    try {
        const res = await batchCreateChapters(novel.id, modalVolumeId, chapters);
        if (res.success) {
             setNovel(prev => {
                if (!prev) return null;
                const newVolumes = prev.volumes.map(v => {
                    if (v.id === modalVolumeId) {
                         return { ...v, chapters: [...v.chapters, ...res.data] };
                    }
                    return v;
                });
                return { ...prev, volumes: newVolumes };
            });
            setIsBatchModalOpen(false);
        } else {
            alert('批量添加失败: ' + res.error);
        }
    } catch (e) {
        alert('网络错误');
    } finally {
        setIsBatchProcessing(false);
    }
  };

  // Save Function
  const handleSave = useCallback(async (overrideData?: any) => {
    if (!id || isSaving) return;

    // Determine if overrideData is actually an event object
    const isEvent = overrideData && (overrideData.preventDefault || overrideData.nativeEvent || overrideData.constructor?.name?.includes('Event'));
    const actualOverrideData = (overrideData && !isEvent) ? overrideData : null;

    if (activeTab === 'editor' && currentChapter) {
      setIsSaving(true);
      try {
        // Find volume ID for the current chapter
        const volumeId = novel?.volumes.find(v => v.chapters.some(c => c.id === currentChapter.id))?.id;
        
        if (!volumeId) {
          console.error('Volume ID not found for chapter:', currentChapter.id);
          toast.error('保存失败：未找到所属分卷');
          return;
        }

        const res = await updateChapter(id, volumeId, currentChapter.id, {
          title: currentChapter.title,
          content: currentChapter.content
        });
        
        if (res.success) {
          setLastSaved(new Date());
          toast.success("保存成功");
          // Update local novel data to reflect changes in tree if needed
          setNovel(prev => {
            if (!prev) return null;
            const newVolumes = prev.volumes.map(vol => ({
              ...vol,
              chapters: vol.chapters.map(c => 
                c.id === currentChapter.id ? { ...c, title: currentChapter.title, content: currentChapter.content } : c
              )
            }));
            return { ...prev, volumes: newVolumes };
          });
        }
      } catch (error) {
        console.error('Save failed:', error);
      } finally {
        setIsSaving(false);
      }
    } else if (activeTab === 'lore' && (currentLore || actualOverrideData)) {
      const targetLore = actualOverrideData || currentLore;
      setIsSaving(true);
      try {
        let targetId = targetLore._id || targetLore.id;
        let payload: any = targetLore;

        if (targetLore._section && ['world', 'plot', 'narrative'].includes(targetLore.type)) {
          const baseId = targetLore.id || targetId;
          const sectionKey = targetLore._section;
          targetId = baseId;
          
          if (targetLore.type === 'world') {
              // Ensure all 3 key fields are sent for world settings
              payload = {
                  background: (targetLore as any).background,
                  powerSystem: (targetLore as any).powerSystem,
                  forces: (targetLore as any).forces
              };
          } else {
              payload = {
                [sectionKey]: (targetLore as any)[sectionKey]
              };
          }
        }

        // Special handling for Antagonist lore item: enforce type='antagonist'
        // This ensures the backend recognizes it correctly even if it was loaded as 'character'
        let objpar = {}
        if (targetId === 'antagonist' || targetLore.id === 'antagonist' || targetLore.type === 'antagonist') {
            objpar = {
                ...payload,
                type: 'antagonist'
            };
            delete objpar._id;
            delete objpar.id;
        }
        if (targetId === 'protagonist' || targetLore.id === 'protagonist' || targetLore.type === 'protagonist') {
            objpar = {
                ...payload,
                type: 'protagonist'
            };
            delete objpar._id;
            delete objpar.id;
        }
        
        // Generic Character handling
        if (targetLore.type === 'character' && targetId !== 'protagonist' && targetId !== 'antagonist') {
            objpar = {
                ...payload,
                type: 'character'
            };
            if (payload.id === 'protagonist') {
              delete objpar._id;
              delete objpar.id;
            }
            
        }

        if (targetId === 'world') {
          objpar = {
            ...payload,
            type: 'world'
          };
          delete objpar._id;
          delete objpar.id;
        }
        if (payload.title === '主大纲') {
          objpar = {
            content: payload.content,
            id: payload.id,
            type: 'outline'
          };
        }
        if (payload.type === 'outline') {
          objpar = {
            content: payload.content,
            id: payload.id,
            type: 'outline',
            title: payload.title
          };
        }
        if (payload.type === 'location') {
          objpar = {
            ...payload,
          };
        }
        if (payload.type === 'item') {
          objpar = {
            ...payload,
          };
        }
        if (payload.type === 'other') {
          objpar = {
            ...payload,
          };
        }
        if (targetLore.type === "plot") {
          objpar = {
            conflict:targetLore.conflict,
            hooks:targetLore.hooks,
            twists:targetLore.twists,
            type: 'plot'
          }
        }
        if (targetLore.type === "core_settings") {
          objpar = {
            ...targetLore.world,
            type: 'world'
          }
        }

        delete (objpar as any).loreId;

        let res = null
        if (targetLore.type === "narrative") {
          const toneVal = targetLore._section === 'tone'
            ? (targetLore as any).tone
            : ((targetLore as any).tone ?? (targetLore as any).content);
          const pacingVal = targetLore._section === 'pacing'
            ? (targetLore as any).pacing
            : (targetLore as any).pacing;
          const themesVal = (targetLore as any).themes;
          objpar = {
            style: toneVal,
            genre: pacingVal,
            tags: Array.isArray(themesVal)
              ? JSON.stringify(themesVal)
              : (typeof themesVal === 'string' ? themesVal : undefined),
          };
          res = await updateNovel(id,objpar);
          console.log('Update Novel Response:', res);
        } else {
          res = await postLore(id, '1', objpar);
        }

        // 当保存的是主大纲时，将主大纲的分卷摘要同步到小说目录分卷摘要，保持一致
        if (res.success && targetLore.type === 'outline') {
          try {
            const outlineVolumes: Array<{ title?: string; summary?: string }> =
              (targetLore as any).volumes || [];
            const novelVolumes = novel?.volumes || [];
            const count = Math.min(outlineVolumes.length, novelVolumes.length);
            for (let i = 0; i < count; i++) {
              const volSummary = outlineVolumes[i]?.summary || '';
              const nv = novelVolumes[i];
              if (nv && (nv.summary || '') !== volSummary) {
                await updateVolume(id, nv.id, {
                  title: nv.title,
                  summary: volSummary
                });
              }
            }
            // 同步本地状态中的分卷摘要
            setNovel(prev => {
              if (!prev) return null;
              const newVolumes = prev.volumes.map((v, idx) => {
                const ov = outlineVolumes[idx];
                if (ov && (ov.summary || '') !== (v.summary || '')) {
                  return { ...v, summary: ov.summary || '' };
                }
                return v;
              });
              return { ...prev, volumes: newVolumes };
            });
          } catch (e) {
            console.warn('同步主大纲到分卷摘要失败', e);
          }
        }

        // Sync Antagonist data from Core Settings to the 'antagonist' lore item
        if (res.success && targetLore.type === 'core_settings' && (targetLore as any).antagonist) {
          const ant = (targetLore as any).antagonist;
          try {
            // Find existing antagonist lore item ID if possible, otherwise default to 'antagonist'
            const existingAntagonist = (novel?.lore || []).find(l => l.type === 'antagonist' || l.id === 'antagonist');
            const antagonistLid = existingAntagonist ? (existingAntagonist.id || (existingAntagonist as any)._id) : 'antagonist';

            // Use the standard updateLore API (PUT /app-api/api/novels/{pid}/lore/{lid})
            await postLore(id, '1', {
              type: 'antagonist',
              title: ant.name || '反派',
              name: ant.name,
              role: ant.role,
              personality: ant.personality,
              content: ant.personality || ''
            });
          } catch (e) {
            console.warn('Failed to sync antagonist lore:', e);
          }
        }

        // Sync Protagonist data from Core Settings to the 'protagonist' lore item
        if (res.success && targetLore.type === 'core_settings' && (targetLore as any).protagonist) {
          const pro = (targetLore as any).protagonist;
          try {
            const existingProtagonist = (novel?.lore || []).find(l => l.type === 'protagonist' || l.id === 'protagonist');
            const protagonistLid = existingProtagonist ? (existingProtagonist.id || (existingProtagonist as any)._id) : 'protagonist';

            await postLore(id, '1', {
              type: 'protagonist',
              title: pro.name || '主角',
              name: pro.name,
              age: pro.age,
              personality: pro.personality,
              cheat: pro.cheat,
              content: pro.personality || ''
            });
          } catch (e) {
            console.warn('Failed to sync protagonist lore:', e);
          }
        }

        if (res.success) {
          setLastSaved(new Date());
          try {
            const novelRes = await getNovel(id);
            if (novelRes.success && novelRes.data) {
              
              // Sync narrative fields from novel to lore list if this was a narrative update
              // This is necessary because updateNovel updates the novel entity but might not immediately 
              // sync the virtual narrative lore item in the backend response
              if (targetLore.type === 'narrative') {
                const freshLoreList = novelRes.data.lore || [];
                const narrativeLore = freshLoreList.find((l: any) => l.type === 'narrative');
                
                console.log('Syncing narrative lore:', {
                    savedTone: targetLore.tone,
                    savedPacing: targetLore.pacing,
                    remoteStyle: novelRes.data.style,
                    remoteGenre: novelRes.data.genre,
                    targetLoreSection: targetLore._section
                });

                if (narrativeLore) {
                   // Force update from saved data if remote is empty or we just saved it
                   // Using targetLore values ensures we don't revert to old data if backend sync is slow
                   if (targetLore._section === 'tone' && targetLore.tone) {
                       narrativeLore.tone = targetLore.tone;
                       // Also update novel style locally to match
                       novelRes.data.style = targetLore.tone;
                   } else if (novelRes.data.style) {
                       narrativeLore.tone = novelRes.data.style;
                   }

                   if (targetLore._section === 'pacing' && targetLore.pacing) {
                       narrativeLore.pacing = targetLore.pacing;
                       novelRes.data.genre = targetLore.pacing;
                   } else if (novelRes.data.genre) {
                       narrativeLore.pacing = novelRes.data.genre;
                   }

                   // Use the themes we just saved if available, as they might not be in novel details
                   if (targetLore.themes) narrativeLore.themes = targetLore.themes;
                }
              }

              setNovel(novelRes.data);
              const freshLoreList = novelRes.data.lore || [];
              const currentRawId = targetLore._id || targetLore.id;
              const baseId = currentRawId && currentRawId.includes('_')
                ? currentRawId.slice(0, currentRawId.lastIndexOf('_'))
                : currentRawId;
              const freshBase = freshLoreList.find((l: any) => (l.id || (l as any)._id) === baseId);
              if (freshBase) {
                if (targetLore._section && ['world', 'plot', 'narrative'].includes(targetLore.type)) {
                  setCurrentLore({
                    ...(freshBase as any),
                    _section: targetLore._section,
                    _id: targetLore._id || `${baseId}_${targetLore._section}`,
                    title: targetLore.title
                  } as any);
                } else {
                  setCurrentLore(freshBase);
                }
              }
            }
          } catch (e) {
          }
        }
      } catch (error) {
        console.error('Save Lore failed:', error);
      } finally {
        setIsSaving(false);
      }
    } else if (activeTab === 'volume' && currentVolume) {
      setIsSaving(true);
      try {
        const res = await updateVolume(id, currentVolume.id, {
          title: currentVolume.title,
          summary: currentVolume.summary
        });
        
        if (res.success) {
          setLastSaved(new Date());
          // Update local novel data to reflect title changes in tree
          setNovel(prev => {
            if (!prev) return null;
            const newVolumes = prev.volumes.map(vol => 
              vol.id === currentVolume.id ? { ...vol, title: currentVolume.title, summary: currentVolume.summary } : vol
            );
            return { ...prev, volumes: newVolumes };
          });

          // 将分卷摘要同步回主大纲的分卷数组，保持一致
          try {
            const primaryOutline = (novel?.lore || []).find((l: any) => l.type === 'outline' && (l as any).isPrimary);
            if (primaryOutline) {
              const volumesArr: Array<{ title?: string; summary?: string }> = (primaryOutline as any).volumes || [];
              const index = (novel?.volumes || []).findIndex(v => v.id === currentVolume.id);
              if (index >= 0) {
                const nextVolumes = [...volumesArr];
                const old = nextVolumes[index] || {};
                nextVolumes[index] = {
                  title: old.title || (novel?.volumes[index]?.title || ''),
                  summary: currentVolume.summary || ''
                };
                await updateLore(id, (primaryOutline as any).id || (primaryOutline as any)._id, { volumes: nextVolumes });
                // 更新本地大纲对象
                setNovel(prev => {
                  if (!prev) return null;
                  const newLore = (prev.lore || []).map(l => {
                    if (l.type === 'outline' && (l as any).isPrimary) {
                      return { ...l, volumes: nextVolumes };
                    }
                    return l;
                  });
                  return { ...prev, lore: newLore };
                });
              }
            }
          } catch (e) {
            console.warn('同步分卷摘要到主大纲失败', e);
          }
        }
      } catch (error) {
        console.error('Save Volume failed:', error);
      } finally {
        setIsSaving(false);
      }
    }
  }, [id, currentChapter, currentLore, currentVolume, isSaving, activeTab]);

  // Shortcut: Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleStopChat = () => {
    if (chatAbortControllerRef.current) {
        chatAbortControllerRef.current.abort();
        chatAbortControllerRef.current = null;
        setIsLoading(false);
    }
  };

  const startLoreDiffReviewFromPending = (loreId: string, directData?: { original: string; modified: string }) => {
    const pending = directData || pendingLoreDiffs[loreId];
    if (!pending || !id) return;

    // Resolve baseId correctly by checking direct match first
    const allLoreList = novel?.lore || [];
    let baseId = loreId;
    let section: string | undefined = undefined;

    const directMatch = allLoreList.find(l => (l.id || (l as any)._id) === loreId);
    if (directMatch) {
        baseId = loreId;
    } else {
        const lastUnderscore = loreId.lastIndexOf('_');
        if (lastUnderscore > 0) {
            baseId = loreId.slice(0, lastUnderscore);
            section = loreId.slice(lastUnderscore + 1);
        }
    }

    const targetLore = allLoreList.find(l => (l.id || (l as any)._id) === baseId);
    if (targetLore) {
      if (section && ['world','plot','narrative'].includes((targetLore as any).type)) {
        const sectionTitleMap: Record<string, string> = {
          content: '世界观设定',
          background: '世界背景',
          powerSystem: '力量体系',
          forces: '势力分布',
          locations: '空间设置',
          timeline: '时间线',
          conflict: '主线冲突',
        };
        setCurrentLore({ ...targetLore, _section: section, _id: loreId, title: sectionTitleMap[section] || targetLore.title });
      } else {
        setCurrentLore(targetLore);
      }
      setSidebarMode('lore');
    }
    // Inline diff on editor
    setDiffData({
      original: pending.original,
      modified: pending.modified,
      onAccept: async (finalContent: string) => {
        let targetId = loreId;
        const payload: any = {};
        const allLore = novel?.lore || [];
        
        // Check if loreId matches a file directly (e.g. lore_123456)
        // This is crucial because standard lore files have IDs like "lore_timestamp" which contain underscores
        const isDirectFile = allLore.some(l => (l.id || (l as any)._id) === loreId);

        if (isDirectFile) {
            payload.content = finalContent;
            targetId = loreId;
        } else if (loreId.includes('_')) {
          const lastUnderscore = loreId.lastIndexOf('_');
          const section = lastUnderscore > 0 ? loreId.slice(lastUnderscore + 1) : '';
          if (section) {
            payload[section] = finalContent;
          } else {
            payload.content = finalContent;
          }
        } else {
          // Fallback logic
          const targetLore = allLore.find(l => (l.id || (l as any)._id) === loreId);
          if (targetLore && (targetLore as any).id === 'world' && (targetLore as any).type === 'world') {
            payload.background = finalContent;
            targetId = `${loreId}_background`;
          } else {
            payload.content = finalContent;
          }
        }

        const res = await updateLore(id, targetId, payload);
        if (!res.success) {
          alert('应用修改失败: ' + (res.error || '未知错误'));
          return;
        }
        window.dispatchEvent(new Event('novel-data-reload'));
        setPendingLoreDiffs(prev => {
          const next = { ...prev };
          delete next[loreId];
          return next;
        });
        setDiffData(null);
        // Keep selection on target lore after applying
        const refreshed = await getNovel(id);
        if (refreshed.success && refreshed.data) {
          setNovel(refreshed.data);
          const selected = refreshed.data.lore?.find((l: any) => (l.id || l._id) === baseId);
          if (selected) setCurrentLore(selected);
        }
        setSidebarMode('lore');
        setActiveTab('lore');
      },
      onReject: () => {
        setPendingLoreDiffs(prev => {
          const next = { ...prev };
          delete next[loreId];
          return next;
        });
        setDiffData(null);
        // Keep selection on target lore when cancelling
        const target = (novel?.lore || []).find(l => (l.id || (l as any)._id) === baseId);
        if (target) setCurrentLore(target);
        setSidebarMode('lore');
        setActiveTab('lore');
      }
    });
    setActiveTab('diff');
  };

  const applyLoreChanges = (loreId: string, changes: Array<{ field: string; before?: string; after?: string; mode?: 'replace' | 'append' | 'delete' }>) => {
    const allLore = novel?.lore || [];
    const loreItem: any = allLore.find(l => (l.id || (l as any)._id) === loreId);
    if (!loreItem) return;
    const buildContentMarkdown = (data: any) => {
      if (typeof data?.content === 'string' && data.content.length > 0) return data.content;
      if (data?.type === 'character') {
        let md = `# ${data.name || data.title || '未命名角色'}\n\n`;
        if (data.age) md += `- **年龄**：${data.age}\n`;
        if (data.gender) md += `- **性别**：${data.gender}\n`;
        if (data.role) md += `- **身份**：${data.role}\n`;
        md += '\n';
        if (data.personality) md += `## 性格特征\n${data.personality}\n\n`;
        if (data.appearance) md += `## 外貌描写\n${data.appearance}\n\n`;
        if (data.background) md += `## 背景故事\n${data.background}\n\n`;
        if (data.cheat) md += `## 金手指/能力\n${data.cheat}\n\n`;
        Object.keys(data).forEach(key => {
          if (['id','type','title','_section','name','age','gender','role','personality','background','appearance','cheat','content','_id'].includes(key)) return;
          const val = data[key];
          if (typeof val === 'string' && val.length > 0) md += `## ${key}\n${val}\n\n`;
        });
        return md;
      }
      if (data?.type === 'world') {
        const title = data.title || '世界设定';
        const background = data.background || '';
        const powerSystem = data.powerSystem || '';
        const forces = data.forces || '';
        const timeline = Array.isArray(data.timeline) ? data.timeline.join('\n') : (data.timeline || '');
        const locations = Array.isArray(data.locations) ? data.locations.join('\n') : (data.locations || '');
        let md = `# ${title}\n\n`;
        if (background) md += `## 世界背景\n${background}\n\n`;
        if (powerSystem) md += `## 力量体系\n${powerSystem}\n\n`;
        if (forces) md += `## 势力分布\n${forces}\n\n`;
        if (timeline) md += `## 时间线\n${timeline}\n\n`;
        if (locations) md += `## 空间设置\n${locations}\n\n`;
        return md;
      }
      if (data?.type === 'plot') {
        const conflict = data.conflict || '';
        const hooks = Array.isArray(data.hooks) ? data.hooks.join('\n') : (data.hooks || '');
        const twists = Array.isArray(data.twists) ? data.twists.join('\n') : (data.twists || '');
        let md = `# 剧情架构\n\n`;
        if (conflict) md += `## 主线冲突\n${conflict}\n\n`;
        if (hooks) md += `## 钩子\n${hooks}\n\n`;
        if (twists) md += `## 转折\n${twists}\n\n`;
        return md;
      }
      if (data?.type === 'narrative') {
        const tone = data.tone || '';
        const pacing = data.pacing || '';
        const themes = Array.isArray(data.themes) ? data.themes.join('\n') : (data.themes || '');
        let md = `# 叙事策略\n\n`;
        if (tone) md += `## 文风基调\n${tone}\n\n`;
        if (pacing) md += `## 节奏\n${pacing}\n\n`;
        if (themes) md += `## 主题\n${themes}\n\n`;
        return md;
      }
      return data?.content || '';
    };
    // Helper functions

    const levenshtein = (a: string, b: string) => {
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        const ai = a.charCodeAt(i - 1);
        for (let j = 1; j <= n; j++) {
          const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
          const del = dp[i - 1][j] + 1;
          const ins = dp[i][j - 1] + 1;
          const sub = dp[i - 1][j - 1] + cost;
          dp[i][j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
        }
      }
      return dp[m][n];
    };
    const findApprox = (text: string, pattern: string, thr: number = 0.3) => {
      const L = pattern.length;
      if (!L) return { index: -1, length: 0 };
      const exact = text.indexOf(pattern);
      if (exact !== -1) return { index: exact, length: L };
      const anchor = pattern.slice(0, Math.min(12, L));
      let start = 0, end = text.length;
      const pos = text.indexOf(anchor);
      if (pos !== -1) {
        start = Math.max(0, pos - 60);
        end = Math.min(text.length, pos + L + 60);
      }
      let bestScore = Infinity, bestIndex = -1, bestLen = L;
      const searchStart = start, searchEnd = end;
      const lenMin = Math.max(5, Math.floor(L * 0.8));
      const lenMax = Math.min(text.length, Math.floor(L * 1.1));
      const stepOuter = pos !== -1 ? 1 : 10;
      for (let len = lenMin; len <= lenMax; len += 5) {
        for (let i = searchStart; i + len <= searchEnd; i += stepOuter) {
          const frag = text.slice(i, i + len);
          const dist = levenshtein(frag, pattern);
          const norm = dist / Math.max(len, L);
          if (norm < bestScore) {
            bestScore = norm;
            bestIndex = i;
            bestLen = len;
          }
        }
      }
      if (bestIndex === -1) return { index: -1, length: 0 };
      if (bestScore <= thr) return { index: bestIndex, length: bestLen };
      return { index: -1, length: 0 };
    };
    const applyOne = (text: string, change: { before?: string; after?: string; mode?: string }) => {
      const mode = change.mode || 'replace';
      if (mode === 'append') {
        const appendText = (change.after || '').trim();
        return `${text || ''}\n${appendText}`;
      } else if (mode === 'delete') {
        const target = change.before || '';
        if (!target) return text;
        let found = findApprox(text || '', target, 0.4);
        if (found.index === -1) {
          found = findApprox(text || '', target, 0.45);
        }
        if (found.index === -1) return text;
        return (text || '').slice(0, found.index) + (text || '').slice(found.index + found.length);
      } else {
        const after = change.after || '';
        const before = change.before || '';
        if (!before) return text;
        if (after.trim().length === 0) {
          // Treat empty after as delete of the matched fragment
          const foundDel = findApprox(text || '', before, 0.3);
          if (foundDel.index === -1) {
            const base = (text || '').trim();
            return base.length === 0 ? '' : text;
          }
          return (text || '').slice(0, foundDel.index) + (text || '').slice(foundDel.index + foundDel.length);
        }
        const found = findApprox(text || '', before, 0.3);
        if (found.index === -1) {
          // Fallback: if原文本为空或几乎为空，且提供了after，则直接写入after
          const base = (text || '').trim();
          if (base.length === 0 && after.trim().length > 0) {
            return after;
          }
          return text;
        }
        return (text || '').slice(0, found.index) + after + (text || '').slice(found.index + found.length);
      }
    };
    const type = (loreItem as any).type;
    
    // Split logic for World/Plot/Narrative
    if (['world', 'plot', 'narrative'].includes(type)) {
      const changesBySection: Record<string, typeof changes> = {};
      changes.forEach(c => {
        const f = (c.field || '').trim();
        let section = 'content'; // Default fallback
        if (type === 'world') {
           if (['content', 'background', 'powerSystem', 'forces', 'locations', 'timeline'].includes(f)) section = f;
        } else if (type === 'plot') {
           if (['conflict', 'hooks', 'twists'].includes(f)) section = f;
           else section = 'conflict';
        } else if (type === 'narrative') {
           if (['tone', 'pacing', 'themes'].includes(f)) section = f;
           else section = 'tone';
        }
        if (!changesBySection[section]) changesBySection[section] = [];
        changesBySection[section].push(c);
      });

      let firstPendingId = '';
      let firstOriginal = '';
      let firstModified = '';
      let hasChange = false;

      Object.entries(changesBySection).forEach(([section, sectionChanges]) => {
        const sectionVal = (loreItem as any)[section];
        let original = '';
        if (typeof sectionVal === 'string') {
          original = sectionVal;
        } else if (sectionVal != null) {
          original = JSON.stringify(sectionVal, null, 2);
        }
        let modified = original;
        sectionChanges.forEach(ch => {
          modified = applyOne(modified, ch);
        });

        if (modified !== original) {
          hasChange = true;
          const pId = `${loreId}_${section}`;
          setPendingLoreDiffs(prev => ({ ...prev, [pId]: { original, modified } }));
          if (!firstPendingId) {
            firstPendingId = pId;
            firstOriginal = original;
            firstModified = modified;
          }
        }
      });

      if (firstPendingId) {
        startLoreDiffReviewFromPending(firstPendingId, { original: firstOriginal, modified: firstModified });
      } else if (!hasChange) {
         const hasDelete = changes.some(c => (c.mode || 'replace') === 'delete');
         alert(hasDelete ? '未能精准定位需要删除的片段，请在当前条目中手动删除该段或放宽建议片段匹配。' : '未能定位替换片段，请手动调整或开启智能追加回退。');
         setCurrentLore(loreItem);
         setSidebarMode('lore');
         setActiveTab('lore');
      }
      return;
    }

    let original = '';
    let modified = '';
    let pendingId = loreId;
    
    original = buildContentMarkdown(loreItem) || '';
    modified = original;
    changes.forEach(ch => {
      modified = applyOne(modified, ch);
    });

    if (modified !== original) {
      setPendingLoreDiffs(prev => ({ ...prev, [pendingId]: { original, modified } }));
      startLoreDiffReviewFromPending(pendingId, { original, modified });
    } else {
      const hasDelete = changes.some(c => (c.mode || 'replace') === 'delete');
      alert(hasDelete ? '未能精准定位需要删除的片段，请在当前条目中手动删除该段或放宽建议片段匹配。' : '未能定位替换片段，请手动调整或开启智能追加回退。');
      
      // Navigate to the item anyway so user can manually edit
      setCurrentLore(loreItem);
      setSidebarMode('lore');
      setActiveTab('lore');
    }
  };





  const handleExecuteAction = async (msgId: string, intent: AiCommandIntent) => {
    const novelId = novel?.id;
    if (!novelId) return;

    // Tolerance for unknown/complex commands
    const effectiveAction = intent.action === 'unknown' ? 'rewrite_content' : intent.action;
    const effectiveScopeType = (intent.action === 'unknown' && (!intent.scope.type || intent.scope.type as string === 'unknown'))
        ? (activeTab === 'lore' ? 'lore' : 'chapter')
        : intent.scope.type;

    setMessages(prev => prev.map(m => 
      m.id === msgId && m.actionData 
        ? { ...m, actionData: { ...m.actionData!, status: 'executing' } } 
        : m
    ));
    try {
      if (effectiveAction === 'modify_metadata') {
        if (effectiveScopeType === 'chapter') {
          const targetIds = (intent.scope.ids && intent.scope.ids.length > 0)
            ? intent.scope.ids
            : (Array.isArray(novel?.volumes)
                ? novel.volumes.flatMap((v: any) => (v.chapters || []).map((c: any) => c.id))
                : []);
          const newTitle = intent.params?.new_title;
          if (!newTitle) throw new Error('缺少参数：new_title');
          if (targetIds.length !== 1) throw new Error('当前版本仅支持单章节标题修改');
          const chapterId = targetIds[0];
          const res = await updateChapter(novelId, chapterId, { title: newTitle });
          if (!res.success) throw new Error(res.error || '更新失败');
          setMessages(prev => prev.map(m => 
            m.id === msgId && m.actionData 
              ? { ...m, actionData: { ...m.actionData!, status: 'success' } } 
              : m
          ));
          window.dispatchEvent(new Event('novel-data-reload'));
          return;
        }

        if (effectiveScopeType === 'lore') {
          const targetIds = (intent.scope.ids && intent.scope.ids.length > 0)
            ? intent.scope.ids
            : [];
          if (targetIds.length !== 1) {
            throw new Error('当前版本仅支持单条设定属性修改');
          }
          const loreId = targetIds[0];
          const newTitle = intent.params?.new_title;
          const newSummary = intent.params?.new_summary ?? intent.params?.summary;
          if (!newTitle && !newSummary) {
            throw new Error('缺少可更新的属性（例如 new_title 或 summary）');
          }
          const payload: any = {};
          if (newTitle) {
            payload.title = newTitle;
            payload.name = newTitle;
          }
          if (newSummary) {
            payload.summary = newSummary;
          }
          const res = await updateLore(novelId, loreId, payload);
          if (!res.success) {
            throw new Error(res.error || '更新失败');
          }
          setMessages(prev =>
            prev.map(m =>
              m.id === msgId && m.actionData
                ? { ...m, actionData: { ...m.actionData!, status: 'success' } }
                : m
            )
          );
          window.dispatchEvent(new Event('novel-data-reload'));
          return;
        }
      }
      if (effectiveAction === 'rewrite_content' && effectiveScopeType === 'chapter') {
        const targetIds = (intent.scope.ids && intent.scope.ids.length > 0)
          ? intent.scope.ids
          : (currentChapter?.id ? [currentChapter.id] : []);
        if (targetIds.length !== 1) throw new Error('当前版本仅支持单章节内容优化');
        const chapterId = targetIds[0];
        let chapterObj: Chapter | undefined;
        for (const v of novel?.volumes || []) {
          const found = v.chapters.find(c => c.id === chapterId);
          if (found) {
            chapterObj = found;
            break;
          }
        }
        if (!chapterObj) throw new Error('未找到目标章节');
        const baseText = chapterObj.content || '';
        const ctxParts: string[] = [];
        ctxParts.push(`章节:${chapterObj.title || ''}`);
        const vol = (novel?.volumes || []).find(v => v.chapters.some(c => c.id === chapterId));
        if (vol?.summary) ctxParts.push(`卷概述:${vol.summary}`);
        
        // Add previous/next chapter context for continuity
        const allChapters = novel?.volumes.flatMap((v: any) => v.chapters) || [];
        const currentIndex = allChapters.findIndex((c: any) => c.id === chapterId);
        if (currentIndex > 0) {
            const prevChapter = allChapters[currentIndex - 1];
            const prevContent = prevChapter.content || '';
            const prevSnippet = prevContent.slice(-500); // Increased context
            if (prevSnippet) ctxParts.push(`上一章结尾:${prevSnippet}`);
        }
        if (currentIndex < allChapters.length - 1) {
            const nextChapter = allChapters[currentIndex + 1];
            const nextContent = nextChapter.content || '';
            const nextSnippet = nextContent.slice(0, 500); // Increased context
            if (nextSnippet) ctxParts.push(`下一章开头:${nextSnippet}`);
        }

        const context = ctxParts.join('\n');
        const baseInstruction = intent.instruction || '';
        const guardedInstruction = `${baseInstruction}\n\n严格要求：你只能根据上述修改建议调整与这些建议直接相关的内容片段；与这些建议无关的句子和段落必须逐字保持不变，禁止做其他润色或改写。`;
        const refineRes = await refineText({ text: baseText, context, instruction: guardedInstruction });
        if (!refineRes.success || !refineRes.data) throw new Error(refineRes.error || '优化失败');

        // Instead of immediate update, setup Diff
        setDiffData({
            original: baseText,
            modified: refineRes.data,
            onAccept: async (finalContent: string) => {
                await updateChapter(novelId, chapterId, { content: finalContent });
                window.dispatchEvent(new Event('novel-data-reload'));
                setDiffData(null);
                setActiveTab('editor');
            },
            onReject: () => {
                setDiffData(null);
                setActiveTab('editor');
            }
        });
        setActiveTab('diff');

        setMessages(prev => prev.map(m => 
          m.id === msgId && m.actionData 
            ? { ...m, actionData: { ...m.actionData!, status: 'success' } } 
            : m
        ));
        return;
      }
      if (effectiveAction === 'create_lore' && effectiveScopeType === 'lore') {
        const params = intent.params || {};
        let loreType = 'character';
        if (typeof params.type === 'string') {
          loreType = params.type;
        } else if (typeof params.lore_type === 'string') {
          loreType = params.lore_type;
        }
        
        let titles: string[] = [];
        if (Array.isArray(params.names)) {
            titles = params.names;
        } else if (Array.isArray(params.titles)) {
            titles = params.titles;
        } else if (typeof params.title === 'string' && params.title.trim()) {
            titles = [params.title.trim()];
        } else if (typeof params.name === 'string' && params.name.trim()) {
            titles = [params.name.trim()];
        } else {
            const firstLine = intent.instruction.split('\n')[0].trim();
            titles = [firstLine.slice(0, 50) || '未命名设定'];
        }

        const content =
          typeof params.content === 'string' && params.content.trim()
            ? params.content
            : intent.instruction;

        let itemsPayload: { title: string; content: string }[] = titles.map(t => ({
          title: t,
          content
        }));

        if (loreType === 'item' && titles.length > 0) {
          try {
            const namesList = titles.map((t, index) => `${index + 1}. ${t}`).join('\n');
            const systemPrompt = `你是一位小说物品与道具设计专家。根据给定的物品名称列表和通用说明，为每个物品生成独立的详细描述。只输出 JSON 数组，每个元素包含：title, content。title 为物品名称，content 为该物品的完整描述。不要输出任何多余文字或 Markdown 代码块。当前物品名称列表：\n${namesList}\n\n通用说明：\n${content || '无'}`;
            const aiRes = await chatWithAI(systemPrompt, novelId);
            if (aiRes.success && aiRes.data) {
              let parsed: any;
              try {
                const raw = aiRes.data.replace(/```json/g, '').replace(/```/g, '').trim();
                const firstBracket = raw.indexOf('[');
                const lastBracket = raw.lastIndexOf(']');
                if (firstBracket !== -1 && lastBracket !== -1) {
                  const arrayStr = raw.substring(firstBracket, lastBracket + 1);
                  parsed = JSON.parse(arrayStr);
                } else {
                  parsed = JSON.parse(raw);
                }
              } catch (e) {
                parsed = null;
              }
              if (parsed) {
                if (!Array.isArray(parsed)) {
                  parsed = [parsed];
                }
                const map = new Map<string, string>();
                for (const it of parsed) {
                  const t = (it && (it.title || it.name)) ? String(it.title || it.name).trim() : '';
                  const c = it && (it.content || it.description) ? String(it.content || it.description) : '';
                  if (t && c) {
                    map.set(t, c);
                  }
                }
                itemsPayload = titles.map((t, index) => {
                  const direct = map.get(t);
                  if (direct) {
                    return { title: t, content: direct };
                  }
                  for (const [key, value] of map.entries()) {
                    if (key.includes(t) || t.includes(key)) {
                      return { title: t, content: value };
                    }
                  }
                  return { title: t, content };
                });
              }
            }
          } catch (e) {
            console.error('AI Item Description Error:', e);
          }
        }

        let successCount = 0;
        const createdItems: any[] = [];

        for (const item of itemsPayload) {
            const title = item.title;
            try {
                const createRes = await createLore(novelId, title, loreType);
                if (!createRes.success || !createRes.data || !createRes.data.id) {
                  console.error(`创建设定 ${title} 失败:`, createRes.error);
                  continue;
                }

                const updatePayload: any = {
                  title,
                  type: loreType,
                  content: item.content
                };
                if (loreType === 'character') {
                  updatePayload.name = title;
                }
                const updateRes = await updateLore(novelId, createRes.data.id, updatePayload);
                if (!updateRes.success) {
                  console.warn(`更新设定 ${title} 内容失败:`, updateRes.error);
                }
                
                // Construct the full item object for local state update
                createdItems.push({ 
                    ...createRes.data, 
                    ...updatePayload,
                    // Ensure ID fields are present for list rendering
                    id: createRes.data.id,
                    _id: createRes.data.id 
                });
                successCount++;
            } catch (e) {
                console.error(`处理设定 ${title} 时出错:`, e);
            }
        }

        if (successCount === 0) {
          throw new Error('创建设定失败');
        }

        // Optimistically update local state to ensure UI updates immediately
        setNovel(prev => {
            if (!prev) return null;
            return {
                ...prev,
                lore: [...(prev.lore || []), ...createdItems]
            };
        });

        window.dispatchEvent(new Event('novel-data-reload'));

        setMessages(prev =>
          prev.map(m =>
            m.id === msgId && m.actionData
              ? { ...m, actionData: { ...m.actionData!, status: 'success', error: successCount < titles.length ? `部分创建成功 (${successCount}/${titles.length})` : undefined } }
              : m
          )
        );
        return;
      }
      if (effectiveAction === 'rewrite_content' && effectiveScopeType === 'lore') {
        const targetIds = (intent.scope.ids && intent.scope.ids.length > 0)
          ? intent.scope.ids
          : (activeTab === 'lore' && currentLore ? [currentLore._id || currentLore.id] : []);
        if (targetIds.length === 0) throw new Error('未找到目标设定');

        if (targetIds.length === 1) {
          let loreId = targetIds[0];
          const allLore = novel?.lore || [];
          let loreItem: any = allLore.find(l => (l.id || (l as any)._id) === loreId);
          let section: string | undefined;

          if (!loreItem && loreId.includes('_')) {
            const parts = loreId.split('_');
            const realId = parts[0];
            section = parts[1];
            loreItem = allLore.find(l => (l.id || (l as any)._id) === realId);
          }

          if (!loreItem && loreId === 'world') {
            loreItem = allLore.find(l => (l.id || (l as any)._id) === 'world');
            if (loreItem && (loreItem as any).type === 'world') {
              section = 'background';
              loreId = 'world_background';
            }
          }

          if (loreItem && (loreItem as any).type === 'plot' && !section) {
            const rawInstr = intent.instruction || '';
            const lowerInstr = rawInstr.toLowerCase();
            if (/主线冲突|冲突|对立|博弈/.test(rawInstr) || lowerInstr.includes('conflict')) {
              section = 'conflict';
              loreId = `${(loreItem.id || (loreItem as any)._id)}_conflict`;
            } else if (/总纲|大纲|全书|结构/.test(rawInstr) || lowerInstr.includes('outline')) {
              section = 'outline';
              loreId = `${(loreItem.id || (loreItem as any)._id)}_outline`;
            }
          }

          if (!loreItem) throw new Error('未找到目标设定');

          let baseText = '';
          if (section) {
            const sectionVal = (loreItem as any)[section];
            if (typeof sectionVal === 'string') {
              baseText = sectionVal;
            } else {
              baseText = JSON.stringify(sectionVal ?? '', null, 2);
            }
          } else {
            baseText =
              (loreItem as any).content ||
              (loreItem as any).summary ||
              (loreItem as any).description ||
              '';
          }

          const ctxParts: string[] = [];
          ctxParts.push(`设定:${(loreItem as any).title || (loreItem as any).name || ''}`);
          if ((loreItem as any).type) ctxParts.push(`类型:${(loreItem as any).type}`);
          const context = ctxParts.join('\n');
          const baseInstruction = intent.instruction || '';
          const editPlan =
            intent.params && typeof intent.params.edit_plan === 'string'
              ? intent.params.edit_plan
              : '';
          const mergedInstruction = editPlan
            ? `${editPlan}\n\n${baseInstruction}`
            : baseInstruction;

          const lowerInstr = (mergedInstruction || '').toLowerCase();
          const isDeleteIntent =
            /删除/.test(mergedInstruction) ||
            lowerInstr.includes('delete') ||
            lowerInstr.includes('remove');

          if (isDeleteIntent) {
            const delRes = await deleteLore(novelId, loreId);
            if (!delRes.success) {
              throw new Error(delRes.error || '删除设定失败');
            }
            window.dispatchEvent(new Event('novel-data-reload'));
            setMessages(prev =>
              prev.map(m =>
                m.id === msgId && m.actionData
                  ? { ...m, actionData: { ...m.actionData!, status: 'success' } }
                  : m
              )
            );
            return;
          }

          const guardedInstruction = `${mergedInstruction}\n\n严格要求：你只能根据上述修改建议调整与这些建议直接相关的内容片段；与这些建议无关的句子和段落必须逐字保持不变，禁止做其他润色或改写。`;
          const refineRes = await refineText({ text: baseText, context, instruction: guardedInstruction });
          if (!refineRes.success || !refineRes.data) throw new Error(refineRes.error || '优化失败');

          const newDiff = {
            original: baseText,
            modified: refineRes.data
          };
          setPendingLoreDiffs(prev => ({
            ...prev,
            [loreId]: newDiff
          }));

          startLoreDiffReviewFromPending(loreId, newDiff);

          setMessages(prev => prev.map(m => 
            m.id === msgId && m.actionData 
              ? { ...m, actionData: { ...m.actionData!, status: 'success' } } 
              : m
          ));
          return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const originalLoreId of targetIds) {
          let loreId = originalLoreId;
          const allLore = novel?.lore || [];
          let loreItem: any = allLore.find(l => (l.id || (l as any)._id) === loreId);
          let section: string | undefined;

          if (!loreItem && loreId.includes('_')) {
            const parts = loreId.split('_');
            const realId = parts[0];
            section = parts[1];
            loreItem = allLore.find(l => (l.id || (l as any)._id) === realId);
          }

          if (loreItem && (loreItem as any).type === 'world' && !section) {
             const instr = (intent.instruction || '').toLowerCase();
             if (instr.includes('时间线') || instr.includes('年表') || instr.includes('大事记')) {
               section = 'timeline';
               loreId = `${(loreItem.id || (loreItem as any)._id)}_timeline`;
             } else if (instr.includes('势力') || instr.includes('阵营') || instr.includes('组织')) {
               section = 'forces';
               loreId = `${(loreItem.id || (loreItem as any)._id)}_forces`;
             } else if (instr.includes('力量') || instr.includes('体系') || instr.includes('等级') || instr.includes('修炼')) {
               section = 'powerSystem';
               loreId = `${(loreItem.id || (loreItem as any)._id)}_powerSystem`;
             } else if (instr.includes('地点') || instr.includes('地理') || instr.includes('地图')) {
                section = 'locations';
                loreId = `${(loreItem.id || (loreItem as any)._id)}_locations`;
             } else {
               section = 'background';
               loreId = `${(loreItem.id || (loreItem as any)._id)}_background`;
             }
          }

          if (loreItem && (loreItem as any).type === 'plot' && !section) {
            const rawInstr = intent.instruction || '';
            const lowerInstr = rawInstr.toLowerCase();
            if (/主线冲突|冲突|对立|博弈/.test(rawInstr) || lowerInstr.includes('conflict')) {
              section = 'conflict';
              loreId = `${(loreItem.id || (loreItem as any)._id)}_conflict`;
            } else if (/总纲|大纲|全书|结构/.test(rawInstr) || lowerInstr.includes('outline')) {
              section = 'outline';
              loreId = `${(loreItem.id || (loreItem as any)._id)}_outline`;
            }
          }

          if (loreItem && (loreItem as any).type === 'narrative' && !section) {
             const rawInstr = intent.instruction || '';
             const lowerInstr = rawInstr.toLowerCase();
             if (/文风|基调|风格|tone|style/.test(rawInstr) || lowerInstr.includes('tone')) {
               section = 'tone';
               loreId = `${(loreItem.id || (loreItem as any)._id)}_tone`;
             }
          }

          if (!loreItem) {
            failCount++;
            continue;
          }

          let baseText = '';
          if (section) {
            const sectionVal = (loreItem as any)[section];
            if (typeof sectionVal === 'string') {
              baseText = sectionVal;
            } else {
              baseText = JSON.stringify(sectionVal ?? '', null, 2);
            }
          } else {
            baseText =
              (loreItem as any).content ||
              (loreItem as any).summary ||
              (loreItem as any).description ||
              '';
          }

          const ctxParts: string[] = [];
          ctxParts.push(`设定:${(loreItem as any).title || (loreItem as any).name || ''}`);
          if ((loreItem as any).type) ctxParts.push(`类型:${(loreItem as any).type}`);
          const context = ctxParts.join('\n');
          const baseInstruction = intent.instruction || '';
          const guardedInstruction = `${baseInstruction}\n\n严格要求：你只能根据上述修改建议调整与这些建议直接相关的内容片段；与这些建议无关的句子和段落必须逐字保持不变，禁止做其他润色或改写。`;
          const refineRes = await refineText({ text: baseText, context, instruction: guardedInstruction });
          if (!refineRes.success || !refineRes.data) {
            failCount++;
            continue;
          }
          setPendingLoreDiffs(prev => ({
            ...prev,
            [loreId]: {
              original: baseText,
              modified: refineRes.data
            }
          }));
          successCount++;
        }

        if (successCount === 0) {
          throw new Error('设定优化失败，请检查指令或内容');
        }

        setMessages(prev => prev.map(m => 
          m.id === msgId && m.actionData 
            ? { 
                ...m, 
                actionData: { 
                  ...m.actionData!, 
                  status: failCount > 0 ? 'error' : 'success', 
                  error: failCount > 0 ? `部分设定优化失败（成功 ${successCount} 条，失败 ${failCount} 条）` : undefined 
                } 
              } 
            : m
        ));
        return;
      }
      throw new Error('不支持的指令或作用对象');
    } catch (e: any) {
      setMessages(prev => prev.map(m => 
        m.id === msgId && m.actionData 
          ? { ...m, actionData: { ...m.actionData!, status: 'error', error: e.message || '执行失败' } } 
          : m
      ));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    const userMsgId = Date.now().toString();
    setInput('');
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: userMsg }]);
    setIsLoading(true);

    // Construct simplified history for command context
    const recentHistory = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    if (isCommandMode) {
      try {
        const intent = await parseAiCommand(userMsg, novel, recentHistory);
        const confirmMsg: Message = {
          id: Date.now().toString() + '_cmd',
          role: 'assistant',
          content: '',
          type: 'action_confirm',
          actionData: {
            intent,
            status: 'pending'
          }
        };
        setMessages(prev => [...prev, confirmMsg]);
      } catch (e: any) {
        setMessages(prev => [...prev, { 
          id: Date.now().toString() + '_err', 
          role: 'assistant', 
          content: `指令解析失败: ${e.message}` 
        }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    const prevMessages = [...messages];
    const historyToSend = prevMessages.slice(-historyRounds * 2).map(m => ({ role: m.role, content: m.content }));
    const olderMessages = prevMessages.slice(0, Math.max(0, prevMessages.length - historyRounds * 2));
    let historyToSendFull = historyToSend;
    if ((enableSummarize || summarizeMode !== 'none') && olderMessages.length > 0) {
      let perMsg = 120;
      let maxTotal = 800;
      let titleText = '对话摘要：';
      if (summarizeMode === 'simple') {
        perMsg = 80;
        maxTotal = 600;
        titleText = '摘要：';
      } else if (summarizeMode === 'detailed') {
        perMsg = 160;
        maxTotal = 1200;
        titleText = '详细摘要：';
      } else if (summarizeMode === 'auto') {
        if (historyRounds > 10) {
          perMsg = 60;
          maxTotal = 500;
          titleText = '摘要：';
        } else {
          perMsg = 120;
          maxTotal = 900;
          titleText = '摘要：';
        }
      }
      const parts: string[] = [];
      for (const m of olderMessages) {
        const head = `${m.role === 'user' ? '用户' : '助手'}: `;
        const txt = (m.content || '').replace(/\s+/g, ' ').slice(0, perMsg);
        parts.push(head + txt);
        if (parts.join('\n').length >= maxTotal) break;
      }
      const summaryText = parts.join('\n');
      const summaryMsg = { role: 'assistant' as const, content: `${titleText}\n${summaryText}` };
      historyToSendFull = [summaryMsg, ...historyToSend];
    }

    // Wrap reference processing in try-catch to avoid blocking send
    let apiReferences: ReferenceItem[] = [];
    try {
        // Filter effective references: selected + free-typed mentions matching available references
        const typedRefs = (novelReferences || []).filter(ref => userMsg.includes(`@${ref.label}`));
        const activeReferences = [...selectedReferences, ...typedRefs].filter(ref => 
            userMsg.includes(`@${ref.label}`)
        );
        // Remove duplicates based on ID
        const uniqueReferences = Array.from(new Map(activeReferences.map(item => [item.id, item])).values());
        
        apiReferences = uniqueReferences.map(ref => {
            let content = '';
            if (ref.type === 'chapter') {
                content = (ref.data as Chapter).content || '';
            } else {
                content = (ref.data as any).content || JSON.stringify(ref.data);
            }
            return {
                type: ref.type,
                title: ref.label,
                content: content
            };
        });
    } catch (err) {
        console.error('Reference processing error:', err);
        // Continue without references
    }

    
    // Create new abort controller
    chatAbortControllerRef.current = new AbortController();

    try {
      const context = {
        currentChapter: currentChapter ? {
          title: currentChapter.title,
          content: currentChapter.content
        } : undefined,
        references: apiReferences
      };
      const allMentionRefs = [...selectedReferences, ...(novelReferences || [])].filter(ref => userMsg.includes(`@${ref.label}`));
      const apiReferencedSettings = Array.from(new Map(
        allMentionRefs.map(item => [item.id, item])
      ).values()).map(ref => ({
        id: ref.id,
        type: ref.type,
        name: ref.label
      }));

      // Add placeholder for assistant message
      setMessages(prev => [...prev, { id: Date.now().toString() + '_ai', role: 'assistant', content: '' }]);
      let currentResponse = '';

      await chatWithAIStream(
          (() => {
            const m = new Map<string, string>();
            for (const r of apiReferences) m.set(r.title, r.content || '');
            let pm = userMsg;
            for (const [t, c] of m.entries()) {
              const needle = `@${t}`;
              if (pm.includes(needle)) pm = pm.replaceAll(needle, c);
            }
            return pm;
          })(),
          (chunk) => {
              currentResponse += chunk;
              setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { ...newMessages[newMessages.length - 1], content: currentResponse };
                  return newMessages;
              });
          },
          () => {
              // Done
              setIsLoading(false);
              chatAbortControllerRef.current = null;
          },
          (err) => {
              setMessages(prev => {
                  const newMessages = [...prev];
                  const last = newMessages[newMessages.length - 1];
                  newMessages[newMessages.length - 1] = { ...last, content: currentResponse + '\n\n[出错: ' + err + ']' };
                  return newMessages;
              });
              setIsLoading(false);
              chatAbortControllerRef.current = null;
          },
          chatAbortControllerRef.current.signal,
          novel?.id,
          context,
          historyToSendFull,
          apiReferencedSettings
      );
      
      setSelectedReferences([]); // Clear references
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString() + '_err', role: 'assistant', content: '网络请求失败，请检查后台服务。' }]);
      setIsLoading(false);
    }
  };
  
  const handleRegenerate = async (index: number) => {
    if (isLoading) return;
    const target = messages[index];
    // Find the nearest previous user message as prompt
    let userIdx = -1;
    for (let j = index - 1; j >= 0; j--) {
      if (messages[j].role === 'user') {
        userIdx = j;
        break;
      }
    }
    if (userIdx === -1) return;
    const userMsg = messages[userIdx].content || '';
    setIsLoading(true);
    // Reset target content/action to loading state
    setMessages(prev => {
      const next = [...prev];
      if (next[index].type === 'action_confirm') {
        next[index] = { ...next[index], actionData: { ...(next[index].actionData || { intent: null }), status: 'pending', error: undefined } };
      } else {
        next[index] = { ...next[index], content: '' };
      }
      return next;
    });
    try {
      const prevMessages = messages.slice(0, index); // history before this assistant
      const historyToSend = prevMessages.slice(-historyRounds * 2).map(m => ({ role: m.role, content: m.content }));
      const olderMessages = prevMessages.slice(0, Math.max(0, prevMessages.length - historyRounds * 2));
      let historyToSendFull = historyToSend;
      if ((enableSummarize || summarizeMode !== 'none') && olderMessages.length > 0) {
        let perMsg = 120;
        let maxTotal = 800;
        let titleText = '对话摘要：';
        if (summarizeMode === 'simple') {
          perMsg = 80;
          maxTotal = 600;
          titleText = '摘要：';
        } else if (summarizeMode === 'detailed') {
          perMsg = 160;
          maxTotal = 1200;
          titleText = '详细摘要：';
        } else if (summarizeMode === 'auto') {
          if (historyRounds > 10) {
            perMsg = 60;
            maxTotal = 500;
            titleText = '摘要：';
          } else {
            perMsg = 120;
            maxTotal = 900;
            titleText = '摘要：';
          }
        }
        const parts: string[] = [];
        for (const m of olderMessages) {
          const head = `${m.role === 'user' ? '用户' : '助手'}: `;
          const txt = (m.content || '').replace(/\s+/g, ' ').slice(0, perMsg);
          parts.push(head + txt);
          if (parts.join('\n').length >= maxTotal) break;
        }
        const summaryText = parts.join('\n');
        const summaryMsg = { role: 'assistant' as const, content: `${titleText}\n${summaryText}` };
        historyToSendFull = [summaryMsg, ...historyToSend];
      }
      
      if (target.type === 'action_confirm') {
        const intent = await parseAiCommand(userMsg, novel, prevMessages);
        setMessages(prev => {
          const next = [...prev];
          if (next[index].type === 'action_confirm') {
            next[index] = { ...next[index], actionData: { intent, status: 'success', error: undefined } };
          }
          return next;
        });
        setIsLoading(false);
        return;
      }
      
      chatAbortControllerRef.current = new AbortController();
      let currentResponse = '';
      const typedRefs2 = (novelReferences || []).filter(ref => userMsg.includes(`@${ref.label}`));
      const apiReferencedSettings2 = Array.from(new Map(
        [...selectedReferences, ...typedRefs2].map(item => [item.id, item])
      ).values()).map(ref => ({
        id: ref.id,
        type: ref.type,
        name: ref.label
      }));
      await chatWithAIStream(
        (() => {
          const m = new Map<string, string>();
          for (const r of [...selectedReferences, ...typedRefs2]) {
            let c = '';
            if (r.type === 'chapter') {
              c = (r.data as Chapter).content || '';
            } else {
              c = (r.data as any).content || JSON.stringify(r.data);
            }
            m.set(r.label, c || '');
          }
          let pm = userMsg;
          for (const [t, c] of m.entries()) {
            const needle = `@${t}`;
            if (pm.includes(needle)) pm = pm.replaceAll(needle, c);
          }
          return pm;
        })(),
        (chunk) => {
          currentResponse += chunk;
          setMessages(prev => {
            const next = [...prev];
            next[index] = { ...next[index], content: currentResponse };
            return next;
          });
        },
        () => {
          setIsLoading(false);
          chatAbortControllerRef.current = null;
        },
        (err) => {
          setMessages(prev => {
            const next = [...prev];
            next[index] = { ...next[index], content: currentResponse + '\n\n[出错: ' + err + ']' };
            return next;
          });
          setIsLoading(false);
          chatAbortControllerRef.current = null;
        },
        chatAbortControllerRef.current.signal,
        novel?.id,
        {
          currentChapter: currentChapter ? { title: currentChapter.title, content: currentChapter.content } : undefined,
          references: (() => {
            const arr: ReferenceItem[] = [];
            const uniq = Array.from(new Map([...selectedReferences, ...typedRefs2].map(item => [item.id, item])).values());
            for (const r of uniq) {
              let c = '';
              if (r.type === 'chapter') {
                c = (r.data as Chapter).content || '';
              } else {
                c = (r.data as any).content || JSON.stringify(r.data);
              }
              arr.push({ type: r.type, title: r.label, content: c });
            }
            return arr;
          })()
        },
        historyToSendFull,
        apiReferencedSettings2
      );
    } catch (e) {
      setMessages(prev => {
        const next = [...prev];
        next[index] = { ...next[index], content: (next[index].content || '') + '\n\n[网络请求失败]' };
        return next;
      });
      setIsLoading(false);
    }
  };

  const handleAiWriterSubmit = async () => {
    if (!currentChapter || !novel) return;
    setIsAiWriting(true);
    abortControllerRef.current = new AbortController();

    try {
      // 1. Find Previous Chapter
      let previousChapter = undefined;
      let found = false;
      // Flatten chapters to find previous
      const allChapters: Chapter[] = [];
      novel.volumes.forEach(v => allChapters.push(...v.chapters));
      
      for (let i = 0; i < allChapters.length; i++) {
        if (allChapters[i].id === currentChapter.id) {
           if (i > 0) previousChapter = allChapters[i - 1];
           break;
        }
      }
      if (previousChapter && typeof previousChapter.content === 'string') {
        const c = previousChapter.content;
        const tail = c.length > 500 ? c.slice(-500) : c;
        previousChapter = { ...previousChapter, content: tail };
      }

      // 2. Prepare Context
      // Global Lore Summary
      const globalLore = (novel.lore || [])
        .filter(l => {
          if (l.type === 'character') {
            const cid = String(l._id || l.id || '');
            const ids = (currentChapter.characterIds || []).map(x => String(x));
            return ids.includes(cid);
          }
          if (l.type === 'narrative') {
            return true;
          }
          return false;
        })
        .map(l => {
          if (l.content) {
             const typeStr = LORE_CATEGORIES.find(c => c.id === l.type)?.title || l.type || '设定';
             return `【${typeStr}】${l.title}: ${l.content.slice(0, 300).replace(/\n/g, ' ')}`;
          }

          let content = '';
          if (l.type === 'character') {
             content = `角色:${l.name || l.title}, ${l.role || ''}, ${l.personality || ''}`;
          } else if (l.type === 'narrative') {
             const tone = (l as any).tone || '';
             const pacing = (l as any).pacing || '';
             const themes = Array.isArray((l as any).themes) ? (l as any).themes.join('、') : ((l as any).themes || '');
             content = `叙事文风基调:${tone} 节奏:${pacing} 主题:${themes}`;
          } else {
             content = l.summary || l.description || '';
          }
          return content;
      }).join('\n') || '';

      const currentVol = novel.volumes.find(v => v.chapters.some(c => c.id === currentChapter.id));
      const volumeSummary = currentVol?.summary;

      const activeCharacters = currentChapter.characterIds?.map(id => {
          return novel.lore.find(l => (l._id || l.id) === id);
      }).filter(Boolean) || [];

      const pendingForeshadowing = novel.foreshadowing?.filter(f => f.status === 'pending') || [];

      let milestoneContext: {
        title: string;
        summary?: string;
        current: number;
        total: number;
        isLast: boolean;
      } | undefined = undefined;

      if (currentVol && Array.isArray(currentVol.milestones) && currentVol.milestones.length > 0) {
        const chapterIndex = currentVol.chapters.findIndex(c => c.id === currentChapter.id);
        if (chapterIndex !== -1) {
          const milestonesWithIndex = currentVol.milestones
            .map(m => {
              const startIdx = currentVol.chapters.findIndex(c => c.id === m.chapterId);
              return { m, startIdx };
            })
            .filter(x => x.startIdx !== -1)
            .sort((a, b) => a.startIdx - b.startIdx);

          let activeMilestone: { m: typeof currentVol.milestones[number]; startIdx: number } | null = null;
          for (let i = 0; i < milestonesWithIndex.length; i++) {
            if (milestonesWithIndex[i].startIdx <= chapterIndex) {
              activeMilestone = milestonesWithIndex[i];
            } else {
              break;
            }
          }

          if (activeMilestone) {
            let nextStartIdx = currentVol.chapters.length;
            const rank = milestonesWithIndex.indexOf(activeMilestone);
            if (rank >= 0 && rank < milestonesWithIndex.length - 1) {
              nextStartIdx = milestonesWithIndex[rank + 1].startIdx;
            }

            const current = chapterIndex - activeMilestone.startIdx + 1;
            const actualTotal = nextStartIdx - activeMilestone.startIdx;
            const estimated = activeMilestone.m.estimated_chapters && activeMilestone.m.estimated_chapters > 0
              ? activeMilestone.m.estimated_chapters
              : actualTotal;
            const total = estimated > 0 ? Math.max(actualTotal, estimated) : actualTotal;

            milestoneContext = {
              title: activeMilestone.m.title,
              summary: activeMilestone.m.summary,
              current,
              total,
              isLast: current >= total
            };

            const planChapters = currentVol.chapters.slice(activeMilestone.startIdx, nextStartIdx);
            (milestoneContext as any).chaptersPlan = planChapters.map((c, idx) => ({
              id: c.id,
              title: c.title,
              summary: c.summary,
              index: idx + 1
            }));
          }
        }
      }

      let characterKnowledge: Array<{ characterId: string; knownFacts?: string; misunderstandings?: string; suspicions?: string; extra?: any }> = [];
      if (id && currentChapter?.id && Array.isArray(currentChapter.characterIds) && currentChapter.characterIds.length > 0) {
        try {
          const promises = currentChapter.characterIds.map(cid => 
            getChapterCharacterKnowledge(id, currentChapter.id, cid)
          );
          const results = await Promise.all(promises);
          characterKnowledge = results.map((res, idx) => {
            const cid = currentChapter!.characterIds![idx];
            if (res.success && res.data && typeof res.data === 'object') {
              return {
                characterId: cid,
                knownFacts: res.data.knownFacts || '',
                misunderstandings: res.data.misunderstandings || '',
                suspicions: res.data.suspicions || '',
                extra: res.data.extra
              };
            }
            return { characterId: cid };
          });
        } catch (e) {
        }
      }

      setIsAiWriterModalOpen(false); // Close modal immediately
      setAiWriterInstruction('');

      let chapterForAi = currentChapter;
      if (currentChapter?.id) {
        const bs: any = (currentChapter as any).beatSheet;
        const hasBeats = Array.isArray(bs?.beats) && bs.beats.length > 0;
        const hasScenes = Array.isArray(bs?.scenes) && bs.scenes.length > 0;
        if (!hasBeats && !hasScenes) {
          try {
            const bsRes = await getChapterBeatSheet(currentChapter.id);
            if (bsRes.success && bsRes.data) {
              const beatData = typeof bsRes.data === 'string' ? JSON.parse(bsRes.data) : bsRes.data;
              chapterForAi = { ...currentChapter, beatSheet: beatData } as any;
              setCurrentChapter(prev => (prev ? ({ ...prev, beatSheet: beatData } as any) : prev));
            }
          } catch (e) {
          }
        }
      }
      
      const res = await generateChapterContent({
        chapter: chapterForAi,
        previousChapter,
        volumeSummary,
        globalLore,
        instruction: aiWriterInstruction,
        characters: activeCharacters,
        foreshadowing: pendingForeshadowing,
        coreSettings: novel?.coreSettings,
        milestoneContext,
        volumeChaptersPlan: currentVolume?.chapters?.map(c => ({
          id: c.id,
          title: c.title,
          summary: c.summary
        })),
        characterKnowledge
      }, (chunk) => {
        // Handle stream chunk - append to content
        setCurrentChapter(prev => {
          if (!prev) return null;
          return {
            ...prev,
            content: (prev.content || '') + chunk
          };
        });
      }, abortControllerRef.current?.signal);

      if (!res.success) {
        if (res.data) {
             // If we have data, it might be a partial success (abort)
             // Don't show error alert if it was aborted
        } else {
             alert('AI 生成失败: ' + res.error);
        }
        setIsAiWriting(false);
      } else {
        // Stream finished successfully
        setIsAiWriting(false);
      }
    } catch (e) {
      console.error(e);
      alert('AI 生成出错');
      setIsAiWriting(false);
    }
  };

  const handleFormatContent = () => {
    if (!currentChapter?.content) return;
    
    // Auto formatting rules:
    let newContent = currentChapter.content;

    // 1. Normalize line breaks (CRLF -> LF)
    newContent = newContent.replace(/\r\n/g, '\n');

    // 2. Remove trailing spaces per line
    newContent = newContent.replace(/[ \t]+$/gm, '');

    // 3. Compress multiple empty lines (max 2 empty lines)
    newContent = newContent.replace(/\n{3,}/g, '\n\n');

    // 4. Ensure space between Chinese and English (simple heuristic)
    // Add space between Chinese char and English/Number
    newContent = newContent.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2');
    // Add space between English/Number and Chinese char
    newContent = newContent.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2');

    // 5. Paragraph Indentation (2 em space at start of lines that are not empty)
    // Note: This is opinionated. Some users prefer CSS text-indent.
    // We will check if the line starts with spaces/tabs/ideographic spaces, if not, add them.
    // Only apply to lines that look like paragraphs (contain Chinese) and don't start with Markdown markers
    const lines = newContent.split('\n');
    const formattedLines = lines.map(line => {
        // Skip empty lines
        if (!line.trim()) return line;
        
        // Skip Markdown headers, lists, blockquotes
        if (/^#|^>|^-|^\*|^\d+\./.test(line.trim())) return line;

        // Skip lines that already have indentation (full-width space or 2+ spaces)
        if (/^(\u3000|  )/.test(line)) return line;

        // Add 2 full-width spaces for Chinese indentation
        return `\u3000\u3000${line}`;
    });
    newContent = formattedLines.join('\n');
    
    if (newContent !== currentChapter.content) {
        setCurrentChapter(prev => prev ? ({ ...prev, content: newContent }) : null);
        // Show a simple feedback (using alert for now as we don't have a toast component yet, or just console)
        // Ideally, a toast.
        console.log('Auto format applied');
    }
  };

  const handleStopAi = () => {
    if (abortControllerRef.current) {
      console.log('User requested stop');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAiWriting(false);
  };

  const handleDeleteVolume = (volId: string) => {
    setDeleteModal({
        isOpen: true,
        type: 'volume',
        id: volId,
        title: '删除分卷'
    });
  };

  const handleMoveChapter = async (volId: string, chapterId: string, direction: 'up' | 'down') => {
      const vol = novel?.volumes.find(v => v.id === volId);
      if (!vol || !novel) return;

      const currentIndex = vol.chapters.findIndex(c => c.id === chapterId);
      if (currentIndex === -1) return;
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === vol.chapters.length - 1) return;

      const newChapters = [...vol.chapters];
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      // Swap
      [newChapters[currentIndex], newChapters[targetIndex]] = [newChapters[targetIndex], newChapters[currentIndex]];

      // Optimistic update
      setNovel(prev => {
          if (!prev) return null;
          return {
              ...prev,
              volumes: prev.volumes.map(v => v.id === volId ? { ...v, chapters: newChapters } : v)
          };
      });

      // API call - only send the IDs of the two chapters that were swapped
      const changedChapterIds = [newChapters[currentIndex].id, newChapters[targetIndex].id];
      await reorderChapters(novel.id, volId, changedChapterIds);
  };

  const handleDeleteChapter = (chapterId: string) => {
    setDeleteModal({
        isOpen: true,
        type: 'chapter',
        id: chapterId,
        title: '删除章节'
    });
  };

  const handleCreateLore = (type: string) => {
    let title = '新建设定';
    if (type === 'character') title = '新建角色';
    if (type === 'item') title = '新建物品';
    if (type === 'location') title = '新建地点';
    if (type === 'world') title = '新建世界观设定';
    
    setLoreModal({
      isOpen: true,
      type: type, 
      title: title
    });
  };

  const handleDeleteLore = (loreId: string) => {
      setDeleteModal({
          isOpen: true,
          type: 'lore', 
          id: loreId,
          title: '删除设定'
      });
  };

  const executeDelete = async () => {
      const { type, id: targetId } = deleteModal;
      if (!id || !targetId) return;

      if (type === 'volume') {
        const res = await deleteVolume(id, targetId);
        if (res.success) {
            const novelRes = await getNovel(id);
            if (novelRes.success) {
                setNovel(novelRes.data);
                // Only clear if we deleted the current volume
                if (currentVolume?.id === targetId) {
                    setCurrentVolume(null);
                    setCurrentChapter(null);
                    setActiveTab('editor'); 
                }
            }
        } else {
            alert('删除失败: ' + res.error);
        }
      } else if (type === 'chapter') {
        const res = await deleteChapter(id, targetId);
        if (res.success) {
             const novelRes = await getNovel(id);
             if (novelRes.success) {
                 setNovel(novelRes.data);
                 if (currentChapter?.id === targetId) {
                     setCurrentChapter(null);
                 }
                 // Also update currentVolume to reflect chapter removal
                 if (currentVolume) {
                     const updatedVol = novelRes.data.volumes.find(v => v.id === currentVolume.id);
                     if (updatedVol) setCurrentVolume(updatedVol);
                 }
             }
        } else {
            alert('删除失败: ' + res.error);
        }
      } else if (type === 'lore') {
        const res = await deleteLore(id, targetId);
        if (res.success) {
            const novelRes = await getNovel(id);
            if (novelRes.success) {
                setNovel(novelRes.data);
                if (currentLore?._id === targetId || currentLore?.id === targetId) {
                    setCurrentLore(null);
                    // Optionally reset active tab if you want
                }
            }
        } else {
            alert('删除失败: ' + res.error);
        }
      }
      setDeleteModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleAiGenerateCharacters = async (prompt: string, count: number): Promise<GeneratedCharacter[]> => {
    if (!novel) return [];
    
    // Prepare context
    const plotLore = novel.lore.find(l => l.id === 'plot' && l.type === 'plot');
    const primaryOutline = novel.lore.find((l: any) => l.type === 'outline' && (l as any).isPrimary);
    const outlineSummary = primaryOutline ? (primaryOutline.summary || (primaryOutline.content || '').slice(0, 500)) : '';
    const outline = `总纲：${outlineSummary || '无'} \n冲突：${JSON.stringify(plotLore?.conflict || {})}`;
    
    const worldLore = novel.lore.find(l => l.id === 'world' && l.type === 'world');
    const world = worldLore ? `背景：${JSON.stringify(worldLore.background || {})} \n势力：${JSON.stringify(worldLore.forces || {})}` : '';
    
    const characters = novel.lore
      .filter(l => l.type === 'character')
      .map(c => `${c.name || c.title}: ${c.role || ''}`)
      .join('\n');
      
    const context = {
      outline,
      world,
      existingCharacters: characters
    };
    
    const res = await generateCharacters(context, count, prompt);
    if (res.success) {
      return res.data;
    } else {
      throw new Error(res.error);
    }
  };

  const handleConfirmAiCharacters = async (chars: GeneratedCharacter[]) => {
    if (!id) return;
    
    // Create lore for each character sequentially to avoid race conditions
    for (const char of chars) {
       // Single-field description → Markdown content（兼容旧字段作为回退）
       const anyChar: any = char as any;
       const desc = (char.description && char.description.trim().length > 0)
         ? char.description
         : (() => {
             const parts: string[] = [];
             if (anyChar.role) parts.push(`身份：${anyChar.role}`);
             if (anyChar.personality) parts.push(`性格：${anyChar.personality}`);
             if (anyChar.background) parts.push(`背景：${anyChar.background}`);
             return parts.join('\n');
           })();
       const content = `# ${char.name}\n\n${desc}\n`;

       // First create the lore file
       const res = await createLore(id, char.name, 'character');
       if (res.success) {
         await createLorePostObj(id, {
           title: char.name, 
           type: 'character',
           content: content
         });
       }
    }
    
    // Refresh
    const novelRes = await getNovel(id);
    if (novelRes.success) {
        setNovel(novelRes.data);
    }
  };

  const handleLocationGenerate = async () => {
    if (!id || !novel) return;
    setIsLocationGenerating(true);
    try {
        // 1. Refresh Data
        const novelRes = await getNovel(id);
        if (!novelRes.success || !novelRes.data) {
            alert('读取项目数据失败');
            setIsLocationGenerating(false);
            return;
        }
        const currentNovel = novelRes.data;
        
        // 2. Prepare Context
        const plotLore = currentNovel.lore.find((l: any) => l.id === 'plot' && l.type === 'plot');
        const primaryOutline = currentNovel.lore.find((l: any) => l.type === 'outline' && (l as any).isPrimary);
        const outlineSummary = primaryOutline ? ((primaryOutline as any).summary || ((primaryOutline as any).content || '').slice(0, 1000)) : '';
        const outline = `【大纲】\n${outlineSummary}\n【冲突】\n${JSON.stringify((plotLore as any)?.conflict || {})}`;
        
        const worldLore = currentNovel.lore.find((l: any) => (l.id === 'world' || (l as any)._id === 'world') && l.type === 'world');
        const spaceSettings = worldLore ? `【空间设置】\n${(worldLore as any).locations || ''}\n【世界背景】\n${(worldLore as any).background || ''}` : '';
        
        if (!spaceSettings && !locationPrompt.trim()) {
            alert('空间设置为空，且未输入具体要求，无法生成地点。请至少补充空间设置或输入要求。');
            setIsLocationGenerating(false);
            return;
        }

        // 3. Construct Prompt
        const systemPrompt = `你是一个专业的小说世界观架构师。请根据用户提供的大纲、空间设置和具体要求，生成一系列具体的地点（Location）设定。
请返回 JSON 格式数组，每个元素包含：
- title: 地点名称
- content: 地点的详细描述（包含氛围、布局、功能等）
- type: 固定为 "location"

现有大纲信息：
${outline}

现有空间设置与背景：
${spaceSettings}

用户具体要求：
${locationPrompt || '请根据上述空间设置，将其拆解并丰富为具体的地点设定。'}

注意：
1. 如果空间设置中已经包含了具体地点列表，请将其转化为标准格式并润色。
2. 如果空间设置较模糊，请结合大纲进行合理的地点扩充。
3. 必须返回纯 JSON 数组，不要包含 Markdown 代码块标记。
`;

        // 4. Call AI
        const res = await chatWithAI(systemPrompt, id);
        if (!res.success || !res.data) {
            alert('AI 生成失败: ' + (res.error || '无返回数据'));
             setIsLocationGenerating(false);
            return;
        }

        // 5. Parse Result
        let locations: any[] = [];
        try {
            const jsonStr = res.data.replace(/```json/g, '').replace(/```/g, '').replace(/\n/g, '').trim();
            // Attempt to find the array if there's extra text
            locations = JSON.parse(jsonStr);
            // const firstBracket = jsonStr.indexOf('[');
            // const lastBracket = jsonStr.lastIndexOf(']');
            // if (firstBracket !== -1 && lastBracket !== -1) {
            //     const arrayStr = jsonStr.substring(firstBracket, lastBracket + 1);
            //     locations = JSON.parse(arrayStr);
            // } else {
            //      locations = JSON.parse(jsonStr);
            // }
            if (!Array.isArray(locations)) {
                locations = [locations];
            }
        } catch (e) {
            console.error('JSON Parse Error:', e);
            toast.success('AI 返回格式错误，无法解析');
            setIsLocationGenerating(false);
            return;
        }

        // 6. Import Locations
        let successCount = 0;
        for (const loc of locations) {
             const createRes = await createLorePostObj(id, loc);
             if (createRes.success && createRes.data) {
                 const loreId = createRes.data.id || createRes.data._id;
                 if (loreId) {
                     await updateLore(id, loreId, {
                         ...loc,
                         type: 'location'
                     });
                     successCount++;
                 }
             }
        }

        // 7. Finish
        toast.success(`成功生成 ${successCount} 个地点`);
        setIsLocationModalOpen(false);
        setLocationPrompt('');
        
        // Refresh
        const finalRes = await getNovel(id);
        if (finalRes.success) setNovel(finalRes.data);

    } catch (e: any) {
        alert('执行出错: ' + e.message);
    } finally {
        setIsLocationGenerating(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const chapterForeshadowing: Foreshadowing[] =
    (novel?.foreshadowing || []).filter(
      f => String(f.chapterId) === String(currentChapter?.id) || String(f.resolvedChapterId) === String(currentChapter?.id)
    );

  const handleDownload = async (type: 'lore' | 'chapters') => {
    if (!id) return;
    try {
      const res = type === 'lore' ? await exportNovelLore(id) : await exportNovelChapters(id);
      if (!res.ok) {
        alert('导出失败');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      a.download = match && match[1] ? decodeURIComponent(match[1]) : type === 'lore' ? '设定集.doc' : '正文.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('导出失败: ' + (e?.message || '未知错误'));
    }
  };

  // Calculate previous chapter for context
  const previousChapter = (() => {
    if (!novel || !currentChapter) return undefined;
    let volIdx = -1;
    let chapIdx = -1;
    
    for (let v = 0; v < novel.volumes.length; v++) {
      const c = novel.volumes[v].chapters.findIndex(ch => ch.id === currentChapter.id);
      if (c !== -1) {
        volIdx = v;
        chapIdx = c;
        break;
      }
    }

    if (volIdx === -1 || chapIdx === -1) return undefined;

    if (chapIdx > 0) {
      return novel.volumes[volIdx].chapters[chapIdx - 1];
    } else if (volIdx > 0) {
      const prevVol = novel.volumes[volIdx - 1];
      if (prevVol.chapters.length > 0) {
        return prevVol.chapters[prevVol.chapters.length - 1];
      }
    }
    return undefined;
  })();

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Top Navigation */}
      <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center px-4 justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100" title="返回书架">
            <Home className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-2"></div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{novel?.title || '未命名小说'}</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                  <span className="text-xs text-zinc-500">保存中...</span>
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-zinc-500">已保存 {lastSaved.toLocaleTimeString()}</span>
                </>
              ) : (
                <span className="text-xs text-zinc-500">未保存</span>
              )}
            </div>
            <button
              onClick={() => setIsGuideOpen(prev => !prev)}
              className="p-2 rounded-lg transition-colors flex items-center gap-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title={isGuideOpen ? '隐藏指引' : '使用指引'}
            >
              <Info className="w-5 h-5" />
              <span className="text-sm font-medium">{isGuideOpen ? '隐藏指引' : '使用指引'}</span>
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Global Save Button Removed - Moved to Editor Toolbar */}
          
          <button 
            onClick={() => setIsAiOpen(!isAiOpen)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${isAiOpen ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
          >
            <Bot className="w-5 h-5" />
            <span className="text-sm font-medium">AI 助手</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Resources Tree */}
        <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col shrink-0">
          
          {/* Resources Section */}
          <div className={`flex flex-col border-b border-zinc-200 dark:border-zinc-800 transition-all duration-300 overflow-hidden ${
            sidebarMode === 'resources' ? 'flex-1' : sidebarMode === 'lore' ? 'h-auto shrink-0' : 'h-[50%]'
          }`}>
            <div className="flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-900/20">
              <div 
                className="flex items-center gap-2 text-zinc-500 text-sm font-medium cursor-pointer"
                onClick={() => setSidebarMode(prev => prev === 'resources' ? 'split' : 'resources')}
              >
                <BookOpen className="w-4 h-4" />
                <span>小说目录</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload('chapters');
                  }}
                  className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-zinc-200 dark:text-zinc-500 dark:hover:text-blue-400 dark:hover:bg-zinc-700 rounded"
                  title="导出正文为 Word"
                >
                  <Download className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setSidebarMode(prev => prev === 'resources' ? 'split' : 'resources')}
                  className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-400"
                  title={sidebarMode === 'resources' ? '收起' : '展开'}
                >
                  {sidebarMode === 'resources' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>
            
            {/* Dynamic Tree */}
            <div className={`space-y-4 overflow-y-auto custom-scrollbar px-4 pb-4 ${sidebarMode === 'lore' ? 'hidden' : 'block'}`}>
              {novel?.volumes?.map(vol => (
                <div key={vol.id} className="space-y-1 group/vol">
                  <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    <span 
                      className="text-sm font-medium text-zinc-900 dark:text-zinc-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentVolume(vol);
                        setActiveTab('volume');
                      }}
                    >
                      {vol.title}
                    </span>
                    <div className="flex items-center gap-1">
                        <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setModalVolumeId(vol.id);
                            const volIndex = (novel?.volumes || []).findIndex((v: any) => v.id === vol.id);
                            const previousChapterCount = (novel?.volumes || [])
                                .slice(0, volIndex)
                                .reduce((acc: number, v: any) => acc + (v.chapters?.length || 0), 0);

                            setModalVolumeData({ 
                              title: vol.title, 
                              summary: vol.summary || '',
                              existingChapters: vol.chapters.map(c => c.title),
                              outlineContext: (() => {
                                const outlines = (novel?.lore || []).filter((l: any) => l.type === 'outline' || l.type === 'plot');
                                return outlines.map((l: any) => `【${l.title}】\n${(l.content || l.summary || '')}`).join('\n\n');
                              })(),
                              previousChapterCount
                            });
                            setIsBatchModalOpen(true);
                        }}
                        className="p-1 text-zinc-400 hover:text-purple-600 dark:text-zinc-500 dark:hover:text-purple-400 transition-colors"
                        title="批量新建章节"
                        >
                        <List className="w-4 h-4" />
                        </button>
                        <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setModalVolumeId(vol.id);
                            setModalVolumeData({ title: vol.title, summary: vol.summary || '' });
                            setIsChapterModalOpen(true);
                        }}
                        className="p-1 text-zinc-400 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400 transition-colors"
                        title="新建章节"
                        >
                        <Plus className="w-4 h-4" />
                        </button>
                        <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVolume(vol.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
                        title="删除分卷"
                        >
                        <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                  <div className="pl-4 space-y-1">
                    {vol.chapters?.length > 0 ? (
                      vol.chapters.map(chapter => (
                        <div 
                          key={chapter.id}
                          onClick={async (e) => {
                             e.stopPropagation();
                             setCurrentChapter(chapter);
                             setActiveTab('editor');
                             // Fetch chapter content
                             try {
                               const contentRes = await getChapterContent(chapter.id);
                               if (contentRes.success) {
                                 setCurrentChapter(prev => prev?.id === chapter.id ? { ...prev, content: contentRes.data || '' } : prev);
                               }
                             } catch (error) {
                               console.error('Failed to load chapter content:', error);
                               toast.error('加载章节内容失败');
                             }
                          }}
                          className={`group/chapter flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${
                            currentChapter?.id === chapter.id && activeTab === 'editor'
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-medium'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <span className="truncate">第{vol.chapters.indexOf(chapter) + 1}章 {chapter.title}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover/chapter:opacity-100 transition-opacity">
                              <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveChapter(vol.id, chapter.id, 'up'); }}
                                  className="p-1 text-zinc-400 hover:text-blue-600 transition-all disabled:opacity-30 disabled:hover:text-zinc-400"
                                  disabled={vol.chapters.indexOf(chapter) === 0}
                                  title="上移"
                              >
                                  <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveChapter(vol.id, chapter.id, 'down'); }}
                                  className="p-1 text-zinc-400 hover:text-blue-600 transition-all disabled:opacity-30 disabled:hover:text-zinc-400"
                                  disabled={vol.chapters.indexOf(chapter) === vol.chapters.length - 1}
                                  title="下移"
                              >
                                  <ArrowDown className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteChapter(chapter.id);
                                }}
                                className="p-1 text-zinc-400 hover:text-red-600 transition-all"
                                title="删除章节"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-zinc-400 italic">
                        暂无章节
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNewVolumeTitle(`第${(novel?.volumes?.length || 0) + 1}卷`);
                  setIsCreateVolumeOpen(true);
                }}
                className="w-full py-2 flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>新建分卷</span>
              </button>
            </div>
          </div>
          
          {/* Lore Section */}
          <div className={`flex flex-col overflow-hidden transition-all duration-300 ${
             sidebarMode === 'lore' ? 'flex-1' : sidebarMode === 'resources' ? 'h-auto shrink-0' : 'flex-1'
          }`}>
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/20">
              <div className="flex items-center gap-2 text-zinc-500 text-sm font-medium cursor-pointer" onClick={() => setSidebarMode(prev => prev === 'lore' ? 'split' : 'lore')}>
                <Settings className="w-4 h-4" />
                <span>设定集</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload('lore');
                  }}
                  className="p-1 text-zinc-400 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                  title="导出设定为 Word"
                >
                  <Download className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setActiveTab('lore-ai')}
                  className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:opacity-80"
                >
                  AI审查
                </button>
                <div className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-400 cursor-pointer" onClick={() => setSidebarMode(prev => prev === 'lore' ? 'split' : 'lore')}>
                  {sidebarMode === 'lore' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto custom-scrollbar px-2 ${sidebarMode === 'resources' ? 'hidden' : 'block'}`}>
              <ProjectSidebarLore 
                loreFiles={novel?.lore || []}
                coreSettings={novel?.coreSettings}
                selectedId={currentLore?._id || currentLore?.id}
                pendingDiffIds={Object.keys(pendingLoreDiffs)}
                onSelect={async (item) => {
                  if (item.type === 'outline' && ((item as any).isPrimary || item.title === '主大纲')) {
                    if (id) {
                      const res = await getNovel(id);
                      if (res.success && res.data) {
                        setNovel(res.data);
                        const freshOutline = (res.data.lore || []).find((l: any) => l.type === 'outline' && ((l as any).isPrimary || l.title === '主大纲'));
                        const dbVolumes = (res.data.volumes || []).map((v: any) => ({ title: v.title, summary: v.summary }));
                        if (freshOutline) {
                          setCurrentLore({ ...(freshOutline as any), volumes: dbVolumes });
                        } else {
                          setCurrentLore({ ...(item as any), volumes: dbVolumes });
                        }
                      } else {
                        setCurrentLore(item);
                      }
                    } else {
                      setCurrentLore(item);
                    }
                  } else {
                    setCurrentLore(item);
                  }
                  const loreId = item._id || item.id;
                  if (loreId && pendingLoreDiffs[loreId]) {
                    startLoreDiffReviewFromPending(loreId);
                  } else {
                    setActiveTab('lore');
                  }
                }}
                onCreate={handleCreateLore}
                onDelete={handleDeleteLore}
                onAiGenerate={async (type) => {
                  if (type === 'character') {
                    setIsAiCharacterModalOpen(true);
                    return;
                  }
                  if (type === 'outline') {
                    setIsAiOutlineModalOpen(true);
                    return;
                  }
                  if (type === 'location') {
                    setIsLocationModalOpen(true);
                    return;
                  }
                }}
                onOpenGraph={() => setActiveTab('graph')}
              />
            </div>
          </div>
        </aside>

        {/* Center: Editor Area */}
        <main className="flex-1 flex flex-col bg-white dark:bg-zinc-900 relative min-w-0">
          {/* Tabs */}
          <div className="h-10 flex border-b border-zinc-200 dark:border-zinc-800">
            {activeTab === 'lore' ? (
               <button 
                className="px-4 flex items-center gap-2 text-sm font-medium border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 border-t-2 border-t-purple-600"
              >
                <Settings className="w-4 h-4" />
                <span>{currentLore?.title || '设定编辑'}</span>
              </button>
            ) : activeTab === 'graph' ? (
               <button 
                className="px-4 flex items-center gap-2 text-sm font-medium border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 border-t-2 border-t-purple-600"
              >
                <Network className="w-4 h-4" />
                <span>人物关系图谱</span>
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setActiveTab('editor')}
                  className={`px-4 flex items-center gap-2 text-sm font-medium border-r border-zinc-200 dark:border-zinc-800 ${activeTab === 'editor' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 border-t-2 border-t-blue-600' : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 hover:bg-zinc-100'}`}
                >
                  <span>{currentChapter?.title || '无章节'}</span>
                </button>
              </>
            )}
          </div>

          {/* Content Area */}
          <div className={`flex-1 overflow-auto ${activeTab === 'editor' && (chapterViewMode === 'write' || chapterViewMode === 'pov' || chapterViewMode === 'foreshadowing' || chapterViewMode === 'beat') ? 'p-0' : 'p-4 md:p-8 lg:p-12'}`}>
            <div className={`mx-auto h-full ${activeTab === 'editor' && (chapterViewMode === 'write' || chapterViewMode === 'pov' || chapterViewMode === 'foreshadowing' || chapterViewMode === 'beat') ? 'w-full max-w-none flex flex-col' : 'max-w-3xl'}`}>
              {activeTab === 'lore' && currentLore ? (
                <LoreEditor 
                  key={currentLore._section ? `${(currentLore as any).id || (currentLore as any)._id}_${(currentLore as any)._section}` : ((currentLore as any)._id || (currentLore as any).id)}
                  lore={currentLore}
                  allLore={novel?.lore || []}
                  onChange={setCurrentLore}
                  onSave={handleSave}
                  isSaving={isSaving}
                  externalDiff={diffData ? {
                    original: diffData.original,
                    modified: diffData.modified,
                    onApply: diffData.onAccept,
                    onCancel: diffData.onReject
                  } : null}
                  novel={novel}
                />
              ) : activeTab === 'graph' ? (
                <RelationshipGraph 
                    novelId={id!} 
                    characters={novel?.lore.filter(l => l.type === 'character') || []} 
                />
              ) : activeTab === 'diff' ? (
                 <div className="h-full bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    {diffData ? (
                        <DiffViewer 
                            originalContent={diffData.original}
                            newContent={diffData.modified}
                            onApply={diffData.onAccept}
                            onCancel={diffData.onReject}
                            title="AI 内容优化对比"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                            <History className="w-16 h-16 mb-4 opacity-20" />
                            <p>暂无 Diff 数据</p>
                        </div>
                    )}
                 </div>
             ) : activeTab === 'lore-ai' ? (
                <LoreAuditPanel
                  novelId={id!}
                  suggestions={loreAuditSuggestions || undefined}
                  onUpdateSuggestions={(list) => setLoreAuditSuggestions(list)}
                  onLocate={(loreId, field, title) => {
                    console.log('onLocate triggered:', { loreId, field, title });
                    
                    const reverseSectionTitleMap: Record<string, string> = {
                        '世界观设定': 'content', '设定': 'content',
                        '世界背景': 'background', '背景': 'background',
                        '空间设置': 'locations', '空间': 'locations', '地点': 'locations',
                        '力量体系': 'powerSystem', '力量': 'powerSystem',
                        '势力分布': 'forces', '势力': 'forces',
                        '时间线': 'timeline', '时间': 'timeline',
                        '主线冲突': 'conflict', '冲突': 'conflict',
                        '钩子': 'hooks',
                        '转折': 'twists',
                        '文风基调': 'tone', '基调': 'tone',
                        '节奏': 'pacing',
                        '主题': 'themes'
                    };

                    // Strategy: Try to find the corresponding sidebar item in DOM and click it
                    // This ensures consistent behavior with user interaction
                    let targetDomId = loreId;
                    let englishField = field;
                    
                    // Pre-fetch item to check type
                    let preItem = (novel?.lore || []).find(l => 
                        l.id === loreId || (l as any)._id === loreId || String(l.id) === String(loreId)
                    );
                    
                    // Fallback: If ID match fails, try title match if provided
                    if (!preItem && title) {
                        preItem = (novel?.lore || []).find(l => l.title === title || l.name === title);
                        if (preItem) {
                            console.log('Found item by title match:', preItem.id);
                            // Update target IDs to use the found item's ID
                            loreId = preItem.id; 
                            targetDomId = preItem.id;
                        }
                    }

                    if (preItem && preItem.type === 'character') {
                        // For characters, we don't have sub-menus for fields like personality
                        // So we ignore the field for DOM targeting and just locate the character item
                        englishField = undefined;
                    } else if (field) {
                        // Convert Chinese field to English key if necessary
                        if (reverseSectionTitleMap[field]) {
                            englishField = reverseSectionTitleMap[field];
                        }
                        
                        const potentialId = `${loreId}_${englishField}`;
                        // Always prefer combined ID if field is present
                        // But we should verify if it exists in DOM, otherwise fall back to loreId
                        if (document.querySelector(`[data-lore-id="${potentialId}"]`)) {
                             targetDomId = potentialId;
                        }
                    }
                    console.log('Target DOM ID:', targetDomId);

                     // Encapsulate fallback logic
                     const performFallback = () => {
                        console.log('Executing performFallback');
                        // Fallback: Try exact match first, then string match
                        let target = (novel?.lore || []).find(l => 
                            (l.id === loreId) || 
                            ((l as any)._id === loreId) ||
                            (String(l.id) === String(loreId)) ||
                            (String((l as any)._id) === String(loreId))
                        );
                        
                        // Fallback: Check if loreId is actually a lore type (for singleton lores like world, plot)
                        if (!target && ['world', 'plot', 'narrative', 'outline'].includes(loreId)) {
                            target = (novel?.lore || []).find(l => l.type === loreId);
                        }

                        if (target) {
                            if (field && ['world','plot','narrative'].includes((target as any).type)) {
                                const sectionTitleMap: Record<string, string> = {
                                content: '世界观设定',
                                background: '世界背景',
                                powerSystem: '力量体系',
                                forces: '势力分布',
                                locations: '空间设置',
                                timeline: '时间线',
                                conflict: '主线冲突',
                                };
                                // Use a consistent ID format for the virtual section item
                                const sectionId = `${target.id || (target as any)._id}_${field}`;
                                setCurrentLore({ 
                                    ...target, 
                                    _section: field, 
                                    _id: sectionId, 
                                    id: sectionId, // Ensure ID is set for consistency
                                    title: sectionTitleMap[field] || target.title 
                                });
                            } else {
                                setCurrentLore(target);
                            }
                            setActiveTab('lore');
                            setSidebarMode('lore');
                        } else {
                            console.warn('Lore item not found for locating:', loreId);
                            toast.error('未找到对应的设定项');
                        }
                     };

                     const tryClick = () => {
                          const el = document.querySelector(`[data-lore-id="${targetDomId}"]`);
                          console.log('tryClick attempt:', targetDomId, 'Found:', !!el);
                          if (el) {
                              console.log('Clicking element:', el);
                              (el as HTMLElement).click();
                              // If we clicked the exact combined ID (child item), we are done.
                              // If we clicked the parent ID (loreId), we still need to perform fallback to set the section.
                              if (targetDomId.includes('_') && field) {
                                  return true;
                              }
                              
                              // For characters, the click is always sufficient as there are no sub-sections
                              if (preItem && preItem.type === 'character') {
                                  return true;
                              }

                              // If we clicked parent but wanted a section, we return false to trigger performFallback
                              // BUT, clicking the parent might have switched the tab already.
                              // performFallback will update currentLore with _section.
                              return false;
                          }
                          return false;
                      };
 
                      if (tryClick()) return;
 
                      // If not found, try to expand the parent category first
                      let categoryId = '';
                      
                      const fieldToCategoryMap: Record<string, string> = {
                          'content': 'world', 'background': 'world', 'locations': 'world',
                          'powerSystem': 'world', 'forces': 'world', 'timeline': 'world',
                          'conflict': 'plot', 'hooks': 'plot', 'twists': 'plot',
                          'tone': 'narrative', 'pacing': 'narrative', 'themes': 'narrative',
                          // Character fields inference
                          '性格': 'character', 'personality': 'character',
                          '外貌': 'character', 'appearance': 'character',
                          '能力': 'character', 'abilities': 'character',
                          '经历': 'character', 'backstory': 'character',
                          '关系': 'character', 'relationships': 'character',
                          '人设': 'character'
                      };

                      // Infer category ID based on naming convention or lookup
                      if (targetDomId.startsWith('world_')) categoryId = 'world';
                      else if (targetDomId.startsWith('plot_')) categoryId = 'plot';
                      else if (targetDomId.startsWith('narrative_')) categoryId = 'narrative';
                      else {
                          // Find the item to know its type
                          const item = (novel?.lore || []).find(l => 
                              l.id === loreId || (l as any)._id === loreId || String(l.id) === String(loreId)
                          );
                          if (item) {
                              categoryId = item.type;
                          } else if (englishField && fieldToCategoryMap[englishField]) {
                              // Fallback: Infer category from field if item not found (e.g. ID mismatch)
                              categoryId = fieldToCategoryMap[englishField];
                              console.log('Inferred Category from field:', categoryId);
                              
                              // Critical Fix: If we inferred category 'world' from field 'powerSystem',
                              // but the original ID '48' was wrong, we should try 'world_powerSystem' as target.
                              if (['world', 'plot', 'narrative'].includes(categoryId)) {
                                  const correctedTargetId = `${categoryId}_${englishField}`;
                                  console.log('Correcting targetDomId to:', correctedTargetId);
                                  targetDomId = correctedTargetId;
                              }
                          } else if (field && fieldToCategoryMap[field]) {
                               // Try matching raw field (e.g. Chinese)
                               categoryId = fieldToCategoryMap[field];
                               console.log('Inferred Category from raw field:', categoryId);
                          }
                      }
                      console.log('Inferred Category ID:', categoryId);
 
                      if (categoryId) {
                          const catEl = document.querySelector(`[data-lore-id="${categoryId}"]`);
                          console.log('Category Element found:', !!catEl);
                          if (catEl) {
                              // Check if expanded: The parent of the row div should have > 1 children (row + children container)
                              const rootEl = catEl.parentElement;
                              const isExpanded = rootEl && rootEl.children.length > 1;
                              console.log('Category isExpanded:', isExpanded);
                              
                              if (!isExpanded) {
                                  console.log('Clicking category to expand:', categoryId);
                                  (catEl as HTMLElement).click();
                                  // Wait for React to render children
                                  setTimeout(() => {
                                      console.log('Retry click after expand...');
                                      // Re-calculate targetDomId because now the child might be rendered
                                      if (englishField) {
                                          const potentialId = `${loreId}_${englishField}`;
                                          if (document.querySelector(`[data-lore-id="${potentialId}"]`)) {
                                              targetDomId = potentialId;
                                          }
                                      }
                                      
                                      if (!tryClick()) {
                                          console.warn('Retry failed, fallback');
                                          performFallback();
                                      }
                                  }, 100);
                                  return;
                              } else {
                                  // ALREADY EXPANDED: Retry click with potentially corrected ID
                                  console.log('Category already expanded, retrying click with:', targetDomId);
                                  if (tryClick()) return;
                              }
                          }
                      }
 
                      performFallback();
                  }}
                  onApplyChanges={(loreId, changes) => {
                    applyLoreChanges(loreId, changes);
                  }}
                />
              ) : activeTab === 'volume' && currentVolume ? (
                <div className="h-full flex flex-col">
                  {/* Volume View Tabs */}
                  <div className="flex items-center gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <button
                      onClick={() => setVolumeViewMode('plot')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        volumeViewMode === 'plot'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      剧情规划 (Plot Board)
                    </button>
                    <button
                      onClick={() => setVolumeViewMode('edit')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        volumeViewMode === 'edit'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      分卷信息
                    </button>
                  </div>

                  {volumeViewMode === 'plot' ? (
                    <PlotManager
                      volume={currentVolume}
                      novelId={id!}
                      characters={novel?.lore.filter(l => l.type === 'character') || []}
                      onUpdate={(updatedVolume) => {
                         setCurrentVolume(updatedVolume);
                      }}
                    />
                  ) : (
                    <>
                      <VolumeEditor 
                        volume={currentVolume}
                        onChange={setCurrentVolume}
                        onSave={handleSave}
                        isSaving={isSaving}
                        onOptimizeClick={() => setIsOptimizeVolumeOpen(true)}
                      />
                    </>
                  )}
                </div>
              ) : (currentChapter && activeTab === 'editor') ? (
                <div className="h-full flex flex-col">
                  {/* Chapter View Tabs */}
                  <div className="flex items-center gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <button
                      onClick={() => setChapterViewMode('beat')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        chapterViewMode === 'beat'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      章纲模式 (Beat Sheet)
                    </button>
                    <button
                      onClick={() => setChapterViewMode('write')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        chapterViewMode === 'write'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      正文模式 (Writer)
                    </button>
                    <button
                      onClick={() => setChapterViewMode('pov')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        chapterViewMode === 'pov'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      POV 与角色认知
                    </button>
                    <button
                      onClick={() => setChapterViewMode('foreshadowing')}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        chapterViewMode === 'foreshadowing'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      伏笔记录
                    </button>
                  </div>

                  {chapterViewMode === 'beat' ? (
                    <div className="flex flex-1 overflow-hidden relative h-full">
                      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                        <div className="px-6 md:px-12 pt-6 pb-6 flex-1 overflow-hidden">
                          <BeatSheetEditor
                            chapter={currentChapter}
                            volumeSummary={currentVolume?.summary}
                            characters={currentChapter.characterIds?.map(id => novel?.lore.find(l => (l._id || l.id) === id)).filter(Boolean)}
                            coreSettings={novel?.coreSettings}
                            milestoneContext={(() => {
                              if (!currentVolume?.milestones || !currentChapter) return undefined;
                              const chapterIndex = currentVolume.chapters.findIndex(c => c.id === currentChapter.id);
                              if (chapterIndex === -1) return undefined;
                              
                              const milestoneIndices = currentVolume.milestones.map((m, idx) => {
                                const cIdx = currentVolume.chapters.findIndex(c => c.id === m.chapterId);
                                return { m, idx, startChapterIdx: cIdx };
                              }).filter(x => x.startChapterIdx !== -1)
                              .sort((a, b) => a.startChapterIdx - b.startChapterIdx);
                              
                              let activeMilestoneInfo = null;
                              for (let i = 0; i < milestoneIndices.length; i++) {
                                 if (milestoneIndices[i].startChapterIdx <= chapterIndex) {
                                   activeMilestoneInfo = milestoneIndices[i];
                                 } else {
                                   break;
                                 }
                              }
                              
                              if (!activeMilestoneInfo) return undefined;
                              
                              // Find next milestone start to determine range
                              let nextStartIdx = currentVolume.chapters.length;
                              const currentMilestoneRank = milestoneIndices.indexOf(activeMilestoneInfo);
                              if (currentMilestoneRank < milestoneIndices.length - 1) {
                                 nextStartIdx = milestoneIndices[currentMilestoneRank + 1].startChapterIdx;
                              }
                              
                              const current = chapterIndex - activeMilestoneInfo.startChapterIdx + 1;
                              const actualTotal = nextStartIdx - activeMilestoneInfo.startChapterIdx;
                              const total = Math.max(actualTotal, activeMilestoneInfo.m.estimated_chapters || 0);
                              
                              return {
                                title: activeMilestoneInfo.m.title,
                                summary: activeMilestoneInfo.m.summary,
                                current,
                                total,
                                isLast: current >= total
                              };
                            })()}
                            onSave={async (newBeatSheet) => {
                              // Update local state
                              const updatedChapter = { ...currentChapter, beatSheet: newBeatSheet };
                              setCurrentChapter(updatedChapter);
                              
                              // Persist immediately
                              setIsSaving(true);
                              const volumeIdForChapter = novel?.volumes.find(v => 
                                v.chapters.some(c => c.id === currentChapter.id)
                              )?.id;
                              if (volumeIdForChapter) {
                                await updateChapter(id!, volumeIdForChapter, currentChapter.id, { beatSheet: newBeatSheet });
                              }
                              setIsSaving(false);
      
                              // Update Novel State (Source of Truth) to prevent data loss on switch
                              setNovel(prev => {
                                 if (!prev) return null;
                                 const newVolumes = prev.volumes.map(vol => ({
                                   ...vol,
                                   chapters: vol.chapters.map(c => 
                                     c.id === currentChapter.id ? { ...c, beatSheet: newBeatSheet } : c
                                   )
                                 }));
                                 return { ...prev, volumes: newVolumes };
                              });
                            }}
                            isSaving={isSaving}
                            previousChapterContent={(() => {
                              if (!novel || !currentChapter) return '';
                              for (let i = 0; i < novel.volumes.length; i++) {
                                const vol = novel.volumes[i];
                                const idx = vol.chapters.findIndex(c => c.id === currentChapter.id);
                                if (idx !== -1) {
                                  if (idx > 0) {
                                    return vol.chapters[idx - 1].content || '';
                                  } else if (i > 0) {
                                    const prevVol = novel.volumes[i - 1];
                                    if (prevVol.chapters.length > 0) {
                                      return prevVol.chapters[prevVol.chapters.length - 1].content || '';
                                    }
                                  }
                                  break;
                                }
                              }
                              return '';
                            })()}
                            previousContext={(() => {
                              if (!novel) return '';
                              const plotLore = novel.lore.find(l => l.type === 'plot' && (l.id === 'plot' || (l as any)._id === 'plot'));
                              const parts: string[] = [];
                              if (plotLore && (plotLore as any).conflict) parts.push(`主线冲突：${(plotLore as any).conflict}`);

                              let prevChapter: Chapter | null = null;
                              if (currentChapter) {
                                for (let i = 0; i < novel.volumes.length; i++) {
                                  const vol = novel.volumes[i];
                                  const idx = vol.chapters.findIndex(c => c.id === currentChapter.id);
                                  if (idx !== -1) {
                                    if (idx > 0) {
                                      prevChapter = vol.chapters[idx - 1] as any;
                                    } else if (i > 0) {
                                      const prevVol = novel.volumes[i - 1];
                                      if (prevVol.chapters.length > 0) {
                                        prevChapter = prevVol.chapters[prevVol.chapters.length - 1] as any;
                                      }
                                    }
                                    break;
                                  }
                                }
                              }

                              if (prevChapter) {
                                let prevBeatSheet: any = (prevChapter as any).beatSheet;
                                if (typeof prevBeatSheet === 'string') {
                                  try {
                                    prevBeatSheet = JSON.parse(prevBeatSheet);
                                  } catch {
                                    prevBeatSheet = null;
                                  }
                                }
                                if (prevBeatSheet) {
                                  parts.push(`上一章标题：${prevChapter.title || ''}`.trim());
                                  parts.push(`上一章章纲（JSON）：\n${JSON.stringify(prevBeatSheet, null, 2)}`);
                                }
                              }

                              return parts.join('\n\n').trim();
                            })()}
                            previousChapterId={(() => {
                              if (!novel || !currentChapter) return undefined;
                              for (let i = 0; i < novel.volumes.length; i++) {
                                const vol = novel.volumes[i];
                                const idx = vol.chapters.findIndex(c => c.id === currentChapter.id);
                                if (idx !== -1) {
                                  if (idx > 0) return vol.chapters[idx - 1]?.id;
                                  if (i > 0) {
                                    const prevVol = novel.volumes[i - 1];
                                    if (prevVol.chapters.length > 0) return prevVol.chapters[prevVol.chapters.length - 1]?.id;
                                  }
                                  break;
                                }
                              }
                              return undefined;
                            })()}
                            previousChapterTitle={(() => {
                              if (!novel || !currentChapter) return undefined;
                              for (let i = 0; i < novel.volumes.length; i++) {
                                const vol = novel.volumes[i];
                                const idx = vol.chapters.findIndex(c => c.id === currentChapter.id);
                                if (idx !== -1) {
                                  if (idx > 0) return vol.chapters[idx - 1]?.title;
                                  if (i > 0) {
                                    const prevVol = novel.volumes[i - 1];
                                    if (prevVol.chapters.length > 0) return prevVol.chapters[prevVol.chapters.length - 1]?.title;
                                  }
                                  break;
                                }
                              }
                              return undefined;
                            })()}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 overflow-hidden relative h-full">
                      {/* Outline Sidebar (Left of Editor) */}
                      {chapterViewMode === 'write' && (
                        <div
                          className={`border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 overflow-hidden flex flex-col bg-white/50 dark:bg-zinc-900/50 ${
                            isOutlinePanelOpen ? 'w-64 opacity-100 shrink-0' : 'w-0 opacity-0 border-r-0 shrink-0'
                          }`}
                        >
                          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                              <MapIcon className="w-3 h-3" />
                              本章大纲
                            </span>
                            <button
                              onClick={() => setIsOutlinePanelOpen(false)}
                              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-400"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
                            {/* Goal */}
                            {currentChapter.beatSheet?.goal && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-zinc-400 font-medium text-xs">
                                  <Flag className="w-3 h-3 text-red-500" />
                                  目标 (Goal)
                                </div>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-red-50/50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/20">
                                  {currentChapter.beatSheet.goal}
                                </p>
                              </div>
                            )}

                            {/* Conflict */}
                            {currentChapter.beatSheet?.conflict && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-zinc-400 font-medium text-xs">
                                  <Activity className="w-3 h-3 text-orange-500" />
                                  冲突 (Conflict)
                                </div>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-orange-50/50 dark:bg-orange-900/10 p-2 rounded-lg border border-orange-100 dark:border-orange-900/20">
                                  {currentChapter.beatSheet.conflict}
                                </p>
                              </div>
                            )}

                            {/* Summary */}
                            {currentChapter.summary && (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-zinc-400">摘要</div>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                  {currentChapter.summary}
                                </p>
                              </div>
                            )}

                            {/* Beats */}
                            {currentChapter.beatSheet?.beats && currentChapter.beatSheet.beats.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-zinc-400 font-medium text-xs">
                                  <List className="w-3 h-3 text-blue-500" />
                                  章纲节点 (Beats)
                                </div>
                                <div className="space-y-2">
                                  {currentChapter.beatSheet.beats.map((beat, idx) => (
                                    <div key={idx} className="flex gap-2 text-zinc-600 dark:text-zinc-400 group">
                                      <span className="text-zinc-300 font-mono text-xs pt-0.5">{idx + 1}.</span>
                                      <p className="leading-relaxed group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
                                        {beat}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {!currentChapter.beatSheet?.beats?.length && !currentChapter.summary && (
                              <div className="text-center py-8 text-zinc-400 text-xs">
                                <p>暂无大纲信息</p>
                                <button
                                  onClick={() => setChapterViewMode('beat')}
                                  className="mt-2 text-blue-600 hover:underline"
                                >
                                  去规划章纲
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Editor Container */}
                      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                        {/* Outline Toggle (When closed) */}
                        {chapterViewMode === 'write' && !isOutlinePanelOpen && (
                          <button
                            onClick={() => setIsOutlinePanelOpen(true)}
                            className="absolute left-2 top-2 z-20 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm text-zinc-400 hover:text-blue-600 transition-colors"
                            title="展开大纲"
                          >
                            <MapIcon className="w-4 h-4" />
                          </button>
                        )}

                        {/* Character Bar */}
                        {chapterViewMode === 'write' && (
                        <div className="px-6 md:px-12 pt-6 mb-4 flex items-center gap-2 flex-wrap">
                          <div className="text-sm text-zinc-500 flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              出场:
                          </div>
                          {currentChapter.characterIds?.map(charId => {
                              const char = novel?.lore.find(l => (l._id || l.id) === charId);
                              if (!char) return null;
                              return (
                                  <div 
                                    key={charId} 
                                    className="group/char relative flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs cursor-help transition-colors hover:border-purple-300 dark:hover:border-purple-700"
                                    onMouseEnter={(e) => {
                                       const rect = e.currentTarget.getBoundingClientRect();
                                       setTooltipState({
                                         visible: true,
                                         x: rect.left + rect.width / 2,
                                         y: rect.bottom,
                                         char: char
                                       });
                                     }}
                                    onMouseLeave={() => {
                                      setTooltipState(prev => ({ ...prev, visible: false }));
                                    }}
                                  >
                                      <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px]">
                                          {(char.title || char.name || '')[0]}
                                      </div>
                                      <span>{char.title || char.name}</span>
                                      <button
                                          onClick={async (e) => {
                                              e.stopPropagation();
                                              if (!currentChapter || !id) return;
                                              const newIds = currentChapter.characterIds?.filter(cid => cid !== charId) || [];
                                              const updatedChapter = { ...currentChapter, characterIds: newIds };
                                              setCurrentChapter(updatedChapter);
                                              
                                              // Update novel state
                                              setNovel(prev => {
                                                  if (!prev) return null;
                                                  const newVolumes = prev.volumes.map(vol => ({
                                                      ...vol,
                                                      chapters: vol.chapters.map(c => 
                                                          c.id === updatedChapter.id ? updatedChapter : c
                                                      )
                                                  }));
                                                  return { ...prev, volumes: newVolumes };
                                              });
                                              
                                              // Persist
                                              const volumeId =
                                                currentVolume?.id ||
                                                novel?.volumes.find(v => v.chapters.some(c => c.id === currentChapter.id))?.id;
                                              if (volumeId) {
                                                await updateChapter(id, volumeId, currentChapter.id, { characterIds: newIds });
                                              } else {
                                                console.error('Volume ID not found for chapter character update');
                                              }
                                          }}
                                          className="ml-1 p-0.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-full opacity-0 group-hover/char:opacity-100 transition-all"
                                      >
                                          <X className="w-3 h-3" />
                                      </button>
                                  </div>
                              );
                          })}
                          <button
                              onClick={() => setIsCharSelectorOpen(true)}
                              className="w-6 h-6 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-400 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all"
                          >
                              <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        )}

                        {chapterViewMode === 'foreshadowing' && (
                          <>
                            <div className="px-6 md:px-12 pt-6 mb-4 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <Flag className="w-4 h-4 text-amber-500" />
                                <span>伏笔记录</span>
                                <span className="text-[11px] text-zinc-400">
                                  本章相关：{chapterForeshadowing.length} 条
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    setIsForeshadowingModalOpen(true);
                                    if (id) {
                                      setIsForeshadowingListLoading(true);
                                      try {
                                        const res = await getForeshadowingList(id);
                                        if (res.success && res.data) {
                                          setAllForeshadowingList(res.data);
                                          setNovel(prev => prev ? { ...prev, foreshadowing: res.data } : prev);
                                        }
                                      } catch (e) {
                                        console.error('Failed to fetch foreshadowing list:', e);
                                        toast.error('获取伏笔列表失败');
                                      } finally {
                                        setIsForeshadowingListLoading(false);
                                      }
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                >
                                  <List className="w-3 h-3" />
                                  <span>查看全部伏笔</span>
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!id || !novel || !currentChapter || !currentChapter.content?.trim()) return;
                                    if (isForeshadowingLoading) return;
                                    setIsForeshadowingLoading(true);
                                    try {
                                      const existing = novel.foreshadowing || [];
                                      const res = await analyzeForeshadowing(
                                        currentChapter.id,
                                        currentChapter.title,
                                        currentChapter.content,
                                        existing
                                      );
                                      if (res && res.success && res.data) {
                                        const data = res.data as { newForeshadowing?: any[] };
                                        const others = existing.filter(item => item.chapterId !== currentChapter.id);
                                        const rawItems = Array.isArray(data.newForeshadowing) ? data.newForeshadowing : [];
                                        const now = new Date().toISOString();
                                        const newItems: Foreshadowing[] = rawItems.map((item, index) => {
                                          const raw = item as any;
                                          const vis = raw.visibility;
                                          const visibility: Foreshadowing['visibility'] =
                                            vis === 'reader_known' || vis === 'character_known' ? vis : 'author_only';
                                          const base: any = {
                                            content: String(raw.content || ''),
                                            chapterId: currentChapter.id,
                                            chapterTitle: String(raw.chapterTitle || currentChapter.title || ''),
                                            status: 'pending',
                                            type: raw.type === 'short_term' ? 'short_term' : 'long_term',
                                            visibility,
                                            createdAt: now
                                          };
                                          if (raw.id != null) {
                                            base.id = String(raw.id);
                                          }
                                          return base as Foreshadowing;
                                        }).filter(item => item.content);
                                        const updatedList: Foreshadowing[] = [...others, ...newItems];
                                        const changed =
                                          updatedList.length !== existing.length ||
                                          updatedList.some((item, idx) => item !== existing[idx]);
                                        if (changed) {
                                          setNovel(prev =>
                                            prev ? { ...prev, foreshadowing: updatedList } : prev
                                          );
                                          await updateForeshadowing(id, currentChapter.id, updatedList);
                                        }
                                      }
                                    } finally {
                                      setIsForeshadowingLoading(false);
                                    }
                                  }}
                                  disabled={isForeshadowingLoading || !currentChapter.content}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {isForeshadowingLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                  <Sparkles className="w-3 h-3" />
                                  <span>AI 分析伏笔</span>
                                </button>
                              </div>
                            </div>
                            <div className="px-6 md:px-12 mb-4 space-y-1 max-h-40 overflow-y-auto">
                              {chapterForeshadowing.length > 0 ? (
                                chapterForeshadowing.map(item => (
                                  <div
                                    key={item.id}
                                    className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300"
                                  >
                                    <span
                                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                                        item.status === 'pending' ? 'bg-amber-500' : 'bg-emerald-500'
                                      }`}
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                          {item.status === 'pending' ? '伏笔' : '已兑现'}
                                        </span>
                                        {item.chapterTitle && (
                                          <span className="text-[11px] text-zinc-400">
                                            首出现：{item.chapterTitle}
                                          </span>
                                        )}
                                        {item.status === 'resolved' && item.resolvedChapterTitle && (
                                          <span className="text-[11px] text-zinc-400">
                                            兑现于：{item.resolvedChapterTitle}
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-0.5 leading-relaxed whitespace-pre-wrap">
                                        {item.content}
                                      </p>
                                      <div className="mt-1 flex items-center gap-2">
                                        <select
                                          value={item.visibility || 'author_only'}
                                          onChange={async (e) => {
                                            const v = e.target.value as 'author_only' | 'reader_known' | 'character_known';
                                            const updated = (novel?.foreshadowing || []).map(f => f.id === item.id ? { ...f, visibility: v, characterId: v === 'character_known' ? f.characterId : undefined } : f);
                                            setNovel(prev => prev ? { ...prev, foreshadowing: updated } : prev);
                                            if (id && currentChapter?.id) {
                                              const chapterItems = updated.filter(i => i.chapterId === currentChapter.id);
                                              await updateForeshadowing(id, currentChapter.id, chapterItems);
                                            }
                                          }}
                                          className="text-[11px] px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                                        >
                                          <option value="author_only">作者秘密</option>
                                          <option value="reader_known">读者已知/角色未知</option>
                                          <option value="character_known">角色已知/读者未必知</option>
                                        </select>
                                        {(item.visibility || 'author_only') === 'character_known' && (
                                          <select
                                            value={String(item.characterId || '')}
                                            onChange={async (e) => {
                                              const cid = e.target.value || undefined;
                                              const updated = (novel?.foreshadowing || []).map(f => f.id === item.id ? { ...f, characterId: cid } : f);
                                              setNovel(prev => prev ? { ...prev, foreshadowing: updated } : prev);
                                              if (id && currentChapter?.id) {
                                                const chapterItems = updated.filter(i => i.chapterId === currentChapter.id);
                                                await updateForeshadowing(id, currentChapter.id, chapterItems);
                                              }
                                            }}
                                            className="text-[11px] px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                                          >
                                            <option value="">选择角色</option>
                                            {(novel?.lore || [])
                                              .filter((l: any) => l.type === 'character')
                                              .map((l: any) => (
                                                <option key={String(l.id ?? l._id ?? l.title)} value={String(l.id ?? l._id ?? '')}>
                                                  {l.title || l.name || '人物设定'}
                                                </option>
                                              ))}
                                          </select>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-zinc-400">
                                  本章暂未记录伏笔，可点击上方按钮让 AI 分析。
                                </div>
                              )}
                            </div>
                          </>
                        )}

                         {chapterViewMode === 'write' && (
                         <div className="px-6 md:px-12 flex items-center gap-2 mb-4">
                             <span className="text-3xl font-bold text-zinc-400 select-none whitespace-nowrap">
                                 第{novel?.volumes?.flatMap(v => v.chapters).findIndex(c => c.id === currentChapter.id) !== -1 
                                     ? (novel?.volumes?.flatMap(v => v.chapters).findIndex(c => c.id === currentChapter.id)! + 1)
                                     : '?'}章
                             </span>
                             <input 
                               type="text" 
                               value={currentChapter.title}
                               onChange={(e) => setCurrentChapter({ ...currentChapter, title: e.target.value })}
                               className="text-3xl font-bold bg-transparent border-none outline-none flex-1 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                               placeholder="章节标题"
                             />
                         </div>
                         )}
                        
                        {chapterViewMode === 'write' && (
                        <div className="px-6 md:px-12 mb-2 flex justify-end gap-2">
                           <button
                             onClick={handleFormatContent}
                             className="flex items-center gap-2 px-3 py-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium mr-auto"
                             title="一键排版（清理多余空行）"
                           >
                              <AlignLeft className="w-4 h-4" />
                              <span className="hidden sm:inline">一键排版</span>
                           </button>

                          <button
                           onClick={() => {
                             if (currentChapter) {
                               setEvaluatorChapterId(currentChapter.id);
                             }
                             setIsEvaluatorOpen(true);
                           }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-sm font-medium border border-purple-200 dark:border-purple-800"
                            title="AI 质量分析与重写"
                          >
                              <Sparkles className="w-4 h-4" />
                              <span className="hidden sm:inline">AI 辅助优化</span>
                           </button>

                           {isAiWriting && (
                             <button
                               onClick={handleStopAi}
                               className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium"
                             >
                                <Square className="w-4 h-4 fill-current" />
                                <span>停止生成</span>
                             </button>
                           )}
                           <button
                             onClick={() => setIsAiWriterModalOpen(true)}
                             disabled={isAiWriting}
                             className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-sm font-medium disabled:opacity-50"
                           >
                              <Sparkles className="w-4 h-4" />
                              <span>AI 辅助写作</span>
                           </button>
                           <button
                             onClick={handleSave}
                             disabled={isSaving}
                             className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:opacity-90 transition-colors text-sm font-medium disabled:opacity-50"
                           >
                              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              <span>保存</span>
                           </button>
                           <button
                             onClick={handleGenerateVideo}
                             disabled={isGeneratingVideo || !currentChapter}
                             className="hidden flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-sm font-medium disabled:opacity-50"
                           >
                              {isGeneratingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                              <span>生成视频</span>
                           </button>
                       </div>
                        )}

                        {chapterViewMode === 'pov' && (
                        <div className="px-6 md:px-12 pt-6 mb-4">
                          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">POV 与角色认知</span>
                                <button
                                  type="button"
                                  onClick={handleInitAllCharacterKnowledge}
                                  disabled={initAllKnowledgeStatus.state === 'initializing' || updateChapterKnowledgeStatus.state === 'updating'}
                                  className="text-xs px-2 py-1 rounded border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                                  title="初始化所有角色认知（故事开始前）"
                                >
                                  {initAllKnowledgeStatus.state === 'initializing' ? '初始化中...' : '初始化所有角色认知（故事开始前）'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleUpdateChapterAllCharacterKnowledge}
                                  disabled={updateChapterKnowledgeStatus.state === 'updating' || initAllKnowledgeStatus.state === 'initializing' || !currentChapter?.content?.trim() || !(currentChapter?.characterIds?.length)}
                                  className="text-xs px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
                                  title="章节编写完成后，一键更新本章关联角色的认知（更新到本章末）"
                                >
                                  {updateChapterKnowledgeStatus.state === 'updating' ? '更新中...' : '一键更新本章角色认知（写完后）'}
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={knowledgeCharacterId}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setKnowledgeCharacterId(v);
                                    setKnowledgeKnownFacts('');
                                    setKnowledgeMisunderstandings('');
                                    setKnowledgeSuspicions('');
                                    if (v && currentChapter) {
                                      handleLoadKnowledge(v);
                                    }
                                  }}
                                  className="text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
                                >
                                  <option value="">选择角色</option>
                                  {(novel?.lore || [])
                                    .filter((l: any) => l.type === 'character')
                                    .map((l: any) => {
                                      // 优先使用 loreId，其次使用 id
                                      const value = l.loreId != null ? String(l.loreId) : String(l.id ?? '');
                                      const key = l.loreId != null ? String(l.loreId) : String(l.id ?? l.title);
                                      return (
                                        <option key={key} value={value}>
                                          {l.title || l.name || '人物设定'}
                                        </option>
                                      );
                                    })}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleLoadKnowledge()}
                                  disabled={isLoadingKnowledge || !knowledgeCharacterId || !currentChapter}
                                  className="text-xs px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                                >
                                  {isLoadingKnowledge ? '加载中...' : '加载'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleGenerateKnowledge}
                                  disabled={isGeneratingKnowledge || !knowledgeCharacterId || !currentChapter}
                                  className="text-xs px-2.5 py-1.5 rounded-md border border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                                >
                                  {isGeneratingKnowledge ? '生成中...' : 'AI 一键生成'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveKnowledge}
                                  disabled={isSavingKnowledge || !knowledgeCharacterId || !currentChapter}
                                  className="text-xs px-2.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50"
                                >
                                  {isSavingKnowledge ? '保存中...' : '保存认知'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleLoadKnowledgeTimeline}
                                  disabled={!knowledgeCharacterId || isLoadingTimeline}
                                  className="text-xs px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                                >
                                  {isLoadingTimeline ? '加载时间线...' : '查看时间线'}
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                                <div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">已知事实</div>
                                  <textarea
                                    value={knowledgeKnownFacts}
                                    onChange={(e) => setKnowledgeKnownFacts(e.target.value)}
                                    placeholder="该角色在本章末已知的事实"
                                    className="w-full h-20 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none text-sm text-zinc-800 dark:text-zinc-200 resize-none"
                                  />
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">误解</div>
                                  <textarea
                                    value={knowledgeMisunderstandings}
                                    onChange={(e) => setKnowledgeMisunderstandings(e.target.value)}
                                    placeholder="该角色的误解或错误认知"
                                    className="w-full h-20 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none text-sm text-zinc-800 dark:text-zinc-200 resize-none"
                                  />
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">怀疑/预感</div>
                                  <textarea
                                    value={knowledgeSuspicions}
                                    onChange={(e) => setKnowledgeSuspicions(e.target.value)}
                                    placeholder="该角色的怀疑或预感"
                                    className="w-full h-20 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none text-sm text-zinc-800 dark:text-zinc-200 resize-none"
                                  />
                                </div>
                                {knowledgeTimeline.length > 0 && (
                                  <div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">角色认知时间线</div>
                                    <div className="space-y-2 max-h-40 overflow-auto border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-800/30">
                                      {knowledgeTimeline.map((k, idx) => (
                                        <div key={idx} className="text-xs text-zinc-700 dark:text-zinc-200">
                                          <div className="font-medium">章节：{k.chapterId ?? '初始'}</div>
                                          {k.knownFacts && <div>已知：{k.knownFacts}</div>}
                                          {k.misunderstandings && <div>误解：{k.misunderstandings}</div>}
                                          {k.suspicions && <div>怀疑：{k.suspicions}</div>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                          </div>
                        </div>
                        )}

                      {chapterViewMode === 'write' && (
                        <textarea 
                          value={currentChapter.content}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            setCurrentChapter(prev => prev ? { ...prev, content: newValue } : prev);
                          }}
                          className="flex-1 w-full bg-transparent border-none outline-none resize-none text-lg leading-relaxed text-zinc-800 dark:text-zinc-300 placeholder-zinc-400 px-6 md:px-12 pb-20 overflow-y-auto custom-scrollbar"
                          placeholder="开始你的创作..."
                        />
                      )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                  <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                  <p>请在左侧选择一个章节或设定</p>
                </div>
              )}
            </div>
          </div>
        </main>


        {/* Right Sidebar: AI Assistant / 使用指引 */}
        {(isAiOpen || isGuideOpen) && (
          <aside 
            style={{ width: aiSidebarWidth }}
            className="border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-col shrink-0 relative"
          >
            {/* Drag Handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-10"
              onMouseDown={() => setIsResizing(true)}
            />
             <div className="h-10 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 bg-white dark:bg-zinc-900">
               <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{isGuideOpen ? '使用指引' : 'AI 写作助手'}</span>
               {isGuideOpen && (
                 <button
                   type="button"
                   onClick={() => setIsGuideOpen(false)}
                   className="p-1.5 rounded-md text-xs text-zinc-500 hover:text-blue-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-blue-400 dark:hover:bg-zinc-700 transition-colors"
                   title="关闭使用指引"
                 >
                   <X className="w-4 h-4" />
                 </button>
               )}
             </div>
            {isGuideOpen && (
              <div className="flex-1 p-4 overflow-auto space-y-3">
                {[
                  { id: 'lore', title: '设定集设定', items: [
                    '入口位置',
                    '在编辑工作台左侧/侧边栏点击【设定集】，选择分类（人物/世界观/地点/势力/物品/时间线等）。',
                    '通用操作步骤',
                    '1. 新建设定：选择分类 → 点击【新增】 → 填写标题与正文 → 【保存】。',
                    '2. 编辑设定：点击条目 → 修改内容 → 【保存】。',
                    '1 AI 优化入口（通用）',
                    '1. 进入某个设定条目详情。',
                    '2. 点击【AI 优化/AI 润色/AI 补全】。',
                    '3. 在“优化指令”输入框中说明你的目标与约束（例如：补全童年事件、强化矛盾点、不要改硬设定）。',
                    '4. 点击【开始优化】并等待返回。',
                    '注意事项',
                    '- 指令越具体、约束越明确（不改姓名/性别/关键事实），结果越可控。',
                    '2 人物设定优化（示例指令可直接复用）',
                    '- “保持姓名、年龄、身份不变。补全其童年事件与情绪触发点，强化与反派的矛盾来源，并给出 3 条典型口头禅。”',
                    '- “将人物设定改为更适合第一人称叙事，语气更克制，不要新增无关角色。”',
                    '3 对比与选择接受（非常重要）',
                    '1. AI 返回后会显示【原文】与【AI 修改后】两列对比。',
                    '2. 对每个差异块，点击【接受】或【拒绝】。',
                    '3. 如需快捷处理，使用【全部接受】或【全部拒绝】（若提供）。',
                    '4. 点击【应用/保存】写回设定条目。',
                    '注意事项',
                    '- 谨慎对待“凭空新增关键设定”的改动；优先接受结构化表达与信息补全。',
                    '4 设定集 AI 审查（Review）',
                    '作用：面向“全设定/某分类/某条目”的一致性与质量检查，快速发现问题并给出修复建议。',
                    '入口位置：',
                    '- 设定集页面顶部工具区（Lore 区域顶部工具栏）的【AI审查】按钮。',
                    '- 点击后会切换到“审查面板”（lore-ai 标签页），展示审查建议卡片列表。',
                    '操作步骤：',
                    '1. 选择审查范围：',
                    '   - 【当前条目】/【当前分类】/【全设定集】。',
                    '2. 选择审查维度（常见）：',
                    '   - 逻辑冲突（自相矛盾、因果链断裂）',
                    '   - 术语一致（名词/称谓/地名/能力描述统一性）',
                    '   - 硬设定违规（姓名/性别/身份等被不当改动）',
                    '   - 时间线问题（事件前后顺序矛盾、年龄/年份不匹配）',
                    '   - 角色语气偏差（说话风格与人设不符）',
                    '   - 敏感/禁用词（如需过滤）',
                    '3. 点击【开始审查】，等待生成报告。',
                    '审查结果呈现：',
                    '- 问题清单：严重程度（高/中/低）、问题描述、定位跳转、修复建议。',
                    '- 处理方式：',
                    '  - 在建议卡片的“明确修改”区使用【复制替换文本】按钮复制 AI 给出的修正文本；',
                    '  - 点击【去修改】按钮，系统会定位到对应设定项（进入该条目的编辑视图）；',
                    '  - 将复制的文本粘贴到对应字段中，按需微调后【保存】；',
                    '  - 如需比对流程，可在该设定条目内触发【AI 优化】，进入对比界面逐条【接受/拒绝】；',
                    '  - 【忽略】（记录为已知问题，不做修改）',
                    '- 注：当前前端不提供【一键修复/批量应用】，请按上述“复制 → 去修改 → 粘贴保存”的手动方式逐条处理。',
                    '- 报告导出（如提供）：可【下载审查报告】用于团队协作与留存。',
                    '注意事项：',
                    '- 高严重度优先：例如硬设定违规、时间线矛盾先处理。',
                    '- 一键修复前建议进入“对比界面”逐条核验，避免误改已确认内容。',
                    '- 审查后建议统一术语：在设定集建立“术语表/名词库”，减少未来不一致。'
                  ] },
                  { id: 'lore-review', title: '设定集 AI 审查', items: [
                    '入口位置',
                    '设定集页面顶部工具区（Lore 区域顶部工具栏）的【AI审查】按钮。',
                    '点击后会切换到“审查面板”（lore-ai 标签页），展示审查建议卡片列表。',
                    '操作步骤',
                    '1. 选择审查范围：',
                    '   - 【当前条目】/【当前分类】/【全设定集】。',
                    '2. 选择审查维度（常见）：',
                    '   - 逻辑冲突（自相矛盾、因果链断裂）',
                    '   - 术语一致（名词/称谓/地名/能力描述统一性）',
                    '   - 硬设定违规（姓名/性别/身份等被不当改动）',
                    '   - 时间线问题（事件前后顺序矛盾、年龄/年份不匹配）',
                    '   - 角色语气偏差（说话风格与人设不符）',
                    '   - 敏感/禁用词（如需过滤）',
                    '3. 点击【开始审查】，等待生成报告。',
                    '审查结果呈现',
                    '- 问题清单：严重程度（高/中/低）、问题描述、定位跳转、修复建议。',
                    '- 处理方式：',
                    '  - 在建议卡片的“明确修改”区使用【复制替换文本】按钮复制 AI 给出的修正文本；',
                    '  - 点击【去修改】按钮，系统会定位到对应设定项（进入该条目的编辑视图）；',
                    '  - 将复制的文本粘贴到对应字段中，按需微调后【保存】；',
                    '  - 如需比对流程，可在该设定条目内触发【AI 优化】，进入对比界面逐条【接受/拒绝】；',
                    '  - 【忽略】（记录为已知问题，不做修改）',
                    '- 注：当前前端不提供【一键修复/批量应用】，请按上述“复制 → 去修改 → 粘贴保存”的手动方式逐条处理。',
                    '- 报告导出（如提供）：可【下载审查报告】用于团队协作与留存。',
                    '注意事项',
                    '- 高严重度优先：例如硬设定违规、时间线矛盾先处理。',
                    '- 一键修复前建议进入“对比界面”逐条核验，避免误改已确认内容。',
                    '- 审查后建议统一术语：在设定集建立“术语表/名词库”，减少未来不一致。'
                  ] },
                  { id: 'volume-road', title: '分卷优化', items: [
                    '入口位置',
                    '在项目导航中进入【分卷/卷管理】。',
                    '1 分卷大纲优化',
                    '1. 打开某分卷详情，编辑标题与分卷摘要/目标。',
                    '2. 点击【AI 优化分卷大纲】并等待结果。',
                    '3. 进入对比界面，逐条【接受/拒绝】，最后【保存】。',
                    '注意事项',
                    '- 分卷大纲建议明确“开端-发展-转折-高潮-结局”与主角代价路径。',
                    '2 路标页面（核心用法）',
                    '入口位置',
                    '分卷详情页或“路标”页签。',
                    '操作步骤',
                    '1. 新建路标：点击【新增路标】，填写“标题 + 描述（发生了什么、谁参与、结果/后果、推动主线）”。',
                    '2. 可补充参与人物、冲突/转折、与分卷目标关联。',
                    '3. 生成章节：在路标项点击【生成章节】，等待系统拆出多个章节标题/摘要。',
                    '4. 检查生成的章节顺序与过渡是否合理；不满意，返回路标加细描述后再生成。',
                    '注意事项（路标写作标准）',
                    '- 一句话能说清“谁要做什么，为什么，遇到什么阻碍，结果如何”。',
                    '- 少用抽象口号（如“变强”），多写可执行事件（如“偷账本失败同伴被抓”）。'
                  ] },
                  { id: 'beats', title: '进入章节，生成“章纲”', items: [
                    '入口位置',
                    '章节目录中点击某一章 → 切到【章纲/Beat Sheet】页签或模块。',
                    '操作步骤',
                    '1. 点击【AI 生成章纲】并等待结果。',
                    '2. 章纲通常包含“目标/冲突/钩子/场景节拍”。',
                    '3. 人工微调后点击【保存章纲】。',
                    '注意事项',
                    '- 若本章摘要很空，先补一句“本章要解决的冲突/目标”，再生成章纲。'
                  ] },
                  { id: 'knowledge-init', title: '初始化人物认知', items: [
                    '入口位置',
                    '章节编辑页切到【人物认知】视图。',
                    '操作步骤',
                    '1. 点击【初始化/生成人物认知】。',
                    '2. 检查是否出现“提前知道真相/认知穿越”等问题。',
                    '3. 调整后【保存】。',
                    '注意事项',
                    '- 人物认知依赖“章纲、前文内容、出场人物”，因此第 7 步的选人很关键。'
                  ] },
                  { id: 'characters', title: '章节正文编辑', items: [
                    '1 选择本章出场人物（必做）',
                    '入口位置',
                    '章节编辑页的【出场人物/选择人物】入口。',
                    '操作步骤',
                    '1. 勾选本章实际出场的人物。',
                    '2. 点击【保存/应用】。',
                    '注意事项',
                    '- 出场人物会影响对白风格、冲突编排、认知更新准确性。',
                    '2 AI 辅助写作',
                    '入口位置',
                    '正文编辑区顶部，点击【AI 辅助写作】。',
                    '操作步骤',
                    '1. 在弹窗“写作指令”中说明要生成的段落类型与约束（字数/视角/节奏）。',
                    '2. 点击【开始生成】；生成后插入/追加到正文（以系统行为为准）。',
                    '3. 完成后【保存章节】。',
                    '注意事项',
                    '- 只写某一段时，明确“从哪里开始写/写到哪里停”；如支持插入位置，先把光标放好。'
                  ] },
                  { id: 'chapter-opt', title: 'AI 辅助优化章节正文', items: [
                    '入口位置',
                    '章节编辑页顶部或右侧工具区的【AI 优化/分析与优化】。',
                    '操作步骤',
                    '1. 选择优化维度（逻辑一致性/人物一致性/节奏张力/语言表达/伏笔机会等）或一键优化。',
                    '2. 等待 AI 返回“优化后版本”。',
                    '3. 进入对比界面，逐块【接受/拒绝】，或使用【全部接受/全部拒绝】。',
                    '4. 点击【应用修改/保存章节内容】。',
                    '注意事项（新手筛选策略）',
                    '- 优先接受：更清晰的动作顺序、更自然对白、更明确因果。',
                    '- 谨慎接受：新增背景设定、过多内心独白、强行改走剧情。',
                    '- 直接拒绝：擅自改名、擅自新增关键设定、推翻既定事实。'
                  ] },
                  { id: 'knowledge-update', title: '更新人物认知', items: [
                    '入口位置',
                    '章节的【人物认知】视图。',
                    '操作步骤',
                    '1. 正文优化并保存后，点击【一键更新人物认知】。',
                    '2. 检查是否出现“认知穿越/提前知道”。',
                    '3. 调整后【保存】。',
                    '注意事项',
                    '- 每次大改正文后都建议同步一次，保证后续章节的行为一致性。'
                  ] },
                  { id: 'foreshadow', title: 'AI 生成伏笔', items: [
                    '入口位置',
                    '章节或项目中的【伏笔/伏笔管理】视图。',
                    '操作步骤',
                    '1. 点击【AI 分析/生成伏笔】。',
                    '2. 查看系统生成的伏笔条目（描述、类型：短期/长期；状态：待回收/已回收；可见性；可能关联人物/回收章节）。',
                    '3. 选择保留的条目并【保存】。',
                    '注意事项',
                    '- 伏笔是“承诺”；仅保留最能服务主线与人物成长的条目，避免信息噪音。'
                  ] },
                  { id: 'assistant', title: 'AI 助手', items: ['右侧面板进行 @ 提问 与 指令模式编辑', '谨慎应用改动，优先通过对比界面确认'] },
                  { id: 'download', title: '下载', items: ['在设定集与章节导航栏点击“下载”图标', '选择范围与格式并下载'] },
                  { id: 'tips', title: '新手提示', items: ['每次只改动必要部分；大改后更新人物认知并复查伏笔', '自动改动尽量通过“对比界面”逐条确认', '建立术语表/名词库统一称谓与关键词'] }
                ].map((sec, idx) => {
                  const open = !!guideOpenMap[sec.id];
                  return (
                    <div key={sec.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg">
                      <button
                        onClick={() => setGuideOpenMap(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                        className="w-full px-3 py-2 flex items-center justify-between text-zinc-700 dark:text-zinc-200"
                      >
                        <span className="text-sm font-medium">{`${idx + 1}. ${sec.title}`}</span>
                        {open ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                      </button>
                      {open && (
                        <div className="px-4 pb-3">
                          <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                            {sec.items.map((it, iidx) => {
                              const isHeading =
                                /^(入口位置|通用操作步骤|操作步骤|注意事项|审查结果呈现|标准工作流总览（建议每次按此顺序执行）|新手提示)(：)?$/.test(it) ||
                                /^\d+(\.\d+)*\s/.test(it) ||
                                /^注意事项（/.test(it);
                              return (
                                <li
                                  key={`${sec.id}-${iidx}`}
                                  className={isHeading ? 'font-semibold text-zinc-700 dark:text-zinc-200 mt-2' : undefined}
                                >
                                  {it}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Chat History */}
             <div className={`flex-1 p-4 overflow-auto space-y-4 ${isGuideOpen ? 'hidden' : ''}`}>
               {messages.map((msg, i) => (
                 <div key={msg.id || Math.random().toString()} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'assistant' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                     {msg.role === 'assistant' ? <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" /> : <div className="text-xs font-bold text-zinc-600 dark:text-zinc-400">ME</div>}
                   </div>
                   
                   {msg.type === 'action_confirm' && msg.actionData ? (
                      <div className="max-w-[85%] relative">
                        <AiActionCard 
                          intent={msg.actionData.intent}
                          status={msg.actionData.status}
                          error={msg.actionData.error}
                          onExecute={() => handleExecuteAction(msg.id, msg.actionData!.intent)}
                          onCancel={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
                        />
                        <button
                          type="button"
                          onClick={() => handleRegenerate(i)}
                          disabled={isLoading}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 shadow hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors"
                          title="重新生成该回复"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                        </button>
                      </div>
                   ) : (
                     <div className={`p-3 rounded-lg border shadow-sm text-sm max-w-[85%] ${
                      msg.role === 'assistant' 
                        ? 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300' 
                        : 'bg-blue-600 text白 border-transparent'
                    }`}>
                      {msg.role === 'assistant' ? (
                        ((i === messages.length - 1) && isLoading && !(msg.content || '').trim().length) ? (
                          <div className="flex items-center gap-1 h-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse" style={{ animationDelay: '300ms' }} />
                          </div>
                        ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4">
                            <ReactMarkdown>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )
                      ) : (
                        msg.content
                      )}
                      <div className="mt-2 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const text = msg.content || '';
                            if (!text) return;
                            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                              navigator.clipboard
                                .writeText(text)
                                .then(() => {
                                  window.dispatchEvent(
                                    new CustomEvent('ainovel:toast', {
                                      detail: { type: 'info', message: '已复制到剪贴板' }
                                    })
                                  );
                                })
                                .catch(() => {});
                            }
                          }}
                          className="p-1.5 rounded-md text-xs text-zinc-500 hover:text-blue-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-blue-400 dark:hover:bg-zinc-700 transition-colors"
                          title="复制文本"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {msg.role === 'assistant' && (
                          <button
                            type="button"
                            onClick={() => handleRegenerate(i)}
                            disabled={isLoading || (((i === messages.length - 1) && isLoading && !(msg.content || '').trim().length))}
                            className="p-1.5 rounded-md text-xs text-zinc-500 hover:text-blue-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-blue-400 dark:hover:bg-zinc-700 transition-colors"
                            title="重新生成该回复"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {msg.role === 'assistant' && assistantGuideMsgId === msg.id && (
                        <div className="mt-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-xs text-zinc-700 dark:text-zinc-300 space-y-3">
                          <div>
                            <div className="font-semibold">上下文检索式</div>
                            <div className="mt-1">操作步骤</div>
                            <ol className="list-decimal pl-5">
                              <li>在输入框键入 @，选择对象（章节/设定/人物等）。</li>
                              <li>输入问题并发送，例如：</li>
                            </ol>
                            <ul className="list-disc pl-5 mt-1">
                              <li>“@第十二章：这章冲突是否足够？有什么升级建议？”</li>
                              <li>“@人物-林曜：动机在第 8 章是否自洽？如何补一段铺垫？”</li>
                            </ul>
                            <div className="mt-1">注意事项</div>
                            <ul className="list-disc pl-5">
                              <li>提问尽量带“目标”（要结构方案/修改建议/台词备选等），便于直接落地。</li>
                            </ul>
                          </div>
                          <div className="pt-1 border-t border-zinc-200 dark:border-zinc-700">
                            <div className="font-semibold">指令模式</div>
                            <ol className="list-decimal pl-5">
                              <li>开启指令模式后，在输入框写“可执行修改”的命令，例如：</li>
                            </ol>
                            <ul className="list-disc pl-5 mt-1">
                              <li>“把本章结尾改成反转式钩子，但不改变已发生事件。”</li>
                              <li>“将人物设定中的‘背景经历’改写得更克制，删掉夸张形容。”</li>
                            </ul>
                            <ol className="list-decimal pl-5 mt-1">
                              <li>发送后查看返回的修改结果/应用建议（以系统实际行为为准）。</li>
                            </ol>
                            <div className="mt-1">注意事项</div>
                            <ul className="list-disc pl-5">
                              <li>写清约束：不改人名、不改关键事实、只改某一段、控制字数等。</li>
                              <li>大改时优先走“对比选择”流程，避免误伤已确认内容。</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                   )}
                 </div>
               ))}
              {isLoading && !(
                messages.length > 0 && 
                messages[messages.length - 1].role === 'assistant'
              ) && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify中心 shrink-0">
                    <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="bg白 dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {!isGuideOpen && (
            <div className={`p-4 border-t border-zinc-200 dark:border-zinc-800 transition-colors ${
               isCommandMode ? 'bg-purple-50/30 dark:bg-purple-900/10' : 'bg-white dark:bg-zinc-900'
             }`}>
              <div className="flex items-center gap-2 mb-2">
                  <button
                      onClick={() => setIsCommandMode(!isCommandMode)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          isCommandMode 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                          : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                      }`}
                  >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isCommandMode ? '指令模式' : '切换到指令模式'}
                  </button>
                  {isCommandMode && <span className="text-xs text-zinc-400">输入自然语言指令，例如“把第一章标题改成...”</span>}
              </div>
              
              <SmartTextarea
                 value={input}
                 onChange={setInput}
                 onSend={handleSend}
                 onStop={handleStopChat}
                 isLoading={isLoading}
                 references={novelReferences}
                 onReferenceAdd={(ref) => setSelectedReferences(prev => [...prev, ref])}
                 placeholder={isCommandMode ? "请输入指令..." : "输入消息..."}
              />
              <div className="mt-2 flex items-center gap-2 justify-end">
                <div className="hidden flex items-center gap-2">
                  <div className="text-xs text-zinc-500">轮数</div>
                  <select
                    value={historyRounds}
                    onChange={(e) => setHistoryRounds(Math.max(1, Math.min(20, Number(e.target.value))))}
                    className="text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 select-none">
                    <input
                      type="checkbox"
                      checked={enableSummarize}
                      onChange={(e) => setEnableSummarize(e.target.checked)}
                    />
                    摘要
                  </label>
                  <select
                    value={summarizeMode}
                    onChange={(e) => setSummarizeMode(e.target.value as any)}
                    disabled={!enableSummarize}
                    className="text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1"
                  >
                    <option value="none">无</option>
                    <option value="simple">简单</option>
                    <option value="detailed">详细</option>
                    <option value="auto">自动</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setMessages([{ id: 'init', role: 'assistant', content: '你好！我是你的 AI 写作助手。有什么我可以帮你的吗？' }])}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
title="清空当前对话"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>清空</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const all = [...messages];
                    if (all.length === 0) {
                      setMessages([{ id: 'init', role: 'assistant', content: '你好！我是你的 AI 写作助手。有什么我可以帮你的吗？' }]);
                      return;
                    }
                    let perMsg = 120;
                    let maxTotal = 800;
                    let titleText = '对话摘要：';
                    if (summarizeMode === 'simple') {
                      perMsg = 80;
                      maxTotal = 600;
                      titleText = '摘要：';
                    } else if (summarizeMode === 'detailed') {
                      perMsg = 160;
                      maxTotal = 1200;
                      titleText = '详细摘要：';
                    } else if (summarizeMode === 'auto') {
                      if (historyRounds > 10) {
                        perMsg = 60;
                        maxTotal = 500;
                        titleText = '摘要：';
                      } else {
                        perMsg = 120;
                        maxTotal = 900;
                        titleText = '摘要：';
                      }
                    }
                    const parts: string[] = [];
                    for (const m of all) {
                      const head = `${m.role === 'user' ? '用户' : '助手'}: `;
                      const txt = (m.content || '').replace(/\s+/g, ' ').slice(0, perMsg);
                      parts.push(head + txt);
                      if (parts.join('\n').length >= maxTotal) break;
                    }
                    const summaryText = parts.join('\n');
                    const summaryMsg = { id: Date.now().toString(), role: 'assistant' as const, content: `${titleText}\n${summaryText}` };
                    setMessages([{ id: 'init', role: 'assistant', content: '你好！我是你的 AI 写作助手。有什么我可以帮你的吗？' }, summaryMsg]);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-sm"
                  title="清空并生成摘要"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>清空+摘要</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                    setAssistantGuideMsgId(prev => (prev === lastAssistant?.id ? null : lastAssistant?.id || null));
                  }}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title="显示使用指引"
                >
                  <Info className="w-3 h-3" />
                  <span>{assistantGuideMsgId ? '隐藏指引' : '使用指引'}</span>
                </button>
              </div>
              {enableSummarize && summaryPreview && (
                <div className="mt-2 p-2 border border-zinc-200 dark:border-zinc-800 rounded-md bg-zinc-50 dark:bg-zinc-800/30">
                  <div className="text-xs text-zinc-500 mb-1">摘要</div>
                  <div className="text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-200 max-h-40 overflow-auto">
                    {summaryPreview}
                  </div>
                </div>
              )}
            </div>
            )}
          </aside>
        )}
      </div>
      {/* Chapter Evaluator Panel (Right Side Overlay) */}
      {isEvaluatorOpen && currentChapter && (
        <div className="absolute right-0 top-0 bottom-0 z-50 animate-in slide-in-from-right duration-300">
           <ChapterEvaluator
             chapter={currentChapter}
             previousChapter={previousChapter}
             volumeSummary={currentVolume?.summary}
             globalLore={novel?.lore?.map(l => `${l.title}: ${l.content}`).join('\n')}
             foreshadowing={novel?.foreshadowing}
             coreSettings={novel?.coreSettings}
             onClose={() => setIsEvaluatorOpen(false)}
             onRewrite={(newContent) => {
               const targetChapterId = evaluatorChapterId || currentChapter.id;
               const allVolumes = novel?.volumes || [];
               let targetChapter: Chapter | null = null;
               let targetVolumeId: string | null = null;
               for (const v of allVolumes) {
                 const found = v.chapters.find(c => c.id === targetChapterId);
                 if (found) {
                   targetChapter = found;
                   targetVolumeId = v.id;
                   break;
                 }
               }
               const originalContent = targetChapter?.content || currentChapter.content;

               setDiffData({
                 original: originalContent,
                 modified: newContent,
                 onAccept: async (finalContent) => {
                   const updatedChapter: Chapter = targetChapter
                     ? { ...targetChapter, content: finalContent }
                     : { ...currentChapter, id: targetChapterId, content: finalContent };
                   setCurrentChapter(updatedChapter);
                   if (id && targetVolumeId) {
                     await updateChapter(id, targetVolumeId, targetChapterId, { content: finalContent });
                   }
                   setDiffData(null);
                   setIsEvaluatorOpen(false);
                   setActiveTab('editor');
                 },
                 onReject: () => {
                   setDiffData(null);
                   setActiveTab('editor');
                 }
               });
               setActiveTab('diff');
             }}
           />
        </div>
      )}

      {isOptimizeVolumeOpen && currentVolume && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">AI 优化分卷大纲</h3>
            </div>
            <div className="p-4 space-y-3">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">优化要求</label>
              <textarea
                value={optimizeInstruction}
                onChange={(e) => setOptimizeInstruction(e.target.value)}
                placeholder="请输入希望优化的方向，例如：强化主线冲突、提升人物成长线的连贯性等"
                className="w-full h-32 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm text-zinc-800 dark:text-zinc-200 resize-none"
              />
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">字数要求（允许±10%浮动）</label>
                <input
                  type="number"
                  value={optimizeWordCount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setOptimizeWordCount('');
                    } else {
                      const n = parseInt(v, 10);
                      setOptimizeWordCount(Number.isNaN(n) ? '' : n);
                    }
                  }}
                  placeholder="例如：800"
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm text-zinc-800 dark:text-zinc-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setIsOptimizeVolumeOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                disabled={isOptimizingVolume}
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!id || !currentVolume) return;
                  const baseText = currentVolume.summary || '';
                  setIsOptimizingVolume(true);
                  try {
                    const characters = (novel?.lore || []).filter(l => l.type === 'character');
                    const ctx = characters.map((l) => {
                      const title = l.title || l.name || '';
                      const role = l.role || '';
                      const personality = l.personality || '';
                      const background = l.background || '';
                      const content = l.content || l.description || l.bio || '';
                      return `【${title}】\n身份：${role}\n性格：${personality}\n背景：${background}\n${content}`;
                    }).join('\n\n');
                    const wcLine = typeof optimizeWordCount === 'number' && optimizeWordCount > 0
                      ? `整体字数控制在约${optimizeWordCount}字，允许±10%浮动。`
                      : '';
                    const rules =
                      `编写规则：\n` +
                      `1) 输出3-5个核心场景，每个场景必须包含“时间、地点、人物冲突”三要素。\n` +
                      `2) 每个场景采用“悬念-冲突-转折”三段式结构。\n` +
                      `3) 至少包含两处伏笔提示，使用【伏笔】进行标注。\n` +
                      `4) 场景间使用“---”分隔，并标注场景序号（如【场景一】、【场景二】）。\n` +
                      `5) ${wcLine}\n` +
                      `6) 禁用抽象形容词，所有描述需具体到可拍摄的视觉细节。\n` +
                      `7) 严格符合人物设定与既有逻辑，不得改动既有设定。`;
                    const finalInstruction =
                      (optimizeInstruction ? `${optimizeInstruction}\n\n` : '') +
                      rules +
                      `\n\n只输出改写后的分卷摘要文本，不要解释过程。`;
                    const res = await refineText({
                      text: baseText,
                      context: `人物设定参考：\n${ctx}\n\n请确保修改严格符合人物设定，不得改变既有设定逻辑。`,
                      instruction: finalInstruction
                    });
                    if (!res.success || !res.data) {
                      alert(res.error || '优化失败');
                      setIsOptimizingVolume(false);
                      return;
                    }
                    let optimizedText = res.data;
                    const target = typeof optimizeWordCount === 'number' && optimizeWordCount > 0 ? optimizeWordCount : undefined;
                    if (target) {
                      const minLen = Math.floor(target * 0.9);
                      const maxLen = Math.ceil(target * 1.1);
                      const currentLen = optimizedText.length;
                      if (currentLen < minLen || currentLen > maxLen) {
                        const lengthAdjustInstruction =
                          `${rules}\n` +
                          `长度约束：请将当前文本从约${currentLen}字调整到${minLen}~${maxLen}字范围。\n` +
                          `保持已有结构与场景序号不变，增加具体“可拍摄的视觉细节”（镜头、光线、动作、布景、道具、音效等）以补足字数。\n` +
                          `禁用抽象形容词，禁止扩写无关背景；仅在现有场景内细化。\n` +
                          `只输出调整后的文本。`;
                        const adjustRes = await refineText({
                          text: optimizedText,
                          context: `人物设定参考：\n${ctx}\n\n该文本已包含结构，请在不改变设定与结构的前提下进行长度调整。`,
                          instruction: lengthAdjustInstruction
                        });
                        if (adjustRes.success && adjustRes.data) {
                          optimizedText = adjustRes.data;
                        }
                      }
                    }
                    const hasSections = /卷名：[\s\S]*?卷核心冲突：[\s\S]*?卷人物成长：[\s\S]*?卷世界观推进：[\s\S]*?卷末悬念钩子：[\s\S]*/.test(optimizedText);
                    const shuangdianCount = (optimizedText.match(/爽点[：:]/g) || []).length;
                    const hasHook = /卷末悬念钩子：[\s\S]*?(钩子|悬念)/.test(optimizedText);
                    const hasGrowthQuant = /卷人物成长：[\s\S]*?(等级|Lv|阶段|数值|百分比|称号|权限)/.test(optimizedText);
                    const hasWorldInc = /卷世界观推进：[\s\S]*?(新势力|地图|规则|体系|设定|揭示|扩展|升级|解锁|增量)/.test(optimizedText);
                    const noSceneLevel = !/(【场景|场景一|时间：|地点：|悬念-冲突-转折|---)/.test(optimizedText);
                    const qualityOk = hasSections && shuangdianCount >= 3 && hasHook && hasGrowthQuant && hasWorldInc && noSceneLevel;
                    if (!qualityOk) {
                      const fixInstruction =
                        `你是资深网络文学主编。将当前文本重构为五段式：\n` +
                        `卷名→卷核心冲突→卷人物成长→卷世界观推进→卷末悬念钩子。\n` +
                        `要求：每卷爽点≥3（用“爽点：”标注）、卷末至少1个钩子、成长刻度可量化（如等级/Lv/权限/称号/数值）、世界观增量可感知（新势力/规则/地图等），禁止章纲级场景描述与“时间/地点/场景”分隔。\n` +
                        `${wcLine}\n` +
                        `只输出上述五段式文本。`;
                      const fixRes = await refineText({
                        text: optimizedText,
                        context: `人物设定参考：\n${ctx}\n\n禁止臆造设定，严格按五段式输出。`,
                        instruction: fixInstruction
                      });
                      if (fixRes.success && fixRes.data) {
                        optimizedText = fixRes.data;
                      }
                    }
                    setIsOptimizeVolumeOpen(false);
                    setIsOptimizingVolume(false);
                    setDiffData({
                      original: baseText,
                      modified: optimizedText,
                      onAccept: async (finalContent: string) => {
                        setCurrentVolume(prev => prev ? { ...prev, summary: finalContent } : prev);
                        await updateVolume(id, currentVolume.id, { summary: finalContent });
                        setDiffData(null);
                        setActiveTab('volume');
                        setVolumeViewMode('edit');
                      },
                      onReject: () => {
                        setDiffData(null);
                        setActiveTab('volume');
                        setVolumeViewMode('edit');
                      }
                    });
                    setActiveTab('diff');
                  } catch (e) {
                    alert('网络错误');
                    setIsOptimizingVolume(false);
                  }
                }}
                className="px-4 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                disabled={isOptimizingVolume}
              >
                {isOptimizingVolume ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isOptimizingVolume ? '正在优化...' : '确定优化'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Volume Dialog */}
      <Dialog open={isCreateVolumeOpen} onOpenChange={setIsCreateVolumeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分卷</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                分卷标题
              </label>
              <Input
                value={newVolumeTitle}
                onChange={(e) => setNewVolumeTitle(e.target.value)}
                placeholder="请输入分卷标题"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreatingVolume && newVolumeTitle.trim()) {
                    // Trigger confirm logic
                    const confirmBtn = document.getElementById('create-volume-confirm');
                    confirmBtn?.click();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateVolumeOpen(false)} disabled={isCreatingVolume}>
              取消
            </Button>
            <Button 
              id="create-volume-confirm"
              onClick={async () => {
                if (!newVolumeTitle.trim() || !id) return;
                setIsCreatingVolume(true);
                try {
                  const res = await createVolume(id, newVolumeTitle.trim());
                  if (res.success) {
                    const novelRes = await getNovel(id);
                    if (novelRes.success) setNovel(novelRes.data);
                    setIsCreateVolumeOpen(false);
                    toast.success('分卷创建成功');
                  } else {
                    toast.error('创建失败: ' + res.error);
                  }
                } catch (error) {
                  console.error('Failed to create volume:', error);
                  toast.error('网络错误，请重试');
                } finally {
                  setIsCreatingVolume(false);
                }
              }} 
              disabled={isCreatingVolume || !newVolumeTitle.trim()}
            >
              {isCreatingVolume && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chapter Generation Modal */}
      {isChapterModalOpen && modalVolumeId && modalVolumeData && (
        <ChapterGenerationModal
          isOpen={isChapterModalOpen}
          onClose={() => setIsChapterModalOpen(false)}
          volumeTitle={modalVolumeData.title}
          volumeSummary={modalVolumeData.summary}
          previousChapterTitle={currentChapter?.title}
          previousChapterContent={currentChapter?.content}
          onConfirm={async (title, summary) => {
            if (id && modalVolumeId) {
              // Create chapter
              const res = await createChapter(id, modalVolumeId, title);
              if (res.success) {
                // If AI generated a summary, we might want to append it to the content initially
                if (summary) {
                   await updateChapter(id, res.data.id, { 
                     content: `（本章大纲：${summary}）\n\n` 
                   });
                }
                
                // Refresh
                const novelRes = await getNovel(id);
                if (novelRes.success) {
                  setNovel(novelRes.data);
                  // Auto switch to new chapter
                  // We need to find the new chapter object from the refreshed data
                  const newVol = novelRes.data.volumes.find(v => v.id === modalVolumeId);
                  const newChap = newVol?.chapters.find(c => c.id === res.data.id);
                  if (newChap) {
                    setCurrentChapter(newChap);
                    setActiveTab('editor');
                  }
                }
              }
            }
          }}
        />
      )}

      {/* Batch Chapter Modal */}
      <BatchChapterModal 
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onConfirm={handleBatchCreate}
        isProcessing={isBatchProcessing}
        volumeData={modalVolumeData || undefined}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeDelete}
        title={deleteModal.title}
        message={
          deleteModal.type === 'volume' ? '确定要删除整卷吗？卷内所有章节也将被删除！此操作无法撤销。' : 
          deleteModal.type === 'lore' ? '确定要删除该设定吗？此操作无法撤销。' :
          '确定要删除该章节吗？此操作无法撤销。'
        }
        confirmText="确认删除"
      />

      {/* Lore Input Modal */}
      <InputModal
        isOpen={loreModal.isOpen}
        onClose={() => setLoreModal(prev => ({ ...prev, isOpen: false }))}
        title={loreModal.title}
        defaultType={loreModal.type}
        placeholder="请输入设定名称..."
        onConfirm={async (value, type) => {
          if (id) {
             const res = await createLorePost(id, value, type);
             if (res.success) {
                // Refresh
                const novelRes = await getNovel(id);
                if (novelRes.success) {
                    setNovel(novelRes.data);
                    // Select the new lore
                    // Need to find it. The ID is in res.data.id
                    // But we might need to wait for refresh or just manually set it
                    const newLore = res.data;
                    setCurrentLore(newLore);
                    setActiveTab('lore');
                    setSidebarMode('lore'); // Ensure sidebar is visible
                }
             } else {
                 alert('创建失败: ' + res.error);
             }
          }
        }}
      />

      {/* AI Character Generator Modal */}
      <CharacterGeneratorModal
        isOpen={isAiCharacterModalOpen}
        onClose={() => setIsAiCharacterModalOpen(false)}
        onGenerate={handleAiGenerateCharacters}
        onConfirm={handleConfirmAiCharacters}
      />

      <OutlineGeneratorModal
        isOpen={isAiOutlineModalOpen}
        onClose={() => setIsAiOutlineModalOpen(false)}
        novelInfo={{
          title: novel?.title || '',
          description: defaultDescription,
          genre: defaultGenre,
          style: defaultStyle
        }}
        onConfirm={async (outlineData) => {
          if (!novel || !id) return;
          
          try {
            // Convert outlineData to Markdown string if it's an object
            let markdown = '';
            if (typeof outlineData === 'string') {
                markdown = outlineData;
            } else {
                // Assuming outlineData has title, summary, volumes
                markdown = `# ${outlineData.title || novel?.title || '大纲'}\n\n`;
                if (outlineData.summary) {
                    markdown += `## 核心梗概\n${outlineData.summary}\n\n`;
                }
                if (outlineData.volumes && Array.isArray(outlineData.volumes)) {
                    markdown += `## 分卷规划\n\n`;
                    outlineData.volumes.forEach((vol: any, index: number) => {
                        markdown += `### 第${index + 1}卷：${vol.title}\n${vol.summary}\n\n`;
                    });
                }
            }

            // 1. Create a new lore item
            const existingPrimary = novel.lore.find(l => l.type === 'outline' && (l as any).isPrimary);
            if (existingPrimary) {
                const payload: any = { content: markdown, isPrimary: true };
                if (typeof outlineData === 'object' && outlineData) {
                  if (outlineData.summary) payload.summary = outlineData.summary;
                  if (Array.isArray(outlineData.volumes)) payload.volumes = outlineData.volumes;
                }
                const updateRes = await updateLore(id, (existingPrimary as any).id, payload);
                
                if (updateRes.success) {
                    // 3. Refresh novel data
                    const res = await getNovel(id);
                    if (res.success && res.data) {
                        setNovel(res.data);
                        setActiveTab('lore');
                    }
                    setIsAiOutlineModalOpen(false);
                }
            } else {
                const createRes = await createLore(id, 'AI生成大纲', 'outline');
                if (createRes.success && createRes.data) {
                    const newItem = createRes.data;
                    const payload: any = { content: markdown, isPrimary: true };
                    if (typeof outlineData === 'object' && outlineData) {
                      if (outlineData.summary) payload.summary = outlineData.summary;
                      if (Array.isArray(outlineData.volumes)) payload.volumes = outlineData.volumes;
                    }
                    const updateRes = await updateLore(id, newItem.id, payload);
                    
                    if (updateRes.success) {
                        const res = await getNovel(id);
                        if (res.success && res.data) {
                            setNovel(res.data);
                            const newLoreItem = res.data.lore?.find(l => l.id === newItem.id);
                            if (newLoreItem) {
                                setCurrentLore(newLoreItem);
                                setActiveTab('lore');
                            }
                        }
                        setIsAiOutlineModalOpen(false);
                    }
                }
            }
          } catch (error) {
            console.error('Failed to save outline:', error);
          }
        }}
      />

      <CharacterSelector
        isOpen={isCharSelectorOpen}
        onClose={() => setIsCharSelectorOpen(false)}
        characters={novel?.lore.filter(l => l.type === 'character') || []}
        selectedIds={currentChapter?.characterIds || []}
        onSelect={async (ids) => {
            if (!currentChapter || !id) return;
            const updatedChapter = { ...currentChapter, characterIds: ids };
            setCurrentChapter(updatedChapter);
            
            // Update novel state
            setNovel(prev => {
                if (!prev) return null;
                const newVolumes = prev.volumes.map(vol => ({
                    ...vol,
                    chapters: vol.chapters.map(c => 
                        c.id === updatedChapter.id ? updatedChapter : c
                    )
                }));
                return { ...prev, volumes: newVolumes };
            });
            
            // Persist
            const volumeId =
              currentVolume?.id ||
              novel?.volumes.find(v => v.chapters.some(c => c.id === currentChapter.id))?.id;
            if (volumeId) {
                await updateChapter(id, volumeId, currentChapter.id, { characterIds: ids });
            } else {
                console.error('Volume ID not found for chapter character update');
            }
        }}
      />

      {isForeshadowingModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                全部伏笔与兑现情况
              </h3>
              <button
                onClick={() => setIsForeshadowingModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-zinc-500 mb-3 flex items-center gap-2">
              <span>当前共 {allForeshadowingList.length} 条伏笔</span>
              {isForeshadowingListLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {allForeshadowingList.length > 0 ? (
                allForeshadowingList.map(item => {
                  const statusLabel = item.status === 'pending' ? '未兑现' : '已兑现';
                  const typeLabel = item.type === 'long_term' ? '长线伏笔' : '短线伏笔';
                  return (
                    <div
                      key={item.id}
                      className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50/60 dark:bg-zinc-900/40 text-xs text-zinc-700 dark:text-zinc-200"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.status === 'pending' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="font-medium">{statusLabel}</span>
                          <span className="text-[11px] text-zinc-400">
                            类型：{typeLabel}
                          </span>
                        </div>
                        {item.createdAt && (
                          <span className="text-[11px] text-zinc-400">
                            创建于：{new Date(item.createdAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-400 mb-1.5">
                        <span>首现：{item.chapterTitle || '未知章节'}</span>
                        <span>
                          兑现：
                          {item.resolvedChapterTitle
                            ? item.resolvedChapterTitle
                            : '未兑现'}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">
                        {item.content}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <select
                          value={item.visibility || 'author_only'}
                          onChange={async (e) => {
                            const v = e.target.value as 'author_only' | 'reader_known' | 'character_known';
                            const updatedAll = allForeshadowingList.map(f => f.id === item.id ? { ...f, visibility: v, characterId: v === 'character_known' ? f.characterId : undefined } : f);
                            setAllForeshadowingList(updatedAll);
                            const updatedNovel = (novel?.foreshadowing || []).map(f => f.id === item.id ? { ...f, visibility: v, characterId: v === 'character_known' ? f.characterId : undefined } : f);
                            setNovel(prev => prev ? { ...prev, foreshadowing: updatedNovel } : prev);
                            if (id && item.chapterId) {
                              const chapterItems = updatedNovel.filter(i => i.chapterId === item.chapterId);
                              await updateForeshadowing(id, item.chapterId, chapterItems);
                            }
                          }}
                          className="text-[11px] px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                        >
                          <option value="author_only">作者秘密</option>
                          <option value="reader_known">读者已知/角色未知</option>
                          <option value="character_known">角色已知/读者未必知</option>
                        </select>
                        {(item.visibility || 'author_only') === 'character_known' && (
                          <select
                            value={String(item.characterId || '')}
                            onChange={async (e) => {
                              const cid = e.target.value || undefined;
                              const updatedAll = allForeshadowingList.map(f => f.id === item.id ? { ...f, characterId: cid } : f);
                              setAllForeshadowingList(updatedAll);
                              const updatedNovel = (novel?.foreshadowing || []).map(f => f.id === item.id ? { ...f, characterId: cid } : f);
                              setNovel(prev => prev ? { ...prev, foreshadowing: updatedNovel } : prev);
                              if (id && item.chapterId) {
                                const chapterItems = updatedNovel.filter(i => i.chapterId === item.chapterId);
                                await updateForeshadowing(id, item.chapterId, chapterItems);
                              }
                            }}
                            className="text-[11px] px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                          >
                            <option value="">选择角色</option>
                            {(novel?.lore || [])
                              .filter((l: any) => l.type === 'character')
                              .map((l: any) => (
                                <option key={String(l.id ?? l._id ?? l.title)} value={String(l.id ?? l._id ?? '')}>
                                  {l.title || l.name || '人物设定'}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                  暂无伏笔记录，可在章节中使用“AI 分析伏笔”生成。
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Location Modal */}
      {isLocationModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI 地点生成
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
               AI 将结合大纲和世界观中的“空间设置”来生成具体地点。您可以在此输入额外的具体要求（如：“生成一个阴森的废弃医院”）。如果不填，将自动根据现有设定拆分。
            </p>
            <textarea
              value={locationPrompt}
              onChange={(e) => setLocationPrompt(e.target.value)}
              className="w-full h-32 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl resize-none outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm mb-4"
              placeholder="请输入生成要求（可选）..."
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsLocationModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleLocationGenerate}
                disabled={isLocationGenerating}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isLocationGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                开始生成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Writer Modal */}
      {isAiWriterModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI 辅助写作
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
               AI 将根据当前章节大纲、章纲以及前文内容，为您生成正文片段。您可以输入具体的要求来指导 AI。
            </p>
            <textarea
              value={aiWriterInstruction}
              onChange={(e) => setAiWriterInstruction(e.target.value)}
              className="w-full h-32 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl resize-none outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm mb-4"
              placeholder="请输入写作指令，例如：&#10;- 描写一段环境氛围&#10;- 编写一段两人激烈的争吵对话&#10;- 根据章纲扩写开头的动作戏"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsAiWriterModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleAiWriterSubmit}
                disabled={isAiWriting}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isAiWriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                开始生成
              </button>
            </div>
          </div>
        </div>
      )}

      {copyToastMessage && createPortal(
        <div className="fixed bottom-4 right-4 z-[9999] px-3 py-2 rounded-lg bg-zinc-900/90 text-xs text-white shadow-lg">
          {copyToastMessage}
        </div>,
        document.body
      )}

      {/* Portal Tooltip */}
      {tooltipState.visible && tooltipState.char && createPortal(
        <div 
          className="fixed z-[9999] w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: tooltipState.x,
            top: tooltipState.y + 10, 
            transform: 'translate(-50%, 0)'
          }}
        >
          <div className="flex items-start justify-between mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                {tooltipState.char.title || tooltipState.char.name}
                {tooltipState.char.gender && (
                   <span className="text-[10px] font-normal text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                     {tooltipState.char.gender}
                   </span>
                )}
              </h4>
              <p className="text-xs text-zinc-500 mt-0.5">{tooltipState.char.role || '未设定身份'}</p>
            </div>
            {tooltipState.char.age && (
              <span className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-1 rounded-full font-medium">
                {tooltipState.char.age}
              </span>
            )}
          </div>
          
          <div className="space-y-3 text-xs max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {tooltipState.char.personality && (
              <div>
                <span className="text-zinc-400 font-medium block mb-1">性格特征</span>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                  {tooltipState.char.personality}
                </p>
              </div>
            )}
            {tooltipState.char.appearance && (
              <div>
                <span className="text-zinc-400 font-medium block mb-1">外貌描写</span>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                  {tooltipState.char.appearance}
                </p>
              </div>
            )}
            {tooltipState.char.background && (
              <div>
                <span className="text-zinc-400 font-medium block mb-1">背景故事</span>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                  {tooltipState.char.background}
                </p>
              </div>
            )}
            {tooltipState.char.cheat && (
              <div>
                <span className="text-zinc-400 font-medium block mb-1">金手指/能力</span>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                  {tooltipState.char.cheat}
                </p>
              </div>
            )}
            
            {/* Fallback to Content/Summary if no structured fields are present */}
            {!tooltipState.char.personality && !tooltipState.char.appearance && !tooltipState.char.background && !tooltipState.char.cheat && (
                (tooltipState.char.content || tooltipState.char.summary) ? (
                    <div>
                        <span className="text-zinc-400 font-medium block mb-1">详细设定</span>
                        <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg prose prose-xs dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                            <ReactMarkdown>
                                {tooltipState.char.content || tooltipState.char.summary}
                            </ReactMarkdown>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-zinc-400 italic">
                        暂无详细介绍
                    </div>
                )
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
