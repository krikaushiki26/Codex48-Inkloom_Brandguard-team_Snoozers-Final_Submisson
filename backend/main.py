
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import (
    LoginRequest,
    RegisterRequest,
    login_user,
    register_user,
)

from database import SessionLocal, settings

from models import (
    BrandRule,
    User,
    ContentCheckResult,
)

from security import get_current_user, require_roles

from reviews import (
    request_review,
    get_my_reviews,
    get_pending_reviews,
    review_content,
)

from content_checker import check_content as run_content_check

from analytics import router as analytics_router


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="Inkloom BrandGuard API",
    description=(
        "AI-powered brand compliance, "
        "human review and analytics system."
    ),
    version="2.3.0",
)


# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

frontend_url = settings.frontend_url.strip().rstrip("/")

allowed_origins = list({
    frontend_url,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# REGISTER ANALYTICS ROUTER
# --------------------------------------------------

app.include_router(analytics_router)


# --------------------------------------------------
# DATABASE SESSION
# --------------------------------------------------

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class BrandRuleRequest(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=200,
    )

    description: str = Field(
        min_length=1,
    )

    rule_type: str = Field(
        min_length=1,
        max_length=30,
    )

    approved_source: str = Field(
        min_length=1,
    )


class ContentCheckRequest(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=50000,
    )


class ReviewSubmissionRequest(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=50000,
    )


class ReviewDecisionRequest(BaseModel):
    decision: str = Field(
        pattern="^(approved|changes_requested|rejected)$"
    )

    comment: str | None = None


class RoleUpdateRequest(BaseModel):
    role: str = Field(
        pattern="^(writer|manager|reviewer)$"
    )


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to Inkloom BrandGuard API",
        "version": "2.3.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/auth/register", status_code=201)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    try:
        user = register_user(data, db)

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


@app.post("/auth/login")
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    try:
        return login_user(data, db)

    except ValueError as exc:
        raise HTTPException(
            status_code=401,
            detail=str(exc),
        )


@app.get("/auth/me")
def get_account(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
    }


# --------------------------------------------------
# BRAND RULES
# --------------------------------------------------

@app.get("/rules")
def list_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rules = db.scalars(
        select(BrandRule)
        .where(BrandRule.is_active.is_(True))
        .order_by(BrandRule.created_at.desc())
    ).all()

    return [
        {
            "id": rule.id,
            "title": rule.title,
            "description": rule.description,
            "rule_type": rule.rule_type,
            "approved_source": rule.approved_source,
            "version": rule.version,
            "is_active": rule.is_active,
            "created_by": rule.created_by,
            "created_at": rule.created_at,
        }
        for rule in rules
    ]


@app.post("/rules", status_code=201)
def create_rule(
    data: BrandRuleRequest,
    current_user: User = Depends(
        require_roles("manager", "admin")
    ),
    db: Session = Depends(get_db),
):
    rule = BrandRule(
        title=data.title.strip(),
        description=data.description.strip(),
        rule_type=data.rule_type.strip().lower(),
        approved_source=data.approved_source.strip(),
        created_by=current_user.id,
    )

    db.add(rule)
    db.commit()
    db.refresh(rule)

    return {
        "id": rule.id,
        "title": rule.title,
        "description": rule.description,
        "rule_type": rule.rule_type,
        "approved_source": rule.approved_source,
        "version": rule.version,
        "is_active": rule.is_active,
        "created_by": rule.created_by,
        "created_at": rule.created_at,
    }


# --------------------------------------------------
# AI CONTENT CHECKER + ANALYTICS STORAGE
# --------------------------------------------------

@app.post("/content/check")
def check_content(
    data: ContentCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rules = db.scalars(
        select(BrandRule).where(
            BrandRule.is_active.is_(True)
        )
    ).all()

    approved_rules = [
        {
            "id": rule.id,
            "title": rule.title,
            "description": rule.description,
            "rule_type": rule.rule_type,
            "approved_source": rule.approved_source,
        }
        for rule in rules
    ]

    result = run_content_check(
        content=data.content,
        rules=approved_rules,
    )

    # Do not save invalid checker responses.
    if result.get("status") == "error":
        return result

    try:
        check_record = ContentCheckResult(
            checked_by=current_user.id,
            compliance_score=int(result.get("score", 0)),
            total_flags=int(result.get("total_flags", 0)),
            flags=result.get("flags", []),
            ai_enabled=bool(result.get("ai_enabled", False)),
        )

        db.add(check_record)
        db.commit()
        db.refresh(check_record)

        response_data = dict(result)

        response_data["check_id"] = check_record.id

        return response_data

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "The content check completed, but its analytics "
                "record could not be saved."
            ),
        )


# --------------------------------------------------
# HUMAN REVIEW
# --------------------------------------------------

@app.post("/reviews", status_code=201)
def submit_review(
    data: ReviewSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return request_review(
            db=db,
            submitted_by=current_user.id,
            content=data.content,
        )

    except Exception:
        db.rollback()
        raise


@app.get("/reviews/mine")
def my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_my_reviews(
        db,
        current_user.id,
    )


@app.get("/reviews/pending")
def pending_reviews(
    current_user: User = Depends(
        require_roles("reviewer", "manager", "admin")
    ),
    db: Session = Depends(get_db),
):
    return get_pending_reviews(db)


@app.post("/reviews/{review_id}/decision")
def decide_review(
    review_id: int,
    data: ReviewDecisionRequest,
    current_user: User = Depends(
        require_roles("reviewer", "manager", "admin")
    ),
    db: Session = Depends(get_db),
):
    try:
        return review_content(
            db=db,
            review_id=review_id,
            reviewer=current_user,
            decision=data.decision,
            comment=data.comment,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


# --------------------------------------------------
# ADMIN: USER MANAGEMENT
# --------------------------------------------------

@app.get("/admin/users")
def list_users(
    current_user: User = Depends(
        require_roles("admin")
    ),
    db: Session = Depends(get_db),
):
    users = db.scalars(
        select(User).order_by(User.created_at.desc())
    ).all()

    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at,
        }
        for user in users
    ]


@app.patch("/admin/users/{user_id}/role")
def update_user_role(
    user_id: int,
    data: RoleUpdateRequest,
    current_user: User = Depends(
        require_roles("admin")
    ),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.role == "admin":
        raise HTTPException(
            status_code=400,
            detail=(
                "An admin account's role cannot "
                "be changed here."
            ),
        )

    user.role = data.role

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }
