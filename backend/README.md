
# Inkloom BrandGuard — Backend

## About

Inkloom BrandGuard is a brand-compliance application that checks written content against approved brand rules and supports human review before publishing.

The application helps writers identify potential brand-rule violations and allows authorized reviewers to approve content or request changes.

This is a prototype. The content checker uses predefined rules and does not perform AI-powered fact-checking or automatically publish content.

## Technology Stack

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT-based authentication
- Argon2 password hashing

## Prerequisites

Before setting up the backend, install:

- Python 3.11 or newer
- Access to a PostgreSQL database
- pip (Python package installer)

## Setup Instructions

### 1. Get the Project

Obtain the project source code and open a terminal in the `backend` folder.

### 2. Create a Virtual Environment

On Windows, run:

```powershell
python -m venv .venv
```

Activate the environment:

```powershell
.venv\Scripts\activate
```

### 3. Install Dependencies

Install the required Python packages:

```powershell
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file inside the backend folder using `.env.example` as a template.

Configure these variables:

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: A long, random, private secret used to sign authentication tokens.

Use the actual database connection details supplied by the deployment administrator.

**Security requirements:**
- Never publish the real `.env` file.
- Never commit database passwords or JWT secrets to GitHub.
- Keep production secrets private and separate from development credentials.

### 5. Configure the Database

1. Create a PostgreSQL database.
2. Configure `DATABASE_URL` in the `.env` file.
3. Ensure the database user has permission to create tables.
4. Activate the Python virtual environment and install the dependencies.
5. From the backend folder, run:

```powershell
python init_db.py
```

The initialization script creates tables based on the SQLAlchemy models registered in `models.py`.

Expected tables:

- `users`
- `brand_rules`
- `content_reviews`

**Important:** The PostgreSQL database must already exist and be reachable. The script creates tables; it does not create the database itself.

If the tables already exist, SQLAlchemy's `create_all` generally leaves existing tables unchanged. It does not automatically apply schema migrations or update existing tables to match changed models.

### 6. Start the Backend

From the backend folder, with the virtual environment activated and the environment variables configured, run:

```powershell
uvicorn main:app --reload
```

The backend runs locally at:

`http://127.0.0.1:8000`

The `--reload` option is intended for development. Use an appropriate production server configuration for deployment.

### 7. API Documentation

FastAPI provides interactive API documentation at:

`http://127.0.0.1:8000/docs`

The documentation is available when the backend is running.

## Main API Features

### Authentication

- User registration
- User login
- Retrieve the current authenticated user's account

### Brand Rules

- View active brand rules
- Create brand rules with an authorized manager or administrator account

### Content Checking

- Check submitted content against active brand rules
- Display detected issues, severity, explanations, approved sources, and suggested fixes
- Identify content that needs human review

### Human Review

- Submit content for review
- View personal submission history
- View pending submissions as an authorized reviewer
- Approve content or request changes with a comment

### Administration

- View registered users
- Update eligible users' roles

Access to protected endpoints is enforced by the backend, not just by the frontend interface.

## User Roles

The application supports these roles:

- `writer`: Checks content and submits it for review.
- `manager`: Manages brand rules and can review submissions.
- `reviewer`: Reviews pending submissions and records decisions.
- `admin`: Has administrative access, including eligible user-role management.

Public registration creates writer accounts by default. Administrative privileges must be assigned through an authorized setup process.

## Initial Administrator Setup

The project includes a `setup_admin.py` script for promoting an existing account to administrator.

1. Register the account that should become the administrator.
2. Configure the database connection and environment variables.
3. Run the setup script from the backend folder in a trusted environment:

```powershell
python setup_admin.py
```

4. Enter the registered account's email address.
5. Confirm the promotion when prompted.

Run this script only in a trusted environment. Do not expose administrative setup access to public users.

After promotion, log out and log in again to refresh the account's role in the application.

## Frontend Configuration

The frontend communicates with the backend API. The current development configuration uses:

`http://127.0.0.1:8000`

For deployment, configure the frontend API address to point to the deployed backend and configure the backend CORS settings to allow the intended frontend origin.

Do not use development-only settings blindly in production.

## Security Notes

- Keep database credentials and JWT secrets private.
- Use HTTPS in production.
- Use strong, unique secrets.
- Restrict administrative access.
- Use backend role checks to protect sensitive operations.
- Do not expose database credentials in frontend code.
- Do not automatically publish content without human approval.
- Configure appropriate database permissions and production access controls.

## Limitations


## Limitations

- Rule-based content checking works using predefined brand rules and keyword patterns.
- Optional AI semantic analysis uses the OpenAI API when configured and available.
- AI-generated findings are preliminary and may require human verification.
- The compliance score is a simple rule-based metric, not a calibrated confidence score.
- The system does not automatically publish or approve content.
- Database schema changes may require a migration process.
- Production deployment requires environment-specific configuration and security review.

## Project Status

Inkloom BrandGuard is a prototype intended to demonstrate brand-rule checking, authentication, role-based access, and human review workflows.

Further development may include automated database migrations, production deployment configuration, improved monitoring, and additional content-checking capabilities.
