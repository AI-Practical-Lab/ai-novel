package cn.iocoder.yudao.dal.mysql.project;

import cn.iocoder.yudao.mybatis.core.mapper.BaseMapperX;
import cn.iocoder.yudao.mybatis.core.query.LambdaQueryWrapperX;
import cn.iocoder.yudao.dal.dataobject.project.NovelVolumeDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface NovelVolumeMapper extends BaseMapperX<NovelVolumeDO> {
    default List<NovelVolumeDO> selectListByProjectId(Long projectId) {
        return selectList(new LambdaQueryWrapperX<NovelVolumeDO>()
                .eq(NovelVolumeDO::getProjectId, projectId)
                .orderByAsc(NovelVolumeDO::getOrderIndex)
                .orderByAsc(NovelVolumeDO::getId));
    }
}
