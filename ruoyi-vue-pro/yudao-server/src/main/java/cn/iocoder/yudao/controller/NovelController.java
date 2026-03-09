package cn.iocoder.yudao.controller;

import cn.iocoder.yudao.controller.vo.*;
import cn.iocoder.yudao.dal.dataobject.milestone.NovelVolumeMilestoneDO;
import cn.iocoder.yudao.pojo.CommonResult;
import cn.iocoder.yudao.controller.vo.NovelChapterCreateReqVO;
import cn.iocoder.yudao.controller.vo.NovelProjectUpdateReqVO;
import cn.iocoder.yudao.dal.dataobject.foreshadow.NovelForeshadowingDO;
import cn.iocoder.yudao.dal.dataobject.lore.NovelLoreDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelChapterDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelProjectDO;
import cn.iocoder.yudao.dal.dataobject.project.NovelVolumeDO;
import cn.iocoder.yudao.dal.dataobject.relation.NovelRelationsDO;
import cn.iocoder.yudao.dal.dataobject.knowledge.NovelCharacterKnowledgeDO;
import cn.iocoder.yudao.service.project.NovelProjectService;
import cn.iocoder.yudao.service.knowledge.NovelCharacterKnowledgeService;
import cn.iocoder.yudao.controller.vo.AppNovelCharacterKnowledgeSaveReqVO;
import cn.iocoder.yudao.service.file.NovelFileParseService;
import cn.iocoder.yudao.controller.vo.NovelForeshadowingUpdateReqVO;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.apache.commons.collections4.CollectionUtils;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import static cn.iocoder.yudao.pojo.CommonResult.success;
import static cn.iocoder.yudao.pojo.CommonResult.error;

@RestController
@RequestMapping("/app-api/api/novels")
public class NovelController {
    @Resource
    private NovelProjectService projectService;
    @Resource
    private NovelFileParseService fileParseService;
    @Resource
    private NovelCharacterKnowledgeService knowledgeService;

    /**
     * 获取小说项目列表
     *
     * @return 小说项目列表
     */
    @GetMapping
    public CommonResult<List<NovelProjectDO>> list() {
        return success(projectService.listProjects());
    }

    /**
     * 创建小说项目
     * 
     * @param reqVO 小说项目创建请求参数
     * @return 创建结果
     */
    @PostMapping
    public CommonResult<NovelProjectCreateRespVO> create(@Valid @RequestBody NovelProjectCreateReqVO reqVO) {
        NovelProjectDO p = new NovelProjectDO();
        p.setTitle(reqVO.getTitle());
        p.setDescription(reqVO.getDescription());
        p.setGenre(reqVO.getGenre());
        p.setStyle(reqVO.getStyle());
        if (reqVO.getTags() != null) {
            List<String> tags = new ArrayList<>(reqVO.getTags());
            String joined = String.join(",", tags.stream()
                    .filter(s -> s != null)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .distinct()
                    .toList());
            p.setTags(joined.isEmpty() ? null : joined);
        }
        List<NovelVolumeDO> vols = new ArrayList<>();
        if (reqVO.getCoreSettings() != null && reqVO.getCoreSettings().getOutline() != null && reqVO.getCoreSettings().getOutline().getVolumes() != null) {
            for (NovelProjectCreateReqVO.OutlineVolumeVO v : reqVO.getCoreSettings().getOutline().getVolumes()) {
                NovelVolumeDO vo = new NovelVolumeDO();
                vo.setTitle(v.getTitle());
                vo.setSummary(v.getSummary());
                vols.add(vo);
            }
        }
        NovelProjectDO created = projectService.createProject(p, vols);
        if (reqVO.getCoreSettings() != null) {
            NovelProjectCreateReqVO.CoreSettingsVO cs = reqVO.getCoreSettings();
            if (cs.getOutline() != null) {
                NovelProjectCreateReqVO.OutlineVO o = cs.getOutline();
                NovelLoreDO lore = projectService.createLore(created.getId(), "主大纲", "outline");
                String content = o.getSummary();
                lore.setContent(content);
                lore.setExtra(toJson(o));
                projectService.updateLore(lore);
            }
            if (cs.getProtagonist() != null) {
                NovelProjectCreateReqVO.ProtagonistVO pr = cs.getProtagonist();
                String t = pr.getName() != null && !pr.getName().trim().isEmpty() ? ("主角：" + pr.getName().trim()) : "主角设定";
                NovelLoreDO lore = projectService.createLore(created.getId(), t, "protagonist");
                String content = joinLines(
                        line("姓名：", pr.getName()),
                        line("性别：", pr.getGender()),
                        line("年龄：", pr.getAge()),
                        line("性格：", pr.getPersonality()),
                        line("外挂：", pr.getCheat())
                );
                lore.setContent(content);
                lore.setExtra(toJson(pr));
                projectService.updateLore(lore);
            }
            if (cs.getAntagonist() != null) {
                NovelProjectCreateReqVO.AntagonistVO an = cs.getAntagonist();
                String t = an.getName() != null && !an.getName().trim().isEmpty() ? ("反派：" + an.getName().trim()) : "反派设定";
                NovelLoreDO lore = projectService.createLore(created.getId(), t, "antagonist");
                String content = joinLines(
                        line("名称：", an.getName()),
                        line("角色：", an.getRole()),
                        line("性格/动机：", an.getPersonality())
                );
                lore.setContent(content);
                lore.setExtra(toJson(an));
                projectService.updateLore(lore);
            }
            if (cs.getWorld() != null) {
                NovelProjectCreateReqVO.WorldVO w = cs.getWorld();
                NovelLoreDO lore = projectService.createLore(created.getId(), "世界观设定", "world");
                String content = joinLines(
                        line("背景：", w.getBackground()),
                        line("力量体系：", w.getPowerSystem()),
                        line("势力分布：", w.getForces())
                );
                lore.setContent(content);
                lore.setExtra(toJson(w));
                projectService.updateLore(lore);
            }
        }
        NovelProjectCreateRespVO data = new NovelProjectCreateRespVO();
        data.setId(String.valueOf(created.getId()));
        data.setTitle(created.getTitle());
        data.setDescription(created.getDescription());
        data.setGenre(created.getGenre());
        data.setStyle(created.getStyle());
        if (created.getTags() != null && !created.getTags().isEmpty()) {
            List<String> tagList = new ArrayList<>();
            for (String s : created.getTags().split(",")) {
                String t = s.trim();
                if (!t.isEmpty() && !tagList.contains(t)) tagList.add(t);
            }
            data.setTags(tagList);
        } else {
            data.setTags(null);
        }
        data.setAuthor(created.getAuthor());
        data.setCover(created.getCover());
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        if (created.getCreateTime() != null) data.setCreatedAt(created.getCreateTime().format(fmt));
        if (created.getUpdateTime() != null) data.setUpdatedAt(created.getUpdateTime().format(fmt));
        NovelProjectCreateReqVO.CoreSettingsVO csOut = reqVO.getCoreSettings();
        if (csOut == null && reqVO.getCoreSettings() != null && reqVO.getCoreSettings().getOutline() != null) {
            NovelProjectCreateReqVO.CoreSettingsVO tmp = new NovelProjectCreateReqVO.CoreSettingsVO();
            NovelProjectCreateReqVO.OutlineVO o = new NovelProjectCreateReqVO.OutlineVO();
            o.setMainConflict(reqVO.getCoreSettings().getOutline().getMainConflict());
            o.setSummary(reqVO.getCoreSettings().getOutline().getSummary());
            o.setVolumes(reqVO.getCoreSettings().getOutline().getVolumes());
            tmp.setWorld(null);
            tmp.setProtagonist(null);
            tmp.setAntagonist(null);
            tmp.setOutline(o);
            csOut = tmp;
        }
        data.setCoreSettings(csOut);
        List<NovelVolumeDO> persistedVolumes = projectService.getVolumes(created.getId());
        if (persistedVolumes != null && !persistedVolumes.isEmpty()) {
            List<NovelProjectCreateRespVO.VolumeVO> volRespList = new ArrayList<>();
            for (NovelVolumeDO v : persistedVolumes) {
                NovelProjectCreateRespVO.VolumeVO vr = new NovelProjectCreateRespVO.VolumeVO();
                vr.setId(String.valueOf(v.getId()));
                vr.setTitle(v.getTitle());
                vr.setSummary(v.getSummary());
                vr.setChapters(new ArrayList<>());
                volRespList.add(vr);
            }
            data.setVolumes(volRespList);
        } else {
            data.setVolumes(new ArrayList<>());
        }
        return success(data);
    }

    /**
     * 获取小说项目详情
     * 
     * @param id 小说项目ID
     * @return 小说项目详情
     */
    @GetMapping("/{id}")
    public CommonResult<java.util.Map<String, Object>> get(@PathVariable("id") Long id) {
        NovelProjectDO p = projectService.getProject(id);
        List<NovelVolumeDO> vols = projectService.getVolumes(id);
        List<NovelChapterDO> chapters = projectService.getChaptersByProject(id);
        List<NovelLoreDO> lore = projectService.getLoreList(id);
        java.util.Map<String, Object> data = new java.util.HashMap<>();
        data.put("id", String.valueOf(p.getId()));
        data.put("title", p.getTitle());
        data.put("description", p.getDescription());
        data.put("genre", p.getGenre());
        data.put("style", p.getStyle());
        if (p.getTags() != null && !p.getTags().isEmpty()) {
            List<String> tagList = new ArrayList<>();
            for (String s : p.getTags().split(",")) {
                String t = s.trim();
                if (!t.isEmpty() && !tagList.contains(t)) tagList.add(t);
            }
            data.put("tags", tagList);
        } else {
            data.put("tags", null);
        }
        data.put("author", p.getAuthor());
        data.put("cover", p.getCover());
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        if (p.getCreateTime() != null) data.put("createdAt", p.getCreateTime().format(fmt));
        if (p.getUpdateTime() != null) data.put("updatedAt", p.getUpdateTime().format(fmt));
        NovelProjectCreateReqVO.CoreSettingsVO cs = new NovelProjectCreateReqVO.CoreSettingsVO();
        NovelLoreDO protagonistLore = null;
        NovelLoreDO antagonistLore = null;
        if (lore != null && !lore.isEmpty()) {
            for (NovelLoreDO l : lore) {
                String type = l.getType();
                if (type == null) continue;
                switch (type) {
                    case "outline" -> {
                        NovelProjectCreateReqVO.OutlineVO o = fromJson(l.getExtra(), NovelProjectCreateReqVO.OutlineVO.class);
                        if (o == null) {
                            o = new NovelProjectCreateReqVO.OutlineVO();
                            o.setSummary(l.getContent());
                        }
                        if (o.getVolumes() == null && vols != null && !vols.isEmpty()) {
                            List<NovelProjectCreateReqVO.OutlineVolumeVO> ov = new ArrayList<>();
                            for (NovelVolumeDO v : vols) {
                                NovelProjectCreateReqVO.OutlineVolumeVO item = new NovelProjectCreateReqVO.OutlineVolumeVO();
                                item.setTitle(v.getTitle());
                                item.setSummary(v.getSummary());
                                ov.add(item);
                            }
                            o.setVolumes(ov);
                        }
                        cs.setOutline(o);
                    }
                    case "protagonist" -> {
                        NovelProjectCreateReqVO.ProtagonistVO pr = fromJson(l.getExtra(), NovelProjectCreateReqVO.ProtagonistVO.class);
                        cs.setProtagonist(pr);
                        protagonistLore = l;
                    }
                    case "antagonist" -> {
                        NovelProjectCreateReqVO.AntagonistVO an = fromJson(l.getExtra(), NovelProjectCreateReqVO.AntagonistVO.class);
                        cs.setAntagonist(an);
                        antagonistLore = l;
                    }
                    case "world" -> {
                        NovelProjectCreateReqVO.WorldVO w = fromJson(l.getExtra(), NovelProjectCreateReqVO.WorldVO.class);
                        cs.setWorld(w);
                    }
                    default -> {
                    }
                }
            }
        }
        data.put("coreSettings", cs);
        if (vols != null && !vols.isEmpty()) {
            List<java.util.Map<String, Object>> volRespList = new ArrayList<>();
            for (NovelVolumeDO v : vols) {
                java.util.Map<String, Object> vr = new java.util.HashMap<>();
                vr.put("id", String.valueOf(v.getId()));
                vr.put("title", v.getTitle());
                vr.put("summary", v.getSummary());
                List<java.util.Map<String, Object>> chRespList = new ArrayList<>();
                if (chapters != null && !chapters.isEmpty()) {
                    for (NovelChapterDO c : chapters) {
                        if (c.getVolumeId() != null && c.getVolumeId().equals(v.getId())) {
                            java.util.Map<String, Object> cm = new java.util.HashMap<>();
                            cm.put("id", String.valueOf(c.getId()));
                            cm.put("title", c.getTitle());
                            cm.put("summary", c.getSummary());
                            String cids = c.getCharacterIds();
                            if (cids != null && !cids.trim().isEmpty()) {
                                List<String> cidList = new ArrayList<>();
                                for (String s : cids.split(",")) {
                                    String t = s != null ? s.trim() : "";
                                    if (!t.isEmpty() && !cidList.contains(t)) cidList.add(t);
                                }
                                cm.put("characterIds", cidList.isEmpty() ? null : cidList);
                            } else {
                                cm.put("characterIds", null);
                            }
                            chRespList.add(cm);
                        }
                    }
                }
                vr.put("chapters", chRespList);
                volRespList.add(vr);
            }
            data.put("volumes", volRespList);
        } else {
            data.put("volumes", new ArrayList<>());
        }
        List<java.util.Map<String, Object>> loreResp = new ArrayList<>();
        if (cs.getProtagonist() != null) {
            NovelProjectCreateReqVO.ProtagonistVO pr = cs.getProtagonist();
            java.util.Map<String, Object> item = new java.util.HashMap<>();
            item.put("name", pr.getName());
            item.put("gender", pr.getGender());
            item.put("age", pr.getAge());
            item.put("personality", pr.getPersonality());
            item.put("cheat", pr.getCheat());
            item.put("id", "protagonist");
            item.put("type", "character");
            item.put("title", pr.getName() != null && !pr.getName().trim().isEmpty() ? pr.getName().trim() : "主角");
            if (protagonistLore != null) {
                if (protagonistLore.getId() != null) {
                    item.put("loreId", protagonistLore.getId());
                }
                item.put("content", protagonistLore.getContent() != null ? protagonistLore.getContent() : "");
            }
            loreResp.add(item);
        }
        if (cs.getAntagonist() != null) {
            NovelProjectCreateReqVO.AntagonistVO an = cs.getAntagonist();
            java.util.Map<String, Object> item = new java.util.HashMap<>();
            item.put("name", an.getName());
            item.put("role", an.getRole());
            item.put("personality", an.getPersonality());
            item.put("id", "antagonist");
            item.put("type", "character");
            item.put("title", an.getName() != null && !an.getName().trim().isEmpty() ? an.getName().trim() : "反派");
            if (antagonistLore != null) {
                if (antagonistLore.getId() != null) {
                    item.put("loreId", antagonistLore.getId());
                }
                item.put("content", antagonistLore.getContent() != null ? antagonistLore.getContent() : "");
            }
            loreResp.add(item);
        }
        if (cs.getWorld() != null) {
            NovelProjectCreateReqVO.WorldVO w = cs.getWorld();
            java.util.Map<String, Object> item = new java.util.HashMap<>();
            item.put("background", w.getBackground());
            item.put("powerSystem", w.getPowerSystem());
            item.put("forces", w.getForces());
            item.put("id", "world");
            item.put("type", "world");
            item.put("title", "世界观设定");
            item.put("locations", new ArrayList<>());
            item.put("timeline", new ArrayList<>());
            loreResp.add(item);
        }
        java.util.Map<String, Object> plotExtra = null;
        if (lore != null && !lore.isEmpty()) {
            for (NovelLoreDO l : lore) {
                if ("character".equals(l.getType())) {
                    java.util.Map<String, Object> item = new java.util.HashMap<>();
                    item.put("id", l.getId());
                    item.put("type", "character");
                    item.put("title", l.getTitle() != null ? l.getTitle() : "人物设定");
                    item.put("content", l.getContent() != null ? l.getContent() : "");
                    if (l.getExtra() != null && !l.getExtra().trim().isEmpty()) {
                        try {
                            java.util.Map<String, Object> map = new com.fasterxml.jackson.databind.ObjectMapper().readValue(l.getExtra(), java.util.Map.class);
                            Object name = map.get("name");
                            if (name != null) item.put("name", name);
                            Object role = map.get("role");
                            if (role != null) item.put("role", role);
                            Object personality = map.get("personality");
                            if (personality != null) item.put("personality", personality);
                            Object gender = map.get("gender");
                            if (gender != null) item.put("gender", gender);
                            Object age = map.get("age");
                            if (age != null) item.put("age", age);
                            Object bio = map.get("bio");
                            if (bio != null) item.put("bio", bio);
                            Object description = map.get("description");
                            if (description != null) item.put("description", description);
                        } catch (Exception ignore) {
                        }
                    }
                    loreResp.add(item);
                }
                if ("location".equals(l.getType())) {
                    java.util.Map<String, Object> item = new java.util.HashMap<>();
                    item.put("id", l.getId());
                    item.put("type", "location");
                    item.put("title", l.getTitle() != null ? l.getTitle() : "地点设定");
                    item.put("content", l.getContent() != null ? l.getContent() : "");
                    if (l.getExtra() != null && !l.getExtra().trim().isEmpty()) {
                        try {
                            java.util.Map<String, Object> map = new com.fasterxml.jackson.databind.ObjectMapper().readValue(l.getExtra(), java.util.Map.class);
                            Object name = map.get("name");
                            if (name != null) item.put("name", name);
                            Object description = map.get("description");
                            if (description != null) item.put("description", description);
                            Object address = map.get("address");
                            if (address != null) item.put("address", address);
                            Object region = map.get("region");
                            if (region != null) item.put("region", region);
                        } catch (Exception ignore) {
                        }
                    }
                    loreResp.add(item);
                }
                if ("item".equals(l.getType())) {
                    java.util.Map<String, Object> item = new java.util.HashMap<>();
                    item.put("id", l.getId());
                    item.put("type", "item");
                    item.put("title", l.getTitle() != null ? l.getTitle() : "物品设定");
                    item.put("content", l.getContent() != null ? l.getContent() : "");
                    if (l.getExtra() != null && !l.getExtra().trim().isEmpty()) {
                        try {
                            java.util.Map<String, Object> map = new com.fasterxml.jackson.databind.ObjectMapper().readValue(l.getExtra(), java.util.Map.class);
                            Object name = map.get("name");
                            if (name != null) item.put("name", name);
                            Object description = map.get("description");
                            if (description != null) item.put("description", description);
                            Object category = map.get("category");
                            if (category != null) item.put("category", category);
                            Object effect = map.get("effect");
                            if (effect != null) item.put("effect", effect);
                            Object rarity = map.get("rarity");
                            if (rarity != null) item.put("rarity", rarity);
                        } catch (Exception ignore) {
                        }
                    }
                    loreResp.add(item);
                }
                if ("plot".equals(l.getType())) {
                    java.util.Map<String, Object> item = new java.util.HashMap<>();
                    item.put("id", l.getId());
                    item.put("type", "plot");
                    item.put("title", l.getTitle() != null ? l.getTitle() : "剧情架构");
                    item.put("content", l.getContent() != null ? l.getContent() : "");
                    if (l.getExtra() != null && !l.getExtra().trim().isEmpty()) {
                        try {
                            java.util.Map<String, Object> map = new com.fasterxml.jackson.databind.ObjectMapper().readValue(l.getExtra(), java.util.Map.class);
                            plotExtra = map;
                            Object conflict = map.get("conflict");
                            if (conflict != null) item.put("conflict", conflict);
                            Object hooks = map.get("hooks");
                            if (hooks != null) item.put("hooks", hooks);
                            Object twists = map.get("twists");
                            if (twists != null) item.put("twists", twists);
                        } catch (Exception ignore) {
                        }
                    }
                    loreResp.add(item);
                }
                if (l.getType() == null || "other".equals(l.getType())) {
                    java.util.Map<String, Object> item = new java.util.HashMap<>();
                    item.put("id", l.getId());
                    item.put("type", "other");
                    item.put("title", l.getTitle() != null ? l.getTitle() : "设定");
                    item.put("content", l.getContent() != null ? l.getContent() : "");
                    if (l.getExtra() != null && !l.getExtra().trim().isEmpty()) {
                        try {
                            java.util.Map<String, Object> map = new com.fasterxml.jackson.databind.ObjectMapper().readValue(l.getExtra(), java.util.Map.class);
                            Object name = map.get("name");
                            if (name != null) item.put("name", name);
                            Object description = map.get("description");
                            if (description != null) item.put("description", description);
                        } catch (Exception ignore) {
                        }
                    }
                    loreResp.add(item);
                }
            }
        }
        NovelProjectCreateReqVO.OutlineVO outlineForPlot = null;
        boolean hasOutlineLore = false;
        if (lore != null && !lore.isEmpty()) {
            NovelProjectCreateReqVO.OutlineVO firstOutline = null;
            for (NovelLoreDO l : lore) {
                if ("outline".equals(l.getType())) {
                    hasOutlineLore = true;
                    NovelProjectCreateReqVO.OutlineVO o = fromJson(l.getExtra(), NovelProjectCreateReqVO.OutlineVO.class);
                    if (o == null) {
                        o = new NovelProjectCreateReqVO.OutlineVO();
                        o.setSummary(l.getContent());
                    }
                    if (o.getVolumes() == null && vols != null && !vols.isEmpty()) {
                        List<NovelProjectCreateReqVO.OutlineVolumeVO> ov = new ArrayList<>();
                        for (NovelVolumeDO v : vols) {
                            NovelProjectCreateReqVO.OutlineVolumeVO item = new NovelProjectCreateReqVO.OutlineVolumeVO();
                            item.setTitle(v.getTitle());
                            item.setSummary(v.getSummary());
                            ov.add(item);
                        }
                        o.setVolumes(ov);
                    }
                    if (firstOutline == null) firstOutline = o;
                    java.util.Map<String, Object> item = new java.util.HashMap<>();
                    item.put("id", l.getId());
                    item.put("type", "outline");
                    item.put("title", l.getTitle() != null ? l.getTitle() : "主大纲");
                    item.put("content", l.getContent() != null ? l.getContent() : "");
                    item.put("isPrimary", firstOutline == o);
                    item.put("summary", o.getSummary());
                    item.put("volumes", o.getVolumes());
                    loreResp.add(item);
                }
            }
            outlineForPlot = firstOutline;
        }
        if (!hasOutlineLore && cs.getOutline() != null) {
            NovelProjectCreateReqVO.OutlineVO outline = cs.getOutline();
            java.util.Map<String, Object> item = new java.util.HashMap<>();
            item.put("id", "outline");
            item.put("type", "outline");
            item.put("title", "主大纲");
            item.put("content", "");
            item.put("isPrimary", Boolean.TRUE);
            item.put("summary", outline.getSummary());
            item.put("volumes", outline.getVolumes());
            loreResp.add(item);
            outlineForPlot = outline;
        }
        if (data.get("style") != null || data.get("genre") != null || data.get("tags") != null) {
            java.util.Map<String, Object> narrative = new java.util.HashMap<>();
            narrative.put("id", "narrative");
            narrative.put("type", "narrative");
            narrative.put("title", "叙事策略");
            narrative.put("tone", data.get("style"));
            narrative.put("pacing", data.get("genre"));
            Object tagsObj = data.get("tags");
            List<String> themes = new ArrayList<>();
            if (tagsObj instanceof List) {
                themes = ((List<?>) tagsObj).stream()
                        .filter(java.util.Objects::nonNull)
                        .map(Object::toString)
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .distinct()
                        .collect(java.util.stream.Collectors.toList());
            } else if (tagsObj instanceof String) {
                String s = ((String) tagsObj).trim();
                if (!s.isEmpty()) {
                    themes = java.util.Arrays.stream(s.split(","))
                            .map(String::trim)
                            .filter(x -> !x.isEmpty())
                            .distinct()
                            .collect(java.util.stream.Collectors.toList());
                }
            }
            narrative.put("themes", themes);
            loreResp.add(narrative);
        }
        {
            java.util.Map<String, Object> plot = new java.util.HashMap<>();
            plot.put("id", "plot");
            plot.put("type", "plot");
            plot.put("title", "剧情架构");
            Object conflict = plotExtra != null ? plotExtra.get("conflict") : (outlineForPlot != null ? outlineForPlot.getMainConflict() : null);
            Object hooks = plotExtra != null ? plotExtra.get("hooks") : new ArrayList<>();
            Object twists = plotExtra != null ? plotExtra.get("twists") : null;
            plot.put("conflict", conflict);
            plot.put("hooks", hooks);
            plot.put("twists", twists);
            loreResp.add(plot);
        }
        data.put("lore", loreResp);
        return success(data);
    }


    /**
     * 更新小说项目
     * 
     * @param id 小说项目ID
     * @param reqVO 小说项目更新请求参数
     * @return 更新结果
     */
    @PutMapping("/{id}")
    public CommonResult<Boolean> update(@PathVariable("id") Long id, @RequestBody NovelProjectUpdateReqVO reqVO) {
        NovelProjectDO update = new NovelProjectDO();
        update.setId(id);
        update.setTitle(reqVO.getTitle());
        update.setDescription(reqVO.getDescription());
        update.setGenre(reqVO.getGenre());
        update.setStyle(reqVO.getStyle());
        String tagsJoined = null;
        String tagsStr = reqVO.getTags();
        if (tagsStr != null) {
            String s = tagsStr.trim();
            if (!s.isEmpty()) {
                if (s.startsWith("[") && s.endsWith("]")) {
                    try {
                        java.util.List<String> arr = new com.fasterxml.jackson.databind.ObjectMapper()
                                .readValue(s, new com.fasterxml.jackson.core.type.TypeReference<java.util.List<String>>() {});
                        String joined = String.join(",", arr.stream()
                                .filter(x -> x != null)
                                .map(String::trim)
                                .filter(x -> !x.isEmpty())
                                .distinct()
                                .toList());
                        tagsJoined = joined.isEmpty() ? null : joined;
                    } catch (Exception ignore) {
                        tagsJoined = s;
                    }
                } else {
                    java.util.List<String> arr = java.util.Arrays.stream(s.split(","))
                            .map(String::trim)
                            .filter(x -> !x.isEmpty())
                            .distinct()
                            .collect(java.util.stream.Collectors.toList());
                    String joined = String.join(",", arr);
                    tagsJoined = joined.isEmpty() ? null : joined;
                }
            }
        }
        update.setTags(tagsJoined);
        projectService.updateProject(update);
        return success(true);
    }

    /**
     * 删除小说项目
     * 
     * @param id 小说项目ID
     * @return 删除结果
     */
    @DeleteMapping("/{id}")
    public CommonResult<Boolean> delete(@PathVariable("id") Long id) {
        projectService.deleteProject(id);
        return success(true);
    }

    /**
     * 创建小说卷
     * 
     * @param id 小说项目ID
     * @param reqVO 卷创建请求参数
     * @return 创建的卷
     */
    @PostMapping("/{id}/volumes")
    public CommonResult<NovelVolumeDO> createVolume(@PathVariable("id") Long id, @Valid @RequestBody NovelVolumeCreateReqVO reqVO) {
        return success(projectService.createVolume(id, reqVO.getTitle()));
    }


    /**
     * 更新小说卷
     * 
     * @param id 小说项目ID
     * @param vid 卷ID
     * @param reqVO 卷更新请求参数
     * @return 更新结果
     */
    @PutMapping("/{id}/volumes/{vid}")
    public CommonResult<Boolean> updateVolume(@PathVariable("id") Long id, @PathVariable("vid") Long vid, @RequestBody NovelVolumeUpdateReqVO reqVO) {
        NovelVolumeDO vol = new NovelVolumeDO();
        vol.setId(vid);
        vol.setProjectId(id);
        vol.setTitle(reqVO.getTitle());
        vol.setSummary(reqVO.getSummary());
        projectService.updateVolume(vol);
        return success(true);
    }

    /**
     * 删除小说卷
     * 
     * @param id 小说项目ID
     * @param vid 卷ID
     * @return 删除结果
     */
    @DeleteMapping("/{id}/volumes/{vid}")
    public CommonResult<Boolean> deleteVolume(@PathVariable("id") Long id, @PathVariable("vid") Long vid) {
        projectService.deleteVolume(id, vid);
        return success(true);
    }

    /**
     * 获取卷的里程碑列表
     * 
     * @param id 小说项目ID
     * @param vid 卷ID
     * @return 里程碑列表
     */
    @GetMapping("/{id}/volumes/{vid}/milestones")
    public CommonResult<List<NovelVolumeMilestoneDO>> listMilestones(@PathVariable("id") Long id, @PathVariable("vid") Long vid) {
        return success(projectService.getMilestones(id, vid));
    }

    @PostMapping("/{id}/volumes/{vid}/milestones")
    public CommonResult<NovelVolumeMilestoneDO> createMilestone(@PathVariable("id") Long id, @PathVariable("vid") Long vid,
                                                                @Valid @RequestBody NovelMilestoneCreateReqVO reqVO) {
        NovelVolumeMilestoneDO m = new NovelVolumeMilestoneDO();
        m.setProjectId(id);
        m.setVolumeId(vid);
        m.setTitle(reqVO.getTitle());
        m.setDescription(reqVO.getDescription());
        m.setType(reqVO.getType());
        m.setPaceType(reqVO.getPaceType());
        m.setCoolPoints(reqVO.getCoolPoints());
        m.setReversals(reqVO.getReversals());
        m.setForeshadows(reqVO.getForeshadows());
        m.setCharacterIds(reqVO.getCharacterIds());
        m.setStartChapterId(reqVO.getStartChapterId());
        m.setEndChapterId(reqVO.getEndChapterId());
        m.setEstimatedChapters(reqVO.getEstimatedChapters());
        m.setOrderIndex(reqVO.getOrderIndex());
        m.setEnabled(reqVO.getEnabled());
        return success(projectService.createMilestone(m));
    }

    @PutMapping("/{id}/volumes/{vid}/milestones/{mid}")
    public CommonResult<Boolean> updateMilestone(@PathVariable("id") Long id, @PathVariable("vid") Long vid, @PathVariable("mid") Long mid,
                                                 @Valid @RequestBody NovelMilestoneUpdateReqVO reqVO) {
        NovelVolumeMilestoneDO m = new NovelVolumeMilestoneDO();
        m.setId(mid);
        m.setProjectId(id);
        m.setVolumeId(vid);
        m.setTitle(reqVO.getTitle());
        m.setDescription(reqVO.getDescription());
        m.setType(reqVO.getType());
        m.setPaceType(reqVO.getPaceType());
        m.setCoolPoints(reqVO.getCoolPoints());
        m.setReversals(reqVO.getReversals());
        m.setForeshadows(reqVO.getForeshadows());
        m.setCharacterIds(reqVO.getCharacterIds());
        m.setStartChapterId(reqVO.getStartChapterId());
        m.setEndChapterId(reqVO.getEndChapterId());
        m.setEstimatedChapters(reqVO.getEstimatedChapters());
        m.setOrderIndex(reqVO.getOrderIndex());
        m.setEnabled(reqVO.getEnabled());
        projectService.updateMilestone(m);
        return success(true);
    }

    @DeleteMapping("/{id}/volumes/{vid}/milestones/{mid}")
    public CommonResult<Boolean> deleteMilestone(@PathVariable("id") Long id, @PathVariable("vid") Long vid, @PathVariable("mid") Long mid) {
        projectService.deleteMilestone(id, mid);
        return success(true);
    }

    @PostMapping("/{id}/volumes/{vid}/chapters")
    public CommonResult<NovelChapterDO> createChapter(@PathVariable("id") Long id, @PathVariable("vid") Long vid, @Valid @RequestBody NovelChapterCreateReqVO reqVO) {
        return success(projectService.createChapter(id, vid, reqVO.getTitle(), reqVO.getSummary(), reqVO.getCharacterIds()));
    }

    @PostMapping("/{id}/volumes/{vid}/chapters/batch")
    public CommonResult<List<NovelChapterDO>> createChaptersBatch(@PathVariable("id") Long id, @PathVariable("vid") Long vid,
                                                                  @Valid @RequestBody NovelChapterBatchCreateReqVO body) {
        List<NovelChapterDO> chapters = new ArrayList<>();
        List<NovelChapterCreateReqVO> reqList = body != null ? body.getChapters() : null;
        if (reqList != null) {
            for (NovelChapterCreateReqVO req : reqList) {
                NovelChapterDO ch = new NovelChapterDO();
                ch.setTitle(req.getTitle());
                ch.setSummary(req.getSummary());
                List<String> cids = req.getCharacterIds();
                String joined = cids != null ? String.join(",", cids.stream()
                        .filter(s -> s != null)
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .distinct()
                        .toList()) : null;
                ch.setCharacterIds(joined != null && !joined.isEmpty() ? joined : null);
                chapters.add(ch);
            }
        }
        return success(projectService.createChaptersBatch(id, vid, chapters));
    }

    @PutMapping("/{nid}/volumes/{vid}/chapters/{cid}")
    public CommonResult<Boolean> updateChapter(@PathVariable("nid") Long nid, @PathVariable("vid") String vid, @PathVariable("cid") Long cid,
                                               @RequestBody java.util.Map<String, Object> body) {
        try {
            System.out.println("updateChapter called: nid=" + nid + ", cid=" + cid);
            if (body != null) {
                System.out.println("Body keys: " + body.keySet());
                if (body.containsKey("characterIds")) {
                    Object val = body.get("characterIds");
                    System.out.println("characterIds type: " + (val == null ? "null" : val.getClass().getName()));
                    System.out.println("characterIds value: " + val);
                }
            }

            NovelChapterDO ch = new NovelChapterDO();
            ch.setId(cid);
            ch.setProjectId(nid);
            if (body != null) {
                if (body.containsKey("title")) {
                    Object vTitle = body.get("title");
                    ch.setTitle(vTitle != null ? String.valueOf(vTitle) : null);
                }
                if (body.containsKey("summary")) {
                    Object vSummary = body.get("summary");
                    ch.setSummary(vSummary != null ? String.valueOf(vSummary) : null);
                }
                if (body.containsKey("content")) {
                    Object vContent = body.get("content");
                    ch.setContent(vContent != null ? String.valueOf(vContent) : null);
                }
                if (body.containsKey("characterIds")) {
                    Object vCharacterIds = body.get("characterIds");
                    String joined = "";
                    if (vCharacterIds instanceof java.util.Collection<?> coll) {
                        List<String> list = new ArrayList<>();
                        for (Object o : coll) {
                            String t = o != null ? String.valueOf(o).trim() : "";
                            if (!t.isEmpty() && !list.contains(t)) list.add(t);
                        }
                        joined = list.isEmpty() ? "" : String.join(",", list);
                    } else if (vCharacterIds instanceof String s) {
                        String trimmed = s.trim();
                        if (trimmed.isEmpty()) {
                            joined = "";
                        } else if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                            try {
                                // Try to parse as JSON array (may contain mixed types)
                                com.fasterxml.jackson.databind.JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(trimmed);
                                List<String> list = new ArrayList<>();
                                if (node.isArray()) {
                                    for (com.fasterxml.jackson.databind.JsonNode item : node) {
                                        String t = item.asText(null);
                                        if (t == null && item.isTextual()) t = item.textValue();
                                        if (t == null) t = item.toString();
                                        if (t != null) {
                                            t = t.trim();
                                            // Remove surrounding quotes if toString added them
                                            if (t.startsWith("\"") && t.endsWith("\"") && t.length() > 1) {
                                                t = t.substring(1, t.length() - 1);
                                            }
                                            if (!t.isEmpty() && !list.contains(t)) list.add(t);
                                        }
                                    }
                                }
                                joined = list.isEmpty() ? "" : String.join(",", list);
                            } catch (Exception ignore) {
                                joined = trimmed;
                            }
                        } else if (trimmed.contains(",")) {
                            List<String> list = new ArrayList<>();
                            for (String part : trimmed.split(",")) {
                                String t = part != null ? part.trim() : "";
                                if (!t.isEmpty() && !list.contains(t)) list.add(t);
                            }
                            joined = list.isEmpty() ? "" : String.join(",", list);
                        } else {
                            joined = trimmed;
                        }
                    } else if (vCharacterIds != null) {
                        // Handle ArrayList or other List types that Jackson might deserialize into directly if not caught by Collection check
                        // This block is crucial if vCharacterIds is an ArrayList but not a Collection (which is impossible in Java, but Jackson might produce something unexpected)
                        // Or if it is some other object we want to toString
                        if (vCharacterIds instanceof java.util.List) {
                            List<?> listRaw = (List<?>) vCharacterIds;
                            List<String> list = new ArrayList<>();
                            for (Object o : listRaw) {
                                String t = o != null ? String.valueOf(o).trim() : "";
                                if (!t.isEmpty() && !list.contains(t)) list.add(t);
                            }
                            joined = list.isEmpty() ? "" : String.join(",", list);
                        } else {
                            String trimmed = String.valueOf(vCharacterIds).trim();
                            joined = trimmed;
                        }
                    }
                    ch.setCharacterIds(joined);
                }
                if (body.containsKey("beatSheet")) {
                    Object bs = body.get("beatSheet");
                    String beatJson;
                    if (bs instanceof com.fasterxml.jackson.databind.JsonNode) {
                        beatJson = toJson(bs);
                    } else if (bs instanceof java.util.Map || bs instanceof java.util.Collection) {
                        beatJson = toJson(bs);
                    } else {
                        beatJson = bs != null ? String.valueOf(bs) : null;
                    }
                    ch.setBeatSheet(beatJson);
                }
            }
            projectService.updateChapter(ch);
            return success(true);
        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("Error in updateChapter: " + e.getMessage());
            return error(500, "系统异常: " + e.getMessage());
        }
    }

    @GetMapping("/{id}/export-chapters")
    public ResponseEntity<String> exportChapters(@PathVariable("id") Long id) {
        NovelProjectDO project = projectService.getProject(id);
        if (project == null) {
            return ResponseEntity.status(404).body("Novel not found");
        }
        List<NovelVolumeDO> volumes = projectService.getVolumes(id);
        List<NovelChapterDO> allChapters = projectService.getChaptersByProject(id);
        String text = buildChaptersExportText(project, volumes, allChapters);
        String fileName = ((project.getTitle() != null && !project.getTitle().trim().isEmpty()) ? project.getTitle().trim() : "小说") + "-正文.doc";
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Content-Type", "application/msword; charset=utf-8");
        headers.add("Content-Disposition", "attachment; filename=\"" + encodedFileName + "\"");
        return ResponseEntity.ok().headers(headers).body(text);
    }

    @GetMapping("/{id}/export-lore")
    public ResponseEntity<String> exportLore(@PathVariable("id") Long id) {
        NovelProjectDO project = projectService.getProject(id);
        if (project == null) {
            return ResponseEntity.status(404).body("Novel not found");
        }
        List<NovelLoreDO> lore = projectService.getLoreList(id);
        String text = buildLoreExportText(lore);
        String fileName = ((project.getTitle() != null && !project.getTitle().trim().isEmpty()) ? project.getTitle().trim() : "小说") + "-设定集.doc";
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Content-Type", "application/msword; charset=utf-8");
        headers.add("Content-Disposition", "attachment; filename=\"" + encodedFileName + "\"");
        return ResponseEntity.ok().headers(headers).body(text);
    }

    @PostMapping("/{id}/chapters/{cid}/character-knowledge")
    public CommonResult<NovelCharacterKnowledgeDO> saveCharacterKnowledge(@PathVariable("id") Long projectId,
                                                                          @PathVariable("cid") Long chapterId,
                                                                          @Valid @RequestBody AppNovelCharacterKnowledgeSaveReqVO reqVO) {
        NovelCharacterKnowledgeDO k = new NovelCharacterKnowledgeDO();
        k.setProjectId(projectId);
        k.setChapterId(chapterId);
        k.setCharacterLoreId(reqVO.getCharacterLoreId());
        k.setKnownFacts(reqVO.getKnownFacts());
        k.setMisunderstandings(reqVO.getMisunderstandings());
        k.setSuspicions(reqVO.getSuspicions());
        k.setExtra(reqVO.getExtra());
        return success(knowledgeService.saveOrUpdateKnowledge(k));
    }

    @GetMapping("/{id}/chapters/{cid}/character-knowledge")
    public CommonResult<Object> listOrGetCharacterKnowledge(@PathVariable("id") Long projectId,
                                                            @PathVariable("cid") Long chapterId,
                                                            @RequestParam(value = "characterLoreId", required = false) String characterKey) {
        Long resolvedId = resolveCharacterLoreId(projectId, characterKey);
        if (resolvedId != null) {
            return success(knowledgeService.getKnowledge(projectId, chapterId, resolvedId));
        }
        List<NovelCharacterKnowledgeDO> list = knowledgeService.listByProjectAndChapter(projectId, chapterId);
        return success(list);
    }

    @GetMapping("/{id}/characters/{lid}/knowledge-timeline")
    public CommonResult<List<NovelCharacterKnowledgeDO>> characterKnowledgeTimeline(@PathVariable("id") Long projectId,
                                                                                    @PathVariable("lid") String characterKey) {
        Long resolvedId = resolveCharacterLoreId(projectId, characterKey);
        if (resolvedId == null) {
            return success(java.util.Collections.emptyList());
        }
        return success(knowledgeService.getCharacterTimeline(projectId, resolvedId));
    }

    @GetMapping("/{id}/chapters/progress")
    public CommonResult<List<java.util.Map<String, Object>>> listProgressChapters(@PathVariable("id") Long projectId,
                                                                                  @RequestParam("chapterId") Long chapterId,
                                                                                  @RequestParam(value = "maxChars", required = false) Integer maxChars) {
        return success(buildProgressChapters(projectId, chapterId, maxChars));
    }

    @GetMapping("/{id}/chapters/{cid}/progress")
    public CommonResult<List<java.util.Map<String, Object>>> listProgressChaptersCompat(@PathVariable("id") Long projectId,
                                                                                        @PathVariable("cid") Long chapterId,
                                                                                        @RequestParam(value = "maxChars", required = false) Integer maxChars) {
        return success(buildProgressChapters(projectId, chapterId, maxChars));
    }

    private List<java.util.Map<String, Object>> buildProgressChapters(Long projectId, Long chapterId, Integer maxChars) {
        int limit = (maxChars != null && maxChars > 0) ? maxChars : 1200;
        List<NovelChapterDO> chapters = projectService.getChaptersProgress(projectId, chapterId);
        List<java.util.Map<String, Object>> list = new java.util.ArrayList<>();
        for (NovelChapterDO ch : chapters) {
            if (ch == null) continue;
            java.util.Map<String, Object> item = new java.util.HashMap<>();
            item.put("id", ch.getId() != null ? String.valueOf(ch.getId()) : null);
            item.put("title", ch.getTitle());
            String content = ch.getContent() != null ? ch.getContent() : "";
            String trimmed = content.trim();
            if (trimmed.length() > limit) {
                trimmed = trimmed.substring(0, limit);
            }
            item.put("contentExcerpt", trimmed);
            item.put("summary", trimmed);
            list.add(item);
        }
        return list;
    }

    private Long resolveCharacterLoreId(Long projectId, String key) {
        if (key == null) {
            return null;
        }
        String v = key.trim();
        if (v.isEmpty()) {
            return null;
        }
        boolean allDigits = true;
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            if (c < '0' || c > '9') {
                allDigits = false;
                break;
            }
        }
        if (allDigits) {
            try {
                return Long.valueOf(v);
            } catch (NumberFormatException ignore) {
            }
        }
        String type = null;
        if ("protagonist".equals(v)) {
            type = "protagonist";
        } else if ("antagonist".equals(v)) {
            type = "antagonist";
        }
        if (type == null) {
            return null;
        }
        List<NovelLoreDO> loreList = projectService.getLoreList(projectId);
        if (loreList == null || loreList.isEmpty()) {
            return null;
        }
        for (NovelLoreDO lore : loreList) {
            if (type.equals(lore.getType()) && lore.getId() != null) {
                return lore.getId();
            }
        }
        return null;
    }

    @DeleteMapping("/{id}/chapters/{cid}")
    public CommonResult<Boolean> deleteChapter(@PathVariable("id") Long id, @PathVariable("cid") Long cid) {
        projectService.deleteChapter(id, cid);
        return success(true);
    }

    @GetMapping("/chapters/{cid}/content")
    public CommonResult<String> getChapterContent(@PathVariable("cid") Long cid) {
        return success(projectService.getChapterContent(cid));
    }

    @GetMapping("/chapters/{cid}/beat-sheet")
    public CommonResult<String> getChapterBeatSheet(@PathVariable("cid") Long cid) {
        return success(projectService.getChapterBeatSheet(cid));
    }

    @GetMapping("/{id}/relations")
    public CommonResult<NovelRelationsDO> getRelations(@PathVariable("id") Long id) {
        return success(projectService.getRelations(id));
    }

    @PutMapping("/{id}/relations")
    public CommonResult<Boolean> updateRelations(@PathVariable("id") Long id, @RequestBody NovelRelationsUpdateReqVO reqVO) {
        Object edges = reqVO.getEdges();
        String edgesJson;
        if (edges instanceof com.fasterxml.jackson.databind.JsonNode) {
            edgesJson = toJson(edges);
        } else if (edges instanceof java.util.Map || edges instanceof java.util.Collection) {
            edgesJson = (edges != null && !edges.toString().trim().isEmpty()) ? toJson(edges) : null;
        } else {
            edgesJson = edges != null ? String.valueOf(edges) : null;
        }
        Object positions = reqVO.getPositions();
        String positionsJson;
        if (positions instanceof com.fasterxml.jackson.databind.JsonNode) {
            positionsJson = toJson(positions);
        } else if (positions instanceof java.util.Map || positions instanceof java.util.Collection) {
            positionsJson = toJson(positions);
        } else {
            positionsJson = positions != null ? String.valueOf(positions) : null;
        }
        projectService.updateRelations(id, edgesJson, positionsJson);
        return success(true);
    }

    @PutMapping("/{id}/volumes/{vid}/reorder")
    public CommonResult<Boolean> reorderChapters(@PathVariable("id") Long id, @PathVariable("vid") Long vid, @RequestBody java.util.Map<String, java.util.List<String>> body) {
        java.util.List<String> strIds = body != null ? body.get("chapterIds") : null;
        java.util.List<Long> ids = new java.util.ArrayList<>();
        if (strIds != null) {
            for (String s : strIds) {
                if (s == null) continue;
                String t = s.trim();
                if (t.isEmpty()) continue;
                try {
                    ids.add(Long.valueOf(t));
                } catch (NumberFormatException ex) {
                    throw new IllegalArgumentException("章节 ID 必须为数字字符串");
                }
            }
        }
        if (CollectionUtils.isEmpty(ids) || ids.size() != 2) {
            throw new IllegalArgumentException("章节 ID 列表不能为空，且只能包含 2 个元素");
        }
        projectService.reorderChapters(id, vid, ids);
        return success(true);
    }


    @GetMapping("/{id}/lore")
    public CommonResult<List<NovelLoreDO>> getLores(@PathVariable("id") Long id) {
        return success(projectService.getLoreList(id));
    }

    @PostMapping("/{nid}/lore")
    public CommonResult<NovelLoreDO> createLore(@PathVariable("nid") Long nid, @RequestBody java.util.Map<String, Object> body) {
        String type = body != null && body.get("type") != null ? String.valueOf(body.get("type")) : "other";
        String title = body != null && body.get("title") != null ? String.valueOf(body.get("title")) : null;
        String content = body != null && body.get("content") != null ? String.valueOf(body.get("content")) : null;
        String name = body != null && body.get("name") != null ? String.valueOf(body.get("name")) : null;
        if (title == null || title.trim().isEmpty()) {
            switch (type) {
                case "outline" -> title = (title == null ? "主大纲" : title);
                case "world" -> title = "世界观设定";
                case "protagonist" ->
                        title = (name != null && !name.trim().isEmpty()) ? ("主角：" + name.trim()) : "主角设定";
                case "antagonist" ->
                        title = (name != null && !name.trim().isEmpty()) ? ("反派：" + name.trim()) : "反派设定";
                case "character" -> title = (name != null && !name.trim().isEmpty()) ? name.trim() : "人物设定";
                default -> title = "设定";
            }
        }
        java.util.Map<String, Object> extraMap = new java.util.LinkedHashMap<>();
        if (body != null) {
            for (java.util.Map.Entry<String, Object> e : body.entrySet()) {
                String k = e.getKey();
                if ("content".equals(k) || "title".equals(k) || "type".equals(k) || "id".equals(k) || "_id".equals(k) || "loreId".equals(k))
                    continue;
                extraMap.put(k, e.getValue());
            }
        }
        String extraJson = extraMap.isEmpty() ? null : toJson(extraMap);
        NovelLoreDO created = projectService.createLore(nid, title, type);
        created.setContent(content);
        created.setExtra(extraJson);
        projectService.updateLore(created);
        return success(created);
    }

    @PutMapping("/{nid}/lore/{lid}")
    public CommonResult<NovelLoreOutlineRespVO> getLore(@PathVariable("nid") Long nid, @PathVariable("lid") String lid, @RequestBody NovelLoreDO body) {
        NovelProjectDO projectDO = projectService.getProject(nid);
        List<NovelVolumeDO> volumes = projectService.getVolumes(nid);
        NovelLoreOutlineRespVO resp = new NovelLoreOutlineRespVO();
        resp.setId(nid);
        resp.setSummary(projectDO.getDescription());
        resp.setVolumes(volumes);
        return success(resp);
    }

    @PostMapping("/{nid}/lore/{lid}")
    public CommonResult<Boolean> updateLore(@PathVariable("nid") Long nid, @PathVariable("lid") Long lid, @RequestBody java.util.Map<String, Object> body) {
        String type = body != null && body.get("type") != null ? String.valueOf(body.get("type")) : "other";
        String title = body != null && body.get("title") != null ? String.valueOf(body.get("title")) : null;
        String content = body != null && body.get("content") != null ? String.valueOf(body.get("content")) : null;
        String name = body != null && body.get("name") != null ? String.valueOf(body.get("name")) : null;
        if (title == null || title.trim().isEmpty()) {
            switch (type) {
                case "outline" -> title = (title == null ? "主大纲" : title);
                case "world" -> title = "世界观设定";
                case "protagonist" ->
                        title = (name != null && !name.trim().isEmpty()) ? ("主角：" + name.trim()) : "主角设定";
                case "antagonist" ->
                        title = (name != null && !name.trim().isEmpty()) ? ("反派：" + name.trim()) : "反派设定";
                case "character" -> title = (name != null && !name.trim().isEmpty()) ? name.trim() : "人物设定";
                default -> title = "设定";
            }
        }
        Long bodyId = null;
        if (body != null) {
            Object idObj = body.get("id");
            if (idObj == null) idObj = body.get("_id");
            if (idObj != null) {
                String s = String.valueOf(idObj);
                if (s != null) {
                    String t = s.trim();
                    if (!t.isEmpty()) {
                        try {
                            bodyId = Long.valueOf(t);
                        } catch (Exception ignored) {
                        }
                    }
                }
            }
        }
        NovelLoreDO target = null;
        if (bodyId == null) {
            List<NovelLoreDO> loreList = projectService.getLoreList(nid);
            if (loreList != null) {
                for (NovelLoreDO l : loreList) {
                    if (l.getType() != null && l.getType().equals(type)) {
                        target = l;
                        break;
                    }
                }
            }
        }
        java.util.Map<String, Object> extraMap = new java.util.LinkedHashMap<>();
        if (body != null) {
            for (java.util.Map.Entry<String, Object> e : body.entrySet()) {
                String k = e.getKey();
                if ("content".equals(k) || "title".equals(k) || "type".equals(k) || "id".equals(k) || "_id".equals(k) || "loreId".equals(k))
                    continue;
                extraMap.put(k, e.getValue());
            }
        }
        String extraJson = extraMap.isEmpty() ? null : toJson(extraMap);
        if ("plot".equals(type)) {
            List<NovelLoreDO> loreList = projectService.getLoreList(nid);
            NovelLoreDO existing = null;
            if (loreList != null) {
                for (NovelLoreDO l : loreList) {
                    if ("plot".equals(l.getType())) {
                        existing = l;
                        break;
                    }
                }
            }
            if (existing != null) {
                NovelLoreDO update = new NovelLoreDO();
                update.setId(existing.getId());
                update.setProjectId(nid);
                update.setType(type);
                update.setTitle(title);
                update.setContent(content);
                update.setExtra(extraJson);
                projectService.updateLore(update);
            } else {
                NovelLoreDO created = projectService.createLore(nid, title, type);
                created.setContent(content);
                created.setExtra(extraJson);
                projectService.updateLore(created);
            }
            return success(true);
        }
        if (bodyId != null) {
            NovelLoreDO update = new NovelLoreDO();
            update.setId(bodyId);
            update.setProjectId(nid);
            update.setType(type);
            update.setTitle(title);
            update.setContent(content);
            update.setExtra(extraJson);
            projectService.updateLore(update);
        } else if (target != null) {
            NovelLoreDO update = new NovelLoreDO();
            update.setId(target.getId());
            update.setProjectId(nid);
            update.setType(type);
            update.setTitle(title);
            update.setContent(content);
            update.setExtra(extraJson);
            projectService.updateLore(update);
        } else {
            NovelLoreDO created = projectService.createLore(nid, title, type);
            created.setContent(content);
            created.setExtra(extraJson);
            projectService.updateLore(created);
        }
        return success(true);
    }

    /**
     * 导入设定JSON
     *
     * @param id 小说项目ID
     * @param body 导入请求参数
     * @return 导入结果
     */
    @PostMapping(value = "/{id}/lore/import", consumes = MediaType.APPLICATION_JSON_VALUE)
    public CommonResult<NovelLoreImportRespVO> importLoreJson(@PathVariable("id") Long id, @RequestBody NovelLoreImportJsonReqVO body) {
        String type = body.getType() != null ? body.getType() : "other";
        String content = body.getContent() != null ? body.getContent() : "";
        String fileName = body.getFileName() != null ? body.getFileName() : "导入设定";
        return success(doLoreImport(id, type, content, fileName));
    }

    /**
     * 导入设定文件
     *
     * @param id 小说项目ID
     * @param file 上传的文件
     * @param type 设定类型
     * @return 导入结果
     * @throws Exception 导入异常
     */
    @PostMapping(value = "/{id}/lore/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CommonResult<NovelLoreImportRespVO> importLoreFile(@PathVariable("id") Long id, @RequestParam("file") MultipartFile file, @RequestParam(value = "type", required = false) String type) throws Exception {
        String content = fileParseService.parseFile(file);
        String fileName = file.getOriginalFilename();
        String fixedType = type != null ? type : "other";
        return success(doLoreImport(id, fixedType, content, fileName));
    }

    /**
     * 执行设定导入
     *
     * @param projectId 小说项目ID
     * @param type 设定类型
     * @param content 设定内容
     * @param fileName 文件名
     * @return 导入结果
     */
    private NovelLoreImportRespVO doLoreImport(Long projectId, String type, String content, String fileName) {
        String normalized = content.replace("\r\n", "\n");
        List<String> sections = splitByHeadings(normalized);
        String baseTitle = fileName != null ? fileName.replaceAll("\\.[^.]+$", "") : "导入设定";
        List<NovelLoreDO> created = new ArrayList<>();
        NovelLoreDO backup = projectService.createLore(projectId, baseTitle + "-原始备份", type);
        backup.setContent(normalized);
        projectService.updateLore(backup);
        if (sections != null && sections.size() > 1) {
            int limit = Math.min(sections.size(), 100);
            for (int i = 0; i < limit; i++) {
                String section = sections.get(i);
                String tline = section.trim().split("\n")[0].replaceFirst("^#+\\s*", "").trim();
                NovelLoreDO lore = projectService.createLore(projectId, tline.isEmpty() ? (baseTitle + "_" + (i + 1)) : tline, type);
                lore.setContent(section);
                projectService.updateLore(lore);
                created.add(lore);
            }
            NovelLoreImportRespVO resp = new NovelLoreImportRespVO();
            resp.setCount(created.size());
            resp.setItems(created);
            resp.setBackupId(backup.getId());
            return resp;
        }
        NovelLoreDO lore = projectService.createLore(projectId, baseTitle, type);
        lore.setContent(normalized);
        projectService.updateLore(lore);
        NovelLoreImportRespVO resp = new NovelLoreImportRespVO();
        resp.setCount(1);
        resp.setItems(List.of(lore));
        resp.setBackupId(backup.getId());
        return resp;
    }

    /**
     * 按标题分割内容
     *
     * @param s 内容
     * @return 分割后的内容列表
     */
    private List<String> splitByHeadings(String s) {
        String[] lines = s.split("\n");
        List<Integer> indices = new ArrayList<>();
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            if (line.matches("^#+\\s+.+")) indices.add(i);
        }
        if (indices.size() <= 1) return null;
        List<String> chunks = new ArrayList<>();
        for (int k = 0; k < indices.size(); k++) {
            int start = indices.get(k);
            int end = k + 1 < indices.size() ? indices.get(k + 1) : lines.length;
            String section = String.join("\n", java.util.Arrays.copyOfRange(lines, start, end)).trim();
            if (!section.isEmpty()) chunks.add(section);
        }
        return chunks;
    }

    /**
     * 生成行
     *
     * @param k 键
     * @param v 值
     * @return 生成的行
     */
    private String line(String k, String v) {
        if (v == null) return null;
        String t = v.trim();
        if (t.isEmpty()) return null;
        return k + t;
    }

    /**
     * 连接行
     *
     * @param arr 行数组
     * @return 连接后的字符串
     */
    private String joinLines(String... arr) {
        List<String> out = new ArrayList<>();
        if (arr != null) {
            for (String s : arr) {
                if (s != null && !s.trim().isEmpty()) out.add(s.trim());
            }
        }
        return String.join("\n", out);
    }

    /**
     * 转换为JSON
     *
     * @param obj 对象
     * @return JSON字符串
     */
    private String toJson(Object obj) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(obj);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 从JSON转换
     *
     * @param json JSON字符串
     * @param type 目标类型
     * @param <T> 泛型类型
     * @return 转换后的对象
     */
    private <T> T fromJson(String json, Class<T> type) {
        try {
            if (json == null || json.trim().isEmpty()) return null;
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, type);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 转义HTML
     *
     * @param s 原始字符串
     * @return 转义后的字符串
     */
    private String escapeHtmlForExport(String s) {
        if (s == null) return "";
        String t = s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
        return t;
    }

    /**
     * 去除Markdown
     *
     * @param s 原始字符串
     * @return 去除Markdown后的字符串
     */
    private String stripMarkdownForExport(String s) {
        if (s == null) return "";
        String t = s.replace("\r\n", "\n");
        t = t.replaceAll("^\\s*>\\s*", "");
        t = t.replaceAll("(?m)^#{1,6}\\s*", "");
        t = t.replaceAll("(?m)^\\s*[-*+]\\s*", "");
        t = t.replaceAll("\\*\\*(.+?)\\*\\*", "$1");
        t = t.replaceAll("\\*(.+?)\\*", "$1");
        t = t.replaceAll("`{1,3}([^`]+?)`{1,3}", "$1");
        t = t.replaceAll("!\\[[^\\]]*]\\([^)]*\\)", "");
        t = t.replaceAll("\\[[^\\]]*]\\([^)]*\\)", "$1");
        t = t.replaceAll("\\n{3,}", "\n\n");
        return t.trim();
    }

    private String buildChaptersExportText(NovelProjectDO project, List<NovelVolumeDO> volumes, List<NovelChapterDO> allChapters) {
        List<NovelVolumeDO> vols = volumes != null ? volumes : new ArrayList<>();
        if (vols.isEmpty()) {
            return "<html><head><meta charset=\"UTF-8\"></head><body><p>暂无章节</p></body></html>";
        }
        StringBuilder parts = new StringBuilder();
        parts.append("<html><head><meta charset=\"UTF-8\"></head><body>\n");
        Map<Long, List<NovelChapterDO>> byVol = allChapters != null ? allChapters.stream()
                .filter(c -> c.getVolumeId() != null)
                .collect(Collectors.groupingBy(NovelChapterDO::getVolumeId, LinkedHashMap::new, Collectors.toList())) : new LinkedHashMap<>();
        for (NovelVolumeDO vol : vols) {
            String volTitle = escapeHtmlForExport(vol.getTitle() != null ? vol.getTitle() : "未命名分卷");
            parts.append("<h1>").append(volTitle).append("</h1>\n");
            List<NovelChapterDO> chapters = byVol.getOrDefault(vol.getId(), new ArrayList<>());
            chapters.sort(java.util.Comparator.comparing(c -> c.getOrderIndex() != null ? c.getOrderIndex() : 0));
            for (NovelChapterDO chap : chapters) {
                String chapTitle = escapeHtmlForExport(chap.getTitle() != null ? chap.getTitle() : "未命名章节");
                parts.append("<h2>").append(chapTitle).append("</h2>\n");
                String raw = chap.getContent() != null && !chap.getContent().trim().isEmpty() ? stripMarkdownForExport(chap.getContent()) : "（暂无内容）";
                if (raw != null && !raw.trim().isEmpty()) {
                    String escaped = escapeHtmlForExport(raw);
                    String[] blocks = escaped.split("\\n{2,}");
                    for (String block : blocks) {
                        if (block == null || block.isEmpty()) continue;
                        String withBreaks = block.replace("\n", "<br/>");
                        parts.append("<p>").append(withBreaks).append("</p>\n");
                    }
                }
            }
        }
        parts.append("</body></html>");
        return parts.toString();
    }

    private String buildLoreExportText(List<NovelLoreDO> loreItems) {
        List<NovelLoreDO> items = loreItems != null ? loreItems : new ArrayList<>();
        if (items.isEmpty()) {
            return "<html><head><meta charset=\"UTF-8\"></head><body><p>暂无设定</p></body></html>";
        }
        Map<String, List<NovelLoreDO>> groups = new LinkedHashMap<>();
        for (NovelLoreDO item : items) {
            String type = item.getType() != null ? item.getType() : "other";
            groups.computeIfAbsent(type, k -> new ArrayList<>()).add(item);
        }
        List<String> orderedTypes = new ArrayList<>();
        orderedTypes.add("character");
        orderedTypes.add("world");
        orderedTypes.add("plot");
        orderedTypes.add("narrative");
        orderedTypes.add("location");
        orderedTypes.add("item");
        orderedTypes.add("other");
        for (String t : new ArrayList<>(groups.keySet())) {
            if (!orderedTypes.contains(t)) orderedTypes.add(t);
        }
        Map<String, String> typeLabels = new LinkedHashMap<>();
        typeLabels.put("character", "人物设定");
        typeLabels.put("world", "世界与规则");
        typeLabels.put("plot", "剧情架构");
        typeLabels.put("narrative", "叙事策略");
        typeLabels.put("location", "地点设定");
        typeLabels.put("item", "物品设定");
        typeLabels.put("other", "其他设定");
        StringBuilder parts = new StringBuilder();
        parts.append("<html><head><meta charset=\"UTF-8\"></head><body>\n");
        for (String type : orderedTypes) {
            List<NovelLoreDO> list = groups.get(type);
            if (list == null || list.isEmpty()) continue;
            String typeTitle = escapeHtmlForExport(typeLabels.getOrDefault(type, type));
            parts.append("<h1>").append(typeTitle).append("</h1>\n");
            for (NovelLoreDO item : list) {
                String itemTitleText = item.getTitle() != null ? item.getTitle() : "未命名设定";
                String itemTitle = escapeHtmlForExport(itemTitleText);
                parts.append("<h2>").append(itemTitle).append("</h2>\n");
                String body = "";
                if (item.getContent() != null && !item.getContent().trim().isEmpty()) {
                    body = stripMarkdownForExport(item.getContent());
                } else if (item.getExtra() != null && !item.getExtra().trim().isEmpty()) {
                    try {
                        Map<String, Object> map = new com.fasterxml.jackson.databind.ObjectMapper().readValue(item.getExtra(), java.util.Map.class);
                        List<String> lines = new ArrayList<>();
                        for (Map.Entry<String, Object> e : map.entrySet()) {
                            String k = e.getKey();
                            if ("timeline".equals(k) || "volumes".equals(k)) continue;
                            Object v = e.getValue();
                            if (v instanceof String s) {
                                if (!s.trim().isEmpty()) lines.add(k + "：" + stripMarkdownForExport(s));
                            } else if (v instanceof List<?> arr && !arr.isEmpty() && arr.stream().allMatch(x -> x instanceof String)) {
                                String joined = arr.stream().map(x -> ((String) x)).collect(Collectors.joining("，"));
                                if (!joined.trim().isEmpty()) lines.add(k + "：" + joined);
                            }
                        }
                        body = String.join("\n", lines);
                    } catch (Exception ignore) {
                        body = "";
                    }
                }
                if (body != null && !body.trim().isEmpty()) {
                    String escapedBody = escapeHtmlForExport(body);
                    String[] blocks = escapedBody.split("\\n{2,}");
                    for (String block : blocks) {
                        if (block == null || block.isEmpty()) continue;
                        String withBreaks = block.replace("\n", "<br/>");
                        parts.append("<p>").append(withBreaks).append("</p>\n");
                    }
                }
                if ("world".equals(type)) {
                    String timelineText = "";
                    if (item.getExtra() != null && !item.getExtra().trim().isEmpty()) {
                        try {
                            Map<String, Object> map = new com.fasterxml.jackson.databind.ObjectMapper().readValue(item.getExtra(), java.util.Map.class);
                            Object tl = map.get("timeline");
                            if (tl instanceof String s) {
                                timelineText = s;
                            } else if (tl instanceof List<?> arr && !arr.isEmpty() && arr.stream().allMatch(x -> x instanceof String)) {
                                timelineText = ((List<String>) arr).stream().collect(Collectors.joining("\n"));
                            }
                        } catch (Exception ignore) {
                        }
                    }
                    if (timelineText != null && !timelineText.trim().isEmpty()) {
                        String sectionTitle = escapeHtmlForExport("时间线");
                        parts.append("<h2>").append(sectionTitle).append("</h2>\n");
                        String normalizedTimeline = stripMarkdownForExport(timelineText);
                        String escapedTimeline = escapeHtmlForExport(normalizedTimeline);
                        String[] blocks = escapedTimeline.split("\\n{2,}");
                        for (String block : blocks) {
                            if (block == null || block.isEmpty()) continue;
                            String withBreaks = block.replace("\n", "<br/>");
                            parts.append("<p>").append(withBreaks).append("</p>\n");
                        }
                    }
                }
            }
        }
        parts.append("</body></html>");
        return parts.toString();
    }

    @DeleteMapping("/{id}/lore/{lid}")
    public CommonResult<Boolean> deleteLore(@PathVariable("id") Long id, @PathVariable("lid") Long lid) {
        projectService.deleteLore(id, lid);
        return success(true);
    }

    @GetMapping("/{id}/foreshadowing")
    public CommonResult<List<NovelForeshadowingDO>> getForeshadowing(@PathVariable("id") Long id) {
        return success(projectService.getForeshadowingList(id));
    }

    @PutMapping("/{nid}/chapters/{cid}/foreshadowing")
    public CommonResult<Boolean> updateForeshadowing(@PathVariable("nid") Long nid, @PathVariable("cid") Long cid, @RequestBody NovelForeshadowingUpdateReqVO body) {
        projectService.updateForeshadowing(nid, cid, body.getForeshadowing());
        return success(true);
    }
}