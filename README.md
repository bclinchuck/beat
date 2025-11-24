# Beat - Heart Rate Music Sync
March to the beat of your own drum.

⚠️ Project Disclaimer: This repository was created for a university course project. Our .env file is intentionally public to allow instructors to grade the assignment without configuration issues. This is not an active or production project, so we are not concerned about the exposure of these temporary development credentials.

A React application that queues music from Spotify based on your desrired workout's heart rate zone (BPM).

## Features
- Real-time heart rate monitoring
- BPM-matched song queuing
- Multiple workout profiles
- Spotify API integration

## Setup
1. Install dependencies with `npm install`.
2. Create a `.env.local` (for development) or fill out `.env.production` using the following keys:
   - `REACT_APP_SPOTIFY_CLIENT_ID`
   - `REACT_APP_SPOTIFY_REDIRECT_URI`
   - `REACT_APP_FIREBASE_API_KEY`
   - `REACT_APP_FIREBASE_AUTH_DOMAIN`
   - `REACT_APP_FIREBASE_PROJECT_ID`
   - `REACT_APP_FIREBASE_STORAGE_BUCKET`
   - `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
   - `REACT_APP_FIREBASE_APP_ID`
   - `REACT_APP_FIREBASE_MEASUREMENT_ID` (optional, Analytics only)
3. Run `npm start` to develop locally.

If Firebase environment variables are not supplied the app automatically drops into a browser-only demo mode so you can continue testing the Spotify flow without a backend.

## Deployment
Build the project with `npm run build` and deploy the `build/` directory with Firebase Hosting. The CRA entry point now relies on `public/index.html`, so no manual script tag is required—Firebase Hosting will simply serve the generated bundle.

## Technologies
- React
- Spotify Web API
- Tailwind CSS
- Lucide React Icons
