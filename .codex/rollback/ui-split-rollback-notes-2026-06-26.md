# UI split rollback notes - 2026-06-26

Baseline files captured before this split:

- `.codex/rollback/pre-ui-split-status-2026-06-26.txt`
- `.codex/rollback/pre-ui-split-working-tree-2026-06-26.patch`
- `.codex/rollback/pre-ui-split-staged-2026-06-26.patch`

Files and folders created for this split:

- `src/app/`
- `src/web/`
- `src/mobile/`
- `src/shared/`

Tracked files intentionally edited for this split:

- `src/App.tsx`
- `src/services/swmm/client.ts`
- `src/services/swmm/dto.ts`
- `src/services/swmm/editorRuntime.ts`

Manual rollback scope:

1. Remove `src/app/`, `src/web/`, `src/mobile/`, and `src/shared/`.
2. Restore `src/App.tsx` to the pre-split import path that used `./components/layout/DrainageWorkbench` and `./components/auth/LoginPage`.
3. Restore the three SWMM service type imports to `../../components/editor/editorTypes`.

Do not reset the whole repository without checking first: this checkout already had unrelated modified files before the split started.
