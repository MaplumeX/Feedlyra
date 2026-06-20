# 修复登录界面提交失败无错误提示

## Goal

登录/注册表单提交失败时(如密码错误、邮箱已注册),给用户清晰可见的错误反馈,而不是页面无任何提示 / 误以为刷新。

## Confirmed Facts

来自代码 inspection(无需问用户):

### 后端错误响应(`backend/app/routers/auth.py`)

- `POST /api/auth/login` 失败 → `HTTP 401`, `detail: "Invalid credentials"`
- `POST /api/auth/register` 失败 → `HTTP 400`, `detail: "Email already registered"` 或 `"Username already taken"`

FastAPI `HTTPException` 默认返回体为 `{ "detail": "..." }`,经 `frontend/src/api/client.ts` 解析后抛出 `new Error(error.detail ?? "Request failed")`,`error.message` 即 detail 字符串。

### 前端现状

- `frontend/src/pages/auth/LoginPage.tsx` 的 `onSubmit` 无 `try/catch`:`api.post` 失败会抛出异常,`react-hook-form` 的 `handleSubmit` 不吞错误,产生 unhandled promise rejection → 用户看不到任何提示。
- `frontend/src/pages/auth/RegisterPage.tsx` 的 `onSubmit` 同样无 `try/catch`,且 register 成功后会继续自动 login,任一失败都会抛。
- 项目已集成 `sonner` toast:`client.ts` 的 `refreshTokenIfNeeded` 已用 `toast.error(...)`,基础设施就绪。
- 项目已做中英文 i18n(`frontend/src/i18n/locales/{en,zh-CN}/auth.json`),现有错误校验 key 如 `passwordMinLength`、`passwordsDoNotMatch`。

## Requirements

1. `LoginPage.onSubmit` 用 `try/catch` 包裹;失败时通过 `toast.error` 显示错误提示,不跳转,`isSubmitting` 自动复位,表单可重试。
2. `RegisterPage.onSubmit` 同样加 `try/catch`;register 或随后的 login 任一失败都显示对应提示。
3. 登录成功路径(设 token、取 `/api/auth/me`、跳转首页)不受影响。
4. 注册成功路径不受影响。
5. 错误文案使用 i18n(新增 `auth.json` 中英 key),与校验错误 key 风格一致。
6. 对后端未明确识别的 detail,保留兜底提示。

## Acceptance Criteria

- [ ] 输入正确邮箱 + 错误密码提交登录 → 页面不跳转,弹出错误 toast(如"邮箱或密码错误"),可重试。
- [ ] 输入不存在的邮箱提交登录 → 弹出同样错误 toast,可重试。
- [ ] 用已注册邮箱提交注册 → 弹出"邮箱已被注册"toast,不跳转,可重试。
- [ ] 用已存在的用户名提交注册 → 弹出"用户名已被占用"toast,不跳转,可重试。
- [ ] 正确凭据登录/注册 → 正常进入首页,无错误 toast。
- [ ] 中英文 locale 切换后,错误 toast 文案随之切换。
- [ ] `npm run typecheck` / `npm run lint` 通过。

## Out of Scope

- 不重构后端错误返回结构(继续依赖 `{ detail }`)。
- 不引入前端错误码体系。
- 不处理网络层超时/断网的特殊文案(fallback toast 即可)。
- 不改动 `ProtectedRoute` / token 刷新逻辑。

## Resolved Decisions

- **兜底文案策略**:未知 / 未识别的后端 detail 不直接透传,统一显示 i18n key `errors.unexpected`(中:`操作失败,请稍后重试` / 英:`Something went wrong, please try again later`),避免后端未来加新 detail 时前端中英混杂。
- **错误映射**(后端 detail → i18n key → 文案):
  - `Invalid credentials` (401) → `errors.invalidCredentials` → 中:邮箱或密码错误 / 英:Invalid email or password
  - `Email already registered` (400) → `errors.emailAlreadyRegistered` → 中:该邮箱已被注册 / 英:Email already registered
  - `Username already taken` (400) → `errors.usernameAlreadyTaken` → 中:该用户名已被占用 / 英:Username already taken
  - (其它/未知 detail) → `errors.unexpected` → 中:操作失败,请稍后重试 / 英:Something went wrong, please try again later
