# 为翻译、摘要、对话分别配置独立的AI模型和提供商

## Goal

允许用户为「AI 翻译」「AI 摘要」「AI 对话」三个功能分别配置不同的模型、提供商（base_url）和 API Key，同时支持"使用全局默认"的回退模式，让不想分别配置的用户无需重复填写。

## Requirements

1. 翻译、摘要、对话三个功能各自可有独立的 base_url、api_key、model（三个字段全部独立）
2. 每个功能一个「使用独立配置」开关，关闭时三个字段隐藏，自动使用全局 AI 配置
3. 前端设置页面：单页分区布局，全局设置在上，三个可折叠区域（翻译/摘要/对话）在下
4. 「连接测试」仅测试全局配置，不为独立配置提供单独的测试按钮
5. 数据库不预留未来扩展（不加第四个功能），按三个功能明确定义列
6. 关闭独立配置开关时立即回退到全局设置；切换全局配置不影响已开启独立配置的功能

## Acceptance Criteria

- [ ] 用户可以为翻译、摘要、对话分别设置不同的模型
- [ ] 用户可以为翻译、摘要、对话分别设置不同的 API endpoint
- [ ] 未开启独立配置时，自动使用全局配置
- [ ] 现有功能（翻译、摘要、对话、连接测试）不受影响
- [ ] 独立配置关闭后，对应功能立即回退到全局设置
- [ ] API Key 加密存储，与现有全局 key 一致的安全处理

## Decision (ADR-lite)

**Context**: 需要为翻译、摘要、对话三个 AI 功能支持独立的模型/提供商配置
**Decision**:
- 数据库：`users` 表新增 9 个列（3 功能 × 3 字段），命名如 `translate_model`, `translate_base_url`, `translate_api_key` 等
- 回退逻辑：功能独立配置未设置时，回退到全局 `ai_*` 配置
- UI：功能级「使用独立配置」开关，非字段级
- 不预留扩展，不增加独立连接测试
**Consequences**: 列较多但语义清晰；如果未来加第四个功能需要新迁移

## Out of Scope

- 支持非 OpenAI 兼容的 API 协议
- 不同功能使用不同的 API 协议（SDK）
- 为未来第四个 AI 功能预留数据库扩展
- 独立配置区域的连接测试按钮
- 字段级别的独立回退（不需要"用全局 key 但自定义 model"这种混合）

## Technical Approach

### 数据库变更
- `users` 表新增 9 列：`translate_base_url`, `translate_api_key`, `translate_model`, `summary_base_url`, `summary_api_key`, `summary_model`, `chat_base_url`, `chat_api_key`, `chat_model`
- 全部 nullable，NULL 表示回退到全局配置
- 新迁移文件：`008_per_feature_ai_config.py`

### 后端变更
- `app/models/user.py`: 新增 9 个 Mapped 列
- `app/schemas/ai.py`: `AIConfig` 扩展，增加 `translate`, `summary`, `chat` 三个嵌套对象，每个包含 `enabled`, `base_url`, `api_key`, `model`
- `app/routers/ai.py`: `GET/PUT /api/ai/config` 支持读写三个功能的独立配置
- `app/services/llm.py`: `get_user_llm_client()` 和 `get_user_model()` 接受 `feature` 参数（"translate" | "summary" | "chat"），按优先级取配置

### 前端变更
- `api/types.ts`: 新增 `FeatureAIConfig` 类型
- `api/hooks.ts`: 更新 `useAIConfig` / `useUpdateAIConfig`
- `AISettingsTab.tsx`: 重构为「全局配置」+ 三个可折叠功能配置区

## Technical Notes

- 后端核心文件：`backend/app/services/llm.py`、`backend/app/routers/ai.py`、`backend/app/config.py`、`backend/app/models/user.py`、`backend/app/schemas/ai.py`
- 前端核心文件：`frontend/src/components/settings/AISettingsTab.tsx`、`frontend/src/api/hooks.ts`、`frontend/src/api/types.ts`
- 迁移目录：`backend/alembic/versions/`，当前最新是 007
