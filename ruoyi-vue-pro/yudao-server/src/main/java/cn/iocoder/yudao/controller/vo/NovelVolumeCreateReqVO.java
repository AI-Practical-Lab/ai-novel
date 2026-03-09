package cn.iocoder.yudao.controller.vo;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class NovelVolumeCreateReqVO {
    @NotBlank
    private String title;
}
