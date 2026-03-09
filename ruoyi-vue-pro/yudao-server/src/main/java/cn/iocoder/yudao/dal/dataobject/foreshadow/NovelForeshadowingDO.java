package cn.iocoder.yudao.dal.dataobject.foreshadow;

import cn.iocoder.yudao.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@TableName("novel_foreshadowing")
@KeySequence("novel_foreshadowing_seq")
@Data
public class NovelForeshadowingDO extends BaseDO {
    @TableId
    private Long id;
    private Long projectId;
    private String content;
    private Long chapterId;
    private String chapterTitle;
    private String status;
    private String visibility;
    private Long characterId;
    private Long resolvedChapterId;
    private String resolvedChapterTitle;
    private String type;
}
