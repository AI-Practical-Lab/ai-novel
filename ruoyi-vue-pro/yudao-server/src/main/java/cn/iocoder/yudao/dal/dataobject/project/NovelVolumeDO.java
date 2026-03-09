package cn.iocoder.yudao.dal.dataobject.project;

import cn.iocoder.yudao.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@TableName("novel_volume")
@KeySequence("novel_volume_seq")
@Data
public class NovelVolumeDO extends BaseDO {
    @TableId
    private Long id;
    private Long projectId;
    private String title;
    private String summary;
    private Integer orderIndex;
}
