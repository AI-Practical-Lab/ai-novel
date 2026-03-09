package cn.iocoder.yudao.controller.vo;

import lombok.Data;

import java.util.List;

import cn.iocoder.yudao.dal.dataobject.project.NovelVolumeDO;

@Data
public class NovelLoreOutlineRespVO {
    private Long id;
    private String summary;
    private List<NovelVolumeDO> volumes;
}
