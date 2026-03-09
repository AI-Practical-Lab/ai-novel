package cn.iocoder.yudao.controller.vo.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiGenerateBeatReqVO {
    private String chapterTitle;
    private String chapterSummary;
    private String instruction;
    private List<String> previousBeats;
}
