# Unused code cleanup rollback notes - 2026-06-26

Removed after the web/mobile split because the current app entry no longer imports them:

- `src/components/`
- `src/domain/`
- `src/App.css`
- `src/assets/hero.png`
- `src/assets/react.svg`
- `src/assets/vite.svg`
- `public/icons.svg`
- `public/favicon.svg`
- unused subfolders under `src/web/diagram/`
- unused subfolders under `src/mobile/diagram/`

The app still uses:

- `src/assets/supermario-logo.png`
- `src/data/defaultDrainageLayout.json`
- `public/favicon.png`
- `src/web/diagram/SoilBackground.tsx`
- `src/web/diagram/useLayoutIndexes.ts`
- `src/web/diagram/useRafCoalescedCallback.ts`
- `src/mobile/diagram/SoilBackground.tsx`
- `src/mobile/diagram/useLayoutIndexes.ts`
- `src/mobile/diagram/useRafCoalescedCallback.ts`

Rollback guidance:

- For tracked deleted files, use `git restore -- <path>` on the specific paths above.
- For the removed copied diagram subfolders, restore them from the earlier split patch or from git before the cleanup.
- Avoid whole-repo reset because this checkout already had unrelated modified files before the split and cleanup.
