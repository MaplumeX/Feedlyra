# fix: add token auto-refresh on 401 response

## Goal

修复后端重启后前端操作报 "Invalid token" 需要手动清除 token 重新登录的问题，通过在前端 API client 中添加 401 拦截 + 自动 refresh token 机制，使 token 过期时对用户无感。

## What I already know

* 后端 access token 15 分钟过期，refresh token 7 天过期（`backend/app/services/auth.py`）
* 后端已有 `POST /api/auth/refresh` 端点，接受 `refresh_token`，返回新的 token 对（`backend/app/routers/auth.py:61`）
* 前端 `refreshToken` 存在 Zustand 持久化状态中但从未使用
* 前端 `client.ts` 无任何 401 处理逻辑，错误直接抛出
* 前端 `sse.ts` 同样无 401 处理
* `ProtectedRoute` 只检查 token 是否存在，不检查有效性
* `api.upload` 也有独立的 fetch 调用，同样无 401 处理

## Assumptions (temporary)

* 后端 SECRET_KEY 是静态字符串（hardcoded default），重启不会改变签名密钥
* 用户遇到的 "Invalid token" 是 access token 过期导致的，不是密钥变化

## Open Questions

(全部已解决)

## Requirements (evolving)

* 当 API 请求返回 401 时，自动使用 refreshToken 调用 `/api/auth/refresh`
* refresh 成功：更新 localStorage + Zustand 中的 token，重试原请求
* refresh 失败：执行 logout（清除 token），toast 提示 "登录已过期，请重新登录"，然后跳转 `/login`
* 并发请求时只发一次 refresh 请求（其他请求等待结果复用）
* `sse.ts` 的 streaming 请求也需要处理 401

## Acceptance Criteria (evolving)

* [ ] access token 过期后，前端自动 refresh 并重试原请求，用户无感知
* [ ] refresh token 也过期时，toast 提示后 logout 并跳转登录页
* [ ] 多个并发请求同时收到 401 时，只发一次 refresh
* [ ] SSE/streaming 请求 401 时也能正确处理

## Definition of Done

* Lint / typecheck 通过
* 手动测试：access token 过期后操作仍正常；refresh token 过期后跳转登录

## Out of Scope (explicit)

* 后端 SECRET_KEY 配置优化（另开任务）
* token 过期前的主动刷新（proactive refresh）
* refresh token rotation / 黑名单（后端暂不支持）

## Technical Notes

* 关键文件：`frontend/src/api/client.ts`, `frontend/src/api/sse.ts`, `frontend/src/stores/auth.ts`
* 后端 refresh schema：`RefreshRequest { refresh_token: str }` → `TokenResponse { access_token, refresh_token, token_type }`
* Zustand store 的 `logout()` 需要在非 React 上下文中调用（API client 里），需要用 `useAuthStore.getState().logout()`
