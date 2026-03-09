# AI Novel Assistant (AI 小说创作助手)

一个现代化的、AI 驱动的小说创作辅助工具，旨在帮助作家从灵感到完稿的全流程创作。

## ✨ 核心特性

### 1. 🤖 深度 AI 辅助
- **流式写作**：像 ChatGPT 一样实时生成正文，支持暂停和续写。
- **智能上下文**：AI 自动读取你的设定集（世界观、角色）、大纲、上一章内容，确保生成的剧情连贯且符合设定。
- **设定优化**：利用 AI 润色角色描述和世界观设定，并提供直观的 Diff (红绿) 对比视图。
- **灵感风暴**：自动生成小说标题、简介、核心梗概和分卷规划。

### 2. 📚 结构化创作管理
- **分层架构**：书架 -> 分卷 -> 章节，清晰管理长篇小说结构。
- **路标系统 (Milestones)**：在创作正文前规划关键剧情节点（路标），并自动生成过渡剧情（Beat Sheet）。
- **细纲模式**：每章支持独立的细纲（Beat Sheet）编辑，先规划后写作。
- **剧情板 (Plot Board)**：可视化的分卷剧情规划，拖拽排序（开发中）。

### 3. 🎨 沉浸式编辑器
- **双模式编辑**：支持 Markdown 源码编辑和所见即所得的预览。
- **设定集侧边栏**：写作时随时查阅和引用角色、物品、地点设定。
- **专注模式**：简洁的 UI 设计，日/夜间模式切换，让你专注于文字本身。

### 4. 🛡️ 数据安全与管理
- **本地存储**：项目数据以 JSON 格式存储在本地，安全可控。
- **自动保存**：编辑器支持自动保存和手动保存（Ctrl+S）。
- **文件操作**：支持分卷和章节的增删改查，关键操作提供二次确认。

## 🛠️ 技术栈

- **前端**：React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons
- **后端**：Express.js (Node.js)
- **AI 集成**：OpenAI / DeepSeek API (兼容流式输出 SSE)
- **其他**：`diff` (文本比对), `react-router-dom` (路由)

## 🚀 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装与运行

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd AINovel
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   在根目录创建 `.env` 文件，填入你的 AI API Key：
   ```env
   DEEPSEEK_API_KEY=your_api_key_here
   # 或者
   OPENAI_API_KEY=your_api_key_here
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```
   同时启动前端（Vite, 端口 5173）和后端（Express, 端口 3001）。

5. **访问应用**
   打开浏览器访问 `http://localhost:5173`。

## 📝 目录结构

```
AINovel/
├── api/                # 后端 Express 服务
│   ├── routes/         # API 路由 (AI, Novels, Resources)
│   └── services/       # 业务逻辑 (ProjectService, LLMService)
├── src/                # 前端 React 应用
│   ├── components/     # UI 组件 (Editor, Sidebar, Modals)
│   ├── lib/            # 工具函数与 API 客户端
│   └── pages/          # 页面视图 (Layout, Home)
├── projects/           # 用户小说数据存储目录 (自动生成)
└── ...配置文件
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

[MIT License](LICENSE)

## 🤝 社区支持

遇到问题就加入我们！

![群二维码](frontend/public/QrCode.jpg)
