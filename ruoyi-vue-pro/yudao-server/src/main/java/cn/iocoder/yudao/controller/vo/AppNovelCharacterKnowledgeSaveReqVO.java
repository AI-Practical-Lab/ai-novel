package cn.iocoder.yudao.controller.vo;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AppNovelCharacterKnowledgeSaveReqVO {
    @NotNull
    private Long characterLoreId;
    private String knownFacts;
    private String misunderstandings;
    private String suspicions;
    private String extra;
}
