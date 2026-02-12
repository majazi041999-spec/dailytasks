<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18liUT3pza0r566nbAc1p9wiOzyv1GcM8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) Set your frontend env in `.env.local`:
   - `VITE_API_BASE_URL=http://localhost:3001/api`
3. Run the app:
   `npm run dev`

## Backend security notes

- CORS origins can be restricted with `CORS_ORIGIN` (comma-separated).
- Login endpoint is rate-limited.
- Passwords are stored with scrypt hashing (legacy plain-text values are automatically upgraded on successful login).
