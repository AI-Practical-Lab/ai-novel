package cn.hb.wk.controller.vo.ai;

import lombok.Data;

@Data
public class AiGenerateCharactersReqVO {
    private GenerateCharactersContext context;
    private Integer count;
    private String instruction;

    @Data
    public static class GenerateCharactersContext {
        private String world;
        private String outline;
        private String existingCharacters;
    }
}
