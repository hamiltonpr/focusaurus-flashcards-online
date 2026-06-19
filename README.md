# Focasaurus

Flashcard app for iOS and Android, built with Expo.

## Run the app

```bash
npm install --prefix mobile
npm start
```

Then scan the QR code with Expo Go on your phone, or press `i` for iOS simulator / `a` for Android emulator.

## Project structure

```
mobile/          Expo React Native app (the app)
supabase/        Database migrations (for future cloud sync)
```

## Environment

Copy `mobile/.env.example` to `mobile/.env` and fill in any API keys you need.
