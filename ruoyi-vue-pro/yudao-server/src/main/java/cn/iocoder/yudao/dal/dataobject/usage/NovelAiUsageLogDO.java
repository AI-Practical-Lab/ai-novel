package cn.iocoder.yudao.dal.dataobject.usage;

import cn.iocoder.yudao.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@TableName("novel_ai_usage_log")
@KeySequence("novel_ai_usage_log_seq")
@Data
public class NovelAiUsageLogDO extends BaseDO {
    @TableId
    private Long id;
    private Long projectId;
    private String operation;
    private String platform;
    private String model;
    private Integer promptTokens;
    private Integer completionTokens;
    private Integer totalTokens;
    private Integer inputChars;
    private Integer outputChars;
    private Boolean success;
    private String error;
    private String extra;
}
