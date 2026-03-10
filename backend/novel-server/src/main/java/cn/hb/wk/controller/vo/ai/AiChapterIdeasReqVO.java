package cn.hb.wk.controller.vo.ai;

import lombok.Data;

@Data
public class AiChapterIdeasReqVO {
    private String volumeTitle;
    private String volumeSummary;
    private String previousChapterTitle;
    private String previousChapterContent;
}
