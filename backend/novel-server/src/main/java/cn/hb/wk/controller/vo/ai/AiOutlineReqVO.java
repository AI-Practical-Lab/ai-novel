package cn.hb.wk.controller.vo.ai;

import lombok.Data;

import java.util.List;

@Data
public class AiOutlineReqVO {
    private String title;
    private String description;
    private String genre;
    private String style;
    private List<String> tags;
    private Object coreSettings;
}
