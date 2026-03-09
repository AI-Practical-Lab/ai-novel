package cn.iocoder.yudao.controller.vo.ai;

import lombok.Data;

@Data
public class AiBeatSheetReqVO {
    private String title;
    private String summary;
    private String previousContext;
    private String previousChapterContent;
    private String volumeSummary;
}
