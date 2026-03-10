package cn.hb.wk.controller.vo.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiChapterContentReqVO {
    private Object chapter;
    private Object previousChapter;
    private String volumeSummary;
    private Object globalLore;
    private Object instruction;
    private Boolean stream;
    private List<Object> characters;
    private List<Object> foreshadowing;
    private Object coreSettings;
    private Object milestoneContext;
    private List<Object> volumeChaptersPlan;
    private List<Object> characterKnowledge;
}
