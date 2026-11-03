
from sqlalchemy import text

from database import engine


def test_connection():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))

            print("Database connection successful!")
            print("Test result:", result.scalar())

    except Exception as error:
        print("Database connection failed.")
        print("Error:", error)
        raise


if __name__ == "__main__":
    test_connection()
