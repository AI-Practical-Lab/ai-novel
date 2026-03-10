package cn.hb.wk.service.ai;

import cn.hb.wk.controller.vo.ai.AiChapterContentReqVO;
import com.fasterxml.jackson.databind.ObjectMapper;

public class ChapterPromptBuilder {
    public String buildSystemPrompt() {
        return "### 角色设定\n"
                + "你是一位长期连载的白金网文作者，擅长写节奏紧凑、爽点密集、极度口语化的小说章节。\n\n"
                + "### 去AI味与网文风格硬性规则\n"
                + "1. 禁用论文式逻辑连接词：不要出现\"首先\"\"其次\"\"再者\"\"总之\"\"综上所述\"\"显而易见\"等。\n"
                + "2. 禁用翻译腔和西幻腔：避免使用\"噢\"\"该死的\"\"不得不承认\"\"如同...一般\"\"看在...的份上\"等，改用自然中文口语。\n"
                + "3. 禁用空洞过渡语：不要写\"与此同时\"\"画面一转\"\"值得一提的是\"\"令人惊讶的是\"等，直接通过空行或镜头切换过场。\n"
                + "4. 段落控制：以手机端阅读为标准，每段尽量不超过 3 行；重要对话尽量独占一行。\n"
                + "5. 清理 AI 味虚词：谨慎使用\"一股...之情油然而生\"\"充满\"\"仿佛\"\"旋即\"等抽象词，能用具体画面就不用空洞形容。\n\n"
                + "### 字数要求（极其重要）\n"
                + "1. 本章正文必须达到 3500-4500 字，这是硬性要求，不能偷工减料。\n"
                + "2. 如果内容不足，请通过以下方式扩充，而非灌水：\n"
                + "   - 增加人物对话的回合数，让冲突在对话中层层递进；\n"
                + "   - 补充环境描写、人物神态和动作细节；\n"
                + "   - 增加配角/路人的反应和侧面描写；\n"
                + "   - 细化战斗/辩论/博弈的过程，写出每一招每一式。\n"
                + "3. 绝不允许以\"限于篇幅\"\"为节省字数\"等理由提前结束，必须写够字数。\n\n"
                + "### 章节内容核心原则\n"
                + "1. 内容必须围绕本章目标和核心冲突展开，避免闲笔灌水。\n"
                + "2. 每一章都要推动主线或重要支线至少向前迈出一个清晰的台阶。\n"
                + "3. 使用\"压抑-爆发-反馈\"的爽点结构：先被轻视，再强势翻盘，并描写路人或反派的震惊反应。\n"
                + "4. 人物行为和情绪必须符合其既有性格与经历，不能为了剧情强行降智或强行推进。\n"
                + "5. 严格执行\"Show, Don't Tell\"：少说\"他很生气/很害怕\"，多写动作、表情、生理反应和环境反馈。\n"
                + "6. 文本表达要口语化、易读，减少大段说明文和纯设定说明，多用对话、动作和环境互动承载信息。\n"
                + "7. 段落之间要通过环境、动作或视角变化自然过渡，不要生硬跳切。\n"
                + "8. 本章开头直接给出矛盾或悬念，中段升级冲突，结尾卡在情绪高点或悬念处。\n"
                + "9. 必须保证世界观与设定前后一致，不出现明显的时间线、人物关系或能力体系自相矛盾。\n"
                + "10. 文本必须为简体中文纯文本输出，不得出现 Markdown 标记、场景小标题等格式性标签。\n\n"
                + "### 伏笔与结构执行\n"
                + "1. 优先关注待兑现伏笔，视为官方伏笔列表，在不破坏节奏的前提下自然推进或兑现。\n"
                + "2. 合理时机优先处理到期伏笔，避免突兀兑现或新增大纲外支线。\n"
                + "3. 如有章纲/细纲，必须按照其中的场景顺序和情绪走势执行，不能跳过或模糊带过关键节点。\n\n"
                + "### 续写模式说明\n"
                + "如有已写内容，需在时间、地点与人物状态上无缝接续上一段或上一章；如需跳跃或切换视角，必须在正文中自然交代。\n\n"
                + "### 视角与知识边界\n"
                + "你只能依据【POV 角色当前认知】区块中的信息来描写人物内心与推理；【作者秘密与信息差设定】区块信息仅用于结构与伏笔设计，不能被角色直接知道或准确表达。除非特别说明，你要假定自己\"看不到\"任何不在输入各区块中的信息。\n\n"
                + "### 防剧透硬性约束\n"
                + "1. 严禁写出尚未在输入中显式发生或被角色合理获知的事件、真相和因果解释。\n"
                + "2. 不要提前点破悬疑、阴谋或世界观谜底，不要在本章内解释未来章节才会揭示的答案。\n"
                + "3. 可以埋设线索和压力，只能用模糊的怀疑/预感表达，不得给出唯一正确结论或完全准确的推理。\n"
                + "4. 如需暗示未来走向，请通过细节和氛围让读者产生联想，而不是由角色或旁白直接说破。\n";
    }

    public String buildUserPrompt(AiChapterContentReqVO reqVO, ObjectMapper mapper) {
        Object chapter = reqVO.getChapter();
        Object previousChapter = reqVO.getPreviousChapter();
        String volumeSummary = reqVO.getVolumeSummary();
        Object globalLore = reqVO.getGlobalLore();
        Object instruction = reqVO.getInstruction();
        java.util.List<Object> characters = reqVO.getCharacters();
        java.util.List<Object> foreshadowing = reqVO.getForeshadowing();
        Object coreSettings = reqVO.getCoreSettings();
        Object milestoneContextObj = reqVO.getMilestoneContext();
        java.util.List<Object> volumeChaptersPlan = reqVO.getVolumeChaptersPlan();
        java.util.List<Object> characterKnowledge = reqVO.getCharacterKnowledge();
        java.util.Map<String, java.util.Map<String, Object>> writingCardsByCharacter = new java.util.LinkedHashMap<>();
        if (characterKnowledge != null && !characterKnowledge.isEmpty()) {
            for (Object o : characterKnowledge) {
                try {
                    com.fasterxml.jackson.databind.JsonNode n = mapper.valueToTree(o);
                    com.fasterxml.jackson.databind.JsonNode extraNode = n.get("extra");
                    if (extraNode != null && !extraNode.isNull()) {
                        com.fasterxml.jackson.databind.JsonNode wc = extraNode.get("writingCard");
                        if (wc != null && !wc.isNull()) {
                            String characterId = n.hasNonNull("characterId") ? n.get("characterId").asText() : null;
                            if (characterId != null && !characterId.isEmpty()) {
                                java.util.Map<String, Object> map = mapper.convertValue(wc, java.util.Map.class);
                                writingCardsByCharacter.put(characterId, map);
                            }
                        }
                    }
                } catch (Exception ignore) {
                }
            }
        }
        StringBuilder sbUser = new StringBuilder();
        sbUser.append("分卷大纲：").append(volumeSummary != null ? volumeSummary : "").append("\n");
        sbUser.append("当前章节：").append(String.valueOf(chapter)).append("\n");
        sbUser.append("上一章：").append(String.valueOf(previousChapter)).append("\n");
        sbUser.append("设定集：").append(String.valueOf(globalLore)).append("\n");
        if (coreSettings != null) {
            try {
                sbUser.append("核心设定：").append(coreSettings instanceof String ? (String) coreSettings : mapper.writeValueAsString(coreSettings)).append("\n");
            } catch (Exception ignore) {}
        }
        if (milestoneContextObj != null) {
            try {
                sbUser.append("里程碑上下文：").append(milestoneContextObj instanceof String ? (String) milestoneContextObj : mapper.writeValueAsString(milestoneContextObj)).append("\n");
            } catch (Exception ignore) {}
        }
        if (volumeChaptersPlan != null && !volumeChaptersPlan.isEmpty()) {
            StringBuilder planSb = new StringBuilder();
            for (int i = 0; i < volumeChaptersPlan.size(); i++) {
                planSb.append(String.valueOf(volumeChaptersPlan.get(i)));
                if (i < volumeChaptersPlan.size() - 1) planSb.append("\n");
            }
            sbUser.append("本卷章节规划：").append(planSb.toString()).append("\n");
        }
        if (characters != null && !characters.isEmpty()) {
            StringBuilder chSb = new StringBuilder();
            for (int i = 0; i < characters.size(); i++) {
                Object c = characters.get(i);
                chSb.append(String.valueOf(c));
                if (i < characters.size() - 1) chSb.append("\n");
            }
            sbUser.append("本章人物：").append(chSb.toString()).append("\n");
        }
        if (!writingCardsByCharacter.isEmpty()) {
            StringBuilder cardSb = new StringBuilder();
            for (java.util.Map.Entry<String, java.util.Map<String, Object>> e : writingCardsByCharacter.entrySet()) {
                String cid = e.getKey();
                java.util.Map<String, Object> wc = e.getValue();
                if (wc == null) continue;
                String identity = wc.get("identity") != null ? String.valueOf(wc.get("identity")) : "";
                String relationToProtagonist = wc.get("relationToProtagonist") != null ? String.valueOf(wc.get("relationToProtagonist")) : "";
                String goalThisChapter = wc.get("goalThisChapter") != null ? String.valueOf(wc.get("goalThisChapter")) : "";
                String stateThisChapter = wc.get("stateThisChapter") != null ? String.valueOf(wc.get("stateThisChapter")) : "";
                java.util.List<?> speechStyleList = null;
                try {
                    Object s = wc.get("speechStyle");
                    if (s instanceof java.util.List<?>) {
                        speechStyleList = (java.util.List<?>) s;
                    }
                } catch (Exception ignore) {
                }
                java.util.List<String> speech = new java.util.ArrayList<>();
                if (speechStyleList != null) {
                    for (Object o : speechStyleList) {
                        if (o != null) {
                            String t = String.valueOf(o).trim();
                            if (!t.isEmpty()) speech.add(t);
                        }
                        if (speech.size() >= 2) break;
                    }
                }
                cardSb.append("角色ID：").append(cid).append("\n");
                if (!identity.isEmpty()) {
                    cardSb.append("- 身份/定位：").append(identity).append("\n");
                }
                if (!relationToProtagonist.isEmpty()) {
                    cardSb.append("- 与主角关系：").append(relationToProtagonist).append("\n");
                }
                if (!goalThisChapter.isEmpty()) {
                    cardSb.append("- 本章目标：").append(goalThisChapter).append("\n");
                }
                if (!stateThisChapter.isEmpty()) {
                    cardSb.append("- 当前状态：").append(stateThisChapter).append("\n");
                }
                if (!speech.isEmpty()) {
                    cardSb.append("- 说话风格：").append(String.join("、", speech)).append("\n");
                }
                cardSb.append("\n");
            }
            if (cardSb.length() > 0) {
                sbUser.append("本章人物卡（供写作参考）：\n").append(cardSb.toString());
            }
        }
        if (characterKnowledge != null && !characterKnowledge.isEmpty()) {
            StringBuilder knSb = new StringBuilder();
            for (int i = 0; i < characterKnowledge.size(); i++) {
                knSb.append(String.valueOf(characterKnowledge.get(i)));
                if (i < characterKnowledge.size() - 1) knSb.append("\n");
            }
            sbUser.append("POV 角色当前认知：").append(knSb.toString()).append("\n");
        }
        if (foreshadowing != null && !foreshadowing.isEmpty()) {
            StringBuilder fsSb = new StringBuilder();
            for (int i = 0; i < foreshadowing.size(); i++) {
                fsSb.append(String.valueOf(foreshadowing.get(i)));
                if (i < foreshadowing.size() - 1) fsSb.append("\n");
            }
            sbUser.append("待兑现伏笔：").append(fsSb.toString()).append("\n");
            try {
                java.util.List<String> authorOnly = new java.util.ArrayList<>();
                java.util.List<String> readerKnown = new java.util.ArrayList<>();
                java.util.List<String> characterKnown = new java.util.ArrayList<>();
                for (Object o : foreshadowing) {
                    com.fasterxml.jackson.databind.JsonNode n = mapper.valueToTree(o);
                    String vis = n.hasNonNull("visibility") ? n.get("visibility").asText() : "author_only";
                    String content = n.hasNonNull("content") ? n.get("content").asText() : String.valueOf(o);
                    String cid = n.hasNonNull("characterId") ? n.get("characterId").asText() : null;
                    String line = cid != null && !cid.isEmpty() ? (content + "（角色ID：" + cid + "）") : content;
                    if ("reader_known".equals(vis)) readerKnown.add(line);
                    else if ("character_known".equals(vis)) characterKnown.add(line);
                    else authorOnly.add(line);
                }
                StringBuilder diff = new StringBuilder();
                if (!authorOnly.isEmpty()) {
                    diff.append("【作者秘密】\n");
                    for (int i = 0; i < authorOnly.size(); i++) {
                        diff.append("- ").append(authorOnly.get(i));
                        if (i < authorOnly.size() - 1) diff.append("\n");
                    }
                    diff.append("\n");
                }
                if (!readerKnown.isEmpty()) {
                    diff.append("【读者已知 / 角色未知】\n");
                    for (int i = 0; i < readerKnown.size(); i++) {
                        diff.append("- ").append(readerKnown.get(i));
                        if (i < readerKnown.size() - 1) diff.append("\n");
                    }
                    diff.append("\n");
                }
                if (!characterKnown.isEmpty()) {
                    diff.append("【角色已知 / 读者未必知】\n");
                    for (int i = 0; i < characterKnown.size(); i++) {
                        diff.append("- ").append(characterKnown.get(i));
                        if (i < characterKnown.size() - 1) diff.append("\n");
                    }
                    diff.append("\n");
                }
                if (diff.length() > 0) {
                    sbUser.append("作者秘密与信息差设定：").append(diff.toString());
                }
            } catch (Exception ignore) {}
        }
        sbUser.append("指令：").append(String.valueOf(instruction));
        return sbUser.toString();
    }
}
