package cn.hb.wk.controller.vo;

import lombok.Data;

import java.util.List;

@Data
public class NovelProjectCreateRespVO {
    private String id;
    private String title;
    private String description;
    private String genre;
    private String style;
    private List<String> tags;
    private String author;
    private String cover;
    private String createdAt;
    private String updatedAt;
    private NovelProjectCreateReqVO.CoreSettingsVO coreSettings;
    private List<VolumeVO> volumes;

    @Data
    public static class VolumeVO {
        private String id;
        private String title;
        private String summary;
        private List<ChapterVO> chapters;
    }

    @Data
    public static class ChapterVO {
        private String id;
        private String title;
    }
}
