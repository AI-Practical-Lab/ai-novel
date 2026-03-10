package cn.hb.wk.dal.dataobject.lore;

import cn.hb.wk.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@TableName("novel_lore")
@KeySequence("novel_lore_seq")
@Data
public class NovelLoreDO extends BaseDO {
    @TableId
    private Long id;
    private Long projectId;
    private String type;
    private String title;
    private String content;
    private String extra;
}
