package cn.hb.wk.service.importing;

import cn.hb.wk.dal.dataobject.project.NovelChapterDO;
import cn.hb.wk.dal.dataobject.project.NovelProjectDO;
import cn.hb.wk.dal.dataobject.project.NovelVolumeDO;
import cn.hb.wk.dal.mysql.project.NovelChapterMapper;
import cn.hb.wk.dal.mysql.project.NovelProjectMapper;
import cn.hb.wk.dal.mysql.project.NovelVolumeMapper;
import cn.hb.wk.service.project.LoreWriteAdapter;
import cn.hb.wk.ai.core.model.AiModelFactory;
import cn.hb.wk.model.AiPlatformEnum;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import cn.hb.wk.util.AiUtils;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@Validated
public class ImportServiceImpl implements ImportService {
    private final Map<String, ImportService.Progress> tasks = new ConcurrentHashMap<>();
    private static final List<String> DEFAULT_STEPS = Arrays.asList(
            "parse",
            "generate_outline",           // 大纲与规划 - 主线冲突
            "generate_volume_summary",   // 分卷摘要 - 每个分卷单独生成
            "generate_core",              // 核心设定 - 主角/反派/世界观
            "generate_world_basics",      // 世界与规则 - 背景/力量/势力
            "generate_plot_structure",    // 剧情架构 - 钩子/转折
            "generate_narrative",        // 叙事策略 - 文风基调
            "generate_characters"         // 角色
    );

    @Resource
    private NovelProjectMapper projectMapper;
    @Resource
    private NovelVolumeMapper volumeMapper;
    @Resource
    private NovelChapterMapper chapterMapper;
    @Resource
    private LoreWriteAdapter loreWriteAdapter;
    @Resource
    private AiModelFactory aiModelFactory;
    @Value("${spring.ai.dashscope.api-key:}")
    private String apiKey;

    @Value("${novel.ai.platform:TONG_YI}")
    private String aiPlatformProperty;
    private volatile AiPlatformEnum currentPlatform;

    private String uploadToBailian(String content) throws Exception {

        java.io.File tempFile = java.io.File.createTempFile("novel_context_", ".txt");
        cn.hutool.core.io.FileUtil.writeUtf8String(content, tempFile);
        try {
            cn.hutool.http.HttpResponse response = cn.hutool.http.HttpRequest.post("https://dashscope.aliyuncs.com/compatible-mode/v1/files")
                    .header("Authorization", "Bearer " + apiKey)
                    .form("purpose", "file-extract")
                    .form("file", tempFile)
                    .execute();
            if (!response.isOk()) {
                throw new RuntimeException("上传文件到百炼失败: " + response.body());
            }
            JsonNode json = new ObjectMapper().readTree(response.body());
            return json.get("id").asText();
        } finally {
            tempFile.delete();
        }
    }

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

    private String getNovelContext(Long projectId, int limit) {
        // 获取前3章内容作为上下文
        List<NovelChapterDO> chapters = chapterMapper.selectList("project_id", projectId);
        if (chapters == null || chapters.isEmpty()) {
            return "（无正文内容）";
        }
        // 按 orderIndex 排序
        chapters.sort((a, b) -> Integer.compare(a.getOrderIndex(), b.getOrderIndex()));
        StringBuilder sb = new StringBuilder();
        for (NovelChapterDO ch : chapters) {
            if (sb.length() >= limit) break;
            sb.append("### ").append(ch.getTitle()).append("\n");
            sb.append(ch.getContent()).append("\n\n");
        }
        if (sb.length() > limit) {
            return sb.substring(0, limit) + "...(截断)";
        }
        return sb.toString();
    }

    @PostConstruct
    void init() {
    }

    @Override
    public String startImport(String type, String content, String fileName) {
        String id = UUID.randomUUID().toString();
        ImportService.Progress p = new ImportService.Progress();
        p.setTaskId(id);
        p.setJobId(id);
        p.setProjectId(null);
        p.setStep(0);
        p.setTotal(DEFAULT_STEPS.size());
        p.setSteps(DEFAULT_STEPS);
        p.setCurrentStep(DEFAULT_STEPS.get(0));
        p.setStatus("running");
        p.setMessage("导入任务已创建，当前步骤 parse");
        p.setError(null);
        p.setFinishedSteps(new ArrayList<>());
        tasks.put(id, p);

        try {
            String fileId = uploadToBailian(content);
            Long projectId = createProjectFromText(type, content, fileName, fileId);
            p.setProjectId(projectId);
            p.setStep(1);
            p.setCurrentStep(DEFAULT_STEPS.size() > 1 ? DEFAULT_STEPS.get(1) : "complete");
            p.setStatus(DEFAULT_STEPS.size() > 1 ? "running" : "completed");
            p.setMessage("已解析并创建项目，projectId=" + projectId);
        } catch (Exception e) {
            p.setStatus("error");
            p.setError(e.getMessage());
            p.setMessage("解析或落库失败");
        }
        return id;
    }

    @Override
    public ImportService.Progress getProgress(String taskId) {
        ImportService.Progress p = tasks.get(taskId);
        if (p == null) {
            ImportService.Progress notFound = new ImportService.Progress();
            notFound.setTaskId(taskId);
            notFound.setStep(0);
            notFound.setTotal(DEFAULT_STEPS.size());
            notFound.setStatus("not_found");
            notFound.setMessage("任务不存在");
            return notFound;
        }
        return p;
    }

    @Override
    public ImportService.Progress next(String taskId, Boolean force) {
        ImportService.Progress p = tasks.get(taskId);
        if (p == null) {
            ImportService.Progress notFound = new ImportService.Progress();
            notFound.setTaskId(taskId);
            notFound.setStep(0);
            notFound.setTotal(DEFAULT_STEPS.size());
            notFound.setStatus("not_found");
            notFound.setMessage("任务不存在");
            return notFound;
        }
        int stepIndex = p.getStep() != null ? p.getStep() : 0;
        int total = p.getTotal() != null ? p.getTotal() : DEFAULT_STEPS.size();
        List<String> steps = p.getSteps() != null ? p.getSteps() : DEFAULT_STEPS;
        if (stepIndex < total) {
            String finished = steps.get(stepIndex);
            java.util.List<String> done = p.getFinishedSteps();
            if (done == null) {
                done = new ArrayList<>();
                p.setFinishedSteps(done);
            }
            boolean alreadyDone = done.contains(finished);
            if ("error".equals(p.getStatus()) && Boolean.TRUE.equals(force)) {
                if (!alreadyDone) {
                    done.add(finished);
                }
                p.setError(null);
                p.setStatus("running");
                p.setMessage("忽略错误，继续推进");
            } else if (!alreadyDone && p.getProjectId() != null) {
                try {
                    NovelProjectDO projectDO = projectMapper.selectById(p.getProjectId());
                    String fileId = projectDO != null ? projectDO.getFileId() : null;
                    if (fileId == null) {
                        String novelContext = getNovelContext(p.getProjectId(), 30000); // 30k context
                        fileId = uploadToBailian(novelContext);
                        if (projectDO != null) {
                            projectDO.setFileId(fileId);
                            projectMapper.updateById(projectDO);
                        }
                    }

                    com.alibaba.cloud.ai.dashscope.chat.DashScopeChatOptions options = com.alibaba.cloud.ai.dashscope.chat.DashScopeChatOptions.builder()
                            .withModel("qwen-long")
                            .build();

                    if ("generate_outline".equals(finished)) {
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.TONG_YI);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深主编。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。JSON 格式：{\"summary\":\"全书总纲\",\"mainConflict\":\"主线冲突\",\"hooks\":[\"钩子1\",\"钩子2\"],\"twists\":[\"转折1\",\"转折2\"]}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n请根据上传的文档内容生成：1)全书总纲 2)主线冲突 3)情节钩子(列表) 4)剧情转折(列表)。全部输出到一个JSON中。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new SystemMessage("fileid://" + fileId), new UserMessage(user)), options));
                        String content = AiUtils.getChatResponseContent(response);
                        JsonNode node = toJson(content);

                        // 1. 保存剧情大纲
                        String summary = node != null && node.has("summary") ? String.valueOf(node.get("summary").asText()) : "总纲";
                        loreWriteAdapter.writeLore(p.getProjectId(), "outline", "主大纲", summary, content);

                        // 3. 钩子 - 存到 plot 类型
                        if (node != null && node.has("hooks") && node.get("hooks").isArray()) {
                            String hooksContent = node.get("hooks").toString();
                            loreWriteAdapter.writeLore(p.getProjectId(), "plot", "钩子", "情节钩子", "{\"hooks\":" + hooksContent + "}");
                        }

                        // 4. 转折 - 存到 plot 类型
                        if (node != null && node.has("twists") && node.get("twists").isArray()) {
                            String twistsContent = node.get("twists").toString();
                            loreWriteAdapter.writeLore(p.getProjectId(), "plot", "转折", "剧情转折", "{\"twists\":" + twistsContent + "}");
                        }

                        p.setGeneratedCount(1);
                        p.setGeneratedType("outline");
                    } else if ("generate_volume_summary".equals(finished)) {
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.TONG_YI);
                        List<NovelVolumeDO> vols = volumeMapper.selectList("project_id", p.getProjectId());
                        int count = 0;
                        if (vols != null && !vols.isEmpty()) {
                            // 处理所有分卷
                            for (NovelVolumeDO vol : vols) {
                                try {
                                    String system = "你是网文编辑。请根据正文片段为当前分卷撰写简短摘要（200字以内）。直接输出摘要内容，不要其他说明。";
                                    String user = "分卷名：" + vol.getTitle() + "\n\n请根据上传的文档为当前分卷撰写简短摘要。";
                                    ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new SystemMessage("fileid://" + fileId), new UserMessage(user)), options));
                                    String summary = AiUtils.getChatResponseContent(response);
                                    if (summary != null && !summary.isEmpty()) {
                                        vol.setSummary(summary.trim());
                                        volumeMapper.updateById(vol);
                                        count++;
                                    }
                                } catch (Exception e) {
                                    log.error("Volume summary generation failed for " + vol.getTitle() + ": " + e.getMessage());
                                }
                            }
                        }
                        // 如果没有生成任何摘要，创建默认提示
                        if (count == 0 && vols != null && !vols.isEmpty()) {
                            for (NovelVolumeDO vol : vols) {
                                vol.setSummary("（待生成）");
                                volumeMapper.updateById(vol);
                            }
                            count = vols.size();
                        }
                        p.setGeneratedCount(count);
                        p.setGeneratedType("volume_summary");
                    } else if ("generate_core".equals(finished)) {
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.TONG_YI);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深设定师。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。\n"
                                + "JSON 格式：\n"
                                + "{\n"
                                + "  \"protagonist\": { \"name\": \"姓名\", \"gender\": \"性别\", \"age\": \"年龄\",  \"personality\": \"核心性格\", \"cheat\": \"金手指/核心能力\" },\n"
                                + "  \"antagonist\": { \"name\": \"姓名/代号\", \"role\": \"身份/定位\", \"personality\": \"性格与动机\" }\n"
                                + "}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n请根据上传的文档提取核心设定（主角、反派）并输出 JSON。其中主角必须包含金手指（cheat）设定。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new SystemMessage("fileid://" + fileId), new UserMessage(user)), options));
                        String content = AiUtils.getChatResponseContent(response);
                        JsonNode node = toJson(content);
                        int count = 0;
                        if (node != null) {
                            if (node.has("protagonist")) {
                                JsonNode pNode = node.get("protagonist");
                                String pName = pNode.has("name") ? pNode.get("name").asText() : "主角";
                                StringBuilder pContent = new StringBuilder();
                                if (pNode.has("name")) pContent.append("姓名：").append(pNode.get("name").asText()).append("\n");
                                if (pNode.has("gender")) pContent.append("性别：").append(pNode.get("gender").asText()).append("\n");
                                if (pNode.has("age")) pContent.append("年龄：").append(pNode.get("age").asText()).append("\n");
                                if (pNode.has("personality")) pContent.append("性格：").append(pNode.get("personality").asText()).append("\n");
                                if (pNode.has("cheat")) pContent.append("外挂：").append(pNode.get("cheat").asText());
                                loreWriteAdapter.writeLore(p.getProjectId(), "protagonist", "主角：" + pName, pContent.toString().trim(), toJsonString(pNode));
                                count++;
                            }
                            if (node.has("antagonist")) {
                                JsonNode aNode = node.get("antagonist");
                                String aName = aNode.has("name") ? aNode.get("name").asText() : "反派";
                                StringBuilder aContent = new StringBuilder();
                                if (aNode.has("name")) aContent.append("名称：").append(aNode.get("name").asText()).append("\n");
                                if (aNode.has("role")) aContent.append("角色：").append(aNode.get("role").asText()).append("\n");
                                if (aNode.has("personality")) aContent.append("性格/动机：").append(aNode.get("personality").asText());
                                loreWriteAdapter.writeLore(p.getProjectId(), "antagonist", "反派：" + aName, aContent.toString().trim(), toJsonString(aNode));
                                count++;
                            }
                        }
                        // 如果 AI 没有成功生成核心设定，创建空的默认记录，确保前端能显示
                        if (count == 0) {
                            // 创建空的 protagonist
                            String emptyProtagonist = "{\"name\":\"\",\"gender\":\"\",\"age\":\"\",\"personality\":\"\",\"cheat\":\"\"}";
                            loreWriteAdapter.writeLore(p.getProjectId(), "protagonist", "主角", "主角设定（待完善）", emptyProtagonist);
                            count++;
                            // 创建空的 antagonist
                            String emptyAntagonist = "{\"name\":\"\",\"role\":\"\",\"personality\":\"\"}";
                            loreWriteAdapter.writeLore(p.getProjectId(), "antagonist", "反派", "反派设定（待完善）", emptyAntagonist);
                            count++;
                        }
                        p.setGeneratedCount(count);
                        p.setGeneratedType("core");
                    } else if ("generate_world_basics".equals(finished)) {
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.TONG_YI);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深网文策划。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。\n"
                                + "JSON 格式：\n"
                                + "{\n"
                                + "  \"world\": { \"background\": \"世界背景描述\", \"power_system\": \"力量体系描述\", \"forces\": \"势力分布描述\" }\n"
                                + "}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n请根据上传的文档生成完整的世界观设定：1)世界背景 2)力量体系 3)势力分布 4)当前时空背景。全部输出到一个JSON的world对象中。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new SystemMessage("fileid://" + fileId), new UserMessage(user)), options));
                        String content = AiUtils.getChatResponseContent(response);
                        JsonNode node = toJson(content);
                        int count = 0;

                        if (node != null && node.has("world")) {
                            JsonNode wNode = node.get("world");
                            // 构建完整的world JSON
                            java.util.Map<String, String> worldMap = new java.util.HashMap<>();
                            if (wNode.has("background")) {
                                worldMap.put("background", wNode.get("background").asText());
                            }
                            if (wNode.has("power_system")) {
                                worldMap.put("powerSystem", wNode.get("power_system").asText());
                            }
                            if (wNode.has("forces")) {
                                worldMap.put("forces", wNode.get("forces").asText());
                            }

                            // 创建一个综合的世界观设定
                            String worldContent = worldMap.containsKey("background") ? worldMap.get("background") : "世界观设定";
                            if (worldMap.containsKey("powerSystem") && !worldMap.get("powerSystem").isEmpty()) {
                                worldContent += "\n\n【力量体系】" + worldMap.get("powerSystem");
                            }
                            if (worldMap.containsKey("forces") && !worldMap.get("forces").isEmpty()) {
                                worldContent += "\n\n【势力分布】" + worldMap.get("forces");
                            }

                            // 写入单一的world lore，包含所有字段
                            loreWriteAdapter.writeLore(p.getProjectId(), "world", "世界观设定", worldContent, toJsonStr(worldMap));
                            count++;
                        }

                        // 如果没有生成，创建空的
                        if (count == 0) {
                            String emptyWorld = "{\"background\":\"\",\"powerSystem\":\"\",\"forces\":\"\"}";
                            loreWriteAdapter.writeLore(p.getProjectId(), "world", "世界观设定", "世界观设定（待完善）", emptyWorld);
                            count = 1;
                        }
                        p.setGeneratedCount(count);
                        p.setGeneratedType("world_basics");
                    } else if ("generate_plot_structure".equals(finished)) {
                        // 剧情架构 - 钩子、转折等
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.TONG_YI);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深网文策划。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。\n"
                                + "JSON 格式：\n"
                                + "{\n"
                                + "  \"hooks\": [\"钩子1描述\", \"钩子2描述\"],\n"
                                + "  \"twists\": [\"转折1描述\", \"转折2描述\"],\n"
                                + "  \"foreshadowing\": [\"伏笔1\", \"伏笔2\"]\n"
                                + "}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n请根据上传的文档分析并生成：1)情节钩子 2)剧情转折 3)伏笔埋设。全部输出到一个JSON中。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new SystemMessage("fileid://" + fileId), new UserMessage(user)), options));
                        String content = AiUtils.getChatResponseContent(response);
                        JsonNode node = toJson(content);
                        int count = 0;

                        if (node != null) {
                            // 钩子
                            if (node.has("hooks") && node.get("hooks").isArray()) {
                                String hooksJson = node.get("hooks").toString();
                                loreWriteAdapter.writeLore(p.getProjectId(), "plot", "钩子", hooksJson, "{\"hooks\":" + hooksJson + "}");
                                count++;
                            }
                            // 转折
                            if (node.has("twists") && node.get("twists").isArray()) {
                                String twistsJson = node.get("twists").toString();
                                loreWriteAdapter.writeLore(p.getProjectId(), "plot", "转折", twistsJson, "{\"twists\":" + twistsJson + "}");
                                count++;
                            }
                            // 伏笔
                            if (node.has("foreshadowing") && node.get("foreshadowing").isArray()) {
                                String foreshadowingJson = node.get("foreshadowing").toString();
                                loreWriteAdapter.writeLore(p.getProjectId(), "plot", "伏笔", foreshadowingJson, "{\"foreshadowing\":" + foreshadowingJson + "}");
                                count++;
                            }
                        }

                        // 如果没有生成，创建空的
                        if (count == 0) {
                            loreWriteAdapter.writeLore(p.getProjectId(), "plot", "钩子", "情节钩子（待完善）", "{\"hooks\":[]}");
                            loreWriteAdapter.writeLore(p.getProjectId(), "plot", "转折", "剧情转折（待完善）", "{\"twists\":[]}");
                            count = 2;
                        }
                        p.setGeneratedCount(count);
                        p.setGeneratedType("plot_structure");
                    } else if ("generate_narrative".equals(finished)) {
                        // 叙事策略 - 文风基调
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.TONG_YI);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深网文策划。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。\n"
                                + "JSON 格式：\n"
                                + "{\n"
                                + "  \"style\": \"文风基调，示例：严肃、幽默、暗黑、热血、轻松、悲剧...\",\n"
                                + "  \"tags\": [\"核心元素/标签，示例：职场、社会、奋斗、克苏鲁...\"],\n"
                                + "  \"genre\": \"主要题材，示例：玄幻、科幻、都市、悬疑、历史、游戏、仙侠...\""
                                + "}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n请根据上传的文档分析并生成：1)文风基调 2)核心元素/标签 3)主要题材。全部输出到一个JSON中。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new SystemMessage("fileid://" + fileId), new UserMessage(user)), options));
                        String content = AiUtils.getChatResponseContent(response);
                        JsonNode node = toJson(content);

                        if (node != null) {
                            NovelProjectDO projectUpdate = new NovelProjectDO();
                            projectUpdate.setId(p.getProjectId());
                            // 文风基调 - 存到 narrative 类型
                            if (node.has("style")) {
                                String style = node.get("style").asText();
                                projectUpdate.setStyle(style);
                            }
                            // 节奏特点
                            if (node.has("tags")) {
                                String tags = node.get("tags").toString().replace("[","").replace("]","");
                                projectUpdate.setTags(tags);
                            }
                            // 核心元素
                            if (node.has("genre")) {
                                String genre = node.get("genre").asText();
                                projectUpdate.setGenre(genre);
                            }
                            projectMapper.updateById(projectUpdate);

                        }

                    } else if ("generate_characters".equals(finished)) {
                        // 一次性提取所有重要角色详情
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.TONG_YI);
                        String title = getProjectTitle(p.getProjectId());

                        String system = "你是角色分析专家。请从小说正文中提取所有重要角色（最多20个，优先出场与剧情占比大的角色）的详细档案，不要包含作品的主角和主要反派，因为他们已经被单独记录了。\n"
                                + "必须严格使用简体中文，直接输出 JSON 数组，禁止包裹在对象中。\n"
                                + "JSON 格式示例：\n"
                                + "[\n"
                                + "  {\"name\":\"角色姓名\", \"role\":\"身份\", \"gender\":\"性别\", \"age\":\"年龄\", \"personality\":\"性格\", \"appearance\":\"外貌\", \"background\":\"背景\", \"ability\":\"能力\", \"goal\":\"目标\", \"conflict\":\"冲突\", \"relationships\":\"人际关系\", \"description\":\"综合描述\"}\n"
                                + "]";
                        String user = "作品：" + (title != null ? title : "") + "\n\n请根据上传的文档提取并分析重要角色，输出角色详情数组。";

                        int count = 0;
                        try {
                            ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new SystemMessage("fileid://" + fileId), new UserMessage(user)), options));
                            JsonNode node = toJson(AiUtils.getChatResponseContent(response));

                            JsonNode arrayNode = null;
                            if (node != null) {
                                if (node.isArray()) {
                                    arrayNode = node;
                                } else if (node.has("characters") && node.get("characters").isArray()) {
                                    arrayNode = node.get("characters");
                                }
                            }

                            if (arrayNode != null && arrayNode.isArray()) {
                                for (JsonNode charNode : arrayNode) {
                                    String name = charNode.has("name") ? charNode.get("name").asText() : null;
                                    if (name == null || name.length() < 2) continue;

                                    StringBuilder charContent = new StringBuilder();
                                    if (charNode.has("name")) charContent.append("姓名：").append(charNode.get("name").asText()).append("\n");
                                    if (charNode.has("role")) charContent.append("身份：").append(charNode.get("role").asText()).append("\n");
                                    if (charNode.has("gender")) charContent.append("性别：").append(charNode.get("gender").asText()).append("\n");
                                    if (charNode.has("age")) charContent.append("年龄：").append(charNode.get("age").asText()).append("\n");
                                    if (charNode.has("personality")) charContent.append("性格：").append(charNode.get("personality").asText()).append("\n");
                                    if (charNode.has("appearance")) charContent.append("外貌：").append(charNode.get("appearance").asText()).append("\n");
                                    if (charNode.has("background")) charContent.append("背景：").append(charNode.get("background").asText()).append("\n");
                                    if (charNode.has("ability")) charContent.append("能力：").append(charNode.get("ability").asText()).append("\n");
                                    if (charNode.has("goal")) charContent.append("目标：").append(charNode.get("goal").asText()).append("\n");
                                    if (charNode.has("conflict")) charContent.append("冲突：").append(charNode.get("conflict").asText()).append("\n");
                                    if (charNode.has("relationships")) charContent.append("人际关系：").append(charNode.get("relationships").asText()).append("\n");
                                    if (charNode.has("description")) charContent.append("综合描述：").append(charNode.get("description").asText());

                                    String detailContent = charContent.toString().trim();
                                    String jsonContent = toJsonString(charNode);
                                    loreWriteAdapter.writeLore(p.getProjectId(), "character", name, detailContent, jsonContent);
                                    count++;
                                }
                            }
                        } catch (Exception e) {
                            log.error("Character generation failed: " + e.getMessage());
                        }

                        if (count == 0) {
                            loreWriteAdapter.writeLore(p.getProjectId(), "character", "示例角色", "角色简介", "{\"name\":\"示例角色\"}");
                            count = 1;
                        }
                        p.setGeneratedCount(count);
                        p.setGeneratedType("character");
                    }
                    done.add(finished);
                } catch (Exception e) {
                    p.setStatus("error");
                    p.setError(e.getMessage());
                    p.setMessage("生成失败: " + e.getMessage());
                    return p;
                }
            }
            stepIndex++;
            p.setStep(stepIndex);
            if (stepIndex < total) {
                String nextStep = steps.get(stepIndex);
                p.setCurrentStep(nextStep);
                p.setStatus("running");
                String stepName = switch (nextStep) {
                    case "generate_outline" -> "生成大纲";
                    case "generate_volume_summary" -> "生成分卷摘要";
                    case "generate_core" -> "生成核心设定";
                    case "generate_world_basics" -> "生成世界设定";
                    case "generate_plot_structure" -> "生成剧情架构";
                    case "generate_narrative" -> "生成叙事策略";
                    case "generate_characters" -> "提取角色";
                    default -> nextStep;
                };
                p.setMessage("已完成，进入 " + stepName);
            } else {
                p.setCurrentStep("complete");
                p.setStatus("completed");
                p.setMessage("导入流程已全部完成");
            }
            p.setError(null);
        }
        return p;
    }

    @Override
    public Long complete(String taskId) {
        ImportService.Progress p = tasks.get(taskId);
        if (p == null) {
            return null;
        }
        p.setStep(p.getTotal() != null ? p.getTotal() : DEFAULT_STEPS.size());
        p.setCurrentStep("complete");
        p.setStatus("completed");
        p.setMessage("导入任务已手动标记完成");
        p.setError(null);
        return p.getProjectId();
    }

    @Transactional(rollbackFor = Exception.class)
    protected Long createProjectFromText(String type, String content, String fileName, String fileId) {
        String normalized = content != null ? content.replace("\r\n", "\n") : "";
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("导入内容为空");
        }
        String baseTitle = fileName != null ? fileName.replaceAll("\\.[^.]+$", "") : "导入小说";
        LocalDateTime now = LocalDateTime.now();

        NovelProjectDO project = new NovelProjectDO();
        project.setTitle(baseTitle);
        project.setFileId(fileId);
        project.setCreateTime(now);
        project.setUpdateTime(now);
        projectMapper.insert(project);

        List<VolumeBlock> volumes = splitVolumes(normalized);
        if (volumes.isEmpty()) {
            volumes.add(new VolumeBlock(cleanTitle(baseTitle), normalized));
        }

        int vIdx = 1;
        List<Long> volumeIds = new ArrayList<>();
        for (VolumeBlock vb : volumes) {
            NovelVolumeDO vol = new NovelVolumeDO();
            vol.setProjectId(project.getId());
            vol.setTitle(cleanTitle(vb.title()));
            vol.setOrderIndex(vIdx++);
            vol.setCreateTime(now);
            vol.setUpdateTime(now);
            volumeMapper.insert(vol);
            volumeIds.add(vol.getId());

            List<ChapterBlock> chapters = splitChapters(vb.text());
            if (chapters.isEmpty()) {
                chapters = fallbackChunks(vb.text());
            }
            int cIdx = 1;
            for (ChapterBlock cb : chapters) {
                NovelChapterDO ch = new NovelChapterDO();
                ch.setProjectId(project.getId());
                ch.setVolumeId(vol.getId());
                ch.setTitle(cleanTitle(cb.title()));
                ch.setContent(cb.text());
                ch.setOrderIndex(cIdx++);
                ch.setCreateTime(now);
                ch.setUpdateTime(now);
                chapterMapper.insert(ch);
            }
        }
        return project.getId();
    }

    private record VolumeBlock(String title, String text) {}
    private record ChapterBlock(String title, String text) {}
    private String getProjectTitle(Long projectId) {
        NovelProjectDO p = projectMapper.selectById(projectId);
        return p != null ? p.getTitle() : null;
    }
    private JsonNode toJson(String s) {
        try {
            return new ObjectMapper().readTree(s);
        } catch (Exception e) {
            return null;
        }
    }
    private String toJsonString(JsonNode node) {
        try {
            return node != null ? new ObjectMapper().writeValueAsString(node) : null;
        } catch (Exception e) {
            return null;
        }
    }
    private String toJsonStr(Object obj) {
        try {
            return obj != null ? new ObjectMapper().writeValueAsString(obj) : null;
        } catch (Exception e) {
            return null;
        }
    }

    private List<VolumeBlock> splitVolumes(String text) {
        String[] lines = text.split("\n");
        List<VolumeBlock> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        String currentTitle = null;
        // 匹配：第X卷、卷X、# 卷名、Volume X
        String regex = "^\\s*(第[一二三四五六七八九十百千万亿0-9]+[卷部篇幕]|卷\\s*\\d+|#\\s*.*|Volume\\s*\\d+).*$";
        for (String line : lines) {
            String trimmed = line != null ? line.trim() : "";
            if (trimmed.matches(regex)) {
                if (currentTitle != null) {
                    result.add(new VolumeBlock(currentTitle, current.toString().trim()));
                    current.setLength(0);
                }
                currentTitle = trimmed.replaceFirst("^#\\s+", "").trim();
            } else {
                current.append(line).append("\n");
            }
        }
        if (currentTitle != null) {
            result.add(new VolumeBlock(currentTitle, current.toString().trim()));
        }
        return result;
    }

    private List<ChapterBlock> splitChapters(String text) {
        String[] lines = text.split("\n");
        List<ChapterBlock> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        String currentTitle = null;
        // 匹配模式：
        // 1. 第X章/回/节 + 可选标题（如：第五百九十九章 收网）
        // 2. Chapter X / Chapter 第X章
        // 3. ## 章节名
        // 4. 数字+. 或 数字、 开头（如：1. 第一章，500、章节名，1.章节名）
        // 5. 卷X Volume X
        String chapterRegex = "^\\s*(" +
                "第[一二三四五六七八九十百千万亿零0-9]+[章回节]"  // 第X章/回/节（如：第五百九十九章 收网）
                + "|Chapter\\s*\\d+"  // Chapter 1
                + "|##\\s+.+"  // ## 章节名
                + "|\\d+[、.]\\s*.+"  // 1. 第一章 或 1、章节名 或 1.章节名
                + ").*$";

        for (String line : lines) {
            // 去除全角空格和普通空白字符
            String trimmed = line != null ? line.replaceAll("^[\\s\\u3000]+|[\\s\\u3000]+$", "") : "";
            // 忽略过短的行作为标题
            if (trimmed.length() < 2) {
                current.append(line).append("\n");
                continue;
            }
            // 检查是否匹配章节标题模式
            if (trimmed.matches(chapterRegex)) {
                // 如果当前有未保存的章节，保存它
                if (currentTitle != null) {
                    result.add(new ChapterBlock(currentTitle, current.toString().trim()));
                    current.setLength(0);
                }
                // 设置新章节标题
                currentTitle = trimmed.replaceFirst("^##\\s+", "").trim();
            } else {
                current.append(line).append("\n");
            }
        }
        // 保存最后一个章节
        if (currentTitle != null) {
            result.add(new ChapterBlock(currentTitle, current.toString().trim()));
        }
        return result;
    }

    private List<ChapterBlock> fallbackChunks(String text) {
        String[] paras = text.split("\\n\\s*\\n+");
        List<ChapterBlock> result = new ArrayList<>();
        StringBuilder buf = new StringBuilder();
        String title = null;
        int idx = 1;
        for (String p : paras) {
            if (title == null) {
                String firstLine = p.split("\\n")[0].trim();
                title = firstLine.isEmpty() ? ("第" + idx + "章") : firstLine;
            }
            buf.append(p.trim()).append("\n\n");
            if (buf.length() >= 3000) {
                result.add(new ChapterBlock(title, buf.toString().trim()));
                buf.setLength(0);
                title = null;
                idx++;
            }
        }
        if (buf.length() > 0) {
            String t = title != null ? title : ("第" + idx + "章");
            result.add(new ChapterBlock(t, buf.toString().trim()));
        }
        return result;
    }

    private String cleanTitle(String s) {
        if (s == null) return "";
        // 去除：#、第X章、卷X、Chapter X
        String t = s.replaceAll("^#+\\s*", "")
                .replaceFirst("^\\s*第[一二三四五六七八九十百千万亿0-9]+[卷部篇章回节]\\s*", "")
                .replaceFirst("^\\s*卷\\s*\\d+\\s*", "")
                .replaceFirst("^\\s*(Chapter|Volume)\\s*\\d+\\s*", "")
                .replaceAll("[\\u3000\\s]+", " ")
                .replaceAll("^[\\-—·•\\s]+", "")
                .trim();
        if (t.length() > 100) {
            t = t.substring(0, 100).trim();
        }
        return t.isEmpty() ? s.trim() : t; // 如果清洗后为空，保留原标题（去除首尾空）
    }
}
