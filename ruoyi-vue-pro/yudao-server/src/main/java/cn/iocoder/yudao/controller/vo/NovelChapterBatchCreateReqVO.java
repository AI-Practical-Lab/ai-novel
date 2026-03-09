package cn.iocoder.yudao.controller.vo;

import jakarta.validation.Valid;
import lombok.Data;
import java.util.List;

@Data
public class NovelChapterBatchCreateReqVO {
    @Valid
    private List<NovelChapterCreateReqVO> chapters;
}
