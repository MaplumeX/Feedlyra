# 修复 asyncpg 连接池复用已失效连接问题

## 背景

后端在运行一段时间后（尤其机器睡眠唤醒、PG 重启或 DB 端回收空闲连接之后），
请求会在 `get_current_user` / 各路由执行 SQL 时抛出：

```
asyncpg.exceptions._base.InterfaceError: connection is closed
sqlalchemy.exc.InterfaceError: ... connection is closed
```

根因：`backend/app/database.py` 中的 `create_async_engine` 没有开启任何连接健康检查
与回收策略，连接池会复用底层已被 DB 端关闭的失效连接，取出来直接执行 `_start_transaction`
就报 `connection is closed`。

## Goal

让数据库连接池能在复用连接前检测并丢弃已失效的连接，避免 `connection is closed`
错误反复出现在请求路径里；同时让配置在 dev 与生产都合理、可读。

## Requirements

- 在 `create_async_engine` 中开启 `pool_pre_ping=True`，复用连接前先做一次轻量健康检查。
- 设置 `pool_recycle`，在连接长期复用前主动回收（默认值需小于 PG 端 `idle_in_transaction_session_timeout` /
  `wait_timeout` 等典型空闲回收阈值；dev 环境取一个保守值即可）。
- 设置合理的 `pool_size` 与 `max_overflow`，配合现有 `WORKER_POOL_SIZE=8` 的 feed worker，
  避免连接数耗尽。（pool_size ≥ worker 并发数，max_overflow 留余量）
- `pool_timeout` 取默认即可，不做特殊处理。
- 不改动连接池以外的业务逻辑；改动只落在 `backend/app/database.py`。
- 不引入新的第三方依赖。

## Acceptance Criteria

- [ ] `create_async_engine` 调用包含 `pool_pre_ping=True`。
- [ ] `create_async_engine` 调用包含 `pool_recycle`（取一个合理常量，并注释说明取值依据）。
- [ ] `create_async_engine` 调用包含 `pool_size` 与 `max_overflow`（取值与注释说明依据）。
- [ ] 后端能正常启动，`/docs` 可访问，登录后调用受保护接口不再触发 `connection is closed`。
- [ ] 重启 / 唤醒后 PostgreSQL 后，后续请求自动恢复（无需重启 backend 进程）。
- [ ] lint / type-check 通过。

## Notes

- 全部路由与 `feed_worker` / `agent_loop` 共用同一个 `engine`，因此只改 `database.py` 一处即可全局生效。
- 不删除 `echo=False`。
- 修复后是否要往 `.trellis/spec/` 写入“数据库连接池配置约定”留到 Phase 3.3 决定。
