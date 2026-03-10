package cn.hb.wk.dal.dataobject.milestone;

import cn.hb.wk.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@TableName("novel_volume_milestones")
@KeySequence("novel_volume_milestones_seq")
@Data
public class NovelVolumeMilestoneDO extends BaseDO {
    @TableId
    private Long id;
    private Long projectId;
    private Long volumeId;
    private String title;
    private String description;
    private String type;
    private String paceType;
    private String coolPoints;
    private String reversals;
    private String foreshadows;
    private String characterIds;
    private Long startChapterId;
    private Long endChapterId;
    private Integer estimatedChapters;
    private Integer orderIndex;
    private Boolean enabled;
}
