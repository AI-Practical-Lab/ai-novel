package cn.hb.wk.controller;

import cn.hb.wk.pojo.CommonResult;
import cn.hb.wk.dal.dataobject.lore.NovelLoreDO;
import cn.hb.wk.dal.dataobject.project.NovelProjectDO;
import cn.hb.wk.model.AiPlatformEnum;
import cn.hb.wk.ai.core.model.AiModelFactory;
import cn.hb.wk.service.project.NovelProjectService;
import cn.hb.wk.controller.vo.ai.AiBeatSheetReqVO;
import cn.hb.wk.controller.vo.ai.AiChapterContentReqVO;
import cn.hb.wk.controller.vo.ai.AiChapterIdeasReqVO;
import cn.hb.wk.controller.vo.ai.AiAnalyzeLoreReqVO;
import cn.hb.wk.controller.vo.ai.AiCoreSettingsReqVO;
import cn.hb.wk.controller.vo.ai.AiInspirationReqVO;
import cn.hb.wk.controller.vo.ai.AiOutlineReqVO;
import cn.hb.wk.controller.vo.ai.AiRecommendTagsReqVO;
import cn.hb.wk.controller.vo.ai.AiMilestonesReqVO;
import cn.hb.wk.controller.vo.ai.AiBridgeBeatsReqVO;
import cn.hb.wk.controller.vo.ai.AiChaptersFromMilestoneReqVO;
import cn.hb.wk.controller.vo.ai.AiGenerateBeatReqVO;
import cn.hb.wk.controller.vo.ai.AiRefineTextReqVO;
import cn.hb.wk.controller.vo.ai.AiGenerateCharactersReqVO;
import cn.hb.wk.controller.vo.ai.AiAnalyzeRelationsReqVO;
import cn.hb.wk.controller.vo.ai.AiAnalyzeForeshadowingReqVO;
import cn.hb.wk.controller.vo.ai.AiEvaluateChapterReqVO;
import cn.hb.wk.controller.vo.ai.AiRewriteChapterReqVO;
import cn.hb.wk.controller.vo.ai.AiParseCommandReqVO;
import cn.hb.wk.controller.vo.ai.AiSuggestPlotCharactersReqVO;
import cn.hb.wk.controller.vo.ai.AiSuggestChaptersReqVO;
import cn.hb.wk.controller.vo.ai.AiTestReqVO;
import cn.hb.wk.util.AiUtils;
import cn.hb.wk.service.usage.NovelAiUsageLogService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import cn.hb.wk.service.ai.ChapterPromptBuilder;
import reactor.core.Disposable;
import jakarta.annotation.Resource;
import jakarta.annotation.PostConstruct;
import java.util.List;

import static cn.hb.wk.pojo.CommonResult.success;

@Slf4j
@RestController
@RequestMapping("/app-api/api/ai")
public class AiController {
    @Resource
    private AiModelFactory aiModelFactory;
    @Resource
    private NovelProjectService projectService;
    @Resource
    private NovelAiUsageLogService usageLogService;

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(com.fasterxml.jackson.core.JsonParser.Feature.ALLOW_UNQUOTED_CONTROL_CHARS, true);
    private final java.util.concurrent.ConcurrentHashMap<String, String> settingCache = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.concurrent.ConcurrentHashMap<String, Long> settingCacheExpire = new java.util.concurrent.ConcurrentHashMap<>();
    private final long settingCacheTtlMs = 30 * 60 * 1000L;
    private final ChapterPromptBuilder chapterPromptBuilder = new ChapterPromptBuilder();

    @Value("${novel.ai.platform:TONG_YI}")
    private String aiPlatformProperty;
    private volatile AiPlatformEnum currentPlatform;

    @PostConstruct
    private void initAiPlatform() {
        this.currentPlatform = parsePlatform(aiPlatformProperty);
    }

    private AiPlatformEnum parsePlatform(String s) {
        if (s == null) return AiPlatformEnum.TONG_YI;
        try {
            return AiPlatformEnum.valueOf(s.trim().toUpperCase());
        } catch (Exception ignore) {
            return AiPlatformEnum.TONG_YI;
        }
    }

    private String callAndLog(ChatModel chat, Prompt prompt, String operation, String input, Long projectId, AiPlatformEnum platform) {
        ChatResponse response = chat.call(prompt);
        String content = AiUtils.getChatResponseContent(response);
        try {
            usageLogService.logResponse(projectId, operation, currentPlatform, input, response, true, null);
        } catch (Exception ignored) {
        }
        return content;
    }

    @PostMapping("/test")
    public CommonResult<String> test(@RequestBody AiTestReqVO reqVO) {
        
        String prompt = reqVO.getPrompt() != null ? reqVO.getPrompt() : "请说\"DeepSeek 工作正常！\"";
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是一个乐于助人的助手。请始终用简体中文回答。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(prompt))), "test", prompt, null, currentPlatform);
        return success(content);
    }

    @PostMapping("/chat")
    public CommonResult<Object> chat(@RequestBody String body) {
        
        String parsedPrompt = null;
        List<org.springframework.ai.chat.messages.Message> messages = new java.util.ArrayList<>();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是一个专业的网文写作助手，擅长情节构思、文笔润色和网文套路分析。请始终使用简体中文回答。\n回答要具体、有建设性，避免空泛的理论。";
        messages.add(new SystemMessage(system));
        Long projectId = null;
        java.util.List<String> loadedNames = new java.util.ArrayList<>();
        try {
            com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(body);
            if (node.has("novelId") && !node.get("novelId").isNull()) {
                try {
                    projectId = node.get("novelId").isNumber() ? node.get("novelId").asLong() : Long.parseLong(node.get("novelId").asText());
                } catch (Exception ignore) {
                }
            }
            StringBuilder settingsText = new StringBuilder();
            if (node.has("referencedSettings") && node.get("referencedSettings").isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode s : node.get("referencedSettings")) {
                    String sid = s.has("id") && !s.get("id").isNull() ? s.get("id").asText() : null;
                    String name = s.has("name") && !s.get("name").isNull() ? s.get("name").asText() : sid;
                    String type = s.has("type") && !s.get("type").isNull() ? s.get("type").asText() : null;
                    if (name == null) continue;
                    System.out.println("start load setting id=" + name);
                    String cacheKey = "setting_content:" + name;
                    String content = null;
                    Long expireAt = settingCacheExpire.get(cacheKey);
                    if (expireAt != null && expireAt > System.currentTimeMillis()) {
                        content = settingCache.get(cacheKey);
                    }
                    if (content == null) {
                        if ("relations".equals(type) || "人物与关系".equals(name)) {
                            try {
                                if (projectId != null) {
                                    var relations = projectService.getRelations(projectId);
                                    if (relations != null) {
                                        String edges = relations.getEdges();
                                        content = edges != null ? edges : "";
                                    }
                                }
                            } catch (Exception ignore) {
                            }
                        }
                        if (content == null && node.has("context") && node.get("context").has("references") && node.get("context").get("references").isArray()) {
                            for (com.fasterxml.jackson.databind.JsonNode r : node.get("context").get("references")) {
                                String title = r.has("title") && !r.get("title").isNull() ? r.get("title").asText() : null;
                                if (title != null && title.equals(name)) {
                                    content = r.has("content") && !r.get("content").isNull() ? r.get("content").asText() : "";
                                    break;
                                }
                            }
                        }
                        if (content == null && projectId != null) {
                            try {
                                List<NovelLoreDO> list = projectService.getLoreList(projectId);
                                if (list != null) {
                                    for (NovelLoreDO l : list) {
                                        String t = l.getTitle();
                                        if (t != null && t.equals(name)) {
                                            content = l.getContent() != null ? l.getContent() : "";
                                            break;
                                        }
                                    }
                                    if (("人物与关系".equals(name) || "relations".equals(type)) && (content == null || content.isEmpty())) {
                                        StringBuilder sb = new StringBuilder();
                                        for (NovelLoreDO l : list) {
                                            String lt = l.getType();
                                            if (lt == null) continue;
                                            if ("character".equals(lt) || "protagonist".equals(lt) || "antagonist".equals(lt)) {
                                                String tt = l.getTitle() != null ? l.getTitle() : "角色";
                                                String ct = l.getContent() != null ? l.getContent() : "";
                                                if (!ct.isEmpty()) {
                                                    sb.append("【").append(tt).append("】\n").append(ct).append("\n");
                                                }
                                            }
                                        }
                                        if (sb.length() > 0) {
                                            content = sb.toString();
                                        }
                                    }
                                }
                            } catch (Exception ignore) {
                            }
                        }
                        if (content == null) content = "";
                        settingCache.put(cacheKey, content);
                        settingCacheExpire.put(cacheKey, System.currentTimeMillis() + settingCacheTtlMs);
                    }
                    loadedNames.add(name);
                    String seg = name + ":\n" + content + "\n";
                    settingsText.append(seg);
                }
            }
            if (settingsText.length() > 0) {
                log.info("loaded " + loadedNames.size() + " setting,  characters=" + settingsText.length());
                messages.add(new SystemMessage(settingsText.toString()));
            }
            if (node.has("history") && node.get("history").isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode h : node.get("history")) {
                    String role = h.has("role") && !h.get("role").isNull() ? h.get("role").asText() : null;
                    String content = h.has("content") && !h.get("content").isNull() ? h.get("content").asText() : null;
                    if (content != null && role != null) {
                        if ("assistant".equals(role)) {
                            messages.add(new AssistantMessage(content));
                        } else {
                            messages.add(new UserMessage(content));
                        }
                    }
                }
            }
            parsedPrompt = node.has("prompt") && !node.get("prompt").isNull() ? node.get("prompt").asText() : "";
        } catch (Exception ignored) {
            parsedPrompt = body;
        }
        final String promptFinal = parsedPrompt;
        messages.add(new UserMessage(promptFinal));
        String content = callAndLog(chat, new Prompt(messages), "chat", promptFinal, projectId, currentPlatform);
        java.util.Map<String, Object> debug = java.util.Map.of("loadedSettings", loadedNames);
        java.util.Map<String, Object> resp = java.util.Map.of("content", content, "debug", debug);
        return success(resp);
    }

    @PostMapping("/chat/stream")
    public Object chatStream(@RequestBody String body) {
        
        String parsedPrompt = null;
        List<org.springframework.ai.chat.messages.Message> messages = new java.util.ArrayList<>();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是一个专业的网文写作助手，擅长情节构思、文笔润色和网文套路分析。请始终使用简体中文回答。\n回答要具体、有建设性，避免空泛的理论。";
        messages.add(new SystemMessage(system));
        Long projectId = null;
        try {
            com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(body);
            if (node.has("novelId") && !node.get("novelId").isNull()) {
                try {
                    projectId = node.get("novelId").isNumber() ? node.get("novelId").asLong() : Long.parseLong(node.get("novelId").asText());
                } catch (Exception ignore) {
                }
            }
            StringBuilder settingsText = new StringBuilder();
            if (node.has("referencedSettings") && node.get("referencedSettings").isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode s : node.get("referencedSettings")) {
                    String sid = s.has("id") && !s.get("id").isNull() ? s.get("id").asText() : null;
                    String name = s.has("name") && !s.get("name").isNull() ? s.get("name").asText() : sid;
                    String type = s.has("type") && !s.get("type").isNull() ? s.get("type").asText() : null;
                    if (name == null) continue;
                    System.out.println("start load setting id=" + name);
                    String cacheKey = "setting_content:" + name;
                    String content = null;
                    Long expireAt = settingCacheExpire.get(cacheKey);
                    if (expireAt != null && expireAt > System.currentTimeMillis()) {
                        content = settingCache.get(cacheKey);
                    }
                    if (content == null) {
                        if ("relations".equals(type) || "人物与关系".equals(name)) {
                            try {
                                if (projectId != null) {
                                    var relations = projectService.getRelations(projectId);
                                    if (relations != null) {
                                        String edges = relations.getEdges();
                                        content = edges != null ? edges : "";
                                    }
                                }
                            } catch (Exception ignore) {
                            }
                        }
                        if (content == null && node.has("context") && node.get("context").has("references") && node.get("context").get("references").isArray()) {
                            for (com.fasterxml.jackson.databind.JsonNode r : node.get("context").get("references")) {
                                String title = r.has("title") && !r.get("title").isNull() ? r.get("title").asText() : null;
                                if (title != null && title.equals(name)) {
                                    content = r.has("content") && !r.get("content").isNull() ? r.get("content").asText() : "";
                                    break;
                                }
                            }
                        }
                        if (content == null && projectId != null) {
                            try {
                                List<NovelLoreDO> list = projectService.getLoreList(projectId);
                                if (list != null) {
                                    for (NovelLoreDO l : list) {
                                        String t = l.getTitle();
                                        if (t != null && t.equals(name)) {
                                            content = l.getContent() != null ? l.getContent() : "";
                                            break;
                                        }
                                    }
                                    if (("人物与关系".equals(name) || "relations".equals(type)) && (content == null || content.isEmpty())) {
                                        StringBuilder sb = new StringBuilder();
                                        for (NovelLoreDO l : list) {
                                            String lt = l.getType();
                                            if (lt == null) continue;
                                            if ("character".equals(lt) || "protagonist".equals(lt) || "antagonist".equals(lt)) {
                                                String tt = l.getTitle() != null ? l.getTitle() : "角色";
                                                String ct = l.getContent() != null ? l.getContent() : "";
                                                if (!ct.isEmpty()) {
                                                    sb.append("【").append(tt).append("】\n").append(ct).append("\n");
                                                }
                                            }
                                        }
                                        if (sb.length() > 0) {
                                            content = sb.toString();
                                        }
                                    }
                                }
                            } catch (Exception ignore) {
                            }
                        }
                        if (content == null) content = "";
                        settingCache.put(cacheKey, content);
                        settingCacheExpire.put(cacheKey, System.currentTimeMillis() + settingCacheTtlMs);
                    }
                    String seg = name + ":\n" + content + "\n";
                    settingsText.append(seg);
                }
            }
            if (settingsText.length() > 0) {
                System.out.println("loaded " + settingsText.toString().split("\n:\n").length + " setting,  characters=" + settingsText.length());
                messages.add(new SystemMessage(settingsText.toString()));
            }
            if (node.has("history") && node.get("history").isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode h : node.get("history")) {
                    String role = h.has("role") && !h.get("role").isNull() ? h.get("role").asText() : null;
                    String content = h.has("content") && !h.get("content").isNull() ? h.get("content").asText() : null;
                    if (content != null && role != null) {
                        if ("assistant".equals(role)) {
                            messages.add(new AssistantMessage(content));
                        } else {
                            messages.add(new UserMessage(content));
                        }
                    }
                }
            }
            parsedPrompt = node.has("prompt") && !node.get("prompt").isNull() ? node.get("prompt").asText() : "";
        } catch (Exception ignored) {
            parsedPrompt = body;
        }
        final String promptFinal = parsedPrompt;
        messages.add(new UserMessage(promptFinal));
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        final StringBuilder total = new StringBuilder();
        final String[] modelHolder = new String[1];
        final int[] promptTokensHolder = new int[1];
        final int[] completionTokensHolder = new int[1];
        final int[] totalTokensHolder = new int[1];
        Disposable disposable = chat.stream(new Prompt(messages))
                .subscribe(response -> {
                    String text = AiUtils.getChatResponseContent(response);
                    if (response != null && response.getMetadata() != null && response.getMetadata().getModel() != null) {
                        modelHolder[0] = response.getMetadata().getModel();
                    }
                    if (response != null && response.getMetadata() != null && response.getMetadata().getUsage() != null) {
                        var usage = response.getMetadata().getUsage();
                        if (usage.getTotalTokens() > 0) {
                            totalTokensHolder[0] = usage.getTotalTokens();
                            promptTokensHolder[0] = usage.getPromptTokens();
                            completionTokensHolder[0] = usage.getCompletionTokens();
                        }
                    }
                    if (text != null && !text.isEmpty()) {
                        try {
                            total.append(text);
                            emitter.send(SseEmitter.event().data(java.util.Map.of("content", text)));
                        } catch (Exception e) {
                            try {
                                usageLogService.log(null, "chat/stream", currentPlatform, modelHolder[0],
                                        promptTokensHolder[0] > 0 ? promptTokensHolder[0] : null,
                                        completionTokensHolder[0] > 0 ? completionTokensHolder[0] : null,
                                        totalTokensHolder[0] > 0 ? totalTokensHolder[0] : null,
                                        promptFinal != null ? promptFinal.length() : null,
                                        total.length(), false, String.valueOf(e), null);
                            } catch (Exception ignored) {
                            }
                            emitter.completeWithError(e);
                        }
                    }
                }, error -> {
                    try {
                        usageLogService.log(null, "chat/stream", currentPlatform, modelHolder[0],
                                promptTokensHolder[0] > 0 ? promptTokensHolder[0] : null,
                                completionTokensHolder[0] > 0 ? completionTokensHolder[0] : null,
                                totalTokensHolder[0] > 0 ? totalTokensHolder[0] : null,
                                promptFinal != null ? promptFinal.length() : null,
                                total.length(), false, error != null ? String.valueOf(error) : null, null);
                    } catch (Exception ignored) {
                    }
                    emitter.completeWithError(error);
                }, () -> {
                    try {
                        emitter.send(SseEmitter.event().data("[DONE]"));
                    } catch (Exception ignored) {
                    }
                    try {
                        usageLogService.log(null, "chat/stream", currentPlatform, modelHolder[0],
                                promptTokensHolder[0] > 0 ? promptTokensHolder[0] : null,
                                completionTokensHolder[0] > 0 ? completionTokensHolder[0] : null,
                                totalTokensHolder[0] > 0 ? totalTokensHolder[0] : null,
                                promptFinal != null ? promptFinal.length() : null,
                                total.length(), true, null, null);
                    } catch (Exception ignored) {
                    }
                    emitter.complete();
                });
        emitter.onCompletion(() -> {
            if (disposable != null && !disposable.isDisposed()) {
                disposable.dispose();
            }
        });
        emitter.onTimeout(() -> {
            if (disposable != null && !disposable.isDisposed()) {
                disposable.dispose();
            }
            try {
                usageLogService.log(null, "chat/stream", currentPlatform, modelHolder[0],
                        promptTokensHolder[0] > 0 ? promptTokensHolder[0] : null,
                        completionTokensHolder[0] > 0 ? completionTokensHolder[0] : null,
                        totalTokensHolder[0] > 0 ? totalTokensHolder[0] : null,
                        promptFinal != null ? promptFinal.length() : null,
                        total.length(), false, "timeout", null);
            } catch (Exception ignored) {
            }
        });
        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache")
                .header("X-Accel-Buffering", "no")
                .header("Connection", "keep-alive")
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .body(emitter);
    }

    @PostMapping("/inspiration")
    public CommonResult<JsonNode> inspiration(@RequestBody AiInspirationReqVO reqVO) throws Exception {
        
        String idea = reqVO.getIdea() != null ? reqVO.getIdea() : "";
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是一位经验丰富的小说主编和创意总监。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。JSON 格式：{\"title\":\"\",\"description\":\"\"}\n"
                + "### 角色设定 (Role)\n"
                + "你是一位经验丰富的小说主编和创意总监，擅长发掘市场热点，精通各类小说题材的套路与反套路，能够根据微小的灵感碎片构建出引人入胜的故事雏形。\n\n"
                + "### 任务目标 (Objective)\n"
                + "根据用户的输入（可能是一个模糊的想法、一个具体的设定，或者空白），构思一个高质量且贴合用户期待的小说创意方案。\n\n"
                + "### 约束条件 (Constraints)\n"
                + "1. 语言：必须严格使用简体中文。\n"
                + "2. 格式：必须严格遵循 JSON 格式返回，严禁包含 Markdown 代码块标记（如 ```json）。\n"
                + "3. 基调：书名要吸睛（符合网文市场或出版市场调性），简介要有钩子（悬念/冲突/爽点）。\n"
                + "4. 用户约束优先：如果用户在输入中明确提到题材、时代或风格（例如“都市情感”“现代言情”“古代权谋”），必须以这些要求为最高优先级进行创作，不要随意加入与之冲突的题材（如赛博朋克、克苏鲁），除非用户主动提出融合。\n"
                + "5. 随机性与多样性：\n"
                + "   - 当用户输入为空或非常模糊时，你需要主动多样化题材，可以从以下大类中任意组合：玄幻、仙侠、都市情感、现实职场、历史架空、科幻、末世、悬疑推理、规则怪谈、克苏鲁、轻小说等；\n"
                + "   - 请避免频繁选择同一种题材，尤其不要总是围绕“赛博朋克”或与示例高度相似的套路；\n"
                + "   - 在题材上可以适当混搭，但要保证整体风格清晰、卖点突出。\n\n"
                + "### 思考步骤 (Workflow)\n"
                + "1. 分析输入：识别用户是否给出了明确的题材/风格/背景要求：\n"
                + "   - 如果有明确要求（如“都市情感”），则以此为主进行构思，其他创意仅作为补充，不改变主基调；\n"
                + "   - 如果输入为空或几乎没有有效信息，则从“随机性与多样性”中的题材池里自由选择。\n"
                + "2. 构思书名：想出 3-5 个书名，在脑中比较后选择最吸引人的一个。书名应包含核心卖点（身份反差、强冲突、强爽点或强悬念）。\n"
                + "3. 撰写简介：用 50-100 字概括故事。开头抛出冲突，中间展示设定和人物张力，结尾留下悬念或爽点预告。\n"
                + "4. 确定题材：根据最终构思归纳出最准确的 1-2 个类型标签，例如“都市情感”“科幻冒险”“规则怪谈”等。\n"
                + "5. 格式化输出：将结果封装为 JSON。\n\n"
                + "### 输出结构\n"
                + "你最终只需要输出一个 JSON 对象，结构为：\n"
                + "{\n"
                + "  \\\"title\\\": \\\"书名，尽量短而有记忆点\\\",\n"
                + "  \\\"description\\\": \\\"50-100 字的简介，突出冲突和卖点\\\",\n"
                + "}";
        String user = idea.isEmpty()
                ? "请自主选择题材并构思一个小说创意，输出 JSON。"
                : "根据以下灵感构思小说创意并输出 JSON：" + idea;
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "inspiration", user, null, currentPlatform);
        JsonNode node = toJson(content);
        return success(node);
    }

    @PostMapping("/recommend-tags")
    public CommonResult<JsonNode> recommendTags(@RequestBody AiRecommendTagsReqVO reqVO) throws Exception {
        
        String title = reqVO.getTitle();
        String description = reqVO.getDescription();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是资深编辑。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。JSON 格式：{\"genre\":\"\",\"style\":\"\",\"tags\":[\"\",\"\"]}\n"
                + "### 角色设定\n"
                + "你是一位精通网文市场风向的资深编辑。你的任务是根据小说的书名和简介，精准推荐最合适的题材、文风和核心标签。\n\n"
                + "### 约束条件\n"
                + "1. 语言：必须严格使用简体中文。\n"
                + "2. 格式：必须严格遵循 JSON 格式返回，严禁包含 Markdown 代码块标记。\n\n"
                + "### 输出结构\n"
                + "{\n"
                + "  \\\"genre\\\": \\\"最匹配的一个题材（如：玄幻、科幻、都市）\\\",\n"
                + "  \\\"style\\\": \\\"最匹配的一个文风（如：热血、轻松、暗黑）\\\",\n"
                + "  \\\"tags\\\": [\\\"推荐标签1\\\", \\\"推荐标签2\\\", \\\"推荐标签3\\\", \\\"推荐标签4\\\", \\\"推荐标签5\\\"]\n"
                + "}";
        String user = "书名：" + title + "\n简介：" + description + "\n请推荐题材、文风、标签并输出 JSON。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "recommend-tags", user, null, currentPlatform);
        JsonNode node = toJson(content);
        return success(node);
    }

    @PostMapping("/generate-core-settings")
    public CommonResult<JsonNode> generateCoreSettings(@RequestBody AiCoreSettingsReqVO reqVO) throws Exception {
        
        String title = reqVO.getTitle();
        String description = reqVO.getDescription();
        String genre = reqVO.getGenre();
        String style = reqVO.getStyle();
        List<String> tags = reqVO.getTags() != null ? reqVO.getTags() : List.of();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是资深设定师。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。JSON 格式包含 protagonist、antagonist、world、outline.mainConflict。\n"
                + "### 角色设定\n"
                + "你是一位资深小说设定师。你的任务是根据小说的基础信息，构建出有深度、有吸引力的主角档案、世界观设定，以及高张力的主线冲突。\n\n"
                + "### 约束条件\n"
                + "1. 语言：必须严格使用简体中文。\n"
                + "2. 格式：必须严格遵循 JSON 格式返回，严禁包含 Markdown 代码块标记。\n\n"
                + "### 输出结构\n"
                + "{\n"
                + "  \\\"protagonist\\\": {\n"
                + "    \\\"name\\\": \\\"主角姓名（要有特色）\\\",\n"
                + "    \\\"gender\\\": \\\"性别\\\",\n"
                + "    \\\"age\\\": \\\"年龄（如：18岁）\\\",\n"
                + "    \\\"personality\\\": \\\"核心性格（如：腹黑、热血、冷静）\\\",\n"
                + "    \\\"cheat\\\": \\\"金手指/特殊能力/外挂（如果没有则填'无'）\\\"\n"
                + "  },\n"
                + "  \\\"antagonist\\\": {\n"
                + "    \\\"name\\\": \\\"反派姓名/代号\\\",\n"
                + "    \\\"role\\\": \\\"身份/定位（如：魔教教主、宿命之敌）\\\",\n"
                + "    \\\"personality\\\": \\\"性格与动机（简述）\\\"\n"
                + "  },\n"
                + "  \\\"world\\\": {\n"
                + "    \\\"background\\\": \\\"世界背景简述（50-100字）\\\",\n"
                + "    \\\"powerSystem\\\": \\\"力量体系/核心规则（如：等级划分、异能分类）\\\",\n"
                + "    \\\"forces\\\": \\\"主要势力/组织（简述）\\\"\n"
                + "  },\n"
                + "  \\\"outline\\\": {\n"
                + "    \\\"mainConflict\\\": \\\"全书终极目标/主线冲突（一句话，需要突出强烈矛盾与高风险，读起来具有记忆点和吸引力）\\\"\n"
                + "  }\n"
                + "}";
        String user = "书名：" + title + "\n简介：" + description + "\n题材：" + genre + "\n文风：" + style + "\n标签：" + String.join(", ", tags) + "\n请生成核心设定并输出 JSON。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "generate-core-settings", user, null, currentPlatform);
        JsonNode node = toJson(content);
        return success(node);
    }

    @PostMapping("/generate-outline")
    public CommonResult<JsonNode> generateOutline(@RequestBody AiOutlineReqVO reqVO) throws Exception {
        
        String title = reqVO.getTitle();
        String description = reqVO.getDescription();
        String genre = reqVO.getGenre();
        String style = reqVO.getStyle();
        List<String> tags = reqVO.getTags() != null ? reqVO.getTags() : List.of();
        Object coreSettings = reqVO.getCoreSettings();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是资深主编。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。JSON 格式：{\"summary\":\"\",\"volumes\":[{\"title\":\"\",\"summary\":\"\"}]}\n"
                + "### 角色设定\n"
                + "你是一位资深网文主编。你的任务是根据小说设定，规划出全书的宏观架构（总纲）。\n\n"
                + "### 约束条件\n"
                + "1. 语言：必须严格使用简体中文。\n"
                + "2. 格式：必须严格遵循 JSON 格式返回，严禁包含 Markdown 代码块标记。\n"
                + "3. 结构：你需要将全书分为 3-5 卷（Volume），每卷代表一个大的剧情阶段。\n\n"
                + "### 输出结构\n"
                + "{\n"
                + "  \\\"summary\\\": \\\"全书一句话核心梗概（50字以内）\\\",\n"
                + "  \\\"volumes\\\": [\n"
                + "    {\n"
                + "      \\\"title\\\": \\\"第一卷：卷名（如：潜龙在渊）\\\",\n"
                + "      \\\"summary\\\": \\\"本卷剧情走向与核心冲突（100字左右）\\\"\n"
                + "    },\n"
                + "    ...\n"
                + "  ]\n"
                + "}";
        String user = "书名：" + title + "\n简介：" + description + "\n题材：" + genre + "\n文风：" + style + "\n标签：" + String.join(", ", tags) + "\n核心设定：" + String.valueOf(coreSettings) + "\n请生成全书总纲并输出 JSON。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "generate-outline", user, null, currentPlatform);
        JsonNode node = toJson(content);
        return success(node);
    }

    @PostMapping("/generate-chapter-ideas")
    public CommonResult<JsonNode> generateChapterIdeas(@RequestBody AiChapterIdeasReqVO reqVO) throws Exception {
        
        String volumeTitle = reqVO.getVolumeTitle();
        String volumeSummary = reqVO.getVolumeSummary();
        String previousChapterTitle = reqVO.getPreviousChapterTitle();
        String previousChapterContent = reqVO.getPreviousChapterContent();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是擅长节奏把控的作者。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。JSON 格式：{\"ideas\":[{\"title\":\"\",\"summary\":\"\"}]}\n"
                + "### 角色设定\n"
                + "你是一位擅长把控节奏和设置悬念的网文大神。你的任务是根据当前分卷大纲和上一章内容，构思接下来的剧情发展，并提供 3 个不同走向的章节创意。\n\n"
                + "### 约束条件\n"
                + "1. 语言：必须严格使用简体中文。\n"
                + "2. 格式：必须严格遵循 JSON 格式返回，严禁包含 Markdown 代码块标记。\n"
                + "3. 连贯性：剧情必须紧接上一章，优先围绕上一章结尾尚未解决的冲突或悬念展开，同时符合本卷大纲的宏观走向和既有世界观设定。\n"
                + "4. 多样性：三个创意应代表不同的剧情节奏（如：激进推进、铺垫伏笔、侧面描写）。\n\n"
                + "### 输出结构\n"
                + "{\n"
                + "  \\\"ideas\\\": [\n"
                + "    {\n"
                + "      \\\"title\\\": \\\"章节标题（吸睛）\\\",\n"
                + "      \\\"summary\\\": \\\"本章剧情简述（50-100字），包含发生什么事、核心冲突是什么、结尾留下什么悬念。\\\"\n"
                + "    },\n"
                + "    ...\n"
                + "  ]\n"
                + "}";
        String user = "当前分卷：" + volumeTitle + "\n分卷大纲：" + volumeSummary + "\n上一章标题：" + previousChapterTitle + "\n上一章内容：" + previousChapterContent + "\n请生成3个章节创意并输出 JSON。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "generate-chapter-ideas", user, null, currentPlatform);
        JsonNode node = toJson(content);
        return success(node);
    }

    @PostMapping("/generate-beat-sheet")
    public CommonResult<JsonNode> generateBeatSheet(@RequestBody AiBeatSheetReqVO reqVO) throws Exception {
        
        String title = reqVO.getTitle();
        String summary = reqVO.getSummary();
        String previousContext = reqVO.getPreviousContext();
        String previousChapterContent = reqVO.getPreviousChapterContent();
        String volumeSummary = reqVO.getVolumeSummary();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是剧情架构师。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。JSON 包含 goal、conflict、hook、emotion_target、scenes、beats。\n"
                + "### 角色设定\n"
                + "你是一位专业的小说剧情架构师。你的任务是将简略的章节大纲扩充为结构严谨、节奏紧凑且标注清晰的章纲（Beat Sheet），用于指导后续正文生成。\n\n"
                + "### 约束条件\n"
                + "1. 语言：必须严格使用简体中文。\n"
                + "2. 数据格式：JSON 对象，请严格控制控制返回数据为JSON格式，尤其注意标点符号的使用，严禁包含 Markdown 代码块标记。\n"
                + "3. 场景颗粒度：将本章剧情拆解为 3–5 个具体场景（Scene），每个场景必须包含：发生地点、出场人物列表和核心行动/冲突。\n"
                + "4. 节奏控制：\n"
                + "   - 必须包含 1 个具体的“情绪目标”（emotion_target）。\n"
                + "   - 场景间的“张力等级”（tension）要有起伏（低->中->高）。\n"
                + "5. 伏笔与钩子：\n"
                + "   - 明确本章的“结尾钩子”（Hook）。\n"
                + "   - 检查“全书终极目标”和“当前路标摘要”，确保本章剧情服务于长远目标。\n"
                + "6. 爽点与反转：在 Scene 级别标注本章主爽点与关键反转，可通过每个场景的 cool_points 与 reversals 数组给出。\n"
                + "7. 伏笔管理：区分“回收伏笔”和“新埋伏笔”，在 foreshadows 字段中使用 reuse/new 分类。\n"
                + "8. 上下文衔接：参考前情提要与上一章内容，在首个场景中自然承接上一章结尾。\n"
                + "9. 节奏边界：本章章纲只覆盖当前章节在整体路标中的这一段内容，严禁提前写完后续阶段或下一路标的高潮事件。\n\n"
                + "### 输出结构\n"
                + "{\n"
                + "  \\\"goal\\\": \\\"本章主角的具体目标\\\",\n"
                + "  \\\"conflict\\\": \\\"本章需要正面面对的核心阻碍或冲突点\\\",\n"
                + "  \\\"hook\\\": \\\"本章结尾留下的悬念或钩子\\\",\n"
                + "  \\\"emotion_target\\\": \\\"本章整体情绪目标\\\",\n"
                + "  \\\"scenes\\\": [\n"
                + "    {\n"
                + "      \\\"index\\\": 1,\n"
                + "      \\\"location\\\": \\\"场景发生的主要地点\\\",\n"
                + "      \\\"characters\\\": [\\\"参与本场景的主要角色名称或ID\\\"],\n"
                + "      \\\"summary\\\": \\\"该场景的详细剧情描述（100-200字）\\\",\n"
                + "      \\\"function\\\": \\\"setup/foreshadowing/climax/twist/aftermath 之一\\\",\n"
                + "      \\\"tension\\\": \\\"平/中/高 之一\\\",\n"
                + "      \\\"emotion_curve\\\": \\\"本场景情绪走势\\\",\n"
                + "      \\\"cool_points\\\": [\\\"爽点列表\\\"],\n"
                + "      \\\"reversals\\\": [\\\"关键反转\\\"]\n"
                + "    }\n"
                + "  ],\n"
                + "  \\\"beats\\\": [\\\"用于编辑器展示的简短剧情点文案\\\"]\n"
                + "}";
        String user = "分卷大纲：" + volumeSummary + "\n章节标题：" + title + "\n章节大纲：" + summary + "\n前情提要：" + previousContext + "\n上一章内容：" + previousChapterContent + "\n请生成本章章纲并输出 JSON。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "generate-beat-sheet", user, null, currentPlatform);
        JsonNode node = toJson(content);
        return success(node);
    }

    @PostMapping("/generate-chapter-content")
    public Object generateChapterContent(@RequestBody AiChapterContentReqVO reqVO) {
        
        Object chapter = reqVO.getChapter();
        Object previousChapter = reqVO.getPreviousChapter();
        String volumeSummary = reqVO.getVolumeSummary();
        Object globalLore = reqVO.getGlobalLore();
        Object instruction = reqVO.getInstruction();
        Boolean stream = reqVO.getStream();
        java.util.List<Object> characters = reqVO.getCharacters();
        java.util.List<Object> foreshadowing = reqVO.getForeshadowing();
        Object coreSettings = reqVO.getCoreSettings();
        Object milestoneContextObj = reqVO.getMilestoneContext();
        java.util.List<Object> volumeChaptersPlan = reqVO.getVolumeChaptersPlan();
        java.util.List<Object> characterKnowledge = reqVO.getCharacterKnowledge();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = chapterPromptBuilder.buildSystemPrompt();
        String user = chapterPromptBuilder.buildUserPrompt(reqVO, mapper);
        if (Boolean.TRUE.equals(stream)) {
            SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
            final StringBuilder totalOut = new StringBuilder();
            final String[] modelHolder2 = new String[1];
            final int[] promptTokensHolder2 = new int[1];
            final int[] completionTokensHolder2 = new int[1];
            final int[] totalTokensHolder2 = new int[1];
            Disposable disposable = chat.stream(new Prompt(List.of(new SystemMessage(system), new UserMessage(user))))
                    .subscribe(response -> {
                        String text = AiUtils.getChatResponseContent(response);
                        if (response != null && response.getMetadata() != null) {
                            if (response.getMetadata().getModel() != null) {
                                modelHolder2[0] = response.getMetadata().getModel();
                            }
                            if (response.getMetadata().getUsage() != null) {
                                var usage = response.getMetadata().getUsage();
                                if (usage.getTotalTokens() > 0) {
                                    totalTokensHolder2[0] = usage.getTotalTokens();
                                    promptTokensHolder2[0] = usage.getPromptTokens();
                                    completionTokensHolder2[0] = usage.getCompletionTokens();
                                }
                            }
                        }
                        if (text != null && !text.isEmpty()) {
                        try {
                            totalOut.append(text);
                            emitter.send(java.util.Map.of("text", text));
                        } catch (Exception e) {
                            try {
                                usageLogService.log(null, "generate-chapter-content/stream", currentPlatform, modelHolder2[0],
                                        promptTokensHolder2[0] > 0 ? promptTokensHolder2[0] : null,
                                        completionTokensHolder2[0] > 0 ? completionTokensHolder2[0] : null,
                                        totalTokensHolder2[0] > 0 ? totalTokensHolder2[0] : null,
                                        user != null ? user.length() : null,
                                        totalOut.length(), false, String.valueOf(e), null);
                            } catch (Exception ignored) {
                            }
                            emitter.completeWithError(e);
                        }
                        }
                    }, error -> {
                        try {
                            usageLogService.log(null, "generate-chapter-content/stream", currentPlatform, modelHolder2[0],
                                    promptTokensHolder2[0] > 0 ? promptTokensHolder2[0] : null,
                                    completionTokensHolder2[0] > 0 ? completionTokensHolder2[0] : null,
                                    totalTokensHolder2[0] > 0 ? totalTokensHolder2[0] : null,
                                    user != null ? user.length() : null,
                                    totalOut.length(), false, error != null ? String.valueOf(error) : null, null);
                        } catch (Exception ignored) {
                        }
                        emitter.completeWithError(error);
                    }, () -> {
                        try {
                            emitter.send("[DONE]");
                        } catch (Exception ignored) {
                        }
                        try {
                            usageLogService.log(null, "generate-chapter-content/stream", currentPlatform, modelHolder2[0],
                                    promptTokensHolder2[0] > 0 ? promptTokensHolder2[0] : null,
                                    completionTokensHolder2[0] > 0 ? completionTokensHolder2[0] : null,
                                    totalTokensHolder2[0] > 0 ? totalTokensHolder2[0] : null,
                                    user != null ? user.length() : null,
                                    totalOut.length(), true, null, null);
                        } catch (Exception ignored) {
                        }
                        emitter.complete();
                    });
            emitter.onCompletion(() -> {
                if (disposable != null && !disposable.isDisposed()) {
                    disposable.dispose();
                }
            });
            emitter.onTimeout(() -> {
                if (disposable != null && !disposable.isDisposed()) {
                    disposable.dispose();
                }
                try {
                    usageLogService.log(null, "generate-chapter-content/stream", currentPlatform, modelHolder2[0],
                            promptTokensHolder2[0] > 0 ? promptTokensHolder2[0] : null,
                            completionTokensHolder2[0] > 0 ? completionTokensHolder2[0] : null,
                            totalTokensHolder2[0] > 0 ? totalTokensHolder2[0] : null,
                            user != null ? user.length() : null,
                            totalOut.length(), false, "timeout", null);
                } catch (Exception ignored) {
                }
            });
            return ResponseEntity.ok()
                    .header("Cache-Control", "no-cache")
                    .header("X-Accel-Buffering", "no")
                    .header("Connection", "keep-alive")
                    .contentType(MediaType.TEXT_EVENT_STREAM)
                    .body(emitter);
        } else {
            String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "generate-chapter-content", user, null, currentPlatform);
            return success(content);
        }
    }

    @PostMapping("/generate-milestones")
    public CommonResult<JsonNode> generateMilestones(@RequestBody AiMilestonesReqVO reqVO) throws Exception {
        
        String volumeTitle = reqVO.getVolumeTitle();
        String volumeSummary = reqVO.getVolumeSummary();
        List<AiMilestonesReqVO.ChapterItem> chapters = reqVO.getChapters();
        Object timeline = reqVO.getTimeline();
        Integer volumeTotalChapters = reqVO.getVolumeTotalChapters();
        int totalChapters = volumeTotalChapters != null && volumeTotalChapters > 0 ? volumeTotalChapters : 100;
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String chaptersContext;
        if (chapters != null && !chapters.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < chapters.size(); i++) {
                AiMilestonesReqVO.ChapterItem c = chapters.get(i);
                String t = c.getTitle() != null ? c.getTitle() : ("第" + (i + 1) + "章");
                String s = c.getSummary() != null ? c.getSummary() : "";
                String s2 = s.length() > 200 ? s.substring(0, 200) : s;
                sb.append("第").append(i + 1).append("章《").append(t).append("》：").append(s2.isEmpty() ? "（暂无概述，仅能根据标题和分卷大纲推断）" : s2);
                if (i < chapters.size() - 1) sb.append("\n");
            }
            chaptersContext = sb.toString();
        } else {
            chaptersContext = "暂无已写章节（你需要仅根据分卷大纲规划路标）";
        }
        String timelineContext;
        if (timeline instanceof String) {
            timelineContext = (String) timeline;
        } else if (timeline instanceof List) {
            StringBuilder sb = new StringBuilder();
            List<?> list = (List<?>) timeline;
            for (int i = 0; i < list.size(); i++) {
                sb.append(String.valueOf(list.get(i)));
                if (i < list.size() - 1) sb.append("\n");
            }
            timelineContext = sb.toString();
        } else if (timeline != null) {
            timelineContext = mapper.writeValueAsString(timeline);
        } else {
            timelineContext = "";
        }
        String system = "### 角色设定\n"
                + "请严格控制输出为JSON格式。你是一位精通网文创作理论的主编，深谙“黄金三章”、“期待感管理”和“冲突升级”等核心技巧。你的任务是为小说的指定分卷内容设计 10 个关键的剧情路标（Milestones）。\n\n"
                + "### 核心原则\n"
                + "1. **严格限定范围**：所有路标必须严格基于提供的【分卷大纲】内容和【世界时间线】信息，**严禁**发散到其他分卷或整书的大结局；不得出现与给定时间线明显冲突的事件顺序或年代设置。\n"
                + "2. **网文节奏与章节预算**：\n"
                + "   - 分卷预期总章节数约为 " + totalChapters + " 章，你需要为 10 个路标分配章节预算。\n"
                + "   - 每个路标必须包含字段 \\`estimated_chapters\\`，表示该路标大致需要多少章来完整展开，必须为正整数。\n"
                + "   - **开篇路标（通常是前 1-2 个）**：每个路标的 \\`estimated_chapters\\` 应在 3–5 章之间，制造强钩子与强冲突。\n"
                + "   - **铺垫与发展路标（中间若干个）**：每个路标的 \\`estimated_chapters\\` 应在 5–8 章之间，用于铺垫世界、人物与矛盾升级。\n"
                + "   - **高潮路标（通常是最后 2-3 个路标中的核心高潮节点）**：每个路标的 \\`estimated_chapters\\` 应在 10–15 章之间，用于承载本卷高潮与情绪爆发。\n"
                + "   - 严禁所有路标的 \\`estimated_chapters\\` 平均分配，必须体现节奏起伏与重点倾斜。\n"
                + "   - 所有路标的 \\`estimated_chapters\\` 之和应接近分卷总章节数 " + totalChapters + "（允许少量上下浮动，以便灵活调整）。\n"
                + "3. **节奏类型标记**：每个路标必须包含字段 \\`pace_type\\`，用于标记节奏功能类型，取值限定为：\\`开篇\\`、\\`铺垫\\`、\\`过渡\\`、\\`高潮\\`、\\`收束\\` 之一。\n"
                + "4. **事件设计**：每个路标应是一个具体的“事件”而非抽象的状态；如时间线中存在相关节点，应尽量让事件与这些时间节点对齐或产生因果承接。\n"
                + "5. **章节对齐**：如果提供了本卷已写章节及其概述，你需要优先参考这些章节，保证路标与已有章节在时间顺序和冲突走向上基本一致；如发现总纲与章节有冲突，以“章节概述”的实际剧情为准，适度调整路标描述。\n"
                + "6. **时间线一致性**：如果提供了世界时间线，你需要在设计每个路标时明确其大致发生阶段，避免出现“尚未发生的世界事件却已被引用”等前后矛盾。\n"
                + "7. **爽点、反转与伏笔池**：\n"
                + "   - 每个路标必须提供至少 1 条“爽点”描述，汇总在字段 \\`cool_points\\`（字符串数组）中，用于后续章纲与正文放大这些高爽时刻。\n"
                + "   - 如本路标包含关键反转事件，需要在字段 \\`reversals\\`（字符串数组）中列出反转点及其触发条件。\n"
                + "   - 伏笔信息统一放在字段 \\`foreshadows\\` 中，类型为对象数组，每个伏笔对象包含：\n"
                + "     - \\`description\\`：伏笔内容或提示线索的简要描述。\n"
                + "     - \\`recover_at\\`：预期回收位置，取值限定为 \\`next_milestone\\`（下一路标）、\\`later_this_volume\\`（本卷后段）、\\`next_volume\\`（下一卷）。\n"
                + "8. **数量**：生成 10 个关键路标。\n"
                + "9. **数据格式**：JSON 对象，请严格控制控制返回数据为JSON格式，尤其注意标点符号的使用，其中字段 \\`milestones\\` 为数组。\n\n"
                + "### 输出结构\n"
                + "{\n"
                + "  \\\"milestones\\\": [\n"
                + "    {\n"
                + "      \\\"title\\\": \\\"路标标题（如：退婚风波），使用英文标点替换中文标点符号\\\",\n"
                + "      \\\"summary\\\": \\\"简述发生了什么关键事件，突显冲突和爽点，使用英文标点替换中文标点符号\\\",\n"
                + "      \\\"type\\\": \\\"milestone\\\",\n"
                + "      \\\"estimated_chapters\\\": 8,\n"
                + "      \\\"pace_type\\\": \\\"高潮\\\",\n"
                + "      \\\"cool_points\\\": [\\\"本路标中的高爽情节 A，使用英文标点替换中文标点符号\\\", \\\"高爽情节 B，使用英文标点替换中文标点符号\\\"],\n"
                + "      \\\"reversals\\\": [\\\"关键反转事件及其触发条件，使用英文标点替换中文标点符号\\\"],\n"
                + "      \\\"foreshadows\\\": [\n"
                + "        {\n"
                + "          \\\"description\\\": \\\"伏笔内容或提示线索，使用英文标点替换中文标点符号\\\",\n"
                + "          \\\"recover_at\\\": \\\"next_milestone\\\"\n"
                + "        }\n"
                + "      ]\n"
                + "    },\n"
                + "    ...\n"
                + "  ]\n"
                + "}";
        String user = "分卷标题：" + String.valueOf(volumeTitle) + "\n分卷大纲：" + String.valueOf(volumeSummary) + "\n分卷预期总章节数（约）：" + totalChapters + " 章\n\n世界时间线（如有）："
                + (timelineContext.isEmpty() ? "暂无明确时间线，仅根据分卷大纲和章节信息规划" : timelineContext)
                + "\n\n本卷已有章节及其概述（如有）： \n" + chaptersContext + "\n\n请基于上述分卷大纲，规划本卷的剧情路标。注意：只规划本卷内容！不要写到小说大结局！";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "generate-milestones", user, null, currentPlatform);
        JsonNode node = toJson(content);
        JsonNode data = node.has("milestones") ? node.get("milestones") : node;
        return success(data);
    }

    @PostMapping("/analyze-lore")
    public CommonResult<JsonNode> analyzeLore(@RequestBody AiAnalyzeLoreReqVO reqVO) throws Exception {
        
        Long novelId = reqVO.getNovelId();
        NovelProjectDO project = novelId != null ? projectService.getProject(novelId) : null;
        List<NovelLoreDO> loreItems = novelId != null ? projectService.getLoreList(novelId) : java.util.Collections.emptyList();
        StringBuilder context = new StringBuilder();
        if (project != null) {
            context.append("书名：").append(project.getTitle() != null ? project.getTitle() : "").append("\n");
            context.append("类型：").append(project.getGenre() != null ? project.getGenre() : "").append("\n");
            context.append("风格：").append(project.getStyle() != null ? project.getStyle() : "").append("\n");
            NovelLoreDO outline = null;
            for (NovelLoreDO l : loreItems) {
                if ("outline".equals(l.getType())) {
                    outline = l;
                    break;
                }
            }
            context.append("主大纲：").append(outline != null ? (outline.getContent() != null ? outline.getContent() : "") : "无").append("\n");
        }
        java.util.Map<String, String> textById = new java.util.HashMap<>();
        StringBuilder itemsText = new StringBuilder();
        for (NovelLoreDO l : loreItems) {
            String id = l.getId() != null ? String.valueOf(l.getId()) : "";
            String title = l.getTitle() != null ? l.getTitle() : "未命名";
            String type = l.getType() != null ? l.getType() : "other";
            String text = l.getContent() != null ? l.getContent() : "";
            String full = "- [" + type + "] " + title + " (id=" + id + ")\n" + text;
            if (!id.isEmpty()) {
                textById.put(id, full);
            }
            itemsText.append(full).append("\n\n");
        }
        String system = "你是资深设定编辑。任务是根据网文的设定原则，审查整套设定是否符合要求，并找出互相矛盾、不一致或缺失之处，并提出可执行的修改建议。请使用简体中文，建议要具体、有建设性。\n\n"
                + "【严禁破坏性改写规则】\n"
                + "1. 保留原设定的信息密度与写作风格，禁止将详尽段落简化为笼统标签或短句。\n"
                + "2. 仅做“局部修正”，不进行“整段重写”或“整角色替换”。对人物设定，禁止建议删除角色，除非与主大纲/主线冲突存在不可调和的逻辑矛盾；若提出删除，必须有强证据且改为“弱化出场频次或改为配角”的替代方案。\n"
                + "3. 优先使用 replace/append，对 delete 仅限重复、矛盾或无效句子的小跨度删除；禁止对整段或整角色使用 delete。\n"
                + "4. 每条 changes 的修改跨度应尽量小（建议不超过约60字），并引用原文片段（before）中的真实文本。\n"
                + "5. 保留原有段落结构（如：性格特征/外貌描写/背景故事/能力/角色功能/出场方式），修改应定位到具体句子或小段。\n"
                + "6. 如果在设定文本中找不到可以精确引用的原文句子或短语，则该问题可以只用 issue 和 suggestion 描述，changes 中不要生成对应项；严禁凭空编造不存在的句子作为 before。";
        String user = "项目概况：\n" + context + "设定列表：\n" + itemsText + "\n\n输出一个JSON对象，包含数组suggestions。每项字段：\n- id: 设定id\n- title: 设定标题\n- type: 设定类型\n- issue: 问题概述（一句话）\n- suggestion: 总结性修改建议（两三句话，且不得建议整段替换或整角色删除）\n- severity: \"minor\" | \"medium\" | \"major\"\n- changes: [{ \"field\": \"<字段或段落标识，无法定位时写\\\"content\\\">\", \"before\": \"<原文片段（必须取自主文，精确匹配；如果无法精确匹配则不要生成该 change）>\", \"after\": \"<明确替换文本（保持原风格与信息密度）>\", \"mode\": \"replace|append|delete\" } ...]（列出1-5条明确的“把什么改成什么”的修改；delete仅允许小跨度无效/冲突句子；禁止整段/整角色删除）\n请严格返回 JSON，不要使用 Markdown 代码块标记。";
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "analyze-lore", user, novelId, currentPlatform);
        JsonNode node;
        try {
            node = toJson(content);
        } catch (Exception e) {
            node = mapper.readTree("{\"suggestions\":[]}");
        }
        com.fasterxml.jackson.databind.node.ArrayNode suggestions;
        if (node.isArray()) {
            suggestions = (com.fasterxml.jackson.databind.node.ArrayNode) node;
        } else if (node.has("suggestions") && node.get("suggestions").isArray()) {
            suggestions = (com.fasterxml.jackson.databind.node.ArrayNode) node.get("suggestions");
        } else {
            suggestions = mapper.createArrayNode();
        }
        com.fasterxml.jackson.databind.node.ArrayNode validated = mapper.createArrayNode();
        for (JsonNode s : suggestions) {
            if (!s.isObject()) {
                continue;
            }
            String loreId = s.has("id") ? s.get("id").asText() : (s.has("_id") ? s.get("_id").asText() : "");
            String source = loreId != null ? textById.getOrDefault(loreId, "") : "";
            com.fasterxml.jackson.databind.node.ObjectNode obj = ((com.fasterxml.jackson.databind.node.ObjectNode) s).deepCopy();
            if (obj.has("changes") && obj.get("changes").isArray() && !source.isEmpty()) {
                com.fasterxml.jackson.databind.node.ArrayNode arr = mapper.createArrayNode();
                for (JsonNode ch : obj.get("changes")) {
                    String before = ch.has("before") && ch.get("before").isTextual() ? ch.get("before").asText().trim() : "";
                    if (!before.isEmpty() && source.contains(before)) {
                        arr.add(ch);
                    }
                }
                obj.set("changes", arr);
            }
            validated.add(obj);
        }
        return success(validated);
    }

    @PostMapping("/generate-bridge-beats")
    public CommonResult<JsonNode> generateBridgeBeats(@RequestBody AiBridgeBeatsReqVO reqVO) throws Exception {
        
        AiBridgeBeatsReqVO.Milestone start = reqVO.getStartMilestone();
        AiBridgeBeatsReqVO.Milestone end = reqVO.getEndMilestone();
        String context = reqVO.getContext();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "### 角色设定\n"
                + "你是一位擅长填充剧情缝隙的小说助手。你的任务是在两个关键路标之间，设计 3-5 个过渡剧情点（Beats），使剧情逻辑连贯。\n\n"
                + "### 约束条件\n"
                + "1. **语言**：必须严格使用**简体中文**。\n"
                + "2. **格式**：必须严格遵循 JSON 格式返回，**严禁**包含 Markdown 代码块标记。\n\n"
                + "### 输入上下文\n"
                + "- 起点：" + (start != null ? String.valueOf(start.getTitle()) : "") + " (" + (start != null ? String.valueOf(start.getSummary()) : "") + ")\n"
                + "- 终点：" + (end != null ? String.valueOf(end.getTitle()) : "") + " (" + (end != null ? String.valueOf(end.getSummary()) : "") + ")\n"
                + "- 背景：" + (context != null ? context : "无") + "\n\n"
                + "### 输出结构\n"
                + "{\n"
                + "  \\\"beats\\\": [\n"
                + "    {\n"
                + "      \\\"title\\\": \\\"过渡事件标题\\\",\n"
                + "      \\\"summary\\\": \\\"简述事件内容\\\",\n"
                + "      \\\"type\\\": \\\"beat\\\"\n"
                + "    },\n"
                + "    ...\n"
                + "  ]\n"
                + "}";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage("请生成过渡剧情点。请务必使用 JSON 格式输出。"))), "generate-bridge-beats", "请生成过渡剧情点。请务必使用 JSON 格式输出。", null, currentPlatform);
        JsonNode node = toJson(content);
        JsonNode data = node.has("beats") ? node.get("beats") : node;
        return success(data);
    }

    @PostMapping("/generate-chapters-from-milestone")
    public CommonResult<JsonNode> generateChaptersFromMilestone(@RequestBody AiChaptersFromMilestoneReqVO reqVO) throws Exception {
        
        String milestoneTitle = reqVO.getMilestoneTitle();
        String milestoneSummary = reqVO.getMilestoneSummary();
        Integer count = reqVO.getCount();
        String volumeContext = reqVO.getVolumeContext();
        List<AiChaptersFromMilestoneReqVO.CharacterItem> characters = reqVO.getCharacters();
        AiChaptersFromMilestoneReqVO.Milestone prev = reqVO.getPrevMilestone();
        AiChaptersFromMilestoneReqVO.Milestone next = reqVO.getNextMilestone();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        int n = count != null && count > 0 ? count : 3;
        String system = "### 角色设定\n"
                + "    你是一位擅长小说剧情细化的大纲策划。你的任务是根据给定的“当前路标”、“目标章节数”以及上下文路标，规划出具体的章节列表，并为每一章指定出场人物。\n\n"
                + "    ### 约束条件\n"
                + "    1. 数量：必须严格生成 " + n + " 个章节。\n"
                + "    2. 连贯性：这些章节必须完整地展开“当前路标”所描述的剧情，从开始到结束，逻辑连贯。\n"
                + "    3. 承上启下：\n"
                + "       - 起点：如果存在“上一路标”，剧情应自然承接。\n"
                + "       - 终点：必须为“下一路标”做好铺垫，但**严禁**直接描写或消耗“下一路标”的核心事件。剧情应停留在“下一路标”发生之前。\n"
                + "    4. 角色利用：只能从提供的人物列表中选择人物，禁止凭空创造新角色。\n"
                + "    5. 场景分配：不同章节可以重复使用同一角色，但每章至少评估是否需要主角或关键配角出场。\n"
                + "    6. 结构与节奏（重要）：\n"
                + "       将这 " + n + " 章按照“起（引入）、承（发展）、转（高潮/反转）、合（收束/悬念）”的结构进行分配。\n"
                + "       - 若 count=3：通常为 1起、1承转、1合；\n"
                + "       - 若 count>=5：通常为 1-2起、2-3承、1-2转、1合。\n"
                + "       - 请在返回结果中为每一章标记 role 字段（值为：setup/development/climax/resolution 之一）。\n"
                + "    7. 格式：JSON 对象，内部包含 chapters 数组。\n"
                + "    8. 语言：简体中文。\n\n"
                + "    ### 输出结构\n"
                + "    {\n"
                + "      \\\"chapters\\\": [\n"
                + "        {\n"
                + "          \\\"title\\\": \\\"章节标题（有吸引力）\\\",\n"
                + "          \\\"summary\\\": \\\"章节章纲（100-200字，包含主要情节、冲突和结尾悬念）\\\",\n"
                + "          \\\"characterIds\\\": [\\\"角色ID1\\\", \\\"角色ID2\\\"],\n"
                + "          \\\"role\\\": \\\"setup\\\"\n"
                + "        }\n"
                + "      ]\n"
                + "    }";
        StringBuilder charactersContext = new StringBuilder();
        if (characters != null && !characters.isEmpty()) {
            for (AiChaptersFromMilestoneReqVO.CharacterItem c : characters) {
                String id = c.getId() != null ? c.getId() : (c.get_id() != null ? c.get_id() : "");
                String name = c.getName() != null ? c.getName() : (c.getTitle() != null ? c.getTitle() : "未命名角色");
                String role = c.getRole() != null ? c.getRole() : "未标明身份";
                String descSource = c.getContent() != null ? c.getContent() : (c.getDescription() != null ? c.getDescription() : (c.getBio() != null ? c.getBio() : ""));
                String desc = descSource != null ? (descSource.length() > 80 ? descSource.substring(0, 80) : descSource) : "";
                charactersContext.append("- ").append(id).append("｜").append(name).append("｜").append(role).append("｜").append(desc).append("\n");
            }
            if (charactersContext.length() > 0 && charactersContext.charAt(charactersContext.length() - 1) == '\n') {
                charactersContext.setLength(charactersContext.length() - 1);
            }
        } else {
            charactersContext.append("无");
        }
        String prevContext = prev != null ? ("上一路标：" + String.valueOf(prev.getTitle()) + " (" + String.valueOf(prev.getSummary()) + ")") : "上一路标：无（这是第一个路标）";
        String nextContext = next != null ? ("下一路标（严禁剧透此部分）：" + String.valueOf(next.getTitle()) + " (" + String.valueOf(next.getSummary()) + ")") : "下一路标：无（这是最后一个路标）";
        String user = "当前路标：" + String.valueOf(milestoneTitle) + "\n当前摘要：" + String.valueOf(milestoneSummary) + "\n" + prevContext + "\n" + nextContext + "\n分卷上下文：" + (volumeContext != null ? volumeContext : "无") + "\n\n可用人物设定列表（从中选择出场角色，按ID填写到 characterIds 中）：\n" + charactersContext + "\n\n请将“当前路标”的剧情拆解并扩写为 " + n + " 个具体章节。确保节奏稳健，不要写得太快，**绝对不要**把“下一路标”的内容也写进去了。请务必使用 JSON 格式输出，只能使用提供的角色ID。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "generate-chapters-from-milestone", user, null, currentPlatform);
        JsonNode node = toJson(content);
        JsonNode data = node.has("chapters") ? node.get("chapters") : node;
        return success(data);
    }

    @PostMapping("/generate-beat")
    public CommonResult<String> generateBeat(@RequestBody AiGenerateBeatReqVO reqVO) {
        
        String chapterTitle = reqVO.getChapterTitle();
        String chapterSummary = reqVO.getChapterSummary();
        String instruction = reqVO.getInstruction();
        List<String> previousBeats = reqVO.getPreviousBeats();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "### 角色设定\n"
                + "你是一位擅长拆分剧情的小说章纲助手。你的任务是根据用户提供的简单需求，生成一条精炼的剧情点描述。\n\n"
                + "### 输出要求\n"
                + "1. 文本类型：单条剧情点描述，用于放入章节章纲列表中。\n"
                + "2. 长度：控制在约 80～120 字之间，不要写成整段完整剧情，只保留关键事件、冲突与结果走向。\n"
                + "3. 视角：保持与网文常见叙述方式一致，使用简体中文。\n"
                + "4. 形式：只输出正文内容，不要添加序号、引号、括号或任何前后缀说明。\n"
                + "5. 上下文：如果给出了章节标题、章节大纲和已有剧情点，请保证新剧情点在逻辑上衔接合理，但不要重复已有内容。";
        StringBuilder ctx = new StringBuilder();
        if (chapterTitle != null && !chapterTitle.isEmpty()) ctx.append("章节标题：").append(chapterTitle).append("\n");
        if (chapterSummary != null && !chapterSummary.isEmpty()) ctx.append("章节大纲：").append(chapterSummary).append("\n");
        if (previousBeats != null && !previousBeats.isEmpty()) {
            ctx.append("已有剧情点：\n");
            for (int i = 0; i < previousBeats.size(); i++) {
                String b = previousBeats.get(i);
                String s = b != null ? (b.length() > 80 ? b.substring(0, 80) : b) : "";
                ctx.append(i + 1).append(". ").append(s).append("\n");
            }
        }
        String user = (ctx.length() > 0 ? ctx.toString().trim() : "无章节上下文") + "\n\n用户需求：" + (instruction != null ? instruction : "无（请根据章节信息自行补完一个合适的剧情推进节点）") + "\n\n请据此生成一条新的剧情点描述，满足上述输出要求。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "generate-beat", user, null, currentPlatform);
        String clean = content != null ? content.replaceAll("```[\\s\\S]*?```", "").trim() : "";
        return success(clean);
    }

    @PostMapping("/refine-text")
    public CommonResult<String> refineText(@RequestBody AiRefineTextReqVO reqVO) {
        
        String text = reqVO.getText();
        String context = reqVO.getContext();
        String instruction = reqVO.getInstruction();
        String model = reqVO.getModel();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        boolean isKnowledgeMode =
                instruction != null && instruction.contains("已知事实") && instruction.contains("误解");
        boolean isBeforeStoryKnowledge =
                isKnowledgeMode && text != null && text.contains("当前章节为第一章且正文为空");

        String system;
        String user;
        Prompt prompt;

        if (isKnowledgeMode) {
            if (isBeforeStoryKnowledge) {
                system = "### 角色设定\n"
                        + "你是一位严谨的推理型小说人物心理分析师。你擅长在“故事尚未开始”的前提下，仅基于人物设定、世界观与作者大纲，反推出角色在开篇前的主观认知。\n\n"
                        + "### 总原则\n"
                        + "1. 必须使用简体中文。\n"
                        + "2. 只能输出角色在“第一章开头之前”就可能拥有的主观认知；不得输出任何尚未发生的剧情事件。\n"
                        + "3. 允许阅读作者大纲来反推起点状态，但绝对不能把大纲中的未来事件写成已发生事实。\n"
                        + "4. 严格站在角色视角，不要使用上帝视角，不要出现“作者/读者/大纲写了”等表述。\n"
                        + "5. 信息不足时宁可保守，条目可以很少，允许为空。\n\n"
                        + "### 输出格式\n"
                        + "必须严格按模板输出，且只输出模板内容：\n"
                        + "已知事实：\n"
                        + "- ...\n"
                        + "误解：\n"
                        + "- ...\n"
                        + "怀疑/预感：\n"
                        + "- ...";
            } else {
                system = "### 角色设定\n"
                        + "你是一位严谨的小说剧情逻辑与人物认知校对专家。你的任务是：在不编造未来剧情的前提下，基于提供的上下文和章节信息，推导并更新指定角色在当前章节结束时的主观认知，并给出一份新的、完整的认知清单。\n\n"
                        + "### 总原则\n"
                        + "1. 必须使用简体中文。\n"
                        + "2. 只能写到“当前章节结束”为止角色已经合理知道、相信或怀疑的内容，禁止写未来剧情。\n"
                        + "3. 严格站在角色视角，不要使用上帝视角，不要出现“作者/读者/大纲写了”等表述。\n"
                        + "4. 你的输出应当是一份完整的三类认知清单，而不是只列出变化部分；可以在已有认知的基础上增删和重写条目，使其更符合当前章节后的状态。\n"
                        + "5. 只要本章对角色的看法、情绪、信任度、警惕度、怀疑程度有任何合理变化（哪怕很细微），都应体现在新的认知清单中。\n"
                        + "6. 如果在认真阅读上下文后判断本章对该角色的认知几乎没有影响，也请输出一份完整清单，可以在上一版认知基础上稍作整理后复述，而不要留空或只说“与上一章相同”。\n\n"
                        + "### 输出格式\n"
                        + "必须严格按模板输出，且只输出模板内容：\n"
                        + "已知事实：\n"
                        + "- ...\n"
                        + "误解：\n"
                        + "- ...\n"
                        + "怀疑/预感：\n"
                        + "- ...";
            }

            user = "【任务描述】\n" + String.valueOf(text) + "\n\n"
                    + "【上下文】\n" + (context != null ? context : "无") + "\n\n"
                    + "【额外要求】\n" + (instruction != null ? instruction : "请根据上下文更新角色在当前章节结束时的主观认知。") + "\n\n"
                    + "请严格按输出模板生成结果。";
        } else {
            system = "### 角色设定\n"
                    + "你是一位资深的小说主编和文字润色/精修专家。你的任务是对用户提供的原文进行有节制的修改，提升阅读体验，同时确保文本本身的逻辑与表达连贯。该原文可能是世界观设定、人物小传、文风基调说明、时间线条目或章节正文。\n\n"
                    + "### 约束条件\n"
                    + "1. **语言**：必须使用**简体中文**。\n"
                    + "2. **输出**：只返回优化后的文本，不要包含任何解释、引号或 Markdown 标记，更不要主动续写剧情或生成新的章节片段。\n"
                    + "3. **核心原则**：\n"
                    + "   - **允许改动**：不要机械地保留每个字。如果原文用词不当、逻辑不通或描写干瘪，请在原有内容的基础上进行修饰、增删和重组，使其更符合阅读审美。\n"
                    + "   - **主题一致**：在没有特殊指令时，所有的改动必须服务于原文的核心意图和情感基调，不要随意改动设定事实。\n"
                    + "   - **文本类型保持**：如果原文是“设定说明”（如文风基调、世界观、人物小传、时间线条目等），优化后的结果仍然必须是说明性文本，禁止改写成小说章节。\n"
                    + "   - **上下文衔接**：如果上下文中提供了章节信息，请确保优化后的文本在逻辑与信息上能与上下文自然衔接，而不是重新讲述一遍故事。\n"
                    + "   - **网文去AI味**：当原文属于小说正文或网文风格片段时，请优先清理论文式逻辑连接词（如“首先”“其次”“再者”“总之”“综上所述”“显而易见”等）、翻译腔用语（如“噢”“该死的”“不得不承认”“如同……一般”“看在……的份上”等）和空洞过渡语（如“与此同时”“画面一转”“值得一提的是”“令人惊讶的是”等），并将过长段落拆分为手机端阅读友好的短段落（单段尽量不超过 3 行）。\n"
                    + "4. **风格约束**：根据指令调整语气与文风（如：变严肃、变幽默、变细腻），但不得偏离原文的角色性格和背景设定。\n"
                    + "5. **长度控制**：除非用户在指令中明确要求“扩写”“详细展开”等，优化后文本的整体字数与原文相比应控制在 ±30% 以内，避免出现篇幅急剧膨胀。\n"
                    + "6. **一致性**：保持人称、时态和叙事视角的一致性。\n"
                    + "7. **指令优先级**：如果“指令”中包含明确的逐条修改建议（例如：只改某几个角色、删除/新增某个角色、合并/拆分某段信息），则以这些具体指令为最高优先级：\n"
                    + "   - 必须严格按指令描述对相应片段进行修改、删除或新增。\n"
                    + "   - 对于指令未提到的角色、段落和信息，必须逐字保留，不得做任何润色或改写。\n"
                    + "   - 如果指令要求调整人物关系或设定事实，可以在相关片段中做出对应修改，这是**被允许的**。\n\n"
                    + "### 指令\n"
                    + (instruction != null ? instruction : "在不改变文本类型的前提下，润色文字，使其更具表现力、逻辑更通顺。") + "\n\n"
                    + "### 上下文（可包含章节信息、世界观设定、人物档案、时间线等）\n"
                    + (context != null ? context : "无");
            user = "原文：\n" + String.valueOf(text) + "\n\n请在保持文本类型不变的前提下进行优化。";
        }
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "refine-text", user, null, currentPlatform);
        return success(content);
    }

    @PostMapping("/generate-characters")
    public CommonResult<JsonNode> generateCharacters(@RequestBody AiGenerateCharactersReqVO reqVO) throws Exception {
        
        AiGenerateCharactersReqVO.GenerateCharactersContext ctx = reqVO.getContext();
        Integer count = reqVO.getCount();
        String instruction = reqVO.getInstruction();
        int n = count != null && count > 0 ? count : 3;
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "### 角色设定\n"
                + "你是一位资深小说角色设计专家，擅长为小说章节写作提供直接可用的角色档案。你的任务是根据设定，批量生成用于写正文的精炼人物档案。\n\n"
                + "### 约束条件\n"
                + "1. 语言：必须使用简体中文。\n"
                + "2. 格式：严格返回 JSON；禁止使用 Markdown 代码块标记。\n"
                + "3. 数量：请生成 " + n + " 个角色。\n"
                + "4. 目标：不生成资料型冗余信息，只输出写正文需要的关键信息。\n\n"
                + "### 写正文用的档案模板（纯文本，写进 description）\n"
                + "请在 description 字段中，按以下顺序用简洁段落描述：\n"
                + "1) 剧情定位：该角色在故事中的功能（如：压力源/军师/情绪炸弹）。\n"
                + "2) 性格与矛盾：底色 + \"又…又…\"式矛盾，给出1个具体情境表现。\n"
                + "3) 目标与执念：长期目标 + 当前阶段目标 + 绝不能失去的东西。\n"
                + "4) 情绪触发点：怒点/爽点/雷区，各举1个具体情境。\n"
                + "5) 说话风格：口吻、典型句式/口头禅、说话节奏（举例）。\n"
                + "6) 行为习惯：2-3个稳定小动作或决策惯性。\n"
                + "7) 能力与弱点：核心能力+明显限制（如体能差/社恐）。\n"
                + "8) 关键关系：与主角/重要角色的关系标签及互动气氛。\n\n"
                + "### 输入上下文\n"
                + "- 世界观：" + (ctx != null ? String.valueOf(ctx.getWorld()) : "无") + "\n"
                + "- 大纲：" + (ctx != null ? String.valueOf(ctx.getOutline()) : "无") + "\n"
                + "- 现有角色：" + (ctx != null ? String.valueOf(ctx.getExistingCharacters()) : "无") + "\n"
                + "- 用户指令：" + (instruction != null ? instruction : "请生成一组符合设定的角色。") + "\n\n"
                + "### 输出结构（仅保留必要字段）\n"
                + "{\n"
                + "  \\\"characters\\\": [\n"
                + "    {\n"
                + "      \\\"name\\\": \\\"姓名\\\",\n"
                + "      \\\"description\\\": \\\"按上述模板撰写的精炼人物档案纯文本\\\"\n"
                + "    },\n"
                + "    ...\n"
                + "  ]\n"
                + "}";
        String user = "用户指令：" + (instruction != null ? instruction : "请生成一组符合设定的角色。") + "\n\n请务必使用 JSON 格式输出，且每个角色只包含 name 与 description 字段。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "generate-characters", user, null, currentPlatform);
        JsonNode node = toJson(content);
        JsonNode data = node.has("characters") ? node.get("characters") : node;
        return success(data);
    }

    @PostMapping("/analyze-relations")
    public CommonResult<JsonNode> analyzeRelations(@RequestBody AiAnalyzeRelationsReqVO reqVO) throws Exception {
        
        List<AiAnalyzeRelationsReqVO.CharacterItem> characters = reqVO.getCharacters();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        StringBuilder charContext = new StringBuilder();
        if (characters != null) {
            for (int i = 0; i < characters.size(); i++) {
                AiAnalyzeRelationsReqVO.CharacterItem c = characters.get(i);
                charContext.append(i + 1).append(". [").append(c.getName()).append("] (ID: ").append(c.getId()).append(")\n").append(c.getContent() != null ? c.getContent() : "暂无详细设定");
                if (i < characters.size() - 1) charContext.append("\n\n");
            }
        }
        String system = "你是一位小说关系梳理专家。请根据提供的角色设定，梳理出人物之间的关键关系。\n\n"
                + "### 约束条件\n"
                + "1. **语言**：简体中文。\n"
                + "2. **格式**：JSON 对象，包含 \\\"edges\\\" 数组。\n"
                + "3. **精准**：只提取明确提到或强烈暗示的关系。\n"
                + "4. **简洁**：关系描述（label）限制在 2-6 个字以内。\n\n"
                + "### 输出结构\n"
                + "{\n"
                + "  \\\"edges\\\": [\n"
                + "    { \\\"source\\\": \\\"源角色ID\\\", \\\"target\\\": \\\"目标角色ID\\\", \\\"label\\\": \\\"关系描述\\\" },\n"
                + "    ...\n"
                + "  ]\n"
                + "}";
        String user = "【角色列表】\n\n" + charContext + "\n\n请分析并返回关系 JSON。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "analyze-relations", user, null, currentPlatform);
        JsonNode node = toJson(content);
        JsonNode data = node.has("edges") ? node.get("edges") : node;
        return success(data);
    }

    @PostMapping("/analyze-foreshadowing")
    public CommonResult<JsonNode> analyzeForeshadowing(@RequestBody AiAnalyzeForeshadowingReqVO reqVO) throws Exception {
        
        String chapterId = reqVO.getChapterId();
        String chapterTitle = reqVO.getChapterTitle();
        String contentText = reqVO.getContent();
        List<AiAnalyzeForeshadowingReqVO.ForeshadowingItem> existing = reqVO.getExistingForeshadowing();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String truncated = contentText != null && contentText.length() > 30000 ? contentText.substring(0, 30000) + "... (截断)" : (contentText != null ? contentText : "");
        List<AiAnalyzeForeshadowingReqVO.ForeshadowingItem> pending = existing != null ? existing.stream().filter(f -> "pending".equals(f.getStatus())).toList() : List.of();
        String pendingJson = mapper.writeValueAsString(pending);
        String system = "你是一位专业的文学评论家和网文编辑，擅长分析小说中的伏笔和剧情线索。\n你的任务是：在充分理解当前章节内容和已有伏笔列表的基础上，识别并提炼出对后续剧情发展有重大影响的「关键跨章节伏笔」，并标记出哪些旧伏笔在本章被兑现。\n\n"
                + "### 输入信息\n"
                + "- 当前章节：" + String.valueOf(chapterTitle) + " (ID: " + String.valueOf(chapterId) + ")\n"
                + "- 章节内容：\n"
                + truncated + "\n\n"
                + "- 已有未兑现伏笔列表：\n"
                + pendingJson + "\n\n"
                + "### 输出要求\n"
                + "仅返回真正重要的、跨章节的关键伏笔，并保持结构简洁清晰。\n\n"
                + "返回一个 JSON 对象，包含两个字段：\n"
                + "1. newForeshadowing: 本章新识别出的关键伏笔数组（只保留对后续主线或重要支线有重大影响、预计会在多个章节甚至整卷中持续起作用的伏笔；不要包含只在本章或下一两章内就完全解决的小细节）\n"
                + "2. resolvedForeshadowingIds: 在本章得到「兑现」的既有伏笔 ID 列表（只需要 ID，不要输出详细分析）\n\n"
                + "newForeshadowing 中的每一项必须是一个对象，包含：\n"
                + "- content: 对伏笔本身的一句简洁概括（核心信息、不要长篇大论）\n"
                + "- type: \\\"long_term\\\" 或 \\\"short_term\\\"；优先标记真正长期影响主线的为 \\\"long_term\\\"\n"
                + "- chapterTitle: 伏笔首次出现的章节标题（如果无法确定，使用当前章节标题）\n"
                + "- position: 伏笔在章节中的大致位置或场景说明（例如：\\\"章节开头与师兄对话时\\\"、\\\"中段密林遭遇战\\\"、\\\"结尾临睡前的独白\\\"）\n"
                + "- impact: 对后续剧情潜在影响的简要分析（只写最关键的一两点，不要堆砌细节）\n"
                + "- payoffPrediction: 可能的兑现方式和大致时间节点预测（例如：\\\"第二卷中主角被追杀时揭露真相\\\"、\\\"本卷后段的大决战中触发\\\"）\n"
                + "- visibility: 伏笔在叙事中的知情范围，必须为 \\\"author_only\\\"、\\\"reader_known\\\" 或 \\\"character_known\\\" 之一；如无法明确判断时，请使用 \\\"author_only\\\" 作为保守默认值\n\n"
                + "示例结构（仅示意，注意保持简洁）：\n"
                + "{\n"
                + "  \\\"newForeshadowing\\\": [\n"
                + "    {\n"
                + "      \\\"content\\\": \\\"主角注意到路边乞丐手腕上有一个奇异的蛇形纹身\\\",\n"
                + "      \\\"type\\\": \\\"long_term\\\",\n"
                + "      \\\"chapterTitle\\\": \\\"夜雨初临\\\",\n"
                + "      \\\"position\\\": \\\"中段街道躲雨时与乞丐的短暂对话\\\",\n"
                + "      \\\"impact\\\": \\\"可能指向一个隐藏势力或主角身世之谜，为后续大规模阴谋埋下伏笔\\\",\n"
                + "      \\\"payoffPrediction\\\": \\\"预计在第二卷中期主角被卷入更大势力斗争时，以同样纹身为线索揭开幕后组织\\\"\n"
                + "    }\n"
                + "  ],\n"
                + "  \\\"resolvedForeshadowingIds\\\": [\\\"id_of_previous_foreshadowing_1\\\"]\n"
                + "}\n\n"
                + "### 判定标准（务必严格筛选）\n"
                + "- 只记录真正重要、具有「跨章节影响」的伏笔：\n"
                + "  - 会推动主线或重要支线走向的关键线索；\n"
                + "  - 预计会在多个章节甚至整卷中持续发挥作用；\n"
                + "  - 与人物命运、世界观真相、核心冲突密切相关。\n"
                + "- 不要记录以下内容为伏笔：\n"
                + "  - 只在本章内或下一两章就完全解决的小误会、小细节；\n"
                + "  - 单纯的气氛渲染、背景描写、无后续承接的细枝末节。\n"
                + "- 对于在本章已经完全兑现且不再影响后续走向的伏笔，只在 resolvedForeshadowingIds 中标记 ID，不要在 newForeshadowing 里再次分析。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage("请分析本章的伏笔埋设与兑现情况。"))), "analyze-foreshadowing", "请分析本章的伏笔埋设与兑现情况。", null, currentPlatform);
        JsonNode node = toJson(content);
        return success(node);
    }

    @PostMapping("/evaluate-chapter")
    public CommonResult<JsonNode> evaluateChapter(@RequestBody AiEvaluateChapterReqVO reqVO) throws Exception {
        
        AiEvaluateChapterReqVO.ChapterData chapter = reqVO.getChapter();
        AiEvaluateChapterReqVO.ChapterData previousChapter = reqVO.getPreviousChapter();
        String volumeSummary = reqVO.getVolumeSummary();
        String globalLore = reqVO.getGlobalLore();
        List<AiEvaluateChapterReqVO.ForeshadowingItem> foreshadowing = reqVO.getForeshadowing();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String beatSheetContext;
        Object bs = chapter != null ? chapter.getBeatSheet() : null;
        if (bs instanceof JsonNode) {
            JsonNode json = (JsonNode) bs;
            JsonNode beats = json.get("beats");
            if (beats != null && beats.isArray()) {
                StringBuilder sb = new StringBuilder();
                for (JsonNode b : beats) {
                    sb.append(b.asText()).append("\n");
                }
                beatSheetContext = sb.toString().trim();
            } else {
                beatSheetContext = json.toString();
            }
        } else {
            beatSheetContext = bs != null ? String.valueOf(bs) : "";
        }
        String foreshadowingContext;
        if (foreshadowing != null && !foreshadowing.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (AiEvaluateChapterReqVO.ForeshadowingItem f : foreshadowing) {
                sb.append("- [").append("resolved".equals(f.getStatus()) ? "已兑现" : "未兑现").append(" / ").append("long_term".equals(f.getType()) ? "长期" : "短期").append("] ").append(f.getContent()).append(" (埋设于: ").append(f.getChapterTitle()).append(f.getResolvedChapterTitle() != null ? "，兑现于: " + f.getResolvedChapterTitle() : "").append(")").append("\n");
            }
            foreshadowingContext = sb.toString().trim();
        } else {
            foreshadowingContext = "无";
        }
        String truncatedContent = chapter != null && chapter.getContent() != null ? (chapter.getContent().length() > 30000 ? chapter.getContent().substring(0, 30000) + "\n...(内容截断)..." : chapter.getContent()) : "";
        String system = "你是一位严格的网文主编和文学评论家，负责按照既定“章节写作原则”对章节进行打分与问题诊断。\n\n"
                + "请始终使用简体中文回答，并严格按照指定的 JSON 结构返回结果，不要输出 Markdown 代码块标记。\n\n"
                + "【章节写作原则摘要】\n"
                + "1. 每章必须围绕本章目标和冲突展开，避免无意义灌水。\n"
                + "2. 每章要推动主线或重要支线至少向前迈出一个清晰的台阶。\n"
                + "3. 戏剧张力要足：冲突、反转、压力与释放要有起伏，避免平铺直叙。\n"
                + "4. 人物行为和情绪必须符合其既有性格与经历，不能为了剧情强行降智或强行推进。\n"
                + "5. 文本表达要口语化、易读，多用对话、动作和环境互动承载信息。\n"
                + "6. 段落之间要有自然过渡，通过环境、动作或心理变化衔接，不要生硬跳切。\n"
                + "7. 本章开头要快速给出情境或矛盾，中段推进事件，结尾制造悬念、转折或情绪高潮。\n"
                + "8. 必须保证世界观与设定前后一致，不出现明显的时间线、人物关系或能力体系自相矛盾。\n"
                + "9. 章纲中的每一个剧情点都应该在正文中有具体呈现，而不是一句话带过。\n"
                + "10. 文本必须为简体中文纯文本输出，不允许 Markdown 标记、场景小标题等格式性标记。\n\n"
                + "【去AI味自查】\n"
                + "1. 检查是否使用了“首先”“其次”“再者”“总之”“综上所述”“显而易见”等论文式逻辑词；如出现，应在 styleScore 中扣分并在 issues 中指出具体句子。\n"
                + "2. 检查是否存在“噢”“该死的”“不得不承认”“如同……一般”“看在……的份上”等翻译腔或西幻腔表达，应建议改为自然中文口语。\n"
                + "3. 检查是否大量依赖“与此同时”“画面一转”“值得一提的是”“令人惊讶的是”等空洞过渡语，而不是通过镜头切换或场景描写自然转场。\n"
                + "4. 检查是否出现“一股……之情油然而生”“充满”“仿佛”“旋即”等堆砌抽象词汇，以及超过 3-4 行的长段落；如有，应视为明显“AI 味”，在 issues 中给出具体改写建议。\n\n"
                + "【输入上下文】\n"
                + "- 当前章节标题：" + (chapter != null ? String.valueOf(chapter.getTitle()) : "无") + "\n"
                + "- 当前章节概述：" + (chapter != null ? String.valueOf(chapter.getSummary()) : "无") + "\n"
                + "- 当前章节内容（可能已截断）：\n"
                + (truncatedContent.isEmpty() ? "无" : truncatedContent) + "\n\n"
                + "- 章纲（Beat Sheet）：\n"
                + (beatSheetContext.isEmpty() ? "无" : beatSheetContext) + "\n\n"
                + "- 分卷大纲：" + (volumeSummary != null ? volumeSummary : "无") + "\n\n"
                + "- 上一章标题：" + (previousChapter != null ? String.valueOf(previousChapter.getTitle()) : "无") + "\n"
                + "- 上一章结尾片段：" + (previousChapter != null && previousChapter.getContent() != null ? (previousChapter.getContent().length() > 500 ? previousChapter.getContent().substring(previousChapter.getContent().length() - 500) : previousChapter.getContent()) : "无") + "\n\n"
                + "- 伏笔列表（含已兑现与未兑现）：\n"
                + foreshadowingContext + "\n\n"
                + "【评分与诊断要求】\n"
                + "1. 请从以下维度对本章进行评分（0-100，越高越好）：\n"
                + "   - structureScore：结构与节奏（起承转合是否清晰，节奏是否流畅）\n"
                + "   - plotProgressScore：剧情推进（是否真正推动主线/支线）\n"
                + "   - characterScore：人物行为与塑造（是否符合性格，是否有成长/变化）\n"
                + "   - worldConsistencyScore：世界观与设定一致性\n"
                + "   - hookScore：章尾钩子与悬念\n"
                + "   - styleScore：文风与可读性（是否口语化、有画面感，且没有明显“AI 味”或翻译腔）\n"
                + "2. 计算 overallScore，总体可以是上述子项的平均分或加权结果，但请确保与实际主观评价一致。\n"
                + "3. 列出不合格点（issues），每条说明：\n"
                + "   - category：问题类型，如 \\\"plot\\\", \\\"character\\\", \\\"world\\\", \\\"pacing\\\", \\\"hook\\\", \\\"style\\\", \\\"outline_mismatch\\\"\n"
                + "   - severity：严重程度 \\\"minor\\\" | \\\"medium\\\" | \\\"major\\\"\n"
                + "   - description：简明描述问题\n"
                + "   - suggestion：针对本章可直接执行的修改建议\n"
                + "4. 如有明显与章纲不符的地方，请在 issues 中增加 category 为 \\\"outline_mismatch\\\" 的问题，并具体指出“章纲中要求了什么”“正文中缺了什么或写歪了什么”。\n\n"
                + "【输出 JSON 结构】\n"
                + "请严格返回如下结构（不要包含多余字段）：\n"
                + "{\n"
                + "  \\\"overallScore\\\": 0,\n"
                + "  \\\"structureScore\\\": 0,\n"
                + "  \\\"plotProgressScore\\\": 0,\n"
                + "  \\\"characterScore\\\": 0,\n"
                + "  \\\"worldConsistencyScore\\\": 0,\n"
                + "  \\\"hookScore\\\": 0,\n"
                + "  \\\"styleScore\\\": 0,\n"
                + "  \\\"summary\\\": \\\"总体评价，1-3句话\\\",\n"
                + "  \\\"issues\\\": [\n"
                + "    {\n"
                + "      \\\"category\\\": \\\"plot\\\",\n"
                + "      \\\"severity\\\": \\\"major\\\",\n"
                + "      \\\"description\\\": \\\"这里描述问题\\\",\n"
                + "      \\\"suggestion\\\": \\\"这里给出修改建议\\\"\n"
                + "    }\n"
                + "  ]\n"
                + "}";
        String user = "请根据上述要求对本章进行严格打分和问题诊断，只返回 JSON。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "evaluate-chapter", user, null, currentPlatform);
        JsonNode node = toJson(content);
        return success(node);
    }

    @PostMapping("/rewrite-chapter")
    public CommonResult<String> rewriteChapter(@RequestBody AiRewriteChapterReqVO reqVO) throws Exception {
        
        AiRewriteChapterReqVO.ChapterData chapter = reqVO.getChapter();
        Object evaluation = reqVO.getEvaluation();
        AiRewriteChapterReqVO.ChapterData previousChapter = reqVO.getPreviousChapter();
        String volumeSummary = reqVO.getVolumeSummary();
        String globalLore = reqVO.getGlobalLore();
        List<AiRewriteChapterReqVO.ForeshadowingItem> foreshadowing = reqVO.getForeshadowing();
        String instruction = reqVO.getInstruction();
        Object coreSettings = reqVO.getCoreSettings();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String beatSheetContext;
        Object bs = chapter != null ? chapter.getBeatSheet() : null;
        if (bs instanceof JsonNode) {
            JsonNode json = (JsonNode) bs;
            JsonNode beats = json.get("beats");
            if (beats != null && beats.isArray()) {
                StringBuilder sb = new StringBuilder();
                for (JsonNode b : beats) {
                    sb.append(b.asText()).append("\n");
                }
                beatSheetContext = sb.toString().trim();
            } else {
                beatSheetContext = json.toString();
            }
        } else {
            beatSheetContext = bs != null ? String.valueOf(bs) : "无";
        }
        StringBuilder foreshadowingContext = new StringBuilder("无");
        if (foreshadowing != null && !foreshadowing.isEmpty()) {
            foreshadowingContext.setLength(0);
            for (AiRewriteChapterReqVO.ForeshadowingItem f : foreshadowing) {
                if ("pending".equals(f.getStatus())) {
                    foreshadowingContext.append("- [").append("long_term".equals(f.getType()) ? "长期" : "短期").append("] ").append(f.getContent()).append(" (埋设于: ").append(f.getChapterTitle()).append(")").append("\n");
                }
            }
            if (foreshadowingContext.length() == 0) {
                foreshadowingContext.append("无");
            }
        }
        String truncatedOriginal = chapter != null && chapter.getContent() != null ? (chapter.getContent().length() > 30000 ? chapter.getContent().substring(0, 30000) + "\n...(内容截断)..." : chapter.getContent()) : "";
        String coreSettingsContext = coreSettings != null ? String.valueOf(coreSettings) : "无";
        String evaluationJson = evaluation != null ? mapper.writeValueAsString(evaluation) : "{}";
        String system = "你是一位资深网文主编兼代笔作者，负责在既有章节草稿和详细评审结果的基础上，重写出质量更高的新版本章节。\n\n"
                + "请严格遵守以下要求：\n"
                + "1. 使用简体中文。\n"
                + "2. 只输出重写后的小说正文纯文本，不要输出任何解释、分析、列表或 JSON。\n"
                + "3. 不要使用 Markdown 标记，也不要写“场景一”“【地点】”这类结构性标签。\n\n"
                + "【修改边界（必须执行）】\n"
                + "1. 只允许为解决“章节质量评估结果”中的 issues（问题列表）而修改原文。\n"
                + "2. 对未被 issues 直接涉及的句子与段落，必须尽量逐字保持原样，禁止顺手润色、改写、扩写或重排。\n"
                + "3. 如必须补写内容，只能用于落实 issues 的具体建议，长度尽可能短，优先在原段落附近最小插入。\n"
                + "4. 禁止无关改动：不得新增/删除关键剧情事件、人物关系与设定信息；除非 issues 明确指出矛盾或章纲偏离需要修正。\n\n"
                + "【章节写作原则摘要】\n"
                + "1. 每章必须围绕本章目标和冲突展开，避免无意义灌水。\n"
                + "2. 每章要推动主线或重要支线至少向前迈出一个清晰的台阶。\n"
                + "3. 戏剧张力要足：冲突、反转、压力与释放要有起伏，避免平铺直叙。\n"
                + "4. 人物行为和情绪必须符合其既有性格与经历，不能为了剧情强行降智或强行推进。\n"
                + "5. 文本表达要口语化、易读，多用对话、动作和环境互动承载信息。\n"
                + "6. 段落之间要有自然过渡，通过环境、动作或心理变化衔接，不要生硬跳切。\n"
                + "7. 本章开头要快速给出情境或矛盾，中段推进事件，结尾制造悬念、转折或情绪高潮。\n"
                + "8. 必须保证世界观与设定前后一致，不出现明显的时间线、人物关系或能力体系自相矛盾。\n"
                + "9. 章纲中的每一个剧情点都应该在正文中有具体呈现，而不是一句话带过。\n"
                + "10. 文本必须为简体中文纯文本输出，不允许 Markdown 标记、场景小标题等格式性标记。\n\n"
                + "【去AI味重写要点】\n"
                + "1. 主动清理论文式连接词（如“首先”“其次”“再者”“总之”“综上所述”“显而易见”等）和翻译腔用语（如“噢”“该死的”“不得不承认”“如同……一般”“看在……的份上”等），改为自然中文口语表达。\n"
                + "2. 删除或改写“与此同时”“画面一转”“值得一提的是”“令人惊讶的是”等空洞过渡句，用空行、镜头切换或场景描写实现过场。\n"
                + "3. 拆分超长段落，控制每段在手机端阅读时不超过 3 行；重要对话一行一个说话人。\n"
                + "4. 将“他很愤怒/很震惊/很感动”一类抽象评价，改写为具体动作、表情、生理反应和环境反馈，强化“Show, Don't Tell”。\n"
                + "5. 在装逼、打脸、逆袭等桥段中，补足路人和反派的反应描写，通过震惊、窃窃私语、表情变化等侧写提升爽点强度。\n\n"
                + "【输入数据】\n"
                + "- 当前章节标题：" + (chapter != null ? String.valueOf(chapter.getTitle()) : "无") + "\n"
                + "- 当前章节概述：" + (chapter != null ? String.valueOf(chapter.getSummary()) : "无") + "\n"
                + "- 原始章节内容（可能已截断）：\n"
                + (truncatedOriginal.isEmpty() ? "无" : truncatedOriginal) + "\n\n"
                + "- 章纲（Beat Sheet）：\n"
                + (beatSheetContext.isEmpty() ? "无" : beatSheetContext) + "\n\n"
                + "- 分卷大纲：" + (volumeSummary != null ? volumeSummary : "无") + "\n\n"
                + "- 上一章标题：" + (previousChapter != null ? String.valueOf(previousChapter.getTitle()) : "无") + "\n"
                + "- 上一章结尾片段：" + (previousChapter != null && previousChapter.getContent() != null ? (previousChapter.getContent().length() > 500 ? previousChapter.getContent().substring(previousChapter.getContent().length() - 500) : previousChapter.getContent()) : "无") + "\n\n"
                + "- 未兑现伏笔列表（在重写时可选择性推进或兑现）：\n"
                + foreshadowingContext + "\n\n"
                + "- 全局设定（世界观/人物）：\n"
                + (globalLore != null ? globalLore : "无") + "\n\n"
                + "- 核心设定总览（主角/反派档案、世界观、全书终极目标）：\n"
                + coreSettingsContext + "\n\n"
                + "- 章节质量评估结果（包含打分与不合格点列表）：\n"
                + evaluationJson + "\n\n"
                + "【重写任务】\n"
                + "1. 重点针对评估结果中的 issues（问题列表），逐条思考如何在正文中做最小必要的改写或补写来解决这些问题。\n"
                + "2. 尽量保留原有章节中有价值的桥段、人物瞬间和关键信息；除非 issues 明确要求，否则不要调整顺序、节奏与表现方式。\n"
                + "3. 如果 evaluation 中 worldConsistencyScore 或 outline_mismatch 相关问题较多，请优先修正设定矛盾与章纲偏离。\n"
                + "4. 保证重写后的章节：\n"
                + "   - 整体质量显著高于原稿（especially overallScore > 原稿潜在得分）。\n"
                + "   - 更好地执行章纲与伏笔规划。\n"
                + "   - 章尾拥有更强的悬念或情绪张力。\n"
                + "5. 如果 instruction 中有额外要求，只能在不超出 issues 范围且不违反“修改边界”的前提下考虑。\n\n"
                + "【输出格式】\n"
                + "直接输出重写后的小说正文纯文本，段落之间空一行，不要附加任何说明性文字。";
        String user = (instruction != null && !instruction.trim().isEmpty())
                ? ("请按上述“修改边界（必须执行）”仅针对 issues 做最小必要修订，并在不超出 issues 范围的前提下满足以下额外要求：\n" + instruction)
                : "请按上述“修改边界（必须执行）”仅针对 issues 做最小必要修订，直接输出修订后的正文。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "rewrite-chapter", user, null, currentPlatform);
        String clean = content != null ? content.replaceAll("```(text|markdown)?\\n?|\\n?```", "").trim() : "";
        return success(clean);
    }

    @PostMapping("/parse-command")
    public CommonResult<JsonNode> parseCommand(@RequestBody AiParseCommandReqVO reqVO) throws Exception {
        
        String instruction = reqVO.getInstruction();
        Object context = reqVO.getContext();
        String ctxJson = context != null ? mapper.writeValueAsString(context) : "{}";
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "你是一个小说写作工具的 AI 指令解析器。\n"
                + "    你的任务是分析用户的自然语言指令，并将其转换为结构化的 JSON 命令。\n"
                + "    \n"
                + "    可用数据 (Available Data):\n"
                + "    " + ctxJson + "\n"
                + "    \n"
                + "    注意：'previous_messages' 包含对话历史。\n"
                + "    关键：如果用户的指令引用了之前的建议（例如“接受你的建议”、“按你说的改”），你必须查看 'previous_messages' 找到具体的细节（如新标题、新摘要），并将其包含在 'params' 中。\n"
                + "    \n"
                + "    支持的操作 (Supported Actions):\n"
                + "    1. modify_metadata: 修改标题、摘要或属性。\n"
                + "    2. rewrite_content: 重写章节或设定的正文内容，或者对设定进行复杂的综合修改（如包含删除、合并等建议的落实）。\n"
                + "    3. create_lore: 创建新角色/地点/物品。\n"
                + "    \n"
                + "    当 action 为 \\\"create_lore\\\" 且用户是在「新增角色/人物」时，必须遵守以下规则：\n"
                + "    - scope.type 一律设为 \\\"lore\\\"。\n"
                + "    - 在 params 中补充结构化信息，至少包含：\n"
                + "      - \\\"type\\\": \\\"character\\\"\n"
                + "      - \\\"names\\\": string[]，从指令中提取所有需要新建的角色姓名，例如 [\\\"许清源\\\"]。如果只出现一个名字，则数组只包含该名字。\n"
                + "      - \\\"title\\\": 如果只涉及单个角色，可以等同于该角色姓名。\n"
                + "    - 如果用户的描述中已经包含了对该角色的身份、功能、作用、出场方式等说明，你需要据此生成一个完整的人物档案文本，写入 params.content 字段。\n"
                + "      - params.content 必须使用简体中文，采用如下 Markdown 结构示例（注意这里只是格式示意，实际内容需根据用户描述合理发挥）：\n"
                + "        \\\"# 角色名\n"
                + "        \n"
                + "        - **年龄**：X\n"
                + "        - **性别**：X\n"
                + "        - **身份**：X\n"
                + "        \n"
                + "        ## 性格特征\n"
                + "        ...\n"
                + "        \n"
                + "        ## 外貌描写\n"
                + "        ...\n"
                + "        \n"
                + "        ## 背景故事\n"
                + "        ...\n"
                + "        \n"
                + "        ## 金手指/能力\n"
                + "        ...\\\"\n"
                + "      - 内容应尽量详细自然，可适度补全合理细节，但必须符合用户给出的描述与定位，不得违背设定。\n"
                + "      - 通常用户一次只会新增一个角色；如果同时新增多个角色，请仍然将 names 中列出所有姓名，但 params.content 只需为当前指令中最重要的那个角色生成完整档案文本。\n"
                + "    \n"
                + "    响应格式 (Strict JSON):\n"
                + "    {\n"
                + "      \\\"action\\\": \\\"modify_metadata\\\" | \\\"rewrite_content\\\" | \\\"create_lore\\\" | \\\"unknown\\\",\n"
                + "      \\\"scope\\\": {\n"
                + "        \\\"type\\\": \\\"chapter\\\" | \\\"lore\\\" | \\\"project\\\",\n"
                + "        \\\"ids\\\": [\\\"id1\\\", \\\"id2\\\"], // 如果提到或暗示了特定项目（如“第一章”、“所有章节”）\n"
                + "        \\\"filter\\\": \\\"description\\\" // 可选的范围描述\n"
                + "      },\n"
                + "      \\\"instruction\\\": \\\"实际应用于内容/元数据的具体指令（必须使用简体中文）\\\",\n"
                + "      \\\"params\\\": { ... } // 可选的键值对，如 \\\"new_title\\\": \\\"...\\\"\n"
                + "    }\n"
                + "    \n"
                + "    规则:\n"
                + "    - 如果用户说“把第一章标题改为‘开始’”，action 是 \\\"modify_metadata\\\"，scope.ids 是 [\\\"c...\\\"]，params 是 {\\\"new_title\\\": \\\"开始\\\"}。\n"
                + "    - 如果用户说“修改内容”、“重写”、“润色”、“改一下正文”，action 必须是 \\\"rewrite_content\\\"。绝不要用 \\\"modify_metadata\\\" 来修改正文。\n"
                + "    - 如果用户说“把第一章和第二章重写得更有趣”，action 是 \\\"rewrite_content\\\"，scope.ids 是 [\\\"c...\\\", \\\"c...\\\"]，instruction 是 \\\"让内容更有趣\\\"。\n"
                + "    - 如果用户指令包含多个动作（如删除、合并、修改等复杂操作），或者针对设定集进行综合性修改，请将其解析为 \\\"rewrite_content\\\"，scope.type 为 \\\"lore\\\"，并在 instruction 中包含完整的修改建议（例如“删除xx角色，合并xx与xx”）。\n"
                + "    - 如果用户说“修改所有章节...”，scope.ids 应包含所有章节 ID。\n"
                + "    - ID 必须准确。\n"
                + "    - **重要：** \\\"instruction\\\" 字段必须总是使用**简体中文**，即使用户输入的是英文或其他语言。\n";
        String user = String.valueOf(instruction);
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "parse-command", user, null, currentPlatform);
        JsonNode node = toJson(content);
        return success(node);
    }

    @PostMapping("/suggest-plot-characters")
    public CommonResult<JsonNode> suggestPlotCharacters(@RequestBody AiSuggestPlotCharactersReqVO reqVO) throws Exception {
        
        String plotTitle = reqVO.getPlotTitle();
        String plotSummary = reqVO.getPlotSummary();
        List<AiSuggestPlotCharactersReqVO.CharacterItem> characters = reqVO.getCharacters();
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        StringBuilder charList = new StringBuilder();
        if (characters != null) {
            for (AiSuggestPlotCharactersReqVO.CharacterItem c : characters) {
                charList.append(c.getName()).append(" (ID: ").append(c.getId()).append(", 身份: ").append(c.getRole()).append(")\n简介: ").append(c.getContent() != null ? c.getContent() : "无").append("\n---\n");
            }
            if (charList.length() >= 4) charList.setLength(charList.length() - 4);
        }
        String system = "你是一位专业的导演兼编剧。你的任务是根据剧情梗概，从演员表中挑选适合出场的角色。\n\n"
                + "### 规则\n"
                + "1. **必须包含**：剧情中明确提到名字的角色。\n"
                + "2. **逻辑推断**：\n"
                + "   - 如果剧情涉及某方势力（如“反抗军”），请加入该势力的成员。\n"
                + "   - 如果是日常场景，请加入主角的亲友/死党。\n"
                + "   - 如果是战斗场景，请加入敌对势力的反派/打手。\n"
                + "3. **宁滥勿缺**：如果剧情含糊，请根据角色的【身份】进行匹配，列出**所有**可能在场的角色。\n"
                + "4. **输出格式**：只返回一个 JSON 对象，包含 \\\"characterIds\\\" 数组。\n\n"
                + "### 演员表\n"
                + charList;
        String user = "### 剧情标题：" + String.valueOf(plotTitle) + "\n### 剧情梗概：\n" + String.valueOf(plotSummary) + "\n\n请列出本场戏的出场角色 ID。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "suggest-plot-characters", user, null, currentPlatform);
        JsonNode node = toJson(content);
        JsonNode data = node.has("characterIds") ? node.get("characterIds") : node;
        return success(data);
    }

    @PostMapping("/suggest-chapters")
    public CommonResult<JsonNode> suggestChapters(@RequestBody AiSuggestChaptersReqVO reqVO) throws Exception {
        
        String volumeTitle = reqVO.getVolumeTitle();
        String volumeSummary = reqVO.getVolumeSummary();
        List<String> existingChapters = reqVO.getExistingChapters();
        String context = reqVO.getContext();
        Integer count = reqVO.getCount();
        Integer previousChapterCount = reqVO.getPreviousChapterCount();
        Integer startIndexProvided = reqVO.getStartIndex();
        int existingCount = existingChapters != null ? existingChapters.size() : 0;
        int startIndex = startIndexProvided != null ? startIndexProvided : ((previousChapterCount != null ? previousChapterCount : 0) + existingCount);
        int n = count != null && count > 0 ? count : 5;
        ChatModel chat = aiModelFactory.getDefaultChatModel(currentPlatform);
        String system = "### 角色设定\n"
                + "你是一位资深网文主编。你的任务是根据分卷大纲和小说设定，规划后续的章节。\n\n"
                + "### 核心逻辑\n"
                + "1. **大纲遵循**：仔细分析【分卷大纲】。如果大纲中包含了尚未写的章节规划（已有章节列表之外的），请**直接提取**并填入。请忠实还原大纲中的标题和剧情点。\n"
                + "2. **强制重编号**：无论大纲中的章节序号是多少（例如“第101章”），你**必须**根据当前的【起始章节索引】重新编号。\n"
                + "3. **智能续写**：只有当大纲内容已耗尽或大纲未覆盖时，才允许根据【小说设定】和【已有章节】的剧情走向进行智能创作。\n"
                + "4. **补全信息**：\n"
                + "   - 有标题无概述 -> 生成概述\n"
                + "   - 有概述无标题 -> 生成标题\n"
                + "   - 无标题无概述 -> 生成两者\n\n"
                + "### 约束条件\n"
                + "1. **语言**：简体中文。\n"
                + "2. **格式**：JSON 数组。\n"
                + "3. **数量**：规划 " + n + " 章。\n"
                + "4. **概述要求**：500字以内，尽量忠实大纲原文，点明核心冲突或爽点。\n"
                + "5. **章节序号约束**：当前已有 " + startIndex + " 章。你规划的第一章**必须是第 " + (startIndex + 1) + " 章**。\n"
                + "6. **严禁跳号**：忽略大纲中的原始序号。你的任务是按顺序填充章节。如果大纲中有“第101章”的内容，但当前需要第26章，且中间没有其他大纲内容，那么这“第101章”的内容就是第26章的内容（可能是大纲序号写错了，或者是相对序号）。请按顺序提取大纲中的下一个剧情点作为下一章。\n"
                + "7. **总纲绑定**：如果“小说设定”中包含全书总纲，请优先从总纲中匹配【当前分卷】（根据标题或序号），将该卷的摘要视为本分卷的大纲进行规划。\n\n"
                + "### 输出结构\n"
                + "{\n"
                + "  \\\"chapters\\\": [\n"
                + "    {\n"
                + "      \\\"title\\\": \\\"章节标题（不含序号，例如：风云再起）\\\",\n"
                + "      \\\"summary\\\": \\\"章节剧情简述\\\",\n"
                + "      \\\"reason\\\": \\\"来源说明（如：提取自大纲 / AI续写）\\\"\n"
                + "    }\n"
                + "  ]\n"
                + "}";
        String existingStr = existingChapters != null && !existingChapters.isEmpty() ? String.join(", ", existingChapters) : "无（从第一章开始）";
        String user = "分卷标题：" + String.valueOf(volumeTitle) + "\n分卷大纲：" + (volumeSummary != null ? volumeSummary : "无") + "\n已有章节：" + existingStr + "\n起始章节索引：" + startIndex + "（请从第 " + (startIndex + 1) + " 章开始）\n小说设定/全书总纲：" + (context != null ? context : "无") + "\n\n请规划接下来的 " + n + " 章。";
        String content = callAndLog(chat, new Prompt(List.of(new SystemMessage(system), new UserMessage(user))), "suggest-chapters", user, null, currentPlatform);
        JsonNode node = toJson(content);
        JsonNode data;
        if (node.isArray()) {
            data = node;
        } else if (node.has("chapters")) {
            data = node.get("chapters");
        } else if (node.has("titles")) {
            data = node.get("titles");
        } else {
            data = node;
        }
        return success(data);
    }

    private JsonNode toJson(String content) throws Exception {
        String s = content != null ? content : "";
        s = s.replaceAll("```json\\n?|\\n?```", "").trim();
        String clean = s.isEmpty() ? "{}" : s;
        try {
            return mapper.readTree(clean.isEmpty() ? "{}" : clean);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            log.error(clean);
            return mapper.readTree(clean);
        }
    }

}
