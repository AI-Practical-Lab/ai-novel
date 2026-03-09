package cn.iocoder.yudao.controller.vo.ai;

import lombok.Data;

@Data
public class AiRefineTextReqVO {
    private String text;
    private String context;
    private String instruction;
    private String model;
}
