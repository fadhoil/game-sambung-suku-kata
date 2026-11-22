# Implementation Plan — SSK bug fix + features

Root for all commands: `d:\ADO\KiroAI\game-apps`. Verify by redirecting noisy PowerShell output to a file and reading it: `npx tsc --noEmit -p tsconfig.json *> tsc.log` then read `tsc.log` (expect empty, exit 0); `npx next build *> build.log` then read `build.log` (expect "Compiled successfully", exit 0); delete the logs after. SQL files are authored only (not run against any DB in this task). `functions.sql` is re-run in full (all `create or replace`) so edit it directly; schema changes go in a NEW `migration-v9.sql` (never edit v2..v8). All RPC must `grant execute ... to anon, authenticated`.

This plan is also authored as FEAT artifacts under the same task folder (`task.json`, `context.json`, `features/FEAT-001..003.json`); this file is the working fallback. The design decisions are mine, recorded inline.

## A — Critical turn-rotation bug (root cause + fix)

- [ ] 1. Fix the FFA turn advance in `fn_advance_turn` to not assume unique/contiguous `turn_order`.
      Decision: order alive players on the tuple `(turn_order, id)` and pick the next tuple strictly greater than the current player's, wrapping to the first. Root cause: `join_room` sets `turn_order = <player count>`, so after any lobby leave/kick a later joiner gets a DUPLICATE `turn_order`; the old `turn_order > v_cur_order ... limit 1` can never select the second holder of the top value, so the highest-order ("last") player is skipped every round. The tuple makes the successor relation a single full cycle regardless of duplicates/gaps.
      Files: `supabase/functions.sql` (FFA branch of `fn_advance_turn`; add `v_cur_id uuid` local; read `turn_order, id` of active player; next = `where room_id=v_room.id and is_alive and (turn_order,id) > (v_cur_order,v_cur_id) order by turn_order asc, id asc limit 1`; wrap = `... is_alive order by turn_order asc, id asc limit 1`).
      Verify: SQL not executed here — read back that the FFA branch uses the `(turn_order, id)` tuple and wrap. Then `npx tsc --noEmit -p tsconfig.json *> tsc.log` stays clean (no TS touched).

- [ ] 2. Apply the same `(turn_order, id)` tuple ordering to the team branch of `fn_advance_turn`.
      Decision: teams use `max(turn_order)+1` so duplicates are unlikely, but apply the tuple for robustness (team deletion could create gaps). Keep the alive-members `exists` filter and `order by random()` member pick.
      Files: `supabase/functions.sql` (team branch of `fn_advance_turn`).
      Verify: read back that team advance uses `(t.turn_order, t.id)` ordering with wrap and still randomizes the member.

- [ ] 3. Add a written coverage proof and confirm the opener stays random.
      Decision: a SQL comment block arguing that for N alive players with ANY `turn_order` values, the `(turn_order,id)` successor + wrap forms one cycle visiting each alive player exactly once per round; note `fn_pick_first_subject` is unchanged and keeps `order by random()` for the opener (FFA and team).
      Files: `supabase/functions.sql` (comment near `fn_advance_turn`; verify `fn_pick_first_subject` untouched).
      Verify: read `fn_pick_first_subject` still has `order by random()`.

## B — Admin backend (schema + RPC)

- [ ] 4. Create `supabase/migration-v9.sql` adding `players.is_admin` and a PIN-gated `list_active_rooms`.
      Decision: reuse the migration-v7 PIN pattern (`fn_admin_pin()` = '110966', `if p_pin is distinct from public.fn_admin_pin() then raise exception 'BAD_PIN'`). `list_active_rooms(p_pin)` returns `(code, status, player_count, created_at)` from `public.rooms` with a correlated count, ordered `created_at desc`. Grant execute to anon, authenticated.
      Files: `supabase/migration-v9.sql` (NEW).
      Verify: read back `add column if not exists is_admin boolean not null default false`, the BAD_PIN check, the return shape, and the grant.

- [ ] 5. Extend `join_room` with `p_is_admin boolean default false` and protect admins in `kick_player`.
      Decision: persist `is_admin` on insert; add a `drop function if exists public.join_room(text,text,text,text);` for the old 4-arg signature so the 5-arg replaces cleanly. `kick_player` raises `CANT_KICK_ADMIN` when the target is admin, before the delete.
      Files: `supabase/functions.sql` (`join_room`, `kick_player`).
      Verify: read back the new `join_room` signature inserting `is_admin`, and the `CANT_KICK_ADMIN` guard.

## C — Frontend plumbing, admin join, static layout/text

- [ ] 6. Add `is_admin` to the Player type; extend `joinRoom`; add `listActiveRooms` + `ActiveRoom`.
      Files: `src/types/game.ts`, `src/lib/gameActions.ts`.
      Verify: `npx tsc --noEmit -p tsconfig.json *> tsc.log` clean.

- [ ] 7. Expand avatars and reserve the robot for admin.
      Decision: keep existing AVATARS entries, add new UNIQUE face/animal emojis to reach >=16 (current array has 20 generic emojis; ensure at least 16 and no duplicate robot inside). Export `ADMIN_AVATAR` (🤖) separately, kept OUT of AVATARS so `randomAvatar()` never returns it. Note/assumption: the brief says "16 total" but the array already has 20; I keep >=16 unique and do not shrink below the existing set, since max players is 16 and more choices is harmless. Home page renders ALL avatars (replace `AVATARS.slice(0,10)`).
      Files: `src/lib/session.ts`, `src/app/page.tsx`.
      Verify: build + confirm AVATARS length >=16 and excludes 🤖.

- [ ] 8. Add the "Lihat Lobi Aktif" view to kamus-admin with admin-join.
      Decision: after PIN unlock, a button loads `listActiveRooms(pin)`; render each room's code/player_count/created_at with a status badge (lobby→"Menunggu" green, playing→"Bermain" amber, finished→"Selesai" muted). For "Menunggu" rooms show "Ikut Bermain": `joinRoom(code,'Admin-SSK',ADMIN_AVATAR,true)` → `saveIdentity(code,{playerId,name:'Admin-SSK',avatar:ADMIN_AVATAR})` → `router.push('/room/'+code)`. Keep the existing suggestion-review UI as a separate section/toggle.
      Files: `src/app/kamus-admin/page.tsx`.
      Verify: build passes; read back the join-as-admin flow and status mapping.

- [ ] 9. Hide the kick button for admin players.
      Decision: change the PlayerChip guard to `onKick && !player.is_host && !player.is_admin` (matches server CANT_KICK_ADMIN).
      Files: `src/components/PlayerChip.tsx`.
      Verify: build passes.

- [ ] 10. Move the play-screen turn/timer/input panel to the TOP.
      Decision: reorder JSX so the "Sambung dari / TimerRing / Giliran" panel and the input section render first (after the small header row), with WordChain and the player grid below. Keep overlays (Countdown/RelaxNotice) and props unchanged; player grid may keep `mt-auto`. Keep tidy on mobile (`max-w-md`).
      Files: `src/app/room/[code]/play/page.tsx`.
      Verify: build passes.

- [ ] 11. Remove "- sudah 2 kali gagal." from RelaxNotice.
      Files: `src/components/RelaxNotice.tsx`.
      Verify: grep confirms the string is gone; build passes.

## D — Realtime ephemeral UX (broadcast only, no DB)

- [ ] 12. Add emoji + start-game SFX to `sound.ts`.
      Decision: three per-emoji tones (`sfxEmojiTease`, `sfxEmojiLaugh`, `sfxEmojiAngry`) and a big `sfxGameStart` fanfare/whoosh, all via the existing `tone()` helper and volume style.
      Files: `src/lib/sound.ts`.
      Verify: build passes.

- [ ] 13. Add a broadcast reactions hook and overlay/panel component.
      Decision: `src/lib/useRoomReactions.ts` opens broadcast channel `reactions:CODE` (`broadcast.self:true`), exposes `sendReaction(emoji)` and an `onReaction` callback via `channel.send({type:'broadcast',event:'emoji',payload})`. `src/components/ReactionLayer.tsx`: bottom-center fixed 3-button panel (😜 😂 😡) + a `fixed inset-0 z-40 pointer-events-none` overlay rendering transient emojis that rise + scale up + fade over ~2s then unmount. Add an `emoji-rise` keyframe to `src/app/globals.css` following existing keyframes. Click → `sendReaction` + matching SFX; incoming → spawn element + SFX.
      Files: `src/lib/useRoomReactions.ts` (NEW), `src/components/ReactionLayer.tsx` (NEW), `src/app/globals.css`.
      Verify: build passes; confirm overlay is `pointer-events:none`.

- [ ] 14. Wire ReactionLayer into lobby and play; ensure input keeps focus.
      Files: `src/app/room/[code]/page.tsx`, `src/app/room/[code]/play/page.tsx`.
      Verify: build passes.

- [ ] 15. Play the big start-game sound on all clients when the room becomes `playing`.
      Decision: track previous `room.status` in a ref on the lobby page; when it flips `lobby`→`playing`, call `sfxGameStart()` (fires on host and players since all observe the status change via `useRoomRealtime`). No broadcast needed.
      Files: `src/app/room/[code]/page.tsx`.
      Verify: build passes; read back the transition guard.

- [ ] 16. Informational ready-check via broadcast (no DB).
      Decision: host-only checklist button broadcasts `readycheck:open` on the `reactions:CODE` channel; every client shows a modal (reuse `fixed inset-0 z-50` + white rounded-3xl `animate-pop-in`) with green-check (ready) / red-cross (not ready), auto-close after 7s (non-response = not ready); answering broadcasts `readycheck:answer {playerId, ready}`. Each client keeps a local `playerId→ready` map and tints PlayerChips green/red via a new optional `readyState` prop (sage/coral tokens). Start button stays enabled regardless.
      Files: `src/app/room/[code]/page.tsx`, `src/components/PlayerChip.tsx`.
      Verify: build passes; confirm no `supabase.from(...).insert/update` added for ready-check/emoji.

- [ ] 17. Final integration verification.
      Verify: from `d:\ADO\KiroAI\game-apps`, `npx tsc --noEmit -p tsconfig.json *> tsc.log` (exit 0) and `npx next build *> build.log` (exit 0); read both logs; delete them.

## Digest

SQL (`supabase/functions.sql`, authored only):
- `fn_advance_turn(p_round_id uuid)` — FFA branch currently: `select turn_order into v_cur_order ...; select id into v_next_subject ... where ... is_alive and turn_order > v_cur_order order by turn_order asc limit 1; if null wrap by turn_order asc`. Team branch mirrors with `teams.turn_order`. Change both to `(turn_order, id)` tuple ordering + wrap; add `v_cur_id`/team vars. No test harness — covered by reasoning note.
- `fn_pick_first_subject(p_room_id, out subject_id, out team_id)` — MUST remain unchanged (`order by random()` opener, FFA and team).
- `join_room(p_code,p_name,p_avatar,p_device_id)` — add `p_is_admin boolean default false`; insert `is_admin`; add drop for old 4-arg signature.
- `kick_player(p_room_id,p_host_id,p_target_player)` — add `CANT_KICK_ADMIN` guard before delete.
- File-wide `grant execute on all functions in schema public to anon, authenticated;` at EOF covers join_room/kick_player.

SQL (`supabase/migration-v9.sql`, NEW): `alter table public.players add column if not exists is_admin boolean not null default false;` + `list_active_rooms(p_pin text)` PIN-gated RPC returning `(code,status,player_count,created_at)` + explicit grant. Pattern source: `migration-v7.sql` `list_suggestions`.

TS/React (build-verified via tsc + next build; no unit tests exist):
- `src/types/game.ts` — `Player` interface: add `is_admin: boolean`.
- `src/lib/gameActions.ts` — `joinRoom(code,name,avatar,isAdmin=false)` passes `p_is_admin`; add `listActiveRooms(pin)` + `ActiveRoom` interface (mirror `listSuggestions`/`WordSuggestion`).
- `src/lib/session.ts` — `AVATARS` (currently 20 entries, keep >=16 unique, no 🤖 inside); add `ADMIN_AVATAR="🤖"`; `randomAvatar()` unchanged (picks from AVATARS only).
- `src/app/page.tsx` — avatar picker: `AVATARS.slice(0,10)` → `AVATARS`.
- `src/app/kamus-admin/page.tsx` — add active-lobbies section (listActiveRooms + status badges + Ikut Bermain → joinRoom admin + saveIdentity + router.push); keep suggestion review.
- `src/components/PlayerChip.tsx` — kick guard adds `!player.is_admin`; add optional `readyState?: 'ready'|'notready'` tint prop.
- `src/app/room/[code]/play/page.tsx` — reorder: turn panel + input to top; WordChain + player grid below. Add ReactionLayer.
- `src/app/room/[code]/page.tsx` (lobby) — ReactionLayer; start-game sound on `lobby→playing` ref transition; host checklist + ready-check broadcast + chip tinting.
- `src/components/RelaxNotice.tsx` — paragraph currently: `Suku kata <b>-{fullSyllable}</b> terlalu sulit — sudah 2 kali gagal.` → drop the "- sudah 2 kali gagal." clause.
- `src/lib/sound.ts` — add `sfxEmojiTease`, `sfxEmojiLaugh`, `sfxEmojiAngry`, `sfxGameStart` via `tone()`.
- `src/lib/useRoomReactions.ts` (NEW), `src/components/ReactionLayer.tsx` (NEW), `src/app/globals.css` (add `emoji-rise` keyframe).

Verified today: read all key files above; build/test commands confirmed from `package.json` (`next build`; type-check via `tsc`). No test runner exists, so verification is tsc + next build only. SQL is authored, not executed (per task constraints).
