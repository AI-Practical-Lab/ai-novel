package cn.hb.wk.service.knowledge;

import cn.hb.wk.dal.dataobject.knowledge.NovelCharacterKnowledgeDO;
import cn.hb.wk.dal.dataobject.lore.NovelLoreDO;
import cn.hb.wk.dal.dataobject.project.NovelChapterDO;
import cn.hb.wk.dal.mysql.knowledge.NovelCharacterKnowledgeMapper;
import cn.hb.wk.dal.mysql.lore.NovelLoreMapper;
import cn.hb.wk.dal.mysql.project.NovelChapterMapper;
import cn.hb.wk.dal.mysql.project.NovelProjectMapper;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Validated
public class NovelCharacterKnowledgeServiceImpl implements NovelCharacterKnowledgeService {
    @Resource
    private NovelCharacterKnowledgeMapper knowledgeMapper;
    @Resource
    private NovelProjectMapper projectMapper;
    @Resource
    private NovelChapterMapper chapterMapper;
    @Resource
    private NovelLoreMapper loreMapper;

    @Override
    public NovelCharacterKnowledgeDO getKnowledge(Long projectId, Long chapterId, Long characterLoreId) {
        assertBelongs(projectId, chapterId, characterLoreId);
        return knowledgeMapper.selectOneByUniqueKey(projectId, chapterId, characterLoreId);
    }

    @Override
    public List<NovelCharacterKnowledgeDO> listByProjectAndChapter(Long projectId, Long chapterId) {
        if (chapterId != null) {
            List<NovelChapterDO> chapters = chapterMapper.selectListByProjectId(projectId);
            boolean ok = chapters.stream().anyMatch(c -> c.getId().equals(chapterId));
            if (!ok) {
                throw new RuntimeException("章节不属于该项目");
            }
        }
        return knowledgeMapper.selectListByProjectAndChapter(projectId, chapterId);
    }

    @Override
    public List<NovelCharacterKnowledgeDO> getCharacterTimeline(Long projectId, Long characterLoreId) {
        NovelLoreDO lore = loreMapper.selectById(characterLoreId);
        if (lore == null || !projectId.equals(lore.getProjectId())) {
            throw new RuntimeException("人物设定不属于该项目");
        }
        return knowledgeMapper.selectListByProjectAndCharacterTimeline(projectId, characterLoreId);
    }

    @Override
    public NovelCharacterKnowledgeDO getLatestKnowledgeBeforeChapter(Long projectId, Long chapterId, Long characterLoreId) {
        assertBelongs(projectId, chapterId, characterLoreId);
        List<NovelCharacterKnowledgeDO> timeline = knowledgeMapper.selectListByProjectAndCharacterTimeline(projectId, characterLoreId);
        NovelCharacterKnowledgeDO latest = null;
        for (NovelCharacterKnowledgeDO k : timeline) {
            if (k.getChapterId() == null) {
                latest = k;
            } else if (chapterId != null && k.getChapterId() != null && k.getChapterId() <= chapterId) {
                latest = k;
            }
        }
        return latest;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NovelCharacterKnowledgeDO saveOrUpdateKnowledge(NovelCharacterKnowledgeDO knowledge) {
        assertBelongs(knowledge.getProjectId(), knowledge.getChapterId(), knowledge.getCharacterLoreId());
        NovelCharacterKnowledgeDO existing = knowledgeMapper.selectOneByUniqueKey(
                knowledge.getProjectId(), knowledge.getChapterId(), knowledge.getCharacterLoreId());
        LocalDateTime now = LocalDateTime.now();
        if (existing == null) {
            knowledge.setCreateTime(now);
            knowledge.setUpdateTime(now);
            knowledgeMapper.insert(knowledge);
            return knowledge;
        } else {
            knowledge.setId(existing.getId());
            knowledge.setUpdateTime(now);
            knowledgeMapper.updateById(knowledge);
            return knowledge;
        }
    }

    private void assertBelongs(Long projectId, Long chapterId, Long characterLoreId) {
        if (chapterId != null) {
            List<NovelChapterDO> chapters = chapterMapper.selectListByProjectId(projectId);
            boolean ok = chapters.stream().anyMatch(c -> c.getId().equals(chapterId));
            if (!ok) {
                throw new RuntimeException("章节不属于该项目");
            }
        }
        NovelLoreDO lore = loreMapper.selectById(characterLoreId);
        if (lore == null || !projectId.equals(lore.getProjectId())) {
            throw new RuntimeException("人物设定不属于该项目");
        }
    }
}
