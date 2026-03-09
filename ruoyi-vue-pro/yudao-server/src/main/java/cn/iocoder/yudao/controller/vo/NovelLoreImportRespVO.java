package cn.iocoder.yudao.controller.vo;

import cn.iocoder.yudao.dal.dataobject.lore.NovelLoreDO;
import lombok.Data;

import java.util.List;

@Data
public class NovelLoreImportRespVO {
    private Integer count;
    private List<NovelLoreDO> items;
    private Long backupId;
}
