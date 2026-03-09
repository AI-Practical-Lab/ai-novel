package cn.iocoder.yudao.controller.vo;

import cn.iocoder.yudao.dal.dataobject.foreshadow.NovelForeshadowingDO;
import cn.iocoder.yudao.dal.dataobject.lore.NovelLoreDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelChapterDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelProjectDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelVolumeDO;
import cn.iocoder.yudao.dal.dataobject.relation.NovelRelationsDO;
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
