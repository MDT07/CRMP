# CRMP API Development

## Description
Backend API development helpers for CRMP FastAPI.

## Triggers
- "Create API endpoint"
- "Add backend route"
- "New API"
- "Backend endpoint"

## Conventions

### Route Pattern
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.schemas.deal import DealCreate, DealRead
from app.services.deal_service import DealService

router = APIRouter(prefix="/deals", tags=["deals"])

@router.post("", response_model=DealRead)
async def create_deal(
    payload: DealCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> DealRead:
    return await DealService(session).create_deal(
        organization_id=current_user.organization_id,
        payload=payload,
    )
```

### Model Pattern
```python
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.mixins import TimestampMixin

class Deal(TimestampMixin):
    __tablename__ = "deals"
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(default=0.0)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
```

### Service Pattern
```python
class DealService:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_deal(self, organization_id: UUID, payload: DealCreate) -> Deal:
        deal = Deal(**payload.model_dump(), organization_id=organization_id)
        self.session.add(deal)
        await self.session.commit()
        return deal
```

### Rules
1. Use type hints everywhere
2. Async/await for all I/O
3. Pydantic models for request/response
4. Dependency injection via FastAPI Depends
5. SQLAlchemy 2.0 style (new mapping)
6. Include organization_id for multi-tenancy
