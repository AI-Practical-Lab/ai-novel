---
description: React + TypeScript 项目规范
globs: "**/*.tsx, **/*.ts"
alwaysApply: false
---
# React + TypeScript 项目开发规范

## 技术栈约束
- **框架与语言**：本项目使用 React 18+ 与 TypeScript 5+。**禁止**使用类组件、`any` 类型或已弃用的 API。
- **状态管理**：使用 `useState`, `useReducer`, Context API。**禁止**引入未在 `package.json` 中声明的外部状态库（如 Redux, MobX）。
- **样式方案**：使用 [Tailwind CSS/ styled-components / 等]。**禁止**使用内联 `style` 属性或未声明的 CSS-in-JS 库。

## 代码风格
- **组件定义**：全部使用函数式组件和 React Hooks。
- **命名规范**：组件采用 `PascalCase`，函数、变量采用 `camelCase`，常量采用 `UPPER_SNAKE_CASE`。
- **类型安全**：为所有 Props、State 和函数返回值明确定义 TypeScript 接口或类型。

## 安全与性能
- **副作用管理**：`useEffect` 必须包含正确的依赖项数组。**禁止**在渲染函数中直接进行数据获取或修改 DOM。
- **Key 属性**：渲染列表时，**必须**为每个子元素提供稳定且唯一的 `key` 属性。
