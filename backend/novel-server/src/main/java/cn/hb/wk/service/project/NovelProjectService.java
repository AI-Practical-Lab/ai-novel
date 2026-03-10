package cn.hb.wk.service.project;

import cn.hb.wk.dal.dataobject.foreshadow.NovelForeshadowingDO;
import cn.hb.wk.dal.dataobject.lore.NovelLoreDO;
import cn.hb.wk.dal.dataobject.project.NovelChapterDO;
import cn.hb.wk.dal.dataobject.project.NovelProjectDO;
import cn.hb.wk.dal.dataobject.project.NovelVolumeDO;
import cn.hb.wk.dal.dataobject.relation.NovelRelationsDO;
import cn.hb.wk.dal.dataobject.milestone.NovelVolumeMilestoneDO;
import java.util.List;

public interface NovelProjectService {
    List<NovelProjectDO> listProjects();
    NovelProjectDO createProject(NovelProjectDO project, List<NovelVolumeDO> volumes);
    NovelProjectDO getProject(Long id);
    List<NovelVolumeDO> getVolumes(Long projectId);
    List<NovelChapterDO> getChaptersByProject(Long projectId);
    List<NovelLoreDO> getLoreList(Long projectId);
    List<NovelForeshadowingDO> getForeshadowingList(Long projectId);
    NovelRelationsDO getRelations(Long projectId);
    void updateProject(NovelProjectDO update);
    void deleteProject(Long id);
    NovelVolumeDO createVolume(Long projectId, String title);
    void updateVolume(NovelVolumeDO update);
    void deleteVolume(Long projectId, Long volumeId);
    NovelChapterDO createChapter(Long projectId, Long volumeId, String title, String summary, List<String> characterIds);
    List<NovelChapterDO> createChaptersBatch(Long projectId, Long volumeId, List<NovelChapterDO> chapters);
    void updateChapter(NovelChapterDO update);
    void deleteChapter(Long projectId, Long chapterId);
    void reorderChapters(Long projectId, Long volumeId, List<Long> chapterIds);
    NovelLoreDO createLore(Long projectId, String title, String type);
    void updateLore(NovelLoreDO update);
    void deleteLore(Long projectId, Long loreId);
    void updateRelations(Long projectId, String edgesJson, String positionsJson);
    void updateForeshadowing(Long projectId, Long chapterId, List<NovelForeshadowingDO> list);
    String getChapterContent(Long chapterId);
    String getChapterBeatSheet(Long chapterId);
    List<NovelChapterDO> getChaptersProgress(Long projectId, Long chapterId);
    List<NovelVolumeMilestoneDO> getMilestones(Long projectId, Long volumeId);
    NovelVolumeMilestoneDO createMilestone(NovelVolumeMilestoneDO milestone);
    void updateMilestone(NovelVolumeMilestoneDO update);
    void deleteMilestone(Long projectId, Long milestoneId);
}
