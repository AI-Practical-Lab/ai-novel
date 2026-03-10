package cn.hb.wk.dal.mysql.relation;

import cn.hb.wk.mybatis.core.mapper.BaseMapperX;
import cn.hb.wk.mybatis.core.query.LambdaQueryWrapperX;
import cn.hb.wk.dal.dataobject.relation.NovelRelationsDO;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface NovelRelationsMapper extends BaseMapperX<NovelRelationsDO> {
    default NovelRelationsDO selectByProjectId(Long projectId) {
        return selectOne(new LambdaQueryWrapperX<NovelRelationsDO>()
                .eq(NovelRelationsDO::getProjectId, projectId));
    }
}
