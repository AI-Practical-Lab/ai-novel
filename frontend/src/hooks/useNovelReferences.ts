import { useMemo } from 'react';
import { NovelDetail, Volume, Chapter } from '@/api';
import { ReferenceOption } from '@/components/ui/SmartTextarea';
import { LORE_CATEGORIES } from '@/utils/constants';

export function useNovelReferences(novel: NovelDetail | null): ReferenceOption[] {
  return useMemo(() => {
    if (!novel) return [];

    const refs: ReferenceOption[] = [];

    // 1. Chapters
    if (novel.volumes) {
        novel.volumes.forEach((vol: Volume) => {
        if (vol.chapters) {
            vol.chapters.forEach((chap: Chapter) => {
                refs.push({
                id: `chap_${chap.id}`,
                type: 'chapter',
                label: chap.title,
                data: chap
                });
            });
        }
        });
    }

    // 2. Lore / Characters grouped by top-level categories
    if (novel.lore) {
      const categoryMap: Record<string, any[]> = {};
      LORE_CATEGORIES.forEach((cat) => {
        categoryMap[cat.id] = [];
      });

      novel.lore.forEach((item: any) => {
        const targetCatId = LORE_CATEGORIES.some((c) => c.id === item.type) ? item.type : 'other';
        if (!categoryMap[targetCatId]) {
          categoryMap[targetCatId] = [];
        }
        categoryMap[targetCatId].push(item);
      });

      const primaryOutline = (novel.lore || []).find((l: any) => l.type === 'outline' && l.isPrimary);
      const plotCore = (novel.lore || []).find((l: any) => l.type === 'plot' && (l.id === 'plot' || l._id === 'plot'));
      const primarySummary = primaryOutline ? (primaryOutline.summary || '') : '';
      const plotConflict = plotCore ? (plotCore.conflict || '') : '';

      LORE_CATEGORIES.forEach((cat) => {
        const items = categoryMap[cat.id] || [];

        const content = items.length
          ? items
              .map((l: any) => {
                const title = l.title || l.name || '未命名设定';
                let base = '';

                if (l.content) {
                  base = l.content;
                } else if (l.type === 'plot') {
                  const conflict = l.conflict || '';
                  base = `主线冲突：${conflict}`;
                } else if (l.type === 'outline') {
                  const summary = l.summary || primarySummary || '';
                  base = `总纲：${summary}`;
                } else if (l.type === 'world') {
                  const background = l.background || '';
                  const powerSystem = l.powerSystem || '';
                  const forces = l.forces || '';
                  const timeline = l.timeline || '';
                  base = `世界背景：${background}\n力量体系：${powerSystem}\n势力分布：${forces}\n时间线：${timeline}`;
                } else if (l.type === 'character') {
                  const name = l.name || title;
                  const personality = l.personality || '';
                  const background = l.background || '';
                  const role = l.role || '';
                  base = `姓名：${name}\n身份：${role}\n性格：${personality}\n背景：${background}`;
                } else {
                  base = l.summary || l.description || '';
                }

                const conflictText = cat.id === 'outline' && plotConflict ? `\n主线冲突：${plotConflict}` : '';
                return `【${title}】\n${base}${conflictText}`;
              })
              .join('\n\n')
          : '';

        refs.push({
          id: `lore_cat_${cat.id}`,
          type: cat.id === 'character' ? 'bio' : 'lore',
          label: cat.title,
          data: {
            type: cat.id,
            content
          }
        });
      });
    }

    return refs;
  }, [novel]);
}
