package cn.hb.wk.dal.dataobject.relation;

import cn.hb.wk.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@TableName("novel_relations")
@KeySequence("novel_relations_seq")
@Data
public class NovelRelationsDO extends BaseDO {
    @TableId
    private Long id;
    private Long projectId;
    private String edges;
    private String positions;
}
