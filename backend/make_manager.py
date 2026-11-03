
from sqlalchemy import select

from database import SessionLocal
from models import User


def main():
    print("\nInkloom BrandGuard — Manager Setup")
    print("----------------------------------")

    email = input("Enter the registered account email: ").strip().lower()

    if not email:
        print("Email cannot be empty.")
        return

    confirmation = input(
        "This will give the account Manager permissions. "
        "Type PROMOTE to confirm: "
    ).strip()

    if confirmation != "PROMOTE":
        print("Cancelled. No changes made.")
        return

    with SessionLocal() as db:
        try:
            user = db.scalar(
                select(User).where(User.email == email)
            )

            if user is None:
                print("Account not found. Register it first.")
                return

            if not user.is_active:
                print("Account is inactive. No changes made.")
                return

            if user.role == "admin":
                print("Admin accounts cannot be changed to Manager.")
                return

            if user.role == "manager":
                print("This account is already a Manager.")
                return

            user.role = "manager"
            db.commit()

            print(f"Success! {user.email} is now a Manager.")

        except Exception:
            db.rollback()
            print("Manager setup failed.")
            raise


if __name__ == "__main__":
    main()
