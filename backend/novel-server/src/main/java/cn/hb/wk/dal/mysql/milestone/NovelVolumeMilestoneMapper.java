package cn.hb.wk.dal.mysql.milestone;

import cn.hb.wk.mybatis.core.mapper.BaseMapperX;
import cn.hb.wk.mybatis.core.query.LambdaQueryWrapperX;
import cn.hb.wk.dal.dataobject.milestone.NovelVolumeMilestoneDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface NovelVolumeMilestoneMapper extends BaseMapperX<NovelVolumeMilestoneDO> {
    default List<NovelVolumeMilestoneDO> selectListByProjectId(Long projectId) {
        return selectList(new LambdaQueryWrapperX<NovelVolumeMilestoneDO>()
                .eq(NovelVolumeMilestoneDO::getProjectId, projectId)
                .orderByAsc(NovelVolumeMilestoneDO::getOrderIndex)
                .orderByAsc(NovelVolumeMilestoneDO::getId));
    }
    default List<NovelVolumeMilestoneDO> selectListByVolumeId(Long volumeId) {
        return selectList(new LambdaQueryWrapperX<NovelVolumeMilestoneDO>()
                .eq(NovelVolumeMilestoneDO::getVolumeId, volumeId)
                .orderByAsc(NovelVolumeMilestoneDO::getOrderIndex)
                .orderByAsc(NovelVolumeMilestoneDO::getId));
    }
}
