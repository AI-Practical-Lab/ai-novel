---
description: 核心约束 - 防止代码被意外破坏
globs:
alwaysApply: true
---
# 回复语言
- 所有回复都必须使用中文。

# 项目核心约束规则

## 修改边界
- **严格限定修改范围**：当用户提及修改某个特定功能或文件时，你的注意力**必须**完全聚焦于该处。使用 `@file` 或 `@folder` 命令来明确上下文。
- **禁止“修复”无关问题**：在解决指定问题时，**禁止**“顺便”修复你看到的其他代码风格问题、拼写错误或你认为可以“优化”的地方。
- **原子化任务**：将复杂需求拆解为用户可以逐步验证的小任务。完成一个，提交一个（提示用户）。

## 代码保护
- **测试先行锁定**：如果项目存在测试文件（如 `*_test.js`, `*.spec.ts`），在修改功能代码前，**优先**参考或根据需求编写测试用例。这些测试用例是功能的“契约”，你的修改**必须**通过它们。
- **关键文件保护区**：以下文件/目录被视为敏感区域，未经用户明确指令，**严禁**进行任何修改：
  - `package.json`, `go.mod`, `requirements.txt` 等依赖管理文件
  - 项目配置文件（如 `webpack.config.js`, `docker-compose.yml`）
  - 数据库迁移文件 (`migrations/`)
  - 认证、授权核心逻辑文件 (`/src/auth`, `/middleware/auth`)
  - 核心数据模型 (`/src/models`, `/schemas`)

# MCP Interactive Feedback 规则
1. 在任何流程、任务、对话进行时,无论是询问、回复、或完成阶段性任务,皆必须调用 MCP mcp-feedback-enhanced。
2. 每当收到用户反馈,若反馈内容非空,必须再次调用MCP mcp-feedback-enhanced,并根据反馈内容调整行为。
3. 仅当用户明确表示「结束」或「不再需要交互」时,才可停止调用 MCP mcp-feedback-enhanced,流程才算结束。
4. 除非收到结束指令,否则所有步骤都必须重复调用 MCP mcp-feedback-enhanced。
5. 完成任务前,必须使用 MCP mcp-feedback-enhanced 工具向用户询问反馈。
 
 ## 代码规范
 - 前端使用 TypeScript + React，遵循现有 ESLint 配置与类型约束，优先函数式组件与受控数据流，避免使用 any。
 - 样式遵循项目既有约定与工具链（如 Tailwind），避免魔法数与内联样式；主题状态通过统一的状态/Hook 管理。
 - 网络请求统一通过 `src/api` 层封装，组件内不直接编排底层请求；响应需进行规范化处理后再下发到视图。
 - 命名采用语义化与驼峰（类/组件为大驼峰），文件夹与文件名保持一致性与可读性；避免不明缩写。
 - 严禁在未约定的公共位置输出日志或写入敏感信息；配置与密钥不得入库。
 
 ## 后端 MVC 分层规范
 - Controller 仅负责接收/校验参数与返回结果，禁止直接访问 Mapper 或编写业务/数据访问逻辑。
 - Service 定义业务接口；ServiceImpl 负责编排业务流程与事务控制，统一进行权限与归属校验。
 - Mapper 只承担数据库 CRUD；数据对象使用 DO，对外返回使用 VO/DTO；对象转换通过 Convert 层完成。
 - 统一使用 CommonResult 封装接口响应；异常通过全局处理器归一化为错误码与信息。
 - 分层调用严格遵循 Controller → Service → ServiceImpl → Mapper，不得跨层调用或循环依赖。
 
 ## 模块结构声明（小说相关业务代码位置），如果没有特意说明，当前项目的修改仅限于以下两个目录下的文件
 - d:\adevelop\AINOVEL_NEW\ai-novel\frontend：小说项目前端模块（Vite + React + TypeScript）。
 - d:\adevelop\AINOVEL_NEW\ai-novel\ruoyi-vue-pro\yudao-module-novel：小说项目后端模块（Ruoyi/Spring Boot 模块）。

