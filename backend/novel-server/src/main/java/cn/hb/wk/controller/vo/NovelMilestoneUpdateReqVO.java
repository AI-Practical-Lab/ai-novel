package cn.hb.wk.controller.vo;

import lombok.Data;

@Data
public class NovelMilestoneUpdateReqVO {
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
