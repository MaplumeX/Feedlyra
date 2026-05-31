# 完善用户系统

## Goal

完善 Feedlyra 当前的用户系统，让已登录用户能更完整地管理自己的账户，并补齐认证/用户资料相关的基础能力与前后端一致性。

## What I Already Know

* 用户希望“完善用户系统”，属于新功能/功能扩展，必须先走 Trellis 规划流程。
* 当前后端已有基础认证：
  * `POST /api/auth/register`
  * `POST /api/auth/login`
  * `POST /api/auth/refresh`
  * `GET /api/auth/me`
* 当前用户模型包含 `email`、`username`、`hashed_password`、AI 配置字段，以及时间戳/UUID mixin。
* 当前前端已有登录页、注册页、ProtectedRoute、auth store、401 后 refresh token 重试。
* 当前设置弹窗包含 General、AI、Subscriptions 三个 tab，尚未发现账户资料/改密码入口。
* 后端存在重复的 `UserResponse` schema：`backend/app/schemas/auth.py` 与 `backend/app/schemas/user.py` 都定义了相同结构。

## Assumptions (Temporary)

* 本任务优先面向已有本地账号体系，不引入第三方 OAuth。
* “完善”应尽量先做高价值账户基础能力，而不是一次性引入管理后台、组织/团队、多租户等大范围能力。
* 用户系统应覆盖后端 API、前端 UI、状态同步、双语文案和基础测试/质量检查。

## Open Questions

* None.

## Requirements (Evolving)

* 保持现有注册、登录、刷新 token、`/auth/me` 行为兼容。
* MVP 范围采用账户设置基础版：
  * 在设置弹窗中新增账户 tab。
  * 用户能查看当前邮箱、用户名。
  * 用户能修改用户名。
  * 用户能修改邮箱，提交时必须验证当前密码。
  * 用户能修改密码。
  * 退出登录体验应保持清晰、可达。
* 用户名或邮箱修改成功后保持当前登录状态，仅刷新前端当前用户信息。
* 新增/完善账户管理能力时，需要与现有设置弹窗、auth store、API client 和 i18n 结构一致。
* 后端用户相关 schema 应避免无意义重复，保持类型响应来源清晰。
* 所有用户专属数据继续通过 `get_current_user` 隔离。

## Acceptance Criteria (Evolving)

* [ ] 用户能在应用内查看当前账户信息。
* [ ] 用户能在设置弹窗的账户 tab 中更新用户名，成功后前端当前用户信息同步刷新。
* [ ] 用户能在设置弹窗的账户 tab 中更新邮箱，提交时必须输入当前密码，成功后前端当前用户信息同步刷新。
* [ ] 用户能在设置弹窗的账户 tab 中修改密码，修改时必须验证当前密码。
* [ ] 用户名或邮箱修改成功后保持当前登录状态。
* [ ] 用户能从账户区域退出登录。
* [ ] 用户系统新增能力有对应后端 API、前端交互和双语文案。
* [ ] 认证失败、重复字段、密码错误等错误能以现有错误处理风格返回/展示。
* [ ] lint、type-check 和相关测试通过。

## Definition of Done (Team Quality Bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-equivalent checks pass.
* Docs/spec notes updated if this task discovers a reusable convention.
* Rollout/rollback considered if database migration is needed.

## Out of Scope (Explicit)

* 第三方登录/OAuth。
* 管理员后台。
* 组织、团队、角色权限、多租户。
* 邮箱验证和找回密码邮件流，除非后续明确纳入本任务。
* 服务端 refresh token 存储、撤销列表、全设备登出。

## Technical Notes

* Backend auth router: `backend/app/routers/auth.py`
* Backend user model: `backend/app/models/user.py`
* Backend auth/user schemas: `backend/app/schemas/auth.py`, `backend/app/schemas/user.py`
* Frontend auth store/API client: `frontend/src/stores/auth.ts`, `frontend/src/api/client.ts`
* Frontend auth pages: `frontend/src/pages/auth/LoginPage.tsx`, `frontend/src/pages/auth/RegisterPage.tsx`
* Settings entry point: `frontend/src/components/settings/SettingsDialog.tsx`
