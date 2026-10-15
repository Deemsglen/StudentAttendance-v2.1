# Deployment Guide

## What Changed

The app no longer uses Firebase Cloud Functions (which requires the paid Blaze plan). Instead, the backend runs on **Express.js** and can be deployed to free platforms like **Render**.

### Files Created/Modified

| File | Change |
|------|--------|
| `server/index.js` | New Express.js backend (replaces Cloud Functions) |
| `server/package.json` | Backend dependencies |
| `server/render.yaml` | Render deployment config |
| `src/services/firebase.js` | Removed `functions`, added `apiUrl` |
| `src/services/management.js` | Now uses `fetch()` instead of `httpsCallable` |
| `src/context/AttendanceContext.jsx` | `scan()` now uses REST API |
| `.env` | Added `VITE_API_URL` for backend URL |

## Deployment Steps

### 1. Deploy Backend to Render (Free)

1. Push this project to GitHub
2. Go to [render.com](https://render.com) and sign up
3. Click **New +** → **Web Service**
4. Connect your GitHub repo
5. Use these settings:
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Free
6. Click **Deploy**
7. After deployment, you'll get a URL like `https://student-attendance-backend-xxxx.onrender.com`

### 2. Update Frontend `.env`

```env
VITE_API_URL=https://student-attendance-backend-xxxx.onrender.com
```

### 3. Deploy Frontend to Firebase Hosting (Free)

```bash
npm run build
firebase deploy --only hosting
```

### 4. Update Firebase Project Settings

In your Firebase Console:
1. Go to **Authentication** → **Settings**
2. Under **Authorized domains**, add your Render URL
3. Go to **Firestore** → **Rules** (already deployed)

### 5. Get Firebase Config Values

1. Go to Firebase Console → **Project Settings**
2. Under **Your apps**, find your web app
3. Copy the values to your `.env` file:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`

### 6. Rebuild and Deploy Frontend

```bash
npm run build
firebase deploy --only hosting
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/listManagedClasses` | List teacher's classes |
| `POST /api/createClass` | Create new class |
| `POST /api/getManagedClass` | Get class details |
| `POST /api/enrollStudent` | Enroll student |
| `POST /api/removeStudent` | Remove student |
| `POST /api/startAttendanceSession` | Start attendance |
| `POST /api/rotateAttendanceQR` | Rotate QR code |
| `POST /api/closeAttendanceSession` | Close attendance |
| `POST /api/markAttendance` | Student checks in |
| `GET /api/health` | Health check |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_API_URL` | Backend API URL (Render) |
| `PORT` | Server port (default: 3000) |
