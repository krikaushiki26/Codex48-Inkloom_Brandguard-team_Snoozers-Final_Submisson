
from sqlalchemy import text
from database import engine


def migrate_review_status():
    try:
        # Run both changes in one transaction.
        with engine.begin() as connection:

            print("Updating review status constraint...")

            connection.execute(
                text("""
                    ALTER TABLE public.content_reviews
                    DROP CONSTRAINT IF EXISTS content_reviews_status_check;
                """)
            )

            connection.execute(
                text("""
                    ALTER TABLE public.content_reviews
                    ADD CONSTRAINT content_reviews_status_check
                    CHECK (
                        status IN (
                            'pending',
                            'approved',
                            'changes_requested',
                            'rejected'
                        )
                    );
                """)
            )

            # Verify the updated constraint.
            result = connection.execute(
                text("""
                    SELECT
                        conname,
                        pg_get_constraintdef(oid)
                    FROM pg_catalog.pg_constraint
                    WHERE conrelid =
                        'public.content_reviews'::regclass
                    AND contype = 'c';
                """)
            )

            print("\nUpdated constraints:")

            for row in result:
                print(row)

        print("\nSUCCESS: Review status constraint updated!")

    except Exception as error:
        print("\nMIGRATION FAILED:")
        print(error)
        raise


if __name__ == "__main__":
    migrate_review_status()
