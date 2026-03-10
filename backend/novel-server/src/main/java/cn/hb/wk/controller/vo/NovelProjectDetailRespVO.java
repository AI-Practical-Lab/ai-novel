package cn.hb.wk.controller.vo;

import cn.hb.wk.dal.dataobject.foreshadow.NovelForeshadowingDO;
import cn.hb.wk.dal.dataobject.lore.NovelLoreDO;
import cn.hb.wk.dal.dataobject.project.NovelChapterDO;
import cn.hb.wk.dal.dataobject.project.NovelProjectDO;
import cn.hb.wk.dal.dataobject.project.NovelVolumeDO;
import cn.hb.wk.dal.dataobject.relation.NovelRelationsDO;
import lombok.Data;

import java.util.List;

@Data
public class NovelProjectDetailRespVO {
    private NovelProjectDO project;
    private List<NovelVolumeDO> volumes;
    private List<NovelChapterDO> chapters;
    private List<NovelLoreDO> lore;
    private List<NovelForeshadowingDO> foreshadowing;
    private NovelRelationsDO relations;
}
