package cn.iocoder.yudao.dal.mysql.milestone;

import cn.iocoder.yudao.mybatis.core.mapper.BaseMapperX;
import cn.iocoder.yudao.mybatis.core.query.LambdaQueryWrapperX;
import cn.iocoder.yudao.dal.dataobject.milestone.NovelVolumeMilestoneDO;
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
