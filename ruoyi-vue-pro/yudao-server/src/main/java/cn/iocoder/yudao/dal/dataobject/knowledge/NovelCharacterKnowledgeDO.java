package cn.iocoder.yudao.dal.dataobject.knowledge;

import cn.iocoder.yudao.mybatis.core.dataobject.BaseDO;
import com.baomidou.mybatisplus.annotation.KeySequence;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@TableName("novel_character_knowledge")
@KeySequence("novel_character_knowledge_seq")
@Data
public class NovelCharacterKnowledgeDO extends BaseDO {
    @TableId
    private Long id;
    private Long projectId;
    private Long chapterId;
    private Long characterLoreId;
    private String knownFacts;
    private String misunderstandings;
    private String suspicions;
    private String extra;
}
