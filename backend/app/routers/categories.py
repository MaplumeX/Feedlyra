from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.category import Category
from app.models.feed import Feed
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    CategoryWithCount,
)

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Category:
    result = await db.execute(
        select(Category).where(Category.user_id == user.id, Category.title == body.title)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Category already exists")

    category = Category(user_id=user.id, title=body.title)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.get("", response_model=list[CategoryWithCount])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    result = await db.execute(
        select(Category).where(Category.user_id == user.id).order_by(Category.title)
    )
    categories = result.scalars().all()

    cat_ids = [c.id for c in categories]
    count_map: dict[UUID, int] = {}
    if cat_ids:
        count_result = await db.execute(
            select(Feed.category_id, func.count(Feed.id))
            .where(Feed.category_id.in_(cat_ids), Feed.user_id == user.id)
            .group_by(Feed.category_id)
        )
        count_map = {row[0]: row[1] for row in count_result.all()}

    return [
        {
            **CategoryResponse.model_validate(c).model_dump(),
            "feed_count": count_map.get(c.id, 0),
        }
        for c in categories
    ]


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    body: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Category:
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user.id)
    )
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    if body.title is not None:
        # Check duplicate title
        dup_result = await db.execute(
            select(Category).where(
                Category.user_id == user.id,
                Category.title == body.title,
                Category.id != category_id,
            )
        )
        if dup_result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Category already exists")
        category.title = body.title

    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user.id)
    )
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.delete(category)
    await db.commit()
