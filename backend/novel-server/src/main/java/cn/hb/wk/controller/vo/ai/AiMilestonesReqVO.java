package cn.hb.wk.controller.vo.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiMilestonesReqVO {
    private String volumeTitle;
    private String volumeSummary;
    private List<ChapterItem> chapters;
    private Object timeline;
    private Integer volumeTotalChapters;

    @Data
    public static class ChapterItem {
        private String title;
        private String summary;
    }
}
