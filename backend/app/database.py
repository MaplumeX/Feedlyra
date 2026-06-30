from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# 连接池配置：修复 asyncpg 复用已失效连接导致 `connection is closed` 的问题。
#
# pool_pre_ping: 复用连接前先做一次轻量健康检查（SELECT 1），失败则丢弃该连接并新建。
#   用来应对 DB 端回收空闲连接、机器睡眠唤醒、PG 重启等场景。
# pool_recycle: 主动回收连接的秒数。必须小于 PG 端空闲回收阈值
#   （idle_in_transaction_session_timeout、宿主/云 PG 的空闲连接回收，通常为分钟级），
#   dev 环境取保守值 1800 秒（30 分钟）。
# pool_size: 常驻连接数。取 10，不低于 settings.WORKER_POOL_SIZE=8 的 feed worker 并发，
#   留出余量给其余路由共用同一个 engine。
# max_overflow: 超出 pool_size 后允许临时新建的连接数，取 5 留余量。
_DATABASE_POOL_SIZE = 10
_DATABASE_MAX_OVERFLOW = 5
_DATABASE_POOL_RECYCLE = 1800

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=_DATABASE_POOL_SIZE,
    max_overflow=_DATABASE_MAX_OVERFLOW,
    pool_recycle=_DATABASE_POOL_RECYCLE,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
