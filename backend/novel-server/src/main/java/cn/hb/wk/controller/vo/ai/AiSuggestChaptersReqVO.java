package cn.hb.wk.controller.vo.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiSuggestChaptersReqVO {
    private String volumeTitle;
    private String volumeSummary;
    private List<String> existingChapters;
    private String context;
    private Integer count;
    private Integer previousChapterCount;
    private Integer startIndex;
}
