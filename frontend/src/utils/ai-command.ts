import { parseCommand } from '../api';

export interface AiCommandIntent {
  action: 'modify_metadata' | 'rewrite_content' | 'create_lore' | 'unknown';
  scope: {
    type: 'chapter' | 'lore' | 'project';
    ids?: string[]; // IDs of affected items (e.g., ['c1', 'c2'])
    filter?: string; // Natural language description if IDs not found (e.g., "all chapters")
  };
  instruction: string; // The specific instruction for the next step
  params?: Record<string, any>;
}

export async function parseAiCommand(
  instruction: string, 
  projectData: any,
  history: any[] = []
): Promise<AiCommandIntent> {
  // 1. Prepare Context (Simplified Project Structure)
  const volumes = projectData.volumes || [];
  const chaptersMap = volumes.flatMap((v: any) => v.chapters.map((c: any) => ({
    id: c.id,
    title: c.title,
    volume: v.title
  })));
  
  const loreMap = (projectData.lore || []).flatMap((l: any) => {
    if (l.type === 'world') {
      return [
        { id: l.id, title: l.title || l.name, type: l.type },
        { id: `${l.id}_background`, title: '世界背景', type: 'world_section' },
        { id: `${l.id}_forces`, title: '势力分布', type: 'world_section' },
        { id: `${l.id}_timeline`, title: '时间线', type: 'world_section' },
        { id: `${l.id}_powerSystem`, title: '力量体系', type: 'world_section' },
        { id: `${l.id}_locations`, title: '地点', type: 'world_section' }
      ];
    }

    if (l.type === 'plot' && l.id === 'plot') {
      return [
        { id: l.id, title: l.title || l.name || '剧情架构', type: l.type },
        { id: `${l.id}_conflict`, title: '主线冲突', type: 'plot_section' }
      ];
    }

    if (l.type === 'narrative' && l.id === 'narrative') {
      return [
        { id: l.id, title: l.title || l.name || '叙事策略', type: l.type },
        { id: `${l.id}_tone`, title: '文风基调', type: 'narrative_section' }
      ];
    }

    return [{
      id: l.id,
      title: l.title || l.name,
      type: l.type
    }];
  });

  const context = {
    chapters: chaptersMap,
    lore: loreMap,
    previous_messages: history
  };

  // 2. Call AI via dedicated parse-command endpoint
  try {
    const res = await parseCommand(instruction, context);
    
    if (res.success && res.data) {
      return res.data as AiCommandIntent;
    }
    
    throw new Error(res.error || 'AI request failed');
  } catch (e) {
    console.error('Parse Command Error:', e);
    throw e;
  }
}
