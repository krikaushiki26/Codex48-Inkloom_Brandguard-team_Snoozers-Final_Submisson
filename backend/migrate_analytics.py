
from database import Base, engine
from models import ContentCheckResult


def migrate_analytics():
    try:
        print("Creating analytics table if it does not exist...")

        Base.metadata.create_all(
            bind=engine,
            tables=[ContentCheckResult.__table__],
        )

        print("SUCCESS: content_check_results table is ready.")

    except Exception as error:
        print("MIGRATION FAILED:")
        print(error)
        raise


if __name__ == "__main__":
    migrate_analytics()
