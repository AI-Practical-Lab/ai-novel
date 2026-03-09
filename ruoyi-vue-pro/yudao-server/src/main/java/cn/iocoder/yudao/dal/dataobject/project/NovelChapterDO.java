package cn.iocoder.yudao.dal.dataobject.project;

import cn.iocoder.yudao.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@TableName("novel_chapter")
@KeySequence("novel_chapter_seq")
@Data
public class NovelChapterDO extends BaseDO {
    @TableId
    private Long id;
    private Long projectId;
    private Long volumeId;
    private String title;
    private String summary;
    private String content;
    private String beatSheet;
    private String characterIds;
    private Integer orderIndex;
}
