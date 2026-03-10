package cn.hb.wk.controller.vo.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiSuggestPlotCharactersReqVO {
    private String plotTitle;
    private String plotSummary;
    private List<CharacterItem> characters;

    @Data
    public static class CharacterItem {
        private String id;
        private String name;
        private String role;
        private String content;
        private String title;
    }
}
