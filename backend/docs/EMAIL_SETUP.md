# Email setup

Account verification and password recovery send one-time codes through `backend/services/resendEmailService.js`.

Set these values in the project root `.env` file:

```env
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=no-reply@your-verified-domain.example
APP_NAME=PANTA School Management
```

The sender domain must be verified with Resend. Without `RESEND_API_KEY`, the current service logs email details to the server console for local development. Configure a real key and sender before using account verification outside local development.

The React forms that call these flows are in `frontend/src/react/AuthPages.jsx`; the API endpoints and code validation are implemented in `backend/routes/auth.js` and `backend/routes/schools.js`.
