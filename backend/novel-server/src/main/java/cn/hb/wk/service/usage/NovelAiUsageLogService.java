package cn.hb.wk.service.usage;

import cn.hb.wk.model.AiPlatformEnum;
import org.springframework.ai.chat.model.ChatResponse;

public interface NovelAiUsageLogService {
    void log(Long projectId, String operation, AiPlatformEnum platform, String model,
             Integer promptTokens, Integer completionTokens, Integer totalTokens,
             Integer inputChars, Integer outputChars, Boolean success, String error, String extra);

    void logResponse(Long projectId, String operation, AiPlatformEnum platform, String input, ChatResponse response, boolean success, String error);
}
