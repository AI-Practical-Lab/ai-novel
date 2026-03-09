import { User, Globe, Shield, Map, FileText, GitBranch, PenTool } from 'lucide-react';

export const LORE_CATEGORIES = [
  { id: 'outline', title: '大纲与规划', icon: FileText },
  { id: 'character', title: '人物与关系', icon: User },
  { id: 'world', title: '世界与规则', icon: Globe },
  { id: 'location', title: '地点与场景', icon: Map },
  { id: 'item', title: '物品与道具', icon: Shield },
  { id: 'plot', title: '剧情架构', icon: GitBranch },
  { id: 'narrative', title: '叙事策略', icon: PenTool },
  { id: 'other', title: '其他设定', icon: FileText },
];
