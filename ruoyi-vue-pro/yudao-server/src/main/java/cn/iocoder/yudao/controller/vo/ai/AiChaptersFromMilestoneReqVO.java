package cn.iocoder.yudao.controller.vo.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiChaptersFromMilestoneReqVO {
    private String milestoneTitle;
    private String milestoneSummary;
    private Integer count;
    private String volumeContext;
    private List<CharacterItem> characters;
    private Milestone prevMilestone;
    private Milestone nextMilestone;

    @Data
    public static class CharacterItem {
        private String id;
        private String _id;
        private String name;
        private String title;
        private String role;
        private String content;
        private String bio;
        private String description;
    }

    @Data
    public static class Milestone {
        private String title;
        private String summary;
    }
}
