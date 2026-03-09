package cn.iocoder.yudao.controller.vo.ai;

import lombok.Data;

@Data
public class AiParseCommandReqVO {
    private String instruction;
    private Object context;
}
