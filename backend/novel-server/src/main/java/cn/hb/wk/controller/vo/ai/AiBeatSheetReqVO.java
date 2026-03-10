package cn.hb.wk.controller.vo.ai;

import lombok.Data;

@Data
public class AiBeatSheetReqVO {
    private String title;
    private String summary;
    private String previousContext;
    private String previousChapterContent;
    private String volumeSummary;
}
