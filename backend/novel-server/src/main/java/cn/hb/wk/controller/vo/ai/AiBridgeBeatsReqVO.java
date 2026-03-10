package cn.hb.wk.controller.vo.ai;

import lombok.Data;

@Data
public class AiBridgeBeatsReqVO {
    private Milestone startMilestone;
    private Milestone endMilestone;
    private String context;

    @Data
    public static class Milestone {
        private String title;
        private String summary;
    }
}
