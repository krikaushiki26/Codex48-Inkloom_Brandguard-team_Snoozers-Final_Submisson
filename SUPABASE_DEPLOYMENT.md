# Supabase deployment

Inkloom BrandGuard now uses Supabase Postgres, Row Level Security (RLS),
Supabase Auth, and the `api` Edge Function. There is no Render/FastAPI
service to deploy.

## 1. Create and configure the project

1. Create a Supabase project in the dashboard.
2. In **Authentication → Providers**, keep Email enabled and choose whether
   email confirmation is required.
3. In **Authentication → URL Configuration**, set the Site URL to the
   production frontend URL and add the production URL, `http://localhost:5173`,
   and `http://127.0.0.1:5173` to Redirect URLs.
4. In **Project Settings → API**, copy the Project URL and the publishable
   (anon) key. The anon key is intentionally used in the browser; never put a
   `service_role` key in the frontend or this repository.

## 2. Apply the database migration and deploy the function

Install the Supabase CLI, authenticate, then run these commands from the
repository root. Replace the placeholders with your project ref and frontend
origin:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set FRONTEND_URL=https://YOUR_FRONTEND_ORIGIN
supabase functions deploy api --no-verify-jwt
```

`--no-verify-jwt` is required because `/auth/register` and `/auth/login` are
public API compatibility routes. The function validates every protected route
with `auth.getUser`; the migration's RLS policies enforce the same data
boundaries in Postgres. The Edge Function uses Supabase's automatically
provided `SUPABASE_SERVICE_ROLE_KEY` only after that validation to write
authoritative check results and review decisions. Do not add that key to the
frontend or set it as a repository secret.

For local development, start the Supabase stack and function:

```powershell
supabase start
supabase functions serve api --env-file supabase/.env
```

Use the API URL printed by the CLI (normally
`http://127.0.0.1:54321/functions/v1/api`) in `VITE_API_URL`.

## 3. Configure and deploy the frontend

Copy `frontend/.env.example` to `frontend/.env` and set:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PROJECT_ANON_KEY
VITE_API_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/api
```

Then build and deploy the static Vite application:

```powershell
cd frontend
npm install
npm run build
```

Set the same three `VITE_` variables in the static host's build environment.
After the frontend is deployed, update the `FRONTEND_URL` Edge Function secret
and redeploy the function if its origin changes.

## 4. Bootstrap the first administrator

Register the first account through the app (and confirm its email when email
confirmation is enabled). Then, in the Supabase SQL Editor, run once:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

Sign out and back in. Public registration always creates a `writer`; only an
administrator can promote a non-admin user to `manager` or `reviewer` in the
app. The migration prevents normal application requests from demoting an
administrator or creating additional admins.

## Existing FastAPI data

The supplied migration is intentionally for a new Supabase Auth-backed
installation. The former `users.id` values were integers and their password
hashes belonged to the old application, while Supabase Auth uses UUIDs and
manages password hashes itself. Do not copy the former `users` table or its
password hashes into `auth.users`.

For an existing production deployment, export brand rules, reviews, and check
results before retiring the old backend; create or import users through the
Supabase Auth migration process, then map legacy integer user IDs to the new
`auth.users.id` UUIDs before importing dependent rows. Require password resets
unless the approved Supabase Auth user-import process supports the legacy hash
format. Validate this one-off migration in a non-production project first.

## API compatibility

The function is mounted at `/functions/v1/api` and retains the former routes:
`/auth/me`, `/rules`, `/content/check`, `/reviews`, `/analytics/*`, and
`/admin/users`. It additionally supports `PATCH /rules/:id` and
`DELETE /rules/:id` for full brand-rule CRUD. `/auth/register` and
`/auth/login` remain available for API clients, while the React app calls
Supabase Auth directly so it benefits from secure session persistence and
refresh.

## Operational limitations

The Edge Function ports the deterministic rule-based checker. The legacy
optional server-side Groq integration is intentionally not deployed because
its API key and external AI processing need a separate approved integration.
Checks, reviews, and analytics remain fully functional without it. Supabase
Auth email delivery and rate limits are controlled by the Supabase project.
