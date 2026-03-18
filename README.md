# Sozia Client

Frontend prototype for the Sozia project, built with Expo, React Native, TypeScript, and NativeWind.

## Requirements

- Node.js 20
- npm

## Setup

```bash
cd sozia-client
npm install
```

## Run

```bash
npm run start
```

For direct web preview:

```bash
npm run web
```

After Expo starts, you can:
- press `a` for Android
- press `i` for iOS
- press `w` for web
- scan the QR code with Expo Go

## Available Scripts

```bash
npm run start
npm run android
npm run ios
npm run web
```

## Notes

- No `.env` file is required right now.
- This repo currently contains the frontend/demo implementation.
- Some flows still use placeholder data while backend integration is not yet connected.

## Troubleshooting

If Metro cache causes issues, run:

```bash
npm run start -- --clear
```
