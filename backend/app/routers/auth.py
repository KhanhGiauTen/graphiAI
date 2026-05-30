from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse, UserCreate, UserLogin, UserRead
from app.services.auth import create_access_token, get_current_user, hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register_user(payload: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user), user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return TokenResponse(access_token=create_access_token(user), user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def get_me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user)
