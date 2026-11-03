

from sqlalchemy import select

from database import SessionLocal
from models import User


def main():
    print("\nInkloom BrandGuard — Initial Admin Setup")
    print("----------------------------------------")
    print("This script promotes an existing account.")
    print("Run it only in a trusted deployment environment.\n")

    email = input("Registered account email: ").strip().lower()

    if not email:
        print("Email cannot be empty.")
        return

    db = SessionLocal()

    try:
        user = db.scalar(
            select(User).where(User.email == email)
        )

        if user is None:
            print(
                "Account not found. Register the account first, "
                "then run this script again."
            )
            return

        if not user.is_active:
            print("This account is inactive. Activate it before promotion.")
            return

        if user.role == "admin":
            print("This account is already an admin.")
            return

        print(f"\nAccount: {user.name} ({user.email})")
        print(f"Current role: {user.role}")

        confirmation = input(
            "Type PROMOTE to assign the admin role: "
        ).strip()

        if confirmation != "PROMOTE":
            print("Setup cancelled.")
            return

        user.role = "admin"
        db.commit()

        print("\nAdmin role assigned successfully.")
        print("Log out and log in again to refresh the account role.")

    except Exception:
        db.rollback()
        print(
            "Admin setup failed. Check the database connection "
            "and role constraints."
        )
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
