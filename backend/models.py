
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


# --------------------------------------------------
# USER MODEL
# --------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )

    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    role: Mapped[str] = mapped_column(
        String(20), default="writer", nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# --------------------------------------------------
# BRAND RULE MODEL
# --------------------------------------------------

class BrandRule(Base):
    __tablename__ = "brand_rules"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    title: Mapped[str] = mapped_column(
        String(200), nullable=False
    )

    description: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    rule_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )

    approved_source: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    version: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# --------------------------------------------------
# CONTENT REVIEW MODEL
# --------------------------------------------------

class ContentReview(Base):
    __tablename__ = "content_reviews"

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', "
            "'changes_requested', 'rejected')",
            name="check_content_review_status",
        ),
        Index(
            "ix_content_reviews_submitted_by",
            "submitted_by",
        ),
        Index(
            "ix_content_reviews_status",
            "status",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    submitted_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    content: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30), default="pending", nullable=False
    )

    reviewer_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    reviewer_comment: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# --------------------------------------------------
# CONTENT CHECK RESULT MODEL
# --------------------------------------------------

class ContentCheckResult(Base):
    __tablename__ = "content_check_results"

    __table_args__ = (
        CheckConstraint(
            "compliance_score >= 0 AND compliance_score <= 100",
            name="check_compliance_score_range",
        ),
        Index(
            "ix_content_check_results_checked_by",
            "checked_by",
        ),
        Index(
            "ix_content_check_results_created_at",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    checked_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    compliance_score: Mapped[int] = mapped_column(
        Integer, nullable=False
    )

    total_flags: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )

    # Stores the full list of detected violations as JSON.
    flags: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False
    )

    ai_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
