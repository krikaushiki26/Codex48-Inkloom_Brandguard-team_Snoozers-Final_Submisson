
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
- Access to the Inkloom BrandGuard backend API

## Setup Instructions

### 1. Install Dependencies

Open a terminal in the frontend folder and run:

```powershell
npm install
```

### 2. Configure the Backend URL

Create a `.env` file in the frontend folder using `.env.example` as a template.

Set the backend URL:

```text
VITE_API_URL=http://127.0.0.1:8000
```

Replace this address with the deployed backend URL when deploying the application.

**Security:** Variables beginning with `VITE_` are exposed to frontend code. Never store database passwords or JWT secrets in frontend environment variables.

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

Configure `VITE_API_URL` before building the application for deployment.

The deployed frontend must be able to communicate with the backend API, and the backend must allow the frontend's origin through its CORS configuration.

## Application Features

- User registration and login
- Brand-rule library
- Rule-based content checking
- Human review queue
- Review history
- Administrator dashboard and role management

## Limitations

The content checker uses predefined rules. It is not an AI-powered fact-checker, and the application does not automatically publish content.

## Project Status

Inkloom BrandGuard is a prototype intended to demonstrate brand compliance checking and human review workflows.
