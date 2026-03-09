package cn.iocoder.yudao.controller.vo.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiAnalyzeRelationsReqVO {
    private List<CharacterItem> characters;

    @Data
    public static class CharacterItem {
        private String id;
        private String name;
        private String content;
    }
}
