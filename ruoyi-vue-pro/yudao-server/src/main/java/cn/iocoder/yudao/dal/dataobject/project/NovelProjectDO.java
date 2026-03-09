package cn.iocoder.yudao.dal.dataobject.project;

import cn.iocoder.yudao.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@TableName("novel_project")
@KeySequence("novel_project_seq")
@Data
public class NovelProjectDO extends BaseDO {
    @TableId
    private Long id;
    private String title;
    private String description;
    private String cover;
    private String author;
    private String genre;
    private String style;
    private String tags;
}
