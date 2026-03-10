package cn.hb.wk.controller.vo;

import lombok.Data;

@Data
public class NovelProjectUpdateReqVO {
    private String title;
    private String description;
    private String genre;
    private String style;
    private String tags;
}
