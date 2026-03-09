package cn.iocoder.yudao.service.usage;

import cn.hutool.core.util.StrUtil;
import cn.iocoder.yudao.model.AiPlatformEnum;
import cn.iocoder.yudao.dal.dataobject.usage.NovelAiUsageLogDO;
import cn.iocoder.yudao.dal.mysql.usage.NovelAiUsageLogMapper;
import jakarta.annotation.Resource;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class NovelAiUsageLogServiceImpl implements NovelAiUsageLogService {
    @Resource
    private NovelAiUsageLogMapper mapper;

    @Override
    public void log(Long projectId, String operation, AiPlatformEnum platform, String model,
                    Integer promptTokens, Integer completionTokens, Integer totalTokens,
                    Integer inputChars, Integer outputChars, Boolean success, String error, String extra) {
        NovelAiUsageLogDO log = new NovelAiUsageLogDO();
        log.setProjectId(projectId);
        log.setOperation(operation);
        log.setPlatform(platform != null ? platform.name() : null);
        log.setModel(model);
        log.setPromptTokens(promptTokens);
        log.setCompletionTokens(completionTokens);
        log.setTotalTokens(totalTokens);
        log.setInputChars(inputChars);
        log.setOutputChars(outputChars);
        log.setSuccess(success);
        log.setError(error);
        log.setExtra(extra);
        mapper.insert(log);
    }

    @Override
    public void logResponse(Long projectId, String operation, AiPlatformEnum platform, String input, ChatResponse response, boolean success, String error) {
        String model = response != null && response.getMetadata() != null ? response.getMetadata().getModel() : null;
        Integer promptTokens = response != null && response.getMetadata() != null && response.getMetadata().getUsage() != null
                ? response.getMetadata().getUsage().getPromptTokens() : null;
        Integer completionTokens = response != null && response.getMetadata() != null && response.getMetadata().getUsage() != null
                ? response.getMetadata().getUsage().getCompletionTokens() : null;
        Integer totalTokens = response != null && response.getMetadata() != null && response.getMetadata().getUsage() != null
                ? response.getMetadata().getUsage().getTotalTokens() : null;
        String output = response != null && response.getResult() != null && response.getResult().getOutput() != null
                ? response.getResult().getOutput().getText() : null;
        Integer inputChars = input != null ? input.length() : null;
        Integer outputChars = output != null ? output.length() : null;
        String extra = null;
        if (response != null && response.getMetadata() != null) {
            String rateModel = response.getMetadata().getModel();
            if (StrUtil.isNotEmpty(rateModel)) {
                extra = "{\"model\":\"" + rateModel + "\"}";
            }
        }
        log(projectId, operation, platform, model, promptTokens, completionTokens, totalTokens, inputChars, outputChars, success, error, extra);
    }
}
