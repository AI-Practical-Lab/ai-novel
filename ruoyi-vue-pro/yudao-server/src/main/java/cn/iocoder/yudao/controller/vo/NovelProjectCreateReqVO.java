package cn.iocoder.yudao.controller.vo;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class NovelProjectCreateReqVO {
    @NotBlank
    private String title;
    private Long id;
    private String description;
    private String genre;
    private String style;
    private List<String> tags;
    private CoreSettingsVO coreSettings;

    @Data
    public static class CoreSettingsVO {
        private ProtagonistVO protagonist;
        private AntagonistVO antagonist;
        private WorldVO world;
        private OutlineVO outline;
    }

    @Data
    public static class ProtagonistVO {
        private String name;
        private String gender;
        private String age;
        private String personality;
        private String cheat;
    }

    @Data
    public static class AntagonistVO {
        private String name;
        private String role;
        private String personality;
    }

    @Data
    public static class WorldVO {
        private String background;
        private String powerSystem;
        private String forces;
    }

    @Data
    public static class OutlineVO {
        private String mainConflict;
        private String summary;
        private List<OutlineVolumeVO> volumes;
    }

    @Data
    public static class OutlineVolumeVO {
        @NotBlank
        private String title;
        private String summary;
    }
}
