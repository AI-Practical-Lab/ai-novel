package cn.hb.wk.dal.mysql.project;

import cn.hb.wk.mybatis.core.mapper.BaseMapperX;
import cn.hb.wk.mybatis.core.query.LambdaQueryWrapperX;
import cn.hb.wk.dal.dataobject.project.NovelProjectDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface NovelProjectMapper extends BaseMapperX<NovelProjectDO> {
    default List<NovelProjectDO> selectListByCreatorOrderByUpdateDesc() {
        return selectList(new LambdaQueryWrapperX<NovelProjectDO>()
                .orderByDesc(NovelProjectDO::getUpdateTime));
    }
    default NovelProjectDO selectByIdAndCreator(Long id, String creator) {
        return selectOne(new LambdaQueryWrapperX<NovelProjectDO>()
                .eq(NovelProjectDO::getId, id));
//                .eq(NovelProjectDO::getCreator, creator));
    }
}
