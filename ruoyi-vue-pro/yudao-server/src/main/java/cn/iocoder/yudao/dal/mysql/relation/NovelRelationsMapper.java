package cn.iocoder.yudao.dal.mysql.relation;

import cn.iocoder.yudao.mybatis.core.mapper.BaseMapperX;
import cn.iocoder.yudao.mybatis.core.query.LambdaQueryWrapperX;
import cn.iocoder.yudao.dal.dataobject.relation.NovelRelationsDO;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface NovelRelationsMapper extends BaseMapperX<NovelRelationsDO> {
    default NovelRelationsDO selectByProjectId(Long projectId) {
        return selectOne(new LambdaQueryWrapperX<NovelRelationsDO>()
                .eq(NovelRelationsDO::getProjectId, projectId));
    }
}
