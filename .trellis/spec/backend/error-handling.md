# Error Handling

> How errors are handled in this project.

---

## Overview

All errors are raised via FastAPI's `HTTPException`. No custom exception classes, no exception handlers, no centralized error middleware. Services propagate exceptions upward; routers catch and convert to HTTPException where needed.

---

## Error Response Format

FastAPI's default `{"detail": "message"}` JSON shape. No custom error envelope or error code system.

```json
{"detail": "Feed not found"}
```

---

## Status Code Convention

| Code | Usage |
|------|-------|
| `202` | Accepted — resource created but async processing incomplete (e.g. `POST /api/feeds/refresh-all` enqueues a tracked manual batch into the worker pool; fetch happens asynchronously) |
| `400` | Bad Request — invalid OPML, missing AI config, connection test failure |
| `401` | Unauthorized — invalid credentials/tokens |
| `403` | Forbidden — batch operation contains resources not owned by user |
| `404` | Not Found — standard resource-not-found |
| `409` | Conflict — duplicate feed |
| `422` | Unprocessable Entity — content extraction failed (readability) |
| `502` | Bad Gateway — upstream feed fetch failure |

---

## Error Handling Patterns

### Router-level catch

Services generally do NOT catch exceptions internally. They propagate to the router:

```python
# app/routers/ai.py
try:
    client = get_user_llm_client(user)
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
```

### Service-level logging + re-raise

For background/long-running tasks, log and re-raise:

```python
# app/services/feed_fetcher.py
except Exception:
    logger.exception("Periodic feed refresh failed")
    raise
```

### SSE streaming errors

Return error as SSE data event:

```python
yield f"data: {json.dumps({'error': str(e)})}\n\n"
```

---

## Common Mistakes

- **Bare `except Exception: pass`** — Several places (notably `_extract_full_text`, `_html_to_text`) silently swallow errors. This hides real bugs. See [[quality-guidelines]] for the forbidden pattern and correct alternative. The `add_feed` endpoint was fixed to use 202 + `parsing_error_message` instead of silent pass (see Design Decision below).
- **Returning plaintext API keys in error responses** — Even error responses can leak secrets in logs/middleware. Use `has_api_key: bool` instead.
- **Batch endpoints without ownership validation** — When an endpoint accepts a list of resource IDs (e.g., `article_ids: UUID[]`), always verify the resources belong to the current user. Without this, any user can operate on other users' data.
- **Path-parameter routes shadowing literal sibling paths** — When a router has both `/{feed_id}` (with `feed_id: UUID`) and a literal sibling like `/bulk/move`, registering `/{feed_id}` first causes `/bulk/move` to be parsed as a UUID and return `422` instead of routing to the bulk endpoint. Always register literal `/bulk/*` (and any other literal sibling) **before** the `/{id}` route in the same router. See "Scenario: Bulk Feed Endpoints" for the working ordering.

### Batch Endpoint Ownership Validation

For endpoints that accept arrays of resource IDs, filter by user ownership before operating:

```python
# Verify articles belong to the current user's feeds
owned_ids_result = await db.execute(
    select(Article.id)
    .join(Feed, Feed.id == Article.feed_id)
    .where(Article.id.in_(article_ids), Feed.user_id == user_id)
)
owned_ids = set(owned_ids_result.scalars().all())
```

**Why**: Client-provided IDs can reference resources owned by other users. Without filtering, batch operations silently cross user boundaries — a security vulnerability.

### Bulk Endpoint Result Contract

Batch endpoints return **partial-success** results, not all-or-nothing errors. The response schema carries both the operated IDs and the IDs that were not found / not owned:

```python
class BulkMoveResult(BaseModel):
    updated: list[UUID]
    not_found: list[UUID]

class BulkDeleteResult(BaseModel):
    deleted: list[UUID]
    not_found: list[UUID]
```

- The handler first SELECTs the IDs the current user actually owns (`WHERE id IN(feed_ids) AND user_id=user.id`) → `found_ids`.
- The UPDATE/DELETE is scoped to `found_ids` (and still carries `user_id` as a safety belt).
- `not_found = set(feed_ids) - set(found_ids)`. Duplicate input IDs collapse via the `IN` set semantics.
- The frontend toasts only the success count (`len(updated)` / `len(deleted)`); `not_found` is `console.warn`-only, because it only happens under concurrent cross-tab edits and surfacing it to the user adds confusion without value.
- Empty `feed_ids` is rejected by the request schema (`Field(min_length=1)`) → `422`; do not return an empty result instead, which would mask a buggy caller.

---

## Scenario: Bulk Feed Endpoints

### 1. Scope / Trigger
- Trigger: users need to apply the same mutation (move to category, delete) to many feeds at once via `POST /api/feeds/bulk/move` and `POST /api/feeds/bulk/delete`.
- Cross-layer contract: backend schema defines the request/response, the SubscriptionsTab select mode dispatches the mutation, and partial failure (`not_found`) is surfaced only in the console.

### 2. Signatures
- API: `POST /api/feeds/bulk/move` body `{ feed_ids: UUID[] (min 1), category_id: UUID | null }` → `BulkMoveResult`.
- API: `POST /api/feeds/bulk/delete` body `{ feed_ids: UUID[] (min 1) }` → `BulkDeleteResult`.
- Schema: `BulkMoveResult { updated: list[UUID], not_found: list[UUID] }`.
- Schema: `BulkDeleteResult { deleted: list[UUID], not_found: list[UUID] }`.

### 3. Contracts
- Both endpoints require `get_current_user`; every SELECT/UPDATE/DELETE carries `Feed.user_id == user.id`.
- `category_id == null` is valid and means "move to uncategorized".
- `category_id` referencing a category not owned by the user → `404 Category not found` (reuses the single-update validation).
- Both handlers run inside the request-scoped `AsyncSession`: single SELECT for ownership → single UPDATE/DELETE → single `commit`. No background task.
- Feed→Article cascade delete is handled by the existing FK `ondelete="CASCADE"`; bulk delete reuses `delete(Feed).where(Feed.id.in_(found_ids), Feed.user_id == user.id)`, same shape as the single `delete_feed`.
- Route registration order: `POST /bulk/move` and `POST /bulk/delete` MUST be registered before `PUT /{feed_id}` / `DELETE /{feed_id}` in `routers/feeds.py`. See the path-parameter shadowing common mistake above.
- Frontend `api` client does NOT auto-convert snake_case; hook `mutationFn` body fields must be spelled `feed_ids` / `category_id` (same convention as `useAddFeed` / `useUpdateFeed`).

### 4. Validation & Error Matrix
- Missing/invalid access token -> `401`.
- Empty `feed_ids` (`[]`) -> Pydantic `422`.
- `category_id` not owned by current user -> `404 Category not found`.
- Some `feed_ids` not owned by the user -> `200` with those IDs in `not_found`; owned IDs succeed normally.
- All `feed_ids` not owned -> `200` with `updated=[]` / `deleted=[]` and all IDs in `not_found`.

### 5. Good/Base/Bad Cases
- Good: user selects 10 feeds, moves to a category; backend UPDATEs all 10 in one transaction, returns `updated=[...10]`, `not_found=[]`; frontend toasts "已移动 10 个订阅源到 <category>".
- Base: `category_id=null` moves the selected feeds to uncategorized without any special path.
- Bad: register `PUT /{feed_id}` before `POST /bulk/move`; the `bulk` literal is parsed as a UUID, `bulk` is not a valid UUID, the request returns `422` and the bulk endpoint is unreachable.
- Bad: scope the UPDATE/DELETE only by `id IN (feed_ids)` without `user_id`; a caller passing another user's feed IDs would mutate or delete them — a cross-user security hole.

### 6. Tests Required
- No automated backend test (project convention: trusted unit tests cover pure logic only, and feed router has no existing integration coverage).
- Manual verification: `POST /api/feeds/bulk/move` with a valid `feed_ids` + `category_id=null` returns `200` and the feeds' `category_id` becomes null; empty `feed_ids` -> `422`; a `category_id` owned by another user -> `404`.
- Frontend regression: `npm run lint`, `npm run build` pass; selecting feeds and triggering move/delete refetches the feed list and exits select mode.

### 7. Wrong vs Correct
#### Wrong — path-parameter registered first
```python
@router.put("/{feed_id}", ...)
async def update_feed(...): ...

@router.post("/bulk/move", ...)
async def bulk_move_feeds(...): ...
# /bulk/move is parsed as feed_id="bulk" -> UUID parse fails -> 422, endpoint unreachable
```

#### Correct — literal bulk routes registered first
```python
@router.post("/bulk/move", response_model=BulkMoveResult)
async def bulk_move_feeds(...): ...

@router.post("/bulk/delete", response_model=BulkDeleteResult)
async def bulk_delete_feeds(...): ...

@router.put("/{feed_id}", ...)
async def update_feed(...): ...
```

#### Wrong — DELETE scoped only by `id IN` without `user_id`
```python
await db.execute(delete(Feed).where(Feed.id.in_(found_ids)))
```

#### Correct — `found_ids` already filtered by user, but DELETE still carries user_id as a safety belt
```python
found_ids = {row[0] for row in (await db.execute(
    select(Feed.id).where(Feed.id.in_(body.feed_ids), Feed.user_id == user.id)
)).all()}
await db.execute(delete(Feed).where(Feed.id.in_(found_ids), Feed.user_id == user.id))
```

---

## Scenario: Account Management Endpoints

### 1. Scope / Trigger
- Trigger: authenticated users can update their own profile, email, and password through `/api/auth/me/*` endpoints.
- These endpoints are cross-layer contracts: backend schemas define validation, the frontend account settings tab submits the payloads, and the auth store must stay synchronized with returned user data.

### 2. Signatures
- API: `GET /api/auth/me -> UserResponse`.
- API: `PUT /api/auth/me/profile` with `UserProfileUpdate -> UserResponse`.
- API: `PUT /api/auth/me/email` with `UserEmailUpdate -> UserResponse`.
- API: `PUT /api/auth/me/password` with `UserPasswordUpdate -> 204 No Content`.
- Schema: `UserResponse { id: UUID, email: str, username: str }`.
- Schema: `UserProfileUpdate { username: str }`, `username` length `3..50`, pattern `^[a-zA-Z0-9_]+$`.
- Schema: `UserEmailUpdate { email: EmailStr, current_password: str }`, password length `8..128`.
- Schema: `UserPasswordUpdate { current_password: str, new_password: str }`, both length `8..128`.

### 3. Contracts
- All account management endpoints require the current access token through `get_current_user`.
- `PUT /api/auth/me/profile` updates only `username`; it must not require the current password.
- `PUT /api/auth/me/email` requires the current password because email is the login identifier.
- `PUT /api/auth/me/password` requires the current password and returns no response body.
- Updating username or email keeps the current session valid because access and refresh tokens use the stable user id as `sub`.
- Frontend callers must write the returned `UserResponse` back to the persisted auth store after username/email updates.

### 4. Validation & Error Matrix
- Missing/invalid access token -> `401 Invalid token`.
- Current user no longer exists -> `401 User not found`.
- Duplicate username -> `409 Username already taken`.
- Duplicate email -> `409 Email already registered`.
- Incorrect current password for email/password change -> `400 Current password is incorrect`.
- Pydantic field validation failure -> FastAPI default `422`.

### 5. Good/Base/Bad Cases
- Good: user changes email with the correct current password; API returns updated `UserResponse`; frontend updates auth store and keeps the user signed in.
- Base: user changes only username; API returns updated `UserResponse`; tokens remain unchanged.
- Bad: frontend updates email successfully but does not update auth store, leaving stale account data visible until reload.
- Bad: email update does not verify the current password, allowing a stolen session to change the login identifier silently.

### 6. Tests Required
- API integration: profile update rejects duplicate usernames with `409`.
- API integration: email update rejects wrong current password with `400`.
- API integration: email update rejects duplicate emails with `409` and succeeds with the correct current password.
- API integration: password update rejects wrong current password and returns `204` on success.
- Frontend contract: username/email mutation success writes returned user data to auth state.

### 7. Wrong vs Correct
#### Wrong
```python
@router.put("/me/email")
async def update_email(body: UserEmailUpdate, user: User = Depends(get_current_user)):
    user.email = body.email
```

#### Correct
```python
@router.put("/me/email", response_model=UserResponse)
async def update_email(body: UserEmailUpdate, user: User = Depends(get_current_user)):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.email = body.email
```

---

## Design Decision: Feed Creation Decoupled from Fetch (Miniflux model)

**Context** (updated by task 06-29-align-import-miniflux-model): `POST /api/feeds` and `POST /api/feeds/import/opml` previously created the feed row **and** immediately kicked off a background fetch (`asyncio.create_task(_bg_fetch)`). Importing N feeds spawned N concurrent fetches with no bound, no per-host limit, no lifecycle management, and no progress visibility. The fetch result (title / site_url / icon / description) only appeared after the async task finished, but the response returned an empty shell immediately.

**Decision**: Creation is now **decoupled** from fetch. The create endpoints only write the DB row, mark it due (`next_check_at = now()` for single `add_feed`, or `now() + DEFAULT_CHECK_INTERVAL` for manual batches like import / refresh-all so the 60s due-tick does not double-select feeds a manual worker is already processing), commit, and return `201` with the pending shell. Fetching is owned by the background `FeedScheduler` + `WorkerPool` (see `services/feed_worker.py`), which picks up due feeds on the next 60s tick with bounded concurrency, per-host limiting, and error-limit disabling. The previous `202 + parsing_error_message` override on `add_feed` is removed — it was dead code once the synchronous fetch path was deleted (the feed is always a pending shell at creation time).

**Why not 202 anymore**: The 202 pattern indicated "resource created but async fetch ran and failed". Under the decoupled model the create endpoint no longer fetches at all, so there is no fetch outcome to surface at creation time. The feed's eventual fetch status is observable via `checked_at` (null = pending), `parsing_error_message` (error), and `disabled` (error-limit reached) on the feed list / `FeedResponse`, and via the import/refresh-all batch progress endpoint `GET /api/feeds/jobs/status`.

**Status code usage** (still authoritative):
- `201` — feed created (pending shell; fetch happens later). Both `add_feed` and `import_opml`.
- `202 Accepted` — used by `POST /api/feeds/refresh-all`: marks the user's feeds due + enqueues a tracked manual batch into the worker pool, returns `{"total": N}` immediately.
- `502` — `POST /api/feeds/{feed_id}/refresh` when the synchronous single-feed refresh (via `WorkerPool.run_single`) raises.

The earlier `202 Accepted` rationale ("resource created but async processing incomplete") is now realized by the refresh-all batch endpoint, not by the create endpoint.

**Key insight**: `fetch_and_store_feed` handles some error types internally (HTTP >= 400 incl. 429, parse errors) without throwing — it sets `parsing_error_message` and returns normally. `POST /api/feeds/{feed_id}/refresh` therefore only resets `disabled` / `parsing_error_count` when the refreshed feed has **no** `parsing_error_message` (a genuine success), not merely when `run_single` did not raise — otherwise soft failures (429 / 4xx / parse error) would have their error state wiped while still showing an error badge.

