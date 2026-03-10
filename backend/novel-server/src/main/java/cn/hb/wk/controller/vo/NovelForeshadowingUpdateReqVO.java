package cn.hb.wk.controller.vo;

import cn.hb.wk.dal.dataobject.foreshadow.NovelForeshadowingDO;
import lombok.Data;

import java.util.List;

@Data
public class NovelForeshadowingUpdateReqVO {
    private List<NovelForeshadowingDO> foreshadowing;
}
