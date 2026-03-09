package cn.iocoder.yudao.service.project;

import cn.hutool.core.collection.CollUtil;
import cn.iocoder.yudao.dal.dataobject.foreshadow.NovelForeshadowingDO;
import cn.iocoder.yudao.dal.dataobject.lore.NovelLoreDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelChapterDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelProjectDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelVolumeDO;
import cn.iocoder.yudao.dal.dataobject.relation.NovelRelationsDO;
import cn.iocoder.yudao.dal.dataobject.milestone.NovelVolumeMilestoneDO;
import cn.iocoder.yudao.dal.mysql.foreshadow.NovelForeshadowingMapper;
import cn.iocoder.yudao.dal.mysql.lore.NovelLoreMapper;
import cn.iocoder.yudao.dal.mysql.project.NovelChapterMapper;
import cn.iocoder.yudao.dal.mysql.project.NovelProjectMapper;
import cn.iocoder.yudao.dal.mysql.project.NovelVolumeMapper;
import cn.iocoder.yudao.dal.mysql.relation.NovelRelationsMapper;
import cn.iocoder.yudao.dal.mysql.milestone.NovelVolumeMilestoneMapper;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Validated
public class NovelProjectServiceImpl implements NovelProjectService {
    @Resource
    private NovelProjectMapper projectMapper;
    @Resource
    private NovelVolumeMapper volumeMapper;
    @Resource
    private NovelChapterMapper chapterMapper;
    @Resource
    private NovelLoreMapper loreMapper;
    @Resource
    private NovelForeshadowingMapper foreshadowingMapper;
    @Resource
    private NovelRelationsMapper relationsMapper;
    @Resource
    private NovelVolumeMilestoneMapper milestoneMapper;

    @Override
    public List<NovelProjectDO> listProjects() {
        return projectMapper.selectListByCreatorOrderByUpdateDesc();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NovelProjectDO createProject(NovelProjectDO project, List<NovelVolumeDO> volumes) {
        LocalDateTime now = LocalDateTime.now();
        project.setCreateTime(now);
        project.setUpdateTime(now);
        projectMapper.insert(project);
        if (CollUtil.isNotEmpty(volumes)) {
            int idx = 1;
            for (NovelVolumeDO vol : volumes) {
                vol.setProjectId(project.getId());
                vol.setOrderIndex(idx++);
                vol.setCreateTime(now);
                vol.setUpdateTime(now);
                volumeMapper.insert(vol);
            }
        }
        return project;
    }

    @Override
    public NovelProjectDO getProject(Long id) {
        NovelProjectDO p = projectMapper.selectByIdAndCreator(id, null);
        if (p == null) {
            throw new RuntimeException("无权访问该小说项目");
        }
        return p;
    }

    @Override
    public List<NovelVolumeDO> getVolumes(Long projectId) {
        assertOwner(projectId);
        return volumeMapper.selectListByProjectId(projectId);
    }

    @Override
    public List<NovelChapterDO> getChaptersByProject(Long projectId) {
        assertOwner(projectId);
        return chapterMapper.selectListByProjectId(projectId);
    }

    @Override
    public List<NovelLoreDO> getLoreList(Long projectId) {
        assertOwner(projectId);
        return loreMapper.selectListByProjectId(projectId);
    }

    @Override
    public List<NovelForeshadowingDO> getForeshadowingList(Long projectId) {
        assertOwner(projectId);
        return foreshadowingMapper.selectListByProjectId(projectId);
    }

    @Override
    public NovelRelationsDO getRelations(Long projectId) {
        assertOwner(projectId);
        return relationsMapper.selectByProjectId(projectId);
    }

    @Override
    public void updateProject(NovelProjectDO update) {
        assertOwner(update.getId());
        update.setUpdateTime(LocalDateTime.now());
        projectMapper.updateById(update);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteProject(Long id) {
        assertOwner(id);
        List<NovelVolumeDO> volumes = volumeMapper.selectListByProjectId(id);
        for (NovelVolumeDO vol : volumes) {
            List<NovelChapterDO> chapters = chapterMapper.selectListByVolumeId(vol.getId());
            if (CollUtil.isNotEmpty(chapters)) {
                chapterMapper.deleteByIds(chapters.stream().map(NovelChapterDO::getId).collect(Collectors.toList()));
            }
        }
        if (CollUtil.isNotEmpty(volumes)) {
            volumeMapper.deleteByIds(volumes.stream().map(NovelVolumeDO::getId).collect(Collectors.toList()));
        }
        List<NovelLoreDO> lores = loreMapper.selectListByProjectId(id);
        if (CollUtil.isNotEmpty(lores)) {
            loreMapper.deleteRealByIds(lores.stream().map(NovelLoreDO::getId).collect(Collectors.toList()));
        }
        List<NovelForeshadowingDO> fList = foreshadowingMapper.selectListByProjectId(id);
        if (CollUtil.isNotEmpty(fList)) {
            foreshadowingMapper.deleteByIds(fList.stream().map(NovelForeshadowingDO::getId).collect(Collectors.toList()));
        }
        NovelRelationsDO relations = relationsMapper.selectByProjectId(id);
        if (relations != null) {
            relationsMapper.deleteById(relations.getId());
        }
        projectMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NovelVolumeDO createVolume(Long projectId, String title) {
        assertOwner(projectId);
        List<NovelVolumeDO> volumes = volumeMapper.selectListByProjectId(projectId);
        int nextIndex = volumes.size() + 1;
        NovelVolumeDO vol = new NovelVolumeDO();
        vol.setProjectId(projectId);
        vol.setTitle(title);
        vol.setOrderIndex(nextIndex);
        LocalDateTime now = LocalDateTime.now();
        vol.setCreateTime(now);
        vol.setUpdateTime(now);
        volumeMapper.insert(vol);
        touchProject(projectId);
        return vol;
    }

    @Override
    public void updateVolume(NovelVolumeDO update) {
        assertOwner(update.getProjectId());
        update.setUpdateTime(LocalDateTime.now());
        volumeMapper.updateById(update);
        touchProject(update.getProjectId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteVolume(Long projectId, Long volumeId) {
        assertOwner(projectId);
        List<NovelChapterDO> chapters = chapterMapper.selectListByVolumeId(volumeId);
        if (CollUtil.isNotEmpty(chapters)) {
            chapterMapper.deleteByIds(chapters.stream().map(NovelChapterDO::getId).collect(Collectors.toList()));
        }
        volumeMapper.deleteById(volumeId);
        touchProject(projectId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NovelChapterDO createChapter(Long projectId, Long volumeId, String title, String summary, List<String> characterIds) {
        assertOwner(projectId);
        NovelChapterDO ch = new NovelChapterDO();
        ch.setProjectId(projectId);
        ch.setVolumeId(volumeId);
        ch.setTitle(title);
        ch.setSummary(summary);
        ch.setCharacterIds(CollUtil.isEmpty(characterIds) ? null
                : String.join(",", characterIds.stream()
                .filter(s -> s != null)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList()));
        List<NovelChapterDO> chapters = chapterMapper.selectListByVolumeId(volumeId);
        int nextIndex = chapters.size() + 1;
        ch.setOrderIndex(nextIndex);
        LocalDateTime now = LocalDateTime.now();
        ch.setCreateTime(now);
        ch.setUpdateTime(now);
        chapterMapper.insert(ch);
        touchProject(projectId);
        return ch;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<NovelChapterDO> createChaptersBatch(Long projectId, Long volumeId, List<NovelChapterDO> chapters) {
        assertOwner(projectId);
        List<NovelChapterDO> existing = chapterMapper.selectListByVolumeId(volumeId);
        int idx = existing.size() + 1;
        LocalDateTime now = LocalDateTime.now();
        for (NovelChapterDO ch : chapters) {
            ch.setProjectId(projectId);
            ch.setVolumeId(volumeId);
            ch.setOrderIndex(idx++);
            ch.setCreateTime(now);
            ch.setUpdateTime(now);
            chapterMapper.insert(ch);
        }
        touchProject(projectId);
        return chapters;
    }

    @Override
    public void updateChapter(NovelChapterDO update) {
        assertOwner(update.getProjectId());
        update.setUpdateTime(LocalDateTime.now());
        chapterMapper.updateById(update);
        touchProject(update.getProjectId());
    }

    @Override
    public void deleteChapter(Long projectId, Long chapterId) {
        assertOwner(projectId);
        chapterMapper.deleteById(chapterId);
        touchProject(projectId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void reorderChapters(Long projectId, Long volumeId, List<Long> chapterIds) {
        assertOwner(projectId);
        Long id1 = chapterIds.get(0);
        Long id2 = chapterIds.get(1);
        NovelChapterDO ch1 = chapterMapper.selectById(id1);
        NovelChapterDO ch2 = chapterMapper.selectById(id2);
        if (ch1 != null && ch2 != null) {
            Integer idx1 = ch1.getOrderIndex();
            Integer idx2 = ch2.getOrderIndex();
            NovelChapterDO u1 = new NovelChapterDO();
            u1.setId(id1);
            u1.setOrderIndex(idx2);
            chapterMapper.updateById(u1);
            NovelChapterDO u2 = new NovelChapterDO();
            u2.setId(id2);
            u2.setOrderIndex(idx1);
            chapterMapper.updateById(u2);
        }
        touchProject(projectId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NovelLoreDO createLore(Long projectId, String title, String type) {
        assertOwner(projectId);
        NovelLoreDO lore = new NovelLoreDO();
        lore.setProjectId(projectId);
        lore.setTitle(title);
        lore.setType(type);
        LocalDateTime now = LocalDateTime.now();
        lore.setCreateTime(now);
        lore.setUpdateTime(now);
        loreMapper.insert(lore);
        touchProject(projectId);
        return lore;
    }

    @Override
    public void updateLore(NovelLoreDO update) {
        assertOwner(update.getProjectId());
        update.setUpdateTime(LocalDateTime.now());
        loreMapper.updateById(update);
        touchProject(update.getProjectId());
    }

    @Override
    public void deleteLore(Long projectId, Long loreId) {
        assertOwner(projectId);
        loreMapper.deleteRealById(loreId);
        touchProject(projectId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateRelations(Long projectId, String edgesJson, String positionsJson) {
        assertOwner(projectId);
        NovelRelationsDO relations = relationsMapper.selectByProjectId(projectId);
        LocalDateTime now = LocalDateTime.now();
        if (relations == null) {
            relations = new NovelRelationsDO();
            relations.setProjectId(projectId);
            relations.setEdges(edgesJson);
            relations.setPositions(positionsJson);
            relations.setCreateTime(now);
            relations.setUpdateTime(now);
            relationsMapper.insert(relations);
        } else {
            relations.setEdges(edgesJson);
            relations.setPositions(positionsJson);
            relations.setUpdateTime(now);
            relationsMapper.updateById(relations);
        }
        touchProject(projectId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateForeshadowing(Long projectId, Long chapterId, List<NovelForeshadowingDO> list) {
        assertOwner(projectId);
        List<NovelForeshadowingDO> old = foreshadowingMapper.selectListByProjectIdAndChapterId(projectId, chapterId);
        if (CollUtil.isNotEmpty(old)) {
            foreshadowingMapper.deleteByIds(old.stream().map(NovelForeshadowingDO::getId).collect(Collectors.toList()));
        }
        LocalDateTime now = LocalDateTime.now();
        for (NovelForeshadowingDO f : list) {
            f.setProjectId(projectId);
            f.setChapterId(chapterId);
            String v = f.getVisibility();
            if (v == null || !(v.equals("author_only") || v.equals("reader_known") || v.equals("character_known"))) {
                f.setVisibility("author_only");
            }
            Long cid = f.getCharacterId();
            if (cid != null) {
                NovelLoreDO lore = loreMapper.selectById(cid);
                if (lore == null || !projectId.equals(lore.getProjectId()) || !"character".equals(lore.getType())) {
                    f.setCharacterId(null);
                }
            }
            f.setCreateTime(now);
            f.setUpdateTime(now);
            foreshadowingMapper.insert(f);
        }
        touchProject(projectId);
    }

    @Override
    public String getChapterContent(Long chapterId) {
        NovelChapterDO ch = chapterMapper.selectById(chapterId);
        if (ch != null && ch.getProjectId() != null) {
            assertOwner(ch.getProjectId());
        }
        return ch != null ? ch.getContent() : null;
    }
    @Override
    public String getChapterBeatSheet(Long chapterId) {
        NovelChapterDO ch = chapterMapper.selectById(chapterId);
        if (ch != null && ch.getProjectId() != null) {
            assertOwner(ch.getProjectId());
        }
        return ch != null ? toJson(ch.getBeatSheet()) : null;
    }

    @Override
    public List<NovelChapterDO> getChaptersProgress(Long projectId, Long chapterId) {
        assertOwner(projectId);
        List<NovelVolumeDO> volumes = volumeMapper.selectListByProjectId(projectId);
        java.util.Map<Long, Integer> volumeOrderMap = new java.util.HashMap<>();
        if (volumes != null) {
            volumes.stream()
                    .filter(v -> v != null && v.getId() != null)
                    .sorted((a, b) -> {
                        Integer ai = a.getOrderIndex();
                        Integer bi = b.getOrderIndex();
                        int av = ai != null ? ai : Integer.MAX_VALUE;
                        int bv = bi != null ? bi : Integer.MAX_VALUE;
                        if (av != bv) return Integer.compare(av, bv);
                        return Long.compare(a.getId(), b.getId());
                    })
                    .forEachOrdered(v -> volumeOrderMap.put(v.getId(), v.getOrderIndex() != null ? v.getOrderIndex() : Integer.MAX_VALUE));
        }

        List<NovelChapterDO> chapters = chapterMapper.selectListByProjectId(projectId);
        if (chapters == null || chapters.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        chapters = chapters.stream()
                .filter(ch -> ch != null && ch.getId() != null)
                .sorted((a, b) -> {
                    Long avid = a.getVolumeId();
                    Long bvid = b.getVolumeId();
                    int av = avid != null ? volumeOrderMap.getOrDefault(avid, Integer.MAX_VALUE) : Integer.MAX_VALUE;
                    int bv = bvid != null ? volumeOrderMap.getOrDefault(bvid, Integer.MAX_VALUE) : Integer.MAX_VALUE;
                    if (av != bv) return Integer.compare(av, bv);
                    Integer ao = a.getOrderIndex();
                    Integer bo = b.getOrderIndex();
                    int aoi = ao != null ? ao : Integer.MAX_VALUE;
                    int boi = bo != null ? bo : Integer.MAX_VALUE;
                    if (aoi != boi) return Integer.compare(aoi, boi);
                    return Long.compare(a.getId(), b.getId());
                })
                .toList();

        List<NovelChapterDO> result = new java.util.ArrayList<>();
        boolean found = false;
        for (NovelChapterDO ch : chapters) {
            result.add(ch);
            if (ch.getId().equals(chapterId)) {
                found = true;
                break;
            }
        }
        if (!found) {
            throw new IllegalArgumentException("chapterId 不属于该项目或不存在");
        }
        return result;
    }

    @Override
    public List<NovelVolumeMilestoneDO> getMilestones(Long projectId, Long volumeId) {
        assertOwner(projectId);
        return milestoneMapper.selectListByVolumeId(volumeId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NovelVolumeMilestoneDO createMilestone(NovelVolumeMilestoneDO milestone) {
        assertOwner(milestone.getProjectId());
        List<NovelVolumeMilestoneDO> list = milestoneMapper.selectListByVolumeId(milestone.getVolumeId());
        int nextIndex = list.size() + 1;
        LocalDateTime now = LocalDateTime.now();
        milestone.setOrderIndex(milestone.getOrderIndex() != null ? milestone.getOrderIndex() : nextIndex);
        milestone.setEnabled(milestone.getEnabled() != null ? milestone.getEnabled() : Boolean.TRUE);
        milestone.setCreateTime(now);
        milestone.setUpdateTime(now);
        milestoneMapper.insert(milestone);
        touchProject(milestone.getProjectId());
        return milestone;
    }

    @Override
    public void updateMilestone(NovelVolumeMilestoneDO update) {
        assertOwner(update.getProjectId());
        update.setUpdateTime(LocalDateTime.now());
        milestoneMapper.updateById(update);
        touchProject(update.getProjectId());
    }

    @Override
    public void deleteMilestone(Long projectId, Long milestoneId) {
        assertOwner(projectId);
        milestoneMapper.deleteById(milestoneId);
        touchProject(projectId);
    }

    private void assertOwner(Long projectId) {
        NovelProjectDO p = projectMapper.selectByIdAndCreator(projectId, null);
        if (p == null) {
            throw new RuntimeException("无权访问该小说项目");
        }
    }

    private String toJson(Object obj) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(obj);
        } catch (Exception e) {
            return null;
        }
    }

    private void touchProject(Long projectId) {
        NovelProjectDO p = new NovelProjectDO();
        p.setId(projectId);
        p.setUpdateTime(LocalDateTime.now());
        projectMapper.updateById(p);
    }
}
