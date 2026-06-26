# Mobile Common UI Rollback Notes - 2026-06-26

Scope:
- Added mobile-only shared UI primitives under `src/mobile/ui`.
- Rewired mobile editor bottom sheets, floating action buttons, and repeated icons to those primitives.
- Rewired simulation repeated icons to `src/mobile/ui/MobileIcons.tsx`.

Files added:
- `src/mobile/ui/MobileBottomSheet.tsx`
- `src/mobile/ui/MobileFloatingActionButton.tsx`
- `src/mobile/ui/MobileIcons.tsx`

Files edited:
- `src/mobile/editor/EditorContextMenu.tsx`
- `src/mobile/editor/EditorCanvas.tsx`
- `src/mobile/simulation/SimulationWorkbench.tsx`
- `../docs/work_log.md`

Rollback outline:
1. Restore the three edited mobile files from the previous revision or from the pre-refactor copy in the relevant web/mobile split point.
2. Remove the three files under `src/mobile/ui` if no other mobile files import them.
3. Keep unrelated prior split/cleanup changes intact. Do not use a whole-repo reset unless that is explicitly intended.
4. Re-run:
   - `npm run build`
   - `git diff --check`

Validation at creation:
- `npm run build` passed.
- `git diff --check` passed.
- `npm run lint` still fails on existing React Compiler rules in `src/web/editor/EditorCanvas.tsx` and `src/mobile/editor/EditorCanvas.tsx`.
