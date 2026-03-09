package cn.iocoder.yudao.dal.mysql.project;

import cn.iocoder.yudao.mybatis.core.mapper.BaseMapperX;
import cn.iocoder.yudao.mybatis.core.query.LambdaQueryWrapperX;
import cn.iocoder.yudao.dal.dataobject.project.NovelProjectDO;
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
