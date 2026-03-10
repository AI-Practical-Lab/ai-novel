package cn.hb.wk.controller.vo.ai;

import lombok.Data;

@Data
public class AiParseCommandReqVO {
    private String instruction;
    private Object context;
}
