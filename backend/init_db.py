
from database import Base, engine
import models


def create_tables():
    Base.metadata.create_all(bind=engine)

    print("Database tables created successfully!")
    print("Expected tables: users, brand_rules, content_reviews")


if __name__ == "__main__":
    create_tables()
