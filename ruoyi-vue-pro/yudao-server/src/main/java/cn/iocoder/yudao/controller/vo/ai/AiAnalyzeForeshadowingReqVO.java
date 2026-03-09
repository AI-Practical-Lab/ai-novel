package cn.iocoder.yudao.controller.vo.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiAnalyzeForeshadowingReqVO {
    private String chapterId;
    private String chapterTitle;
    private String content;
    private List<ForeshadowingItem> existingForeshadowing;

    @Data
    public static class ForeshadowingItem {
        private String id;
        private String _id;
        private String status;
        private String type;
        private String content;
        private String chapterTitle;
        private String resolvedChapterTitle;
    }
}
