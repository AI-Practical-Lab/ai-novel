package cn.hb.wk.controller.vo;

import lombok.Data;

import java.util.List;

import cn.hb.wk.dal.dataobject.project.NovelVolumeDO;

@Data
public class NovelLoreOutlineRespVO {
    private Long id;
    private String summary;
    private List<NovelVolumeDO> volumes;
}
