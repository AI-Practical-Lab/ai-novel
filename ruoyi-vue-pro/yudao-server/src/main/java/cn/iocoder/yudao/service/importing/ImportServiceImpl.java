package cn.iocoder.yudao.service.importing;

import cn.iocoder.yudao.dal.dataobject.project.NovelChapterDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelProjectDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelVolumeDO;
import cn.iocoder.yudao.dal.mysql.project.NovelChapterMapper;
import cn.iocoder.yudao.dal.mysql.project.NovelProjectMapper;
import cn.iocoder.yudao.dal.mysql.project.NovelVolumeMapper;
import cn.iocoder.yudao.service.project.LoreWriteAdapter;
import cn.iocoder.yudao.ai.core.model.AiModelFactory;
import cn.iocoder.yudao.model.AiPlatformEnum;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import cn.iocoder.yudao.util.AiUtils;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.Resource;
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
            Long projectId = createProjectFromText(type, content, fileName);
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
                    String novelContext = getNovelContext(p.getProjectId(), 30000); // 30k context
                    
                    if ("generate_outline".equals(finished)) {
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.DEEP_SEEK);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深主编。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。JSON 格式：{\"summary\":\"全书总纲\",\"conflict\":\"主线冲突\",\"hooks\":[\"钩子1\",\"钩子2\"],\"twists\":[\"转折1\",\"转折2\"]}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n正文试读：\n" + novelContext + "\n\n请根据正文生成：1)全书总纲 2)主线冲突 3)情节钩子(列表) 4)剧情转折(列表)。全部输出到一个JSON中。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new UserMessage(user))));
                        String content = AiUtils.getChatResponseContent(response);
                        JsonNode node = toJson(content);
                        
                        // 1. 保存剧情大纲
                        String summary = node != null && node.has("summary") ? String.valueOf(node.get("summary").asText()) : "总纲";
                        loreWriteAdapter.writeLore(p.getProjectId(), "outline", "剧情大纲", summary, content);
                        
                        // 2. 主线冲突 - 存到 world 类型（作为世界与规则的子集）
                        if (node != null && node.has("conflict")) {
                            String conflict = node.get("conflict").asText();
                            String conflictJson = "{\"mainConflict\":\"" + conflict.replace("\"", "\\\"") + "\"}";
                            loreWriteAdapter.writeLore(p.getProjectId(), "world", "主线冲突", conflict, conflictJson);
                        }
                        
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
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.DEEP_SEEK);
                        List<NovelVolumeDO> vols = volumeMapper.selectList("project_id", p.getProjectId());
                        int count = 0;
                        if (vols != null && !vols.isEmpty()) {
                            // 处理所有分卷
                            for (NovelVolumeDO vol : vols) {
                                try {
                                    String system = "你是网文编辑。请根据正文片段为当前分卷撰写简短摘要（200字以内）。直接输出摘要内容，不要其他说明。";
                                    String user = "分卷名：" + vol.getTitle() + "\n\n正文片段：\n" + novelContext;
                                    ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new UserMessage(user))));
                                    String summary = AiUtils.getChatResponseContent(response);
                                    if (summary != null && !summary.isEmpty()) {
                                        vol.setSummary(summary.trim());
                                        volumeMapper.updateById(vol);
                                        count++;
                                    }
                                } catch (Exception e) {
                                    System.err.println("Volume summary generation failed for " + vol.getTitle() + ": " + e.getMessage());
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
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.DEEP_SEEK);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深设定师。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。\n"
                                + "JSON 格式：\n"
                                + "{\n"
                                + "  \"protagonist\": { \"name\": \"...\", \"role\": \"...\", \"personality\": \"...\", \"description\": \"...\", \"age\": \"...\", \"gender\": \"...\", \"cheat\": \"...\" },\n"
                                + "  \"antagonist\": { \"name\": \"...\", \"role\": \"...\", \"description\": \"...\", \"personality\": \"...\" },\n"
                                + "  \"world\": { \"name\": \"...\", \"description\": \"...\", \"background\": \"...\" }\n"
                                + "}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n正文片段：\n" + novelContext + "\n\n请提取核心设定（主角、反派、世界观）并输出 JSON。其中主角必须包含金手指（cheat）设定。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new UserMessage(user))));
                        String content = AiUtils.getChatResponseContent(response);
                        JsonNode node = toJson(content);
                        int count = 0;
                        if (node != null) {
                            if (node.has("protagonist")) {
                                JsonNode pNode = node.get("protagonist");
                                String pName = pNode.has("name") ? pNode.get("name").asText() : "主角";
                                loreWriteAdapter.writeLore(p.getProjectId(), "protagonist", "主角：" + pName, toJsonString(pNode), toJsonString(pNode));
                                count++;
                            }
                            if (node.has("antagonist")) {
                                JsonNode aNode = node.get("antagonist");
                                String aName = aNode.has("name") ? aNode.get("name").asText() : "反派";
                                loreWriteAdapter.writeLore(p.getProjectId(), "antagonist", "反派：" + aName, toJsonString(aNode), toJsonString(aNode));
                                count++;
                            }
                            if (node.has("world")) {
                                JsonNode wNode = node.get("world");
                                // 强制使用统一标题"世界观设定"，确保后续步骤能合并到同一条记录
                                loreWriteAdapter.writeLore(p.getProjectId(), "world", "世界观设定", toJsonString(wNode), toJsonString(wNode));
                                count++;
                            }
                        }
                        // 如果 AI 没有成功生成核心设定，创建空的默认记录，确保前端能显示
                        if (count == 0) {
                            // 创建空的 protagonist
                            String emptyProtagonist = "{\"name\":\"\",\"role\":\"\",\"personality\":\"\",\"description\":\"\",\"age\":\"\",\"gender\":\"\",\"cheat\":\"\"}";
                            loreWriteAdapter.writeLore(p.getProjectId(), "protagonist", "主角", "主角设定（待完善）", emptyProtagonist);
                            count++;
                            // 创建空的 antagonist
                            String emptyAntagonist = "{\"name\":\"\",\"role\":\"\",\"description\":\"\",\"personality\":\"\"}";
                            loreWriteAdapter.writeLore(p.getProjectId(), "antagonist", "反派", "反派设定（待完善）", emptyAntagonist);
                            count++;
                            // 创建空的 world
                            String emptyWorld = "{\"name\":\"\",\"description\":\"\",\"background\":\"\",\"powerSystem\":\"\",\"forces\":\"\"}";
                            loreWriteAdapter.writeLore(p.getProjectId(), "world", "世界观设定", "世界观设定（待完善）", emptyWorld);
                            count++;
                        }
                        p.setGeneratedCount(count);
                        p.setGeneratedType("core");
                    } else if ("generate_world_basics".equals(finished)) {
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.DEEP_SEEK);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深网文策划。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。\n"
                                + "JSON 格式：\n"
                                + "{\n"
                                + "  \"world\": { \"background\": \"世界背景描述\", \"power_system\": \"力量体系描述\", \"forces\": \"势力分布描述\", \"current_time\": \"当前时空背景\" }\n"
                                + "}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n正文片段：\n" + novelContext + "\n\n请生成完整的世界观设定：1)世界背景 2)力量体系 3)势力分布 4)当前时空背景。全部输出到一个JSON的world对象中。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new UserMessage(user))));
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
                            if (wNode.has("current_time")) {
                                worldMap.put("currentTime", wNode.get("current_time").asText());
                            }
                            
                            // 创建一个综合的世界观设定
                            String worldContent = worldMap.containsKey("background") ? worldMap.get("background") : "世界观设定";
                            if (worldMap.containsKey("powerSystem") && !worldMap.get("powerSystem").isEmpty()) {
                                worldContent += "\n\n【力量体系】" + worldMap.get("powerSystem");
                            }
                            if (worldMap.containsKey("forces") && !worldMap.get("forces").isEmpty()) {
                                worldContent += "\n\n【势力分布】" + worldMap.get("forces");
                            }
                            if (worldMap.containsKey("currentTime") && !worldMap.get("currentTime").isEmpty()) {
                                worldContent += "\n\n【当前时空】" + worldMap.get("currentTime");
                            }
                            
                            // 写入单一的world lore，包含所有字段
                            loreWriteAdapter.writeLore(p.getProjectId(), "world", "世界观设定", worldContent, toJsonStr(worldMap));
                            count++;
                        }
                        
                        // 如果没有生成，创建空的
                        if (count == 0) {
                            String emptyWorld = "{\"background\":\"\",\"powerSystem\":\"\",\"forces\":\"\",\"currentTime\":\"\"}";
                            loreWriteAdapter.writeLore(p.getProjectId(), "world", "世界观设定", "世界观设定（待完善）", emptyWorld);
                            count = 1;
                        }
                        p.setGeneratedCount(count);
                        p.setGeneratedType("world_basics");
                    } else if ("generate_plot_structure".equals(finished)) {
                        // 剧情架构 - 钩子、转折等
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.DEEP_SEEK);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深网文策划。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。\n"
                                + "JSON 格式：\n"
                                + "{\n"
                                + "  \"hooks\": [\"钩子1描述\", \"钩子2描述\"],\n"
                                + "  \"twists\": [\"转折1描述\", \"转折2描述\"],\n"
                                + "  \"foreshadowing\": [\"伏笔1\", \"伏笔2\"]\n"
                                + "}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n正文片段：\n" + novelContext + "\n\n请分析并生成：1)情节钩子 2)剧情转折 3)伏笔埋设。全部输出到一个JSON中。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new UserMessage(user))));
                        String content = AiUtils.getChatResponseContent(response);
                        JsonNode node = toJson(content);
                        int count = 0;
                        
                        if (node != null) {
                            // 钩子
                            if (node.has("hooks") && node.get("hooks").isArray()) {
                                String hooksJson = node.get("hooks").toString();
                                loreWriteAdapter.writeLore(p.getProjectId(), "plot", "钩子", "情节钩子列表", "{\"hooks\":" + hooksJson + "}");
                                count++;
                            }
                            // 转折
                            if (node.has("twists") && node.get("twists").isArray()) {
                                String twistsJson = node.get("twists").toString();
                                loreWriteAdapter.writeLore(p.getProjectId(), "plot", "转折", "剧情转折列表", "{\"twists\":" + twistsJson + "}");
                                count++;
                            }
                            // 伏笔
                            if (node.has("foreshadowing") && node.get("foreshadowing").isArray()) {
                                String foreshadowingJson = node.get("foreshadowing").toString();
                                loreWriteAdapter.writeLore(p.getProjectId(), "plot", "伏笔", "伏笔列表", "{\"foreshadowing\":" + foreshadowingJson + "}");
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
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.DEEP_SEEK);
                        String title = getProjectTitle(p.getProjectId());
                        String system = "你是资深网文策划。必须严格使用简体中文，严格按 JSON 输出，禁止 Markdown 代码块。\n"
                                + "JSON 格式：\n"
                                + "{\n"
                                + "  \"tone\": \"文风基调描述\",\n"
                                + "  \"pacing\": \"节奏特点\",\n"
                                + "  \"themes\": [\"核心元素1\", \"核心元素2\"],\n"
                                + "  \"targetAudience\": \"目标读者\"\n"
                                + "}";
                        String user = "书名：" + (title != null ? title : "") + "\n\n正文片段：\n" + novelContext + "\n\n请分析并生成：1)文风基调 2)叙事节奏 3)核心主题元素 4)目标读者群体。全部输出到一个JSON中。";
                        ChatResponse response = chat.call(new Prompt(java.util.List.of(new SystemMessage(system), new UserMessage(user))));
                        String content = AiUtils.getChatResponseContent(response);
                        JsonNode node = toJson(content);
                        int count = 0;
                        
                        if (node != null) {
                            // 文风基调 - 存到 narrative 类型
                            if (node.has("tone")) {
                                String tone = node.get("tone").asText();
                                String narrativeJson = toJsonString(node);
                                loreWriteAdapter.writeLore(p.getProjectId(), "narrative", "文风基调", tone, narrativeJson);
                                count++;
                            }
                            // 节奏特点
                            if (node.has("pacing")) {
                                String pacing = node.get("pacing").asText();
                                loreWriteAdapter.writeLore(p.getProjectId(), "narrative", "叙事节奏", pacing, "{\"pacing\":\"" + pacing.replace("\"", "\\\"") + "\"}");
                                count++;
                            }
                            // 核心元素
                            if (node.has("themes") && node.get("themes").isArray()) {
                                String themesJson = node.get("themes").toString();
                                loreWriteAdapter.writeLore(p.getProjectId(), "narrative", "核心元素", "主题元素列表", "{\"themes\":" + themesJson + "}");
                                count++;
                            }
                        }
                        
                        // 更新项目的文风字段
                        if (node != null && node.has("tone")) {
                            NovelProjectDO projectUpdate = new NovelProjectDO();
                            projectUpdate.setId(p.getProjectId());
                            projectUpdate.setStyle(node.get("tone").asText());
                            projectMapper.updateById(projectUpdate);
                        }
                        
                        // 如果没有生成，创建空的
                        if (count == 0) {
                            loreWriteAdapter.writeLore(p.getProjectId(), "narrative", "文风基调", "文风基调（待完善）", "{\"tone\":\"\"}");
                            count = 1;
                        }
                        p.setGeneratedCount(count);
                        p.setGeneratedType("narrative");
                    } else if ("generate_characters".equals(finished)) {
                        // 两阶段提取：先名后详
                        ChatModel chat = aiModelFactory.getDefaultChatModel(AiPlatformEnum.DEEP_SEEK);
                        String title = getProjectTitle(p.getProjectId());
                        
                        // 1. 提取名单
                        String listSystem = "你是资深小说编辑。请从小说正文中提取所有重要角色的姓名列表（最多8个）。必须严格使用简体中文，按 JSON 数组输出字符串：[\"姓名1\", \"姓名2\"]。不要包含任何对象结构。";
                        String listUser = "作品：" + (title != null ? title : "") + "\n\n正文片段：\n" + novelContext;
                        ChatResponse listResp = chat.call(new Prompt(java.util.List.of(new SystemMessage(listSystem), new UserMessage(listUser))));
                        JsonNode listNode = toJson(AiUtils.getChatResponseContent(listResp));
                        
                        int count = 0;
                        if (listNode != null && listNode.isArray()) {
                            for (JsonNode nameNode : listNode) {
                                String name = nameNode.asText();
                                if (name == null || name.length() < 2) continue;
                                
                                // 2. 生成详情
                                String detailSystem = "你是角色分析专家。请根据小说正文，生成角色【" + name + "】的详细档案。\n"
                                        + "JSON 格式：{\"name\":\"" + name + "\", \"role\":\"身份\", \"gender\":\"性别\", \"age\":\"年龄\", \"personality\":\"性格\", \"appearance\":\"外貌\", \"background\":\"背景\", \"ability\":\"能力\", \"goal\":\"目标\", \"conflict\":\"冲突\", \"relationships\":\"人际关系\", \"description\":\"综合描述\"}";
                                String detailUser = "正文片段：\n" + novelContext + "\n\n请分析角色：" + name;
                                try {
                                    ChatResponse detailResp = chat.call(new Prompt(java.util.List.of(new SystemMessage(detailSystem), new UserMessage(detailUser))));
                                    String detailContent = AiUtils.getChatResponseContent(detailResp);
                                    loreWriteAdapter.writeLore(p.getProjectId(), "character", name, detailContent, detailContent);
                                    count++;
                                } catch (Exception e) {
                                    // 忽略单个失败
                                    System.err.println("Character generation failed for " + name + ": " + e.getMessage());
                                }
                            }
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
    protected Long createProjectFromText(String type, String content, String fileName) {
        String normalized = content != null ? content.replace("\r\n", "\n") : "";
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("导入内容为空");
        }
        String baseTitle = fileName != null ? fileName.replaceAll("\\.[^.]+$", "") : "导入小说";
        LocalDateTime now = LocalDateTime.now();

        NovelProjectDO project = new NovelProjectDO();
        project.setTitle(baseTitle);
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
        String regex = "^\\s*(第[一二三四五六七八九十百千万亿0-9]+[卷部篇]|卷\\s*\\d+|#\\s*.*|Volume\\s*\\d+).*$";
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
        // 4. 数字+. 或 数字、 开头（如：1. 第一章，500、章节名）
        // 5. 卷X Volume X
        String chapterRegex = "^\\s*(" +
                "第[一二三四五六七八九十百千万亿零0-9]+[章回节]"  // 第X章/回/节（如：第五百九十九章 收网）
                + "|Chapter\\s*\\d+"  // Chapter 1
                + "|##\\s+.+"  // ## 章节名
                + "|\\d+[、.]\\s+.+"  // 1. 第一章 或 1、章节名
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
