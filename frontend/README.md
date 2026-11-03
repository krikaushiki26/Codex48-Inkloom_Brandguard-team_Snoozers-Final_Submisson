
# Inkloom BrandGuard — Frontend

## About

Inkloom BrandGuard is a React web application that helps users check written content against approved brand rules and submit content for human review.

## Technology Stack

- React
- Vite
- JavaScript
- CSS
- Axios

## Prerequisites

- Node.js (a supported LTS version)
- npm
- A Supabase project configured with this repository's migration

## Setup Instructions

### 1. Install Dependencies

Open a terminal in the frontend folder and run:

```powershell
npm install
```

### 2. Configure Supabase

Create a `.env` file in the frontend folder using `.env.example` as a template.

Set the Supabase Project URL and publishable anon key:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-project-anon-key
VITE_API_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/api
```

`VITE_API_URL` is optional and defaults to the `api` Edge Function URL derived
from `VITE_SUPABASE_URL`.

**Security:** Variables beginning with `VITE_` are exposed to frontend code.
The Project URL and anon key are designed to be public. Never store database
passwords, service-role keys, or other secrets in frontend environment
variables.

### 3. Start Development Mode

```powershell
npm run dev
```

This command starts the Vite development server.

### 4. Build for Deployment

```powershell
npm run build
```

Vite generates the production files in the `dist` folder.

### 5. Deploy the Frontend

Deploy the generated `dist` folder to a suitable static hosting provider.

Configure all three `VITE_` variables before building the application for
deployment.

The deployed frontend must be listed in Supabase Auth Redirect URLs and must
match the Edge Function `FRONTEND_URL` secret. See
[`../SUPABASE_DEPLOYMENT.md`](../SUPABASE_DEPLOYMENT.md) for the exact
dashboard and CLI deployment steps.

## Application Features

- User registration and login
- Supabase Auth session persistence and refresh
- Brand-rule library
- Rule-based content checking
- Human review queue
- Review history
- Administrator dashboard and role management

## Limitations

The content checker uses predefined rules. It is not an AI-powered
fact-checker, and the application does not automatically publish content.

## Project Status

Inkloom BrandGuard is a prototype intended to demonstrate brand compliance checking and human review workflows.
