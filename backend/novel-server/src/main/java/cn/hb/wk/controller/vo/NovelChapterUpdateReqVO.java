package cn.hb.wk.controller.vo;

import lombok.Data;

@Data
public class NovelChapterUpdateReqVO {
    private String title;
    private String summary;
    private String content;
    private Object beatSheet;
    private String characterIds;
}
