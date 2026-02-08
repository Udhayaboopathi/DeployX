from sqlalchemy.orm import Session
from models import User
from schemas import UserCreate
from password import get_password_hash


def create_user(db: Session, user: UserCreate, is_superuser: bool = False) -> User:
    """Create a new user. The first user is marked as superuser."""
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password,
        is_superuser=is_superuser,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_email(db: Session, email: str) -> User:
    """Get user by email"""
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> User:
    """Get user by username"""
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: str) -> User:
    """Get user by ID"""
    return db.query(User).filter(User.id == user_id).first()
