package cn.hb.wk.controller.vo;

import cn.hb.wk.dal.dataobject.lore.NovelLoreDO;
import lombok.Data;

import java.util.List;

@Data
public class NovelLoreImportRespVO {
    private Integer count;
    private List<NovelLoreDO> items;
    private Long backupId;
}
