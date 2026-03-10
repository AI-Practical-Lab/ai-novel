package cn.hb.wk.service.project;

import cn.hb.wk.dal.dataobject.lore.NovelLoreDO;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.Map;

@Service
@Validated
public class LoreWriteAdapter {
    @Resource
    private NovelProjectService projectService;

    public NovelLoreDO writeLore(Long projectId, String type, String title, String content, String extraJson) {
        // 1. Check if exists
        List<NovelLoreDO> list = projectService.getLoreList(projectId);
        NovelLoreDO existing = null;
        if (list != null) {
            for (NovelLoreDO l : list) {
                if (type.equals(l.getType()) && title.equals(l.getTitle())) {
                    existing = l;
                    break;
                }
            }
        }

        if (existing != null) {
            // Merge extra
            String mergedExtra = extraJson;
            if (existing.getExtra() != null && extraJson != null) {
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    Map<String, Object> oldMap = mapper.readValue(existing.getExtra(), Map.class);
                    Map<String, Object> newMap = mapper.readValue(extraJson, Map.class);
                    oldMap.putAll(newMap);
                    mergedExtra = mapper.writeValueAsString(oldMap);
                } catch (Exception e) {
                    // ignore merge error, use new
                }
            } else if (existing.getExtra() != null) {
                mergedExtra = existing.getExtra();
            }

            // Merge content (append if not empty)
            if (content != null && !content.isEmpty()) {
                if (existing.getContent() != null && !existing.getContent().isEmpty()) {
                    // Avoid duplicate content if exactly same
                    if (!existing.getContent().contains(content)) {
                        existing.setContent(existing.getContent() + "\n\n" + content);
                    }
                } else {
                    existing.setContent(content);
                }
            }

            existing.setExtra(mergedExtra);
            projectService.updateLore(existing);
            return existing;
        } else {
            NovelLoreDO lore = projectService.createLore(projectId, title, type);
            lore.setContent(content);
            lore.setExtra(extraJson);
            projectService.updateLore(lore);
            return lore;
        }
    }
}
