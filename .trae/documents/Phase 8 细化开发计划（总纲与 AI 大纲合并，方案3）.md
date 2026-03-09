## 原则对齐
- 最小化修改：先改读取链路与展示分组，保持现有数据不丢失；逐步替换旧使用点。
- 逐文件更改：每次只改一个文件，提交前单独验证该文件的功能与边界。
- 不触碰敏感区：不改依赖管理、全局配置、认证授权、数据库迁移。
- 验证优先：每一步落地均包含可验证检查点（手测/断言/日志比对）。
- 保留现有代码：不删除现有剧情架构字段，只做兼容与过渡读取。

## 影响范围与不触碰区域
- 影响文件（读取链路与展示）：
  - 展示分组：[ProjectSidebarLore.tsx](file:///D:/开发学习/AINovel/src/components/editor/ProjectSidebarLore.tsx)
  - 大纲生成入口与写入：[EditorLayout.tsx](file:///D:/开发学习/AINovel/src/pages/EditorLayout.tsx)
  - AI 上下文聚合：[useNovelReferences.ts](file:///D:/开发学习/AINovel/src/hooks/useNovelReferences.ts)
  - 新建向导大纲存储：[Step4Outline.tsx](file:///D:/开发学习/AINovel/src/components/wizard/Step4Outline.tsx)
  - 后端项目创建落盘（只读理解）：[projectService.ts](file:///D:/开发学习/AINovel/api/services/projectService.ts)
- 不触碰（除非后续明确授权）：package.json、webpack 等配置、认证/授权、数据库迁移。

## 分阶段任务（细化与验收）
### Task 8.1 数据现状梳理（只读）
- 内容：枚举主大纲潜在来源（coreSettings.outline、lore/plot.json.outline、type:'outline' Lore）。
- 验收：列出来源与字段差异清单，确认兼容策略（优先主大纲 → 兼容旧 plot.outline）。

### Task 8.2 统一数据模型设计（只设计与标注，不改后端）
- 内容：定义“主大纲（Primary Outline）”落点：采用 type:'outline' 的 Lore 中标记一个为主大纲（如字段 isPrimary:true），其内容结构支持 summary + volumes。
- 验收：计划文档中明确：主大纲字段、默认选择规则、与旧数据的对应关系。

### Task 8.3 读取链路重构（逐文件）
1) useNovelReferences.ts：
- 修改策略：读取主大纲（outline 类型且 isPrimary），若不存在则降级读取 plot.outline。
- 验收：
  - 有主大纲时，AI 上下文中“总纲：...”来自主大纲；
  - 无主大纲但有 plot.outline 时，仍有“总纲：...”输出；
  - 无任一时，输出为空但不报错。
2) EditorLayout.tsx（AI 写作/地点生成中的 globalLore 构造处）：
- 修改策略：与 useNovelReferences 一致的数据源逻辑。
- 验收：同上，串联场景生成文案“结合大纲…”的实际数据来源校验。

### Task 8.4 写入与迁移（前端逻辑，逐文件）
1) OutlineGeneratorModal / EditorLayout.tsx：
- 修改策略：AI 生成大纲后写入/更新主大纲（type:'outline' Lore，设置 isPrimary:true）；
- 验收：再次生成时主大纲被更新，系统上下文读取到最新内容。
2) 新建向导 Step4Outline.tsx：
- 修改策略：完成创建时，同步在“大纲与规划”创建主大纲 Lore（isPrimary:true），保留 plot.json.outline 作为过渡。
- 验收：新项目进入编辑界面后，主大纲存在且可被读取；旧 plot.outline 不影响主路径。
3) 迁移提示（不改后端）：
- 内容：当检测到仅存在 plot.outline 且没有主大纲时，前端提供“设为主大纲”按钮，执行一次性迁移（复制内容到 outline Lore 并设 isPrimary）。
- 验收：点击后主大纲建立成功；后续上下文读取走主大纲。

### Task 8.5 前端展示与交互（逐文件）
1) ProjectSidebarLore.tsx：
- 修改策略：在“大纲与规划”分组下展示主大纲；剧情架构分组保留“主线冲突/钩子/转折”，不再冗余显示总纲副本。
- 验收：侧边栏不重复展示总纲；入口统一；旧项目仍可通过迁移按钮建立主大纲。

### Task 8.6 回归测试与文档
- 内容：覆盖新建小说、生成大纲、章节生成、地点生成等流程的手测脚本与断言点；在 plan.md 记录验收通过。
- 验收：
  - 新建后主大纲存在且被上下文读取；
  - 旧项目迁移按钮工作正常；
  - 章节/地点生成均能读取主大纲；
  - 无敏感文件改动、无性能/错误日志新增。

## 风险与回滚
- 风险：主大纲与旧 plot.outline 冲突导致读取混乱。
- 控制：统一优先级（主大纲优先，旧 plot.outline 仅降级）；每一步完成后立即验证。
- 回滚：逐文件修改，保留原分支；如出现问题，撤销该文件改动即可恢复旧路径。

## 交付物
- 计划更新：plan.md Phase 8 细化任务清单与验收标准（已补充）。
- 改造结果：统一主大纲读取/写入链路、迁移入口与展示分组调整。
