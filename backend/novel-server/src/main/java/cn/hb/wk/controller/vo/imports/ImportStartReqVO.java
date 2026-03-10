package cn.hb.wk.controller.vo.imports;

import lombok.Data;

@Data
public class ImportStartReqVO {
    private String type;
    private String content;
    private String fileName;
}
