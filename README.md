# Neon Lane

A hyper‑casual, neon‑styled lane switcher. Tap left/right to dodge obstacles. Speed ramps up over time. Beat your best score.

## Tech
- React + Vite (TypeScript)
- Canvas rendering + `requestAnimationFrame`
- Mobile-friendly input

## Run locally
```bash
npm install
npm run dev
```
Open the URL printed by Vite (usually http://localhost:5173).

## Build
```bash
npm run build
npm run preview
```

## Game Design (MVP)
- 3 lanes: switch left/right by tapping the left or right half of the screen.
- Obstacles spawn and move toward the player.
- Score increases as you survive; best score saved in localStorage.
- Difficulty ramps: obstacle speed increases and spawn interval decreases.

## Roadmap
- Juice: particle bursts, glow trails, hit feedback, sound FX
- Daily challenge + leaderboards (web backend or third-party)
- Skins/themes unlocked by milestones
- PWA packaging for “Add to Home Screen” on iOS/Android
- Port to native:
  - Option A: React Native (Expo) for iOS/Android
  - Option B: Flutter for iOS/Android/Web

## Deploy
- Quick: Vercel/Netlify (drag-and-drop or CI)
- GitHub Pages:
  - Add `"homepage"` and a deploy script to package.json, or use an Action.
  - Then publish `dist/`.

## License
MIT (see LICENSE)