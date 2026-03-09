package cn.iocoder.yudao.dal.mysql.knowledge;

import cn.iocoder.yudao.mybatis.core.mapper.BaseMapperX;
import cn.iocoder.yudao.mybatis.core.query.LambdaQueryWrapperX;
import cn.iocoder.yudao.dal.dataobject.knowledge.NovelCharacterKnowledgeDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface NovelCharacterKnowledgeMapper extends BaseMapperX<NovelCharacterKnowledgeDO> {
    default List<NovelCharacterKnowledgeDO> selectListByProjectAndChapter(Long projectId, Long chapterId) {
        return selectList(new LambdaQueryWrapperX<NovelCharacterKnowledgeDO>()
                .eq(NovelCharacterKnowledgeDO::getProjectId, projectId)
                .eq(NovelCharacterKnowledgeDO::getChapterId, chapterId)
                .orderByAsc(NovelCharacterKnowledgeDO::getCharacterLoreId)
                .orderByAsc(NovelCharacterKnowledgeDO::getId));
    }
    default List<NovelCharacterKnowledgeDO> selectListByProjectAndCharacterTimeline(Long projectId, Long characterLoreId) {
        return selectList(new LambdaQueryWrapperX<NovelCharacterKnowledgeDO>()
                .eq(NovelCharacterKnowledgeDO::getProjectId, projectId)
                .eq(NovelCharacterKnowledgeDO::getCharacterLoreId, characterLoreId)
                .orderByAsc(NovelCharacterKnowledgeDO::getChapterId)
                .orderByAsc(NovelCharacterKnowledgeDO::getId));
    }
    default NovelCharacterKnowledgeDO selectOneByUniqueKey(Long projectId, Long chapterId, Long characterLoreId) {
        return selectOne(new LambdaQueryWrapperX<NovelCharacterKnowledgeDO>()
                .eq(NovelCharacterKnowledgeDO::getProjectId, projectId)
                .eq(NovelCharacterKnowledgeDO::getChapterId, chapterId)
                .eq(NovelCharacterKnowledgeDO::getCharacterLoreId, characterLoreId));
    }
}
