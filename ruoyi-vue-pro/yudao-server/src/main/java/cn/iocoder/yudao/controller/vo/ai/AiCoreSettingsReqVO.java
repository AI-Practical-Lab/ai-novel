package cn.iocoder.yudao.controller.vo.ai;

import lombok.Data;

import java.util.List;

@Data
public class AiCoreSettingsReqVO {
    private String title;
    private String description;
    private String genre;
    private String style;
    private List<String> tags;
}
