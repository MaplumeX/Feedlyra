# Beautify Feedlyra UI Design and Styling

## Goal

对 Feedlyra RSS 阅读器进行全面的视觉美化，从当前标准 shadcn/ui slate 出厂主题升级为冷锐现代 (Sharp Modern) 风格，具备几何感、精确的网格、锐利边角，参考 Linear/Raycast 的工具美学，同时保持功能完整性不变。

## Requirements

### 美学方向: 冷锐现代 (Sharp Modern)
- 冷灰蓝色调，几何感强，精确的网格和锐利边角
- 克制的留白和间距节奏
- 视觉层次清晰，信息密度适中

### 字体策略: Google Fonts
- 引入 1-2 个特色字体 (UI 字体 + 标题字体)
- 需配置合理的系统字体 fallback
- 文章阅读器 (prose) 排版也融入新设计语言

### 动效程度: 克制精致
- 仅关键交互有动效：选中态过渡、面板展开/收起、hover 微移
- 所有动效 < 200ms，干净利落
- 无装饰性动画

### 改动范围: 全站
- 主界面三栏 (Sidebar + ArticleList + ArticleDetail)
- AI 聊天面板、命令面板、Popover 等子组件
- LoginPage / RegisterPage
- SettingsDialog 及其子标签页

### CSS 变量结构优化
- 重新组织变量命名，为未来主题切换/自定义主题预留
- 新增语义化变量 (如 `--sidebar-bg`, `--article-list-hover` 等)

### 阅读器 prose 适配
- 文章内容区排版融入新设计语言
- `prose` 样式与新主题协调：标题、链接、引用、代码块等

## Acceptance Criteria

- [ ] 界面视觉与当前"出厂默认"有明确区别
- [ ] 亮色/暗色模式均完整适配新主题
- [ ] 所有现有功能正常工作
- [ ] Google Fonts 有合理 fallback
- [ ] 新增 CSS 变量结构清晰、可扩展
- [ ] 阅读器 prose 排版与 UI 风格协调
- [ ] 登录页/注册页视觉升级并统一风格

## Definition of Done

* Lint / typecheck 通过
* 手动验证亮色/暗色模式下各页面
* 关键路径功能验证 (浏览文章、AI 功能、设置)
* Google Fonts 加载失败时验证 fallback

## Decision (ADR-lite)

**Context**: 需要确定整体美学方向和技术实现策略
**Decision**: 
- 美学: 冷锐现代 (Sharp Modern)，参考 Linear/Raycast
- 字体: Google Fonts 引入特色字体
- 动效: 克制精致 (< 200ms)
- 范围: 全站统一
- CSS 变量: 优化结构以支持未来主题切换
- 阅读器: prose 排版适配新风格
**Consequences**: 视觉提升显著，需关注 Google Fonts 加载性能和 fallback 体验

## Out of Scope

* 组件逻辑/状态管理重构
* 新增功能
* 后端改动
* 响应式/移动端适配
* 自定义主题 UI 功能 (仅预留变量结构)

## Technical Notes

* 主题修改集中在 `frontend/src/index.css` CSS 变量
* 字体通过 `index.html` 引入 Google Fonts
* 动效通过 Tailwind `transition` / `animate` + CSS keyframes 实现
* shadcn/ui 组件样式通过 CSS 变量全局影响
* 组件级样式通过修改对应 .tsx 文件中的 Tailwind class
* 新增语义化变量可在 `index.css` 中定义，供 Tailwind config 引用或在组件中直接使用
