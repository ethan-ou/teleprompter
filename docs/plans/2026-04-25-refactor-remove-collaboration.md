# Refactor: Remove Collaboration Layer

## What this does

Removes the Y.js / Trystero collaboration feature entirely and restores the content store to its pre-collaboration shape. No algorithm changes. The codebase should be smaller and simpler after this with no behaviour change to the core teleprompter.

This is a prerequisite for the matching architecture plan. The collaboration proxy pattern (`useContent()` / `getContent()`) complicates both the store shape and the recognizer wiring, and needs to be gone before Plan 2 touches either.

---

## Files to delete

```
src/features/collaborate/          entire directory
src/app/use-yjs.ts
src/app/y-webrtc-trystero.ts
src/lib/word-list.ts               7779-line EFF wordlist, only used for passphrase generation
src/lib/generate-passphrase.ts
```

---

## Packages to remove from package.json

```
yjs
y-protocols
trystero
libp2p
@multiformats/multiaddr-matcher    added separately, never imported in src/
```

Run `npm install` after editing package.json to update the lockfile.

---

## src/features/content/store.ts

Restore the pre-collaboration shape. The target is the version from before commit `ecf03c0`, with the `setText` bug fixed (the old version set `start/search/end/bounds` at the top level instead of inside `position`).

Remove:
- `useLocalContentStore` → rename back to `useContentStore`
- `useContent()` hook — delete entirely
- `getContent()` function — delete entirely
- All Y.js imports (`yjs`, `@/app/use-yjs`, `@/features/collaborate/store`)
- `createRoomContentActions()` — delete
- `defaultPosition` constant (inline it)
- The `useCollaborateStore` import

Keep:
- The Zustand + persist setup
- The `Position` type unchanged (Plan 2 changes it)
- The `ContentState` and `ContentActions` interfaces
- The `setText`, `setTokens`, `setPosition` implementations

The resulting store should be ~50 lines. If it's longer, something collaboration-related was missed.

---

## src/app/recognizer.ts

Replace `getContent()` with `useContentStore.getState()`.

Before:
```typescript
import { getContent } from "@/features/content/store";
// ...
const { tokens, position, setPosition } = getContent();
```

After:
```typescript
import { useContentStore } from "@/features/content/store";
// ...
const { tokens, position, setPosition } = useContentStore.getState();
```

This is the same pattern as the pre-collaboration recognizer. No other logic changes.

---

## src/features/content/index.tsx

- Remove `useCollaborateStore` import and all uses (`isConnected` check in `useInterval`)
- Change `useContent()` to `useContentStore()`
- Remove the `isConnected()` condition from the scroll interval — scroll interval should always run when status is `"started"`, not conditionally on room connection

Before:
```typescript
status === "started" || isConnected() ? 2000 : null
```

After:
```typescript
status === "started" ? 2000 : null
```

---

## src/features/navbar/index.tsx

Remove the collaborate button and its related state (`collaborate` toggle, `useCollaborateStore` import). The UI slot it occupied can be removed or left empty — don't add a placeholder.

---

## src/App.tsx

Remove the `<Collaborate>` component and its import.

---

## Validation

After these changes:

1. `npm run build` completes with no errors
2. The app runs and the teleprompter works (start/stop, speech matching, scroll, editing)
3. No references to `yjs`, `trystero`, `useContent`, `getContent`, `useLocalContentStore`, or `useCollaborateStore` remain in `src/`

```bash
grep -r "yjs\|trystero\|useContent\|getContent\|useLocalContentStore\|useCollaborateStore" src/
```

This should return nothing.
