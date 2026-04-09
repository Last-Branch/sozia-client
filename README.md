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
npm run test
npm run lint
```

## Tests

Unit tests live under `__tests__/` mirroring the `src/` structure (`.ts` only, no `.tsx`).

```bash
npm run test
```

## Notes

- No `.env` file is required.
- Backend integration is not yet connected — all transcript data is local/demo.
- Some flows use placeholder data while the backend is pending.

## Troubleshooting

If Metro cache causes issues, run:

```bash
npm run start -- --clear
```
