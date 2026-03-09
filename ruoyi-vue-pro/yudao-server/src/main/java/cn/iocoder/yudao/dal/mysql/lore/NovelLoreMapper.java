package cn.iocoder.yudao.dal.mysql.lore;

import cn.iocoder.yudao.mybatis.core.mapper.BaseMapperX;
import cn.iocoder.yudao.mybatis.core.query.LambdaQueryWrapperX;
import cn.iocoder.yudao.dal.dataobject.lore.NovelLoreDO;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;

import java.util.Collection;
import java.util.List;

@Mapper
public interface NovelLoreMapper extends BaseMapperX<NovelLoreDO> {
    default List<NovelLoreDO> selectListByProjectId(Long projectId) {
        return selectList(new LambdaQueryWrapperX<NovelLoreDO>()
                .eq(NovelLoreDO::getProjectId, projectId)
                .orderByAsc(NovelLoreDO::getId));
    }

    @Delete("DELETE FROM novel_lore WHERE id = #{id}")
    int deleteRealById(Long id);

    @Delete({
            "<script>",
            "DELETE FROM novel_lore WHERE id IN",
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>",
            "#{id}",
            "</foreach>",
            "</script>"
    })
    int deleteRealByIds(Collection<Long> ids);
}
