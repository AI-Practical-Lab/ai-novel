package cn.hb.wk.controller.vo.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiEvaluateChapterReqVO {
    private ChapterData chapter;
    private ChapterData previousChapter;
    private String volumeSummary;
    private String globalLore;
    private List<ForeshadowingItem> foreshadowing;

    @Data
    public static class ChapterData {
        private String id;
        private String title;
        private String summary;
        private String content;
        private Object beatSheet;
    }

    @Data
    public static class ForeshadowingItem {
        private String id;
        private String status;
        private String type;
        private String content;
        private String chapterTitle;
        private String resolvedChapterTitle;
    }
}
