package cn.iocoder.yudao.dal.mysql.foreshadow;

import cn.iocoder.yudao.mybatis.core.mapper.BaseMapperX;
import cn.iocoder.yudao.mybatis.core.query.LambdaQueryWrapperX;
import cn.iocoder.yudao.dal.dataobject.foreshadow.NovelForeshadowingDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface NovelForeshadowingMapper extends BaseMapperX<NovelForeshadowingDO> {
    default List<NovelForeshadowingDO> selectListByProjectId(Long projectId) {
        return selectList(new LambdaQueryWrapperX<NovelForeshadowingDO>()
                .eq(NovelForeshadowingDO::getProjectId, projectId)
                .orderByAsc(NovelForeshadowingDO::getId));
    }
    default List<NovelForeshadowingDO> selectListByProjectIdAndChapterId(Long projectId, Long chapterId) {
        return selectList(new LambdaQueryWrapperX<NovelForeshadowingDO>()
                .eq(NovelForeshadowingDO::getProjectId, projectId)
                .eq(NovelForeshadowingDO::getChapterId, chapterId)
                .orderByAsc(NovelForeshadowingDO::getId));
    }
    default List<NovelForeshadowingDO> selectListByProjectIdAndVisibility(Long projectId, String visibility) {
        return selectList(new LambdaQueryWrapperX<NovelForeshadowingDO>()
                .eq(NovelForeshadowingDO::getProjectId, projectId)
                .eq(NovelForeshadowingDO::getVisibility, visibility)
                .orderByAsc(NovelForeshadowingDO::getId));
    }
    default List<NovelForeshadowingDO> selectListByProjectIdAndCharacterId(Long projectId, Long characterId) {
        return selectList(new LambdaQueryWrapperX<NovelForeshadowingDO>()
                .eq(NovelForeshadowingDO::getProjectId, projectId)
                .eq(NovelForeshadowingDO::getCharacterId, characterId)
                .orderByAsc(NovelForeshadowingDO::getId));
    }
}
