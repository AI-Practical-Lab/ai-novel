---
description: React/Vue 前端开发规范
globs: "**/*.tsx, **/*.vue, **/*.jsx"
alwaysApply: false
---
# 前端组件开发规范

## 技术栈约束
- **框架**：本项目使用 React 18+（函数式组件 + Hooks） / Vue 3 + Composition API。禁止使用类组件或 Options API（除非维护旧代码）。
- **状态管理**：优先使用框架内置状态管理（如 React `useState/Context`, Vue `Pinia`）。禁止引入未在 `package.json` 中声明的外部状态库。
- **样式方案**：使用 [Tailwind CSS / UnoCSS / 项目指定方案]。**禁止**使用内联 `style` 属性。

## 组件开发原则
- **单一职责**：每个组件只做一件事。将大型组件拆分为更小的、可复用的子组件。
- **Props 类型定义**：为所有组件 Props 明确定义 TypeScript 接口或类型，并添加必要的 JSDoc 注释。
- **无副作用渲染**：组件渲染函数必须是纯函数。数据获取、事件订阅等副作用必须在 `useEffect`（React）或 `onMounted`（Vue）等生命周期钩子中处理。
- **列表 Key**：渲染列表时，**必须**为每个子元素提供稳定且唯一的 `key` 属性，禁止使用数组索引。

## 性能与可维护性
- **Memoization**：对计算成本高的纯函数组件使用 `React.memo`（React）或 `computed`（Vue）。
- **依赖数组**：`useEffect`、`useMemo`、`useCallback` 必须包含完整且正确的依赖项数组。
- **优先使用已有组件**：在创建新组件前，**必须**先检查 `src/components/` 或 `src/business/` 目录下是否有可复用的现有组件。
