package cn.iocoder.yudao.controller.vo;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class NovelChapterCreateReqVO {
    @NotBlank
    private String title;
    private String summary;
    private List<String> characterIds;
    private String role;
}
