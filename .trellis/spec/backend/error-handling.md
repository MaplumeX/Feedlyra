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

- **Bare `except Exception: pass`** — Several places (notably `add_feed`, `_extract_full_text`, `_html_to_text`) silently swallow errors. This hides real bugs. See [[quality-guidelines]] for the forbidden pattern and correct alternative.
- **Returning plaintext API keys in error responses** — Even error responses can leak secrets in logs/middleware. Use `has_api_key: bool` instead.
- **Batch endpoints without ownership validation** — When an endpoint accepts a list of resource IDs (e.g., `article_ids: UUID[]`), always verify the resources belong to the current user. Without this, any user can operate on other users' data.

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
