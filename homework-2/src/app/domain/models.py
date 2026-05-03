from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domain.enums import Category, DeviceType, Priority, Source, Status


class TicketMetadata(BaseModel):
    source: Source | None = None
    browser: str | None = None
    device_type: DeviceType | None = None


class TicketCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_id: str
    customer_email: EmailStr
    customer_name: str
    subject: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=10, max_length=2000)
    category: Category | None = None
    priority: Priority | None = None
    status: Status = Status.new
    assigned_to: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: TicketMetadata | None = None


class TicketUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=10, max_length=2000)
    category: Category | None = None
    priority: Priority | None = None
    status: Status | None = None
    assigned_to: str | None = None
    tags: list[str] | None = None
    metadata: TicketMetadata | None = None


class Ticket(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    customer_id: str
    customer_email: EmailStr
    customer_name: str
    subject: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=10, max_length=2000)
    category: Category | None = None
    priority: Priority | None = None
    status: Status = Status.new
    assigned_to: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: TicketMetadata | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: datetime | None = None


class ImportError(BaseModel):
    row: int
    field: str
    message: str


class ImportSummary(BaseModel):
    total: int
    successful: int
    failed: int
    errors: list[ImportError] = []


class ClassificationResult(BaseModel):
    ticket_id: UUID
    category: Category
    priority: Priority
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
    keywords_found: list[str] = []
