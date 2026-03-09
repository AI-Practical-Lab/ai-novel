package cn.iocoder.yudao.controller.vo;

import cn.iocoder.yudao.dal.dataobject.foreshadow.NovelForeshadowingDO;
import lombok.Data;

import java.util.List;

@Data
public class NovelForeshadowingUpdateReqVO {
    private List<NovelForeshadowingDO> foreshadowing;
}
