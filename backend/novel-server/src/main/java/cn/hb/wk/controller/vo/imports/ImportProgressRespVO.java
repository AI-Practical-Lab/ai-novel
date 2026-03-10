package cn.hb.wk.controller.vo.imports;

import lombok.Data;
import java.util.List;

@Data
public class ImportProgressRespVO {
    private String taskId;
    private Integer step;
    private Integer total;
    private String status;
    private String message;
    private String jobId;
    private Long projectId;
    private String currentStep;
    private List<String> steps;
    private List<String> finishedSteps;
    private Integer generatedCount;
    private String generatedType;
    private String error;
    public Integer getPercent() {
        if (step == null || total == null || total <= 0) return 0;
        int v = (int) Math.round(step * 100.0 / total);
        if (v < 0) return 0;
        if (v > 100) return 100;
        return v;
    }
}
