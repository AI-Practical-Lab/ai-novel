import { toast } from 'sonner';
import { useUserStore } from '@/store/userStore';

export interface BeatSheet {
  beats: string[];
  goal: string;
  conflict: string;
  hook: string;
}

export interface Foreshadowing {
  id: string;
  content: string;
  chapterId: string;
  chapterTitle: string;
  status: 'pending' | 'resolved';
  visibility?: 'author_only' | 'reader_known' | 'character_known';
  characterId?: string;
  resolvedChapterId?: string;
  resolvedChapterTitle?: string;
  type: 'long_term' | 'short_term';
  createdAt?: string;
}

export interface CoreSettingsProtagonist {
  name?: string;
  gender?: string;
  age?: string;
  personality?: string;
  cheat?: string;
}

export interface CoreSettingsAntagonist {
  name?: string;
  role?: string;
  personality?: string;
  motivation?: string;
}

export interface CoreSettingsWorld {
  background?: string;
  powerSystem?: string;
  forces?: string;
}

export interface CoreSettingsOutlineVolume {
  title?: string;
  summary?: string;
  description?: string;
}

export interface CoreSettingsOutline {
  mainConflict?: string;
  summary?: string;
  volumes?: CoreSettingsOutlineVolume[];
}

export interface CoreSettings {
  protagonist?: CoreSettingsProtagonist;
  antagonist?: CoreSettingsAntagonist;
  world?: CoreSettingsWorld;
  outline?: CoreSettingsOutline;
  [key: string]: any;
}

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  beatSheet?: BeatSheet;
  content: string;
  characterIds?: string[];
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  percentage: number;
  chapterId?: string;
  summary?: string;
  characterIds?: string[];
  type?: string;
  estimated_chapters?: number;
  pace_type?: string;
}

export interface VolumeMilestone {
  id: number;
  projectId: number;
  volumeId: number;
  title: string;
  description?: string;
  type?: string;
  paceType?: string;
  coolPoints?: string;
  reversals?: string;
  foreshadows?: string;
  characterIds?: string;
  startChapterId?: number;
  endChapterId?: number;
  estimatedChapters?: number;
  orderIndex?: number;
  enabled?: boolean;
}

export interface Volume {
  id: string;
  title: string;
  summary?: string;
  milestones?: Milestone[];
  chapters: Chapter[];
}

export interface NovelDetail {
  id: string;
  title: string;
  cover?: string;
  description?: string;
  genre?: string;
  style?: string;
  coreSettings?: CoreSettings;
  volumes: Volume[];
  lore?: any[];
  foreshadowing?: Foreshadowing[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Novel {
  id: string;
  title: string;
  description?: string;
  cover?: string;
  genre?: string;
  style?: string;
  updateTime: number;
}

// User Info Interfaces
export interface UserLevel {
  id: number;
  name: string;
  level: number;
  icon: string;
}

export interface UserInfo {
  id: number;
  nickname: string;
  avatar: string;
  mobile: string;
  sex: number;
  point: number;
  experience: number;
  level?: UserLevel;
  brokerageEnabled: boolean;
}

export interface SignInSummary {
  totalDay?: number;
  continuousDay?: number;
  todaySignIn?: boolean;
}

export interface SignInConfig {
  day: number;
  point: number;
}

// Helper to adapt backend response to ApiResponse
const adaptResponse = <T>(json: any): ApiResponse<T> => {
  if (json.code === 0) {
    return { success: true, data: json.data };
  }
  return { success: false, error: json.msg || 'Request failed' };
};

// Authenticated Fetch Helper
const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const expiresTime = localStorage.getItem('expiresTime');
  // Check if token is expired (with 1 minute buffer)
  if (expiresTime && Date.now() > parseInt(expiresTime) - 60000) {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        const refreshRes = await fetch('/app-api/member/auth/refresh-token?refreshToken=' + refreshToken, {
          method: 'POST',
          headers: {
            'tenant-id': '1'
          }
        });
        const refreshJson = await refreshRes.json();
        
        if (refreshJson.code === 0 && refreshJson.data) {
          // Update tokens
          localStorage.setItem('accessToken', refreshJson.data.accessToken);
          localStorage.setItem('refreshToken', refreshJson.data.refreshToken);
          localStorage.setItem('expiresTime', refreshJson.data.expiresTime);
          
          // Retry original request with new token
          const newHeaders = new Headers(options.headers);
          newHeaders.set('Authorization', `Bearer ${refreshJson.data.accessToken}`);
          newHeaders.set('tenant-id', '1');
          return fetch(url, { ...options, headers: newHeaders });
        }
      }
    } catch (e) {
      console.error('Token refresh failed:', e);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('expiresTime');
      localStorage.removeItem('userId');
      window.location.href = '/';
      throw new Error('Token expired');
    }
    
    // If refresh failed or no refresh token, logout

  }

  const token = localStorage.getItem('accessToken');
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('tenant-id', '1');

  // Guard: require positive points for AI endpoints
  if (url.startsWith('/app-api/api/ai/')) {
    const point = useUserStore.getState().userInfo?.point ?? 0;
    if (point <= 0) {
      toast.warning('积分不足，无法使用 AI 功能');
      const body = { code: -1, msg: '积分不足，请先充值或签到获取积分' };
      return new Response(JSON.stringify(body), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  const response = await fetch(url, { ...options, headers });

  // Handle 401 Unauthorized (Double check if token expired during request)
  if (response.status === 401) {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
         const refreshRes = await fetch('/app-api/member/auth/refresh-token?refreshToken=' + refreshToken, {
          method: 'POST',
          headers: {
            'tenant-id': '1'
          }
        });
        const refreshJson = await refreshRes.json();
        
        if (refreshJson.code === 0 && refreshJson.data) {
          localStorage.setItem('accessToken', refreshJson.data.accessToken);
          localStorage.setItem('refreshToken', refreshJson.data.refreshToken);
          localStorage.setItem('expiresTime', refreshJson.data.expiresTime);
          
          const retryHeaders = new Headers(options.headers);
          retryHeaders.set('Authorization', `Bearer ${refreshJson.data.accessToken}`);
          retryHeaders.set('tenant-id', '1');
          return fetch(url, { ...options, headers: retryHeaders });
        }
      }
    } catch (e) {
      console.error('401 Token refresh failed:', e);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('expiresTime');
      localStorage.removeItem('userId');
      window.location.href = '/';
      throw new Error('Session expired');
    }
    

  }

  return response;
};

export const getSignInSummary = async (): Promise<ApiResponse<SignInSummary>> => {
  try {
    const res = await authenticatedFetch('/app-api/member/sign-in/record/get-summary', {
      method: 'GET'
    });
    const json = await res.json();
    return adaptResponse<SignInSummary>(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const createSignInRecord = async (): Promise<ApiResponse<any>> => {
  try {
    const res = await authenticatedFetch('/app-api/member/sign-in/record/create', {
      method: 'POST'
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const getSignInConfigList = async (): Promise<ApiResponse<SignInConfig[]>> => {
  try {
    const res = await authenticatedFetch('/app-api/member/sign-in/config/list', {
      method: 'GET'
    });
    const json = await res.json();
    return adaptResponse<SignInConfig[]>(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const getNovels = async (): Promise<ApiResponse<Novel[]>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/novels');
    const json = await res.json();
    return adaptResponse<Novel[]>(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export interface LoginParams {
  mobile: string;
  password: string;
  socialType?: number;
  socialCode?: string;
  socialState?: string;
}

export interface LoginResult {
  userId: number;
  accessToken: string;
  refreshToken: string;
  expiresTime: string;
}

export interface SmsLoginParams {
  mobile: string;
  code: string;
  socialType?: number;
  socialCode?: string;
  socialState?: string;
}

export interface SmsSendParams {
  mobile: string;
  scene: number;
}

export const login = async (data: LoginParams): Promise<ApiResponse<LoginResult>> => {
  try {
    const res = await fetch('/app-api/member/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'tenant-id': '1',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    
    if (json.code === 0) {
      return {
        success: true,
        data: json.data
      };
    } else {
      return {
        success: false,
        error: json.msg || 'Login failed'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const smsLogin = async (data: SmsLoginParams): Promise<ApiResponse<LoginResult>> => {
  try {
    const res = await fetch('/app-api/member/auth/sms-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'tenant-id': '1',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    
    if (json.code === 0) {
      return {
        success: true,
        data: json.data
      };
    } else {
      return {
        success: false,
        error: json.msg || 'SMS Login failed'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const sendSmsCode = async (data: SmsSendParams): Promise<ApiResponse<boolean>> => {
  try {
    const res = await fetch('/app-api/member/auth/send-sms-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'tenant-id': '1',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    
    if (json.code === 0) {
      return {
        success: true,
        data: true
      };
    } else {
      return {
        success: false,
        error: json.msg || 'Send SMS code failed'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

// Get User Info
export const getUserInfo = async (): Promise<ApiResponse<UserInfo>> => {
  try {
    const res = await authenticatedFetch('/app-api/member/user/get');
    const json = await res.json();
    return adaptResponse<UserInfo>(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const getNovel = async (id: string): Promise<ApiResponse<NovelDetail>> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${id}?t=${Date.now()}`);
    const json = await res.json();
    return adaptResponse<NovelDetail>(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const updateNovel = async (id: string, data: Partial<Novel>): Promise<ApiResponse<Novel>> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return adaptResponse<Novel>(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export async function createVolume(novelId: string, title: string) {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error) {
    console.error('Create Volume Error:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function updateVolume(novelId: string, volumeId: string, data: { title?: string; summary?: string; milestones?: Milestone[] }) {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes/${volumeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error) {
    console.error('Update Volume Error:', error);
    return { success: false, error: 'Network error' };
  }
}

export const getVolumeMilestones = async (
  novelId: string,
  volumeId: string
): Promise<ApiResponse<VolumeMilestone[]>> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes/${volumeId}/milestones`, {
      method: 'GET'
    });
    const json = await res.json();
    return adaptResponse<VolumeMilestone[]>(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const replaceVolumeMilestones = async (
  novelId: string,
  volumeId: string,
  milestones: Milestone[]
): Promise<ApiResponse<null>> => {
  try {
    const existing = await getVolumeMilestones(novelId, volumeId);
    if (existing.success && Array.isArray(existing.data)) {
      for (const item of existing.data) {
        await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes/${volumeId}/milestones/${item.id}`, {
          method: 'DELETE'
        });
      }
    }

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes/${volumeId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: m.title,
          description: m.summary || m.description || '',
          type: m.type,
          paceType: m.pace_type,
          coolPoints: m.cool_points ? JSON.stringify(m.cool_points) : undefined,
          reversals: m.reversals ? JSON.stringify(m.reversals) : undefined,
          foreshadows: m.foreshadows ? JSON.stringify(m.foreshadows) : undefined,
          characterIds: m.characterIds ? JSON.stringify(m.characterIds) : undefined,
          startChapterId: m.chapterId ? Number(m.chapterId) : undefined,
          endChapterId: undefined,
          estimatedChapters: m.estimated_chapters,
          orderIndex: i + 1,
          enabled: true
        })
      });
      const json = await res.json();
      const result = adaptResponse(json);
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Save milestone failed'
        };
      }
    }

    return { success: true, data: null };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export async function createChapter(novelId: string, volumeId: string, title: string, summary?: string, characterIds?: string[]) {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes/${volumeId}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, summary, characterIds }),
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error) {
    console.error('Create Chapter Error:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function batchCreateChapters(
  novelId: string, 
  volumeId: string, 
  chapters: any[]
) {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes/${volumeId}/chapters/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapters }),
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error) {
    console.error('Batch Create Error:', error);
    return { success: false, error: 'Network error' };
  }
}

export const getChapterBeatSheet = async (chapterId: string): Promise<ApiResponse<BeatSheet>> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/chapters/${chapterId}/beat-sheet`, {
      method: 'GET'
    });
    const json = await res.json();
    return adaptResponse<BeatSheet>(json);
  } catch (error: any) {
    console.error('Get Chapter Beat Sheet Error:', error);
    return { success: false, error: 'Network error' };
  }
};

export interface ProgressChapter {
  id: string;
  title?: string;
  contentExcerpt?: string;
  summary?: string;
}

export const getProgressChapters = async (
  novelId: string,
  chapterId: string,
  maxChars?: number
): Promise<ApiResponse<ProgressChapter[]>> => {
  try {
    const url = `/app-api/api/novels/${novelId}/chapters/progress?chapterId=${encodeURIComponent(chapterId)}${
      typeof maxChars === 'number' ? `&maxChars=${encodeURIComponent(String(maxChars))}` : ''
    }`;
    const res = await authenticatedFetch(url, { method: 'GET' });
    const json = await res.json();
    const adapted = adaptResponse<ProgressChapter[]>(json);
    if (!adapted.success || !Array.isArray(adapted.data)) {
      return adapted;
    }
    const normalized: ProgressChapter[] = adapted.data
      .filter((x): x is ProgressChapter => Boolean(x && typeof x === 'object'))
      .map((x) => {
        const item = x as ProgressChapter;
        const contentExcerpt = typeof item.contentExcerpt === 'string' ? item.contentExcerpt : '';
        const summary = typeof item.summary === 'string' ? item.summary : contentExcerpt;
        const title = typeof item.title === 'string' ? item.title : undefined;
        return {
          id: String((item as unknown as { id: unknown }).id ?? ''),
          title,
          contentExcerpt,
          summary,
        };
      })
      .filter((x) => Boolean(x.id));
    return { success: true, data: normalized };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
};

export const updateChapter = async (novelId: string, volumeIdOrChapterId: string, chapterIdOrData: string | Partial<Chapter>, data?: Partial<Chapter>) => {
  // Overload handling
  let volumeId: string | undefined;
  let chapterId: string;
  let updateData: Partial<Chapter>;

  if (typeof chapterIdOrData === 'object') {
     volumeId = 'unknown'; // This will likely fail 404
     chapterId = volumeIdOrChapterId;
     updateData = chapterIdOrData;
     console.warn('updateChapter called without volumeId, this may fail.');
  } else {
     volumeId = volumeIdOrChapterId;
     chapterId = chapterIdOrData;
     updateData = data!;
  }

  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes/${volumeId}/chapters/${chapterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error) {
    console.error('Update Chapter Error:', error);
    return { success: false, error: 'Network error' };
  }
};

export const getForeshadowingList = async (novelId: string): Promise<ApiResponse<Foreshadowing[]>> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/foreshadowing`, {
      method: 'GET',
    });
    const json = await res.json();
    return adaptResponse<Foreshadowing[]>(json);
  } catch (error: any) {
    console.error('Get Foreshadowing List Error:', error);
    return { success: false, error: 'Network error' };
  }
};

export const updateForeshadowing = async (novelId: string, chapterId: string, foreshadowingList: Foreshadowing[]) => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/chapters/${chapterId}/foreshadowing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foreshadowing: foreshadowingList }),
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error) {
    console.error('Update Foreshadowing Error:', error);
    return { success: false, error: 'Network error' };
  }
};

export const analyzeForeshadowing = async (
  chapterId: string, 
  chapterTitle: string, 
  content: string, 
  existingForeshadowing: Foreshadowing[]
) => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/analyze-foreshadowing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId, chapterTitle, content, existingForeshadowing }),
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error) {
    console.error('Analyze Foreshadowing Error:', error);
    return { success: false, error: 'Network error' };
  }
};

export interface EvaluationIssue {
  category: string;
  severity: 'minor' | 'medium' | 'major';
  description: string;
  suggestion: string;
}

export interface ChapterEvaluation {
  overallScore: number;
  structureScore: number;
  plotProgressScore: number;
  characterScore: number;
  worldConsistencyScore: number;
  hookScore: number;
  styleScore: number;
  summary: string;
  issues: EvaluationIssue[];
}

export const evaluateChapter = async (data: {
  chapter: Chapter;
  previousChapter?: Partial<Chapter>;
  volumeSummary?: string;
  globalLore?: string;
  foreshadowing?: Foreshadowing[];
}): Promise<ApiResponse<ChapterEvaluation>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/evaluate-chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return adaptResponse<ChapterEvaluation>(json);
  } catch (error: any) {
    console.error('Evaluate Chapter Error:', error);
    return { success: false, error: 'Network error' };
  }
};

export const rewriteChapter = async (data: {
  chapter: Chapter;
  evaluation: ChapterEvaluation;
  previousChapter?: Partial<Chapter>;
  volumeSummary?: string;
  globalLore?: string;
  foreshadowing?: Foreshadowing[];
  instruction?: string;
  coreSettings?: any;
}): Promise<ApiResponse<string>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/rewrite-chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const text = await res.text();
    if (!text) {
      return { success: false, error: '服务器返回空响应' };
    }
    try {
      const json: any = JSON.parse(text);
      return adaptResponse<string>(json);
    } catch (e: any) {
      console.error('Rewrite Chapter JSON Parse Error:', e, text);
      return { success: false, error: '服务器返回的内容不是有效的 JSON' };
    }
  } catch (error: any) {
    console.error('Rewrite Chapter Error:', error);
    return { success: false, error: 'Network error' };
  }
};

export const generateOutline = async (data: { title: string; description?: string; genre?: string; style?: string; tags?: string[]; coreSettings?: any }): Promise<ApiResponse<any>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const refineText = async (data: { text: string; context?: string; instruction?: string; model?: string }): Promise<ApiResponse<string>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/refine-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    return adaptResponse<string>(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const createNovel = async (data: any): Promise<ApiResponse<any>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/novels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const createLore = async (novelId: string, title: string, type: string = 'other'): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/lore`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const createLorePost = async (novelId: string, title: string, type: string = 'other'): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/lore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type })
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const createLorePostObj = async (novelId: string, obj:any): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/lore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const deleteLore = async (novelId: string, loreId: string): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/lore/${loreId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateLore = async (novelId: string, loreId: string, data: any): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/lore/${loreId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const postLore = async (novelId: string, loreId: string, data: any): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/lore/${loreId}`, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const deleteVolume = async (novelId: string, volumeId: string): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes/${volumeId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const deleteChapter = async (novelId: string, chapterId: string): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/chapters/${chapterId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const getChapterContent = async (cid: string): Promise<ApiResponse<string>> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/chapters/${cid}/content`, {
      method: 'GET'
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const deleteNovel = async (id: string): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${id}`, {
      method: 'DELETE',
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const exportNovelLore = async (novelId: string): Promise<Response> => {
  const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/export-lore`, {
    method: 'GET'
  });
  return res;
};

export const exportNovelChapters = async (novelId: string): Promise<Response> => {
  const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/export-chapters`, {
    method: 'GET'
  });
  return res;
};

export const saveCharacterKnowledge = async (novelId: string, chapterId: string, data: {
  characterLoreId: string;
  knownFacts?: string;
  misunderstandings?: string;
  suspicions?: string;
  extra?: string;
}): Promise<ApiResponse<any>> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/chapters/${chapterId}/character-knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return adaptResponse<any>(json);
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
};

export const getChapterCharacterKnowledge = async (novelId: string, chapterId: string, characterLoreId?: string): Promise<ApiResponse<any>> => {
  try {
    const url = characterLoreId
      ? `/app-api/api/novels/${novelId}/chapters/${chapterId}/character-knowledge?characterLoreId=${encodeURIComponent(characterLoreId)}`
      : `/app-api/api/novels/${novelId}/chapters/${chapterId}/character-knowledge`;
    const res = await authenticatedFetch(url, { method: 'GET' });
    const json = await res.json();
    return adaptResponse<any>(json);
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
};

export const getCharacterKnowledgeTimeline = async (novelId: string, characterLoreId: string): Promise<ApiResponse<any[]>> => {
  try {
    console.log('getCharacterKnowledgeTimeline called:', { novelId, characterLoreId });
    const token = localStorage.getItem('accessToken');
    console.log('Current token:', token ? token.substring(0, 20) + '...' : 'null');
    
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/characters/${characterLoreId}/knowledge-timeline`, {
      method: 'GET'
    });
    console.log('Response status:', res.status);
    const text = await res.text();
    console.log('Response text:', text);
    if (!text || text.trim() === '') {
      return { success: true, data: [] };
    }
    const json = JSON.parse(text);
    return adaptResponse<any[]>(json);
  } catch (error: any) {
    console.error('getCharacterKnowledgeTimeline error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
};

export interface ReferenceItem {
  type: 'chapter' | 'bio' | 'lore' | 'summary';
  title: string;
  content: string;
}

export interface ChatContext {
  currentChapter?: {
    title: string;
    content: string;
  };
  references?: ReferenceItem[];
}

export interface ReferencedSetting {
  id: string;
  type?: string;
  name: string;
}

export const parseCommand = async (instruction: string, context: any): Promise<ApiResponse<any>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/parse-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ instruction, context }),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export async function suggestChapters(
  volumeTitle: string, 
  volumeSummary: string, 
  existingChapters: string[] = [],
  context: string = '',
  count: number = 5,
  previousChapterCount: number = 0,
  startIndex?: number
) {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/suggest-chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volumeTitle, volumeSummary, existingChapters, context, count, previousChapterCount, startIndex }),
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error) {
    console.error('Suggest Chapters Error:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function analyzeLore(novelId: string) {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/analyze-lore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novelId })
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error) {
    console.error('Analyze Lore Error:', error);
    return { success: false, error: 'Network error' };
  }
}


export const chatWithAI = async (prompt: string, novelId?: string, context?: ChatContext, history?: Array<{ role: 'user' | 'assistant'; content: string }>, referencedSettings?: ReferencedSetting[]): Promise<ApiResponse<string>> => {
  try {
    const historyText = (history && history.length > 0)
      ? history.map(h => `${h.role === 'user' ? '用户' : '助手'}: ${h.content}`).join('\n')
      : '';
    const finalPrompt = historyText ? `对话上下文：\n${historyText}\n\n当前问题：\n${prompt}` : prompt;
    const res = await authenticatedFetch('/app-api/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: finalPrompt, novelId, context, history, referencedSettings }),
    });
    
    const json = await res.json();
    if (json && json.code === 0 && json.data && typeof json.data === 'string') {
      // keep as-is
    } else if (json && json.code === 0 && json.data && typeof json.data === 'object' && (json.data.content || json.data.text)) {
      json.data = json.data.content || json.data.text;
    }
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const chatWithAIStream = async (
  prompt: string, 
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal?: AbortSignal,
  novelId?: string, 
  context?: ChatContext,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  referencedSettings?: ReferencedSetting[]
) => {
  try {
    const historyText = (history && history.length > 0)
      ? history.map(h => `${h.role === 'user' ? '用户' : '助手'}: ${h.content}`).join('\n')
      : '';
    const finalPrompt = historyText ? `对话上下文：\n${historyText}\n\n当前问题：\n${prompt}` : prompt;
    const res = await authenticatedFetch('/app-api/api/ai/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ prompt: finalPrompt, novelId, context, history, referencedSettings }),
      signal
    });

    if (!res.ok) {
      const fallback = await chatWithAI(finalPrompt, novelId, context, history);
      if (fallback.success && fallback.data) {
        onChunk(fallback.data);
        onDone();
      } else {
        onError(fallback.error || res.statusText || 'Stream request failed');
      }
      return;
    }

    if (!res.body) {
      const fallback = await chatWithAI(finalPrompt, novelId, context, history);
      if (fallback.success && fallback.data) {
        onChunk(fallback.data);
        onDone();
      } else {
        onError(fallback.error || 'No response body');
      }
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let doneReceived = false;
    let gotChunk = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      let lineBreakIndex = buffer.search(/\r?\n/);
      while (lineBreakIndex !== -1) {
        const line = buffer.slice(0, lineBreakIndex);
        buffer = buffer.slice(lineBreakIndex + (buffer[lineBreakIndex] === '\r' && buffer[lineBreakIndex + 1] === '\n' ? 2 : 1));
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0) {
          // event boundary; continue
        } else if (trimmedLine.startsWith('data:')) {
          let data = trimmedLine.slice(5);
          if (data.startsWith(' ')) data = data.slice(1);
          const payload = data.trim();
          if (!payload) {
            // ignore
          } else if (payload === '[DONE]' || payload === '"[DONE]"') {
            doneReceived = true;
            onDone();
            break;
          } else {
            try {
              const parsed: any = JSON.parse(payload);
              if (typeof parsed === 'string') {
                if (parsed === '[DONE]') {
                  doneReceived = true;
                  onDone();
                  break;
                }
                if (parsed) onChunk(parsed);
                gotChunk = true;
              } else if (parsed?.error) {
                onError(parsed.error);
                return;
              } else {
                const text = parsed?.content ?? parsed?.text ?? '';
                if (text) {
                  onChunk(text);
                  gotChunk = true;
                }
              }
            } catch {
              onChunk(payload);
              gotChunk = true;
            }
          }
        }
        lineBreakIndex = buffer.search(/\r?\n/);
      }
      if (doneReceived) return;
    }
    if (!doneReceived) {
      if (!gotChunk) {
        const fallback = await chatWithAI(prompt, novelId, context);
        if (fallback.success && fallback.data) {
          onChunk(fallback.data);
        } else {
          onError(fallback.error || 'Stream ended without data');
        }
      }
      onDone();
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
        // Ignore abort error
    } else {
        onError(error.message || 'Network error');
    }
  }
};

export const generateInspiration = async (idea?: string): Promise<ApiResponse<{ title: string; description: string; genre: string }>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/inspiration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idea }),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const recommendTags = async (title: string, description: string): Promise<ApiResponse<{ genre: string; style: string; tags: string[] }>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/recommend-tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, description }),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const generateCoreSettings = async (data: { title: string; description: string; genre: string; style: string; tags: string[] }): Promise<ApiResponse<any>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-core-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const generateChapterIdeas = async (data: { volumeTitle: string; volumeSummary: string; previousChapterTitle?: string; previousChapterContent?: string }): Promise<ApiResponse<Array<{ title: string; summary: string }>>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-chapter-ideas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    // Fix: Extract ideas array from nested data structure { ideas: [...] }
    if (json.code === 0 && json.data && Array.isArray(json.data.ideas)) {
        json.data = json.data.ideas;
    }
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const generateBeatSheet = async (data: { 
  title: string; 
  summary: string; 
  previousContext?: string; 
  previousChapterContent?: string;
  volumeSummary?: string;
  characters?: any[];
  coreSettings?: any;
  milestoneContext?: any;
}): Promise<ApiResponse<BeatSheet>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-beat-sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const generateBeat = async (data: {
  chapterTitle?: string;
  chapterSummary?: string;
  instruction?: string;
  previousBeats?: string[];
}): Promise<ApiResponse<string>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-beat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const generateMilestones = async (data: { volumeTitle: string; volumeSummary: string; chapters?: Array<{ title: string; summary?: string }>; timeline?: string | string[] | Record<string, any>; volumeTotalChapters?: number }): Promise<ApiResponse<Milestone[]>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-milestones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const generateBridgeBeats = async (data: { startMilestone: Milestone; endMilestone: Milestone; context?: string }): Promise<ApiResponse<Milestone[]>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-bridge-beats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const generateChaptersFromMilestone = async (data: { 
  milestoneTitle: string; 
  milestoneSummary: string; 
  count: number; 
  volumeContext?: string;
  characters?: Array<{ id: string; name?: string; title?: string; role?: string; content?: string; description?: string; bio?: string }>;
  nextMilestone?: { title: string; summary: string };
  prevMilestone?: { title: string; summary: string };
}): Promise<ApiResponse<Array<{ title: string; summary: string; characterIds?: string[] }>>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-chapters-from-milestone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};

export const generateCharacters = async (context: any, count: number, instruction?: string): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, count, instruction })
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const getRelations = async (id: string): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${id}/relations`);
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const updateRelations = async (id: string, data: any): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${id}/relations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const analyzeRelations = async (characters: any[]): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/analyze-relations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters })
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const suggestPlotCharacters = async (params: { plotTitle: string; plotSummary: string; characters: any[] }): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/suggest-plot-characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// 导入设定（支持 FormData 或 JSON）
export const importLore = async (
  novelId: string,
  data: { content: string; fileName: string; type?: string } | FormData
): Promise<ApiResponse<any>> => {
  try {
    const url = `/app-api/api/novels/${novelId}/lore/import`;
    let options: RequestInit = { method: 'POST' };
    if (data instanceof FormData) {
      options.body = data;
    } else {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(data);
    }
    const res = await authenticatedFetch(url, options);
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export interface ImportProgress {
  jobId: string;
  projectId?: number;
  taskId?: string; // Compatibility
  currentStep: string;
  stepIndex: number;
  stepTotal: number;
  message: string;
  error?: string;
  status?: string;
  steps?: string[];
  finishedSteps?: string[];
  generatedCount?: number;
  generatedType?: string;
}

export interface ImportCompleteResult {
  projectId: number;
  redirect: string;
}

export const importNovel = async (data: { content: string; fileName: string } | FormData): Promise<ApiResponse<ImportProgress>> => {
  try {
    let options: RequestInit = {
      method: 'POST',
    };

    if (data instanceof FormData) {
      options.body = data;
      // Do NOT set Content-Type header for FormData, browser sets it with boundary
    } else {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(data);
    }

    const res = await authenticatedFetch('/app-api/api/novels/import', options);
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const getImportProgress = async (taskId: string): Promise<ApiResponse<ImportProgress>> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/import/progress?taskId=${taskId}`);
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const nextImportStep = async (taskId: string, force: boolean = false): Promise<ApiResponse<ImportProgress>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/novels/import/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, force })
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const completeImport = async (taskId: string): Promise<ApiResponse<ImportCompleteResult>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/novels/import/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const reorderChapters = async (novelId: string, volumeId: string, chapterIds: string[]): Promise<ApiResponse> => {
  try {
    const res = await authenticatedFetch(`/app-api/api/novels/${novelId}/volumes/${volumeId}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterIds })
    });
    const json = await res.json();
    return adaptResponse(json);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const generateChapterContent = async (
  data: { 
    chapter: Chapter; 
    previousChapter?: Chapter; 
    volumeSummary?: string; 
    globalLore?: string; 
    instruction?: string; 
    characters?: any[];
    foreshadowing?: Foreshadowing[];
    coreSettings?: unknown;
    milestoneContext?: unknown;
    volumeChaptersPlan?: Array<{ id: string; title?: string; summary?: string }>;
  },
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ApiResponse<string>> => {
  try {
    const res = await authenticatedFetch('/app-api/api/ai/generate-chapter-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...data, stream: !!onChunk }),
      signal
    });

    if (!onChunk) {
      const json: ApiResponse = await res.json();
      return adaptResponse(json);
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let doneReceived = false;

    if (!reader) {
        return { success: false, error: 'Stream not supported' };
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          const lines = evt.split('\n');
          let dataPayload = '';
          for (let line of lines) {
            if (line.startsWith('data:')) {
              let content = line.slice(5);
              if (content.startsWith(' ')) content = content.slice(1);
              if (content.endsWith('\r')) content = content.slice(0, -1);
              dataPayload += dataPayload ? '\n' + content : content;
            }
          }
          const trimmed = dataPayload.trim();
          if (!trimmed) continue;
          if (trimmed === '[DONE]') {
            doneReceived = true;
            break;
          }
          try {
            const parsed: any = JSON.parse(trimmed);
            const text = parsed?.text || '';
            if (text) {
              onChunk(text);
              fullContent += text;
            }
          } catch {}
        }
        if (doneReceived) break;
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || signal?.aborted) {
        console.log('Stream aborted');
        return { success: false, data: fullContent };
      }
      throw e;
    }
    
    return { success: true, data: fullContent };
  } catch (error: any) {
    if (error.name === 'AbortError' || signal?.aborted) {
        return { success: false, data: '' };
    }
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
};
