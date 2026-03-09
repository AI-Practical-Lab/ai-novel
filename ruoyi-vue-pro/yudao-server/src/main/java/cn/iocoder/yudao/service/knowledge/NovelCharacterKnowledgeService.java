package cn.iocoder.yudao.service.knowledge;

import cn.iocoder.yudao.dal.dataobject.knowledge.NovelCharacterKnowledgeDO;
import java.util.List;

public interface NovelCharacterKnowledgeService {
    NovelCharacterKnowledgeDO getKnowledge(Long projectId, Long chapterId, Long characterLoreId);
    NovelCharacterKnowledgeDO getLatestKnowledgeBeforeChapter(Long projectId, Long chapterId, Long characterLoreId);
    NovelCharacterKnowledgeDO saveOrUpdateKnowledge(NovelCharacterKnowledgeDO knowledge);
    List<NovelCharacterKnowledgeDO> listByProjectAndChapter(Long projectId, Long chapterId);
    List<NovelCharacterKnowledgeDO> getCharacterTimeline(Long projectId, Long characterLoreId);
}
