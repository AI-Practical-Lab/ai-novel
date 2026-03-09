package cn.iocoder.yudao.dal.mysql.project;

import cn.iocoder.yudao.mybatis.core.mapper.BaseMapperX;
import cn.iocoder.yudao.mybatis.core.query.LambdaQueryWrapperX;
import cn.iocoder.yudao.dal.dataobject.project.NovelChapterDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface NovelChapterMapper extends BaseMapperX<NovelChapterDO> {
    default List<NovelChapterDO> selectListByVolumeId(Long volumeId) {
        return selectList(new LambdaQueryWrapperX<NovelChapterDO>()
                .eq(NovelChapterDO::getVolumeId, volumeId)
                .orderByAsc(NovelChapterDO::getOrderIndex)
                .orderByAsc(NovelChapterDO::getId));
    }
    default List<NovelChapterDO> selectListByProjectId(Long projectId) {
        return selectList(new LambdaQueryWrapperX<NovelChapterDO>()
                .eq(NovelChapterDO::getProjectId, projectId)
                .orderByAsc(NovelChapterDO::getVolumeId)
                .orderByAsc(NovelChapterDO::getOrderIndex)
                .orderByAsc(NovelChapterDO::getId));
    }

    @Select("""
            SELECT c.*
            FROM novel_chapter c
            JOIN novel_volume v ON v.id = c.volume_id
            JOIN (
              SELECT
                c2.volume_id AS target_volume_id,
                COALESCE(c2.order_index, 2147483647) AS target_chapter_order,
                COALESCE(v2.order_index, 2147483647) AS target_volume_order
              FROM novel_chapter c2
              JOIN novel_volume v2 ON v2.id = c2.volume_id
              WHERE c2.project_id = #{projectId}
                AND c2.id = #{chapterId}
            ) t ON 1 = 1
            WHERE c.project_id = #{projectId}
              AND (
                COALESCE(v.order_index, 2147483647) < t.target_volume_order
                OR (
                  COALESCE(v.order_index, 2147483647) = t.target_volume_order
                  AND COALESCE(c.order_index, 2147483647) <= t.target_chapter_order
                )
              )
            ORDER BY COALESCE(v.order_index, 2147483647) ASC,
                     COALESCE(c.order_index, 2147483647) ASC,
                     c.id ASC
            """)
    List<NovelChapterDO> selectProgressListByProjectAndChapter(@Param("projectId") Long projectId,
                                                              @Param("chapterId") Long chapterId);
}
