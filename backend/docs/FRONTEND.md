# React frontend

The browser application uses React 19 and Vite, with React hooks for client state.

## Source layout

- `frontend/src/main.jsx` mounts the React app.
- `frontend/src/react/App.jsx` contains navigation, authentication state, role dashboards, and page views.
- `frontend/src/react/AuthPages.jsx` contains teacher and school registration plus password recovery.
- `frontend/src/react/TeacherTools.jsx` contains teacher attendance and results forms.
- `frontend/src/react/api.js` configures API requests and authentication headers.
- `frontend/src/react/app.css` contains the application styles.

## Development and build

From the project root, `npm run dev` starts the API and Vite development server. Vite serves the frontend on port 3000 and forwards `/api` and `/uploads` requests to the API on port 5000.

Run `npm run build` from the project root to create `frontend/dist`. The Express server serves that built application in production.

The frontend dependencies and lockfile live in `frontend/package.json` and `frontend/package-lock.json`. Install them with `npm install --prefix frontend`.
