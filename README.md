# BELLORA School Management System

The application is organized into a backend and a frontend:

- `backend/` contains the Express API, database configuration, migrations, routes, maintenance scripts, tools, tests, and operations documentation.
- `frontend/` contains the React and Vite web application plus design references.
- `.env` at the project root contains the backend's local configuration.
- `uploads/` stores uploaded files used by the API.
- `backend/database.sql` contains the schema used by backend setup. Legacy database exports and seeded account records are not included.
- `backend/docs/FRONTEND.md` describes the React app structure and workflow. `backend/docs/EMAIL_SETUP.md` documents the current server-side email setup.

## Setup

Install the backend dependencies from the project root and the frontend dependencies from `frontend/`:

```powershell
npm install
npm install --prefix frontend
```

Set the database and other required values in the root `.env` file. Start the API and frontend together with:

```powershell
npm run dev
```

The API uses port `5000`; the Vite development server uses port `3000` and proxies API and upload requests to the backend.

## Build and production

Build the React frontend with `npm run build`. The API serves the compiled `frontend/dist/` files when that directory exists. Start the production API with `npm run start:prod`.

Database migration and seed commands remain available from the project root, including `npm run db:migrate` and `npm run db:seed`.

