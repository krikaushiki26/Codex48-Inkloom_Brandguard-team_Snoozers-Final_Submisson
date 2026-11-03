
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import settings
from models import User


password_hash = PasswordHash.recommended()

JWT_SECRET = settings.jwt_secret
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Name cannot be empty.")

        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def register_user(data: RegisterRequest, db: Session):
    email = str(data.email).lower()

    try:
        existing_user = db.scalar(
            select(User).where(User.email == email)
        )

        if existing_user:
            raise ValueError(
                "An account with this email already exists."
            )

        user = User(
            name=data.name,
            email=email,
            password_hash=password_hash.hash(data.password),
            role="writer",
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return user

    except ValueError:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


def login_user(data: LoginRequest, db: Session):
    email = str(data.email).lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if not user or not password_hash.verify(
        data.password, user.password_hash
    ):
        raise ValueError("Incorrect email or password.")

    if not user.is_active:
        raise ValueError("This account is inactive.")

    token = jwt.encode(
        {
            "sub": str(user.id),
            "role": user.role,
            "exp": datetime.now(timezone.utc)
            + timedelta(minutes=TOKEN_EXPIRE_MINUTES),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }
