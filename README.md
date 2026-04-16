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
- scan the QR code with the EAS dev client (not Expo Go — see Native Development section below)

## Available Scripts

```bash
npm run start
npm run android
npm run ios
npm run web
npm run typecheck   # TypeScript type checking
npm run lint        # ESLint
npm run test        # Jest unit tests
npm run check       # typecheck + lint + test (run before committing)
```

## Checks

Run all checks before committing:

```bash
npm run check
```

This runs `typecheck → lint → test` in order, stopping on the first failure.

To run individually:

```bash
npm run typecheck                                      # tsc --noEmit
npm run lint                                           # ESLint
npm run test                                           # all unit tests
npx jest __tests__/store/TranscriptStore.test.ts       # single file
npx jest --testNamePattern="export"                    # by test name
```

Unit tests live under `__tests__/` mirroring the `src/` structure (`.ts` only, no `.tsx`).

## Native Development (EAS Dev Build)

Expo Go will not work — native modules require a custom dev client.

```bash
# Build and install the dev client on your device (once per native change)
eas build --profile development --platform android   # or ios

# Then start Metro and scan the QR with the installed dev client
npm run start
```

To view device logs: shake the phone → React Native dev menu → Open DevTools.

## Notes

- No `.env` file is required.
- Backend integration is not yet connected — all transcript data is local/demo.
- Some flows use placeholder data while the backend is pending.

## Troubleshooting

If Metro cache causes issues, run:

```bash
npm run start -- --clear
```
