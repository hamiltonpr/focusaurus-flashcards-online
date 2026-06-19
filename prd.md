# Focasaurus — Product Requirements Document

**Version:** 1.0.0 (pre-production)  
**Last updated:** June 2026  
**Primary platform:** Mobile (`mobile/`) — Expo React Native for iOS & Android  
**Status:** Active development; mobile app is the shipping product

---

## 1. Product overview

Focasaurus is a language-learning flashcard app with a custom study loop engine and guided reading for Japanese learners. Users build vocabulary stacks, study with spaced repetition, and reinforce words through curated stories and live NHK Easy News articles with tap-to-define.

### Goals

- Make daily vocabulary review feel structured and achievable (time or word-count goals)
- Connect study lists to real reading material matched to the learner's recent words
- Sync progress across devices when signed in
- Work offline for core study and curated reading; internet required for NHK news and dictionary lookups

### Non-goals (current scope)

- Web app (legacy components exist but are not maintained)
- AI-generated stories on mobile (curated library + NHK Easy instead)
- Languages other than Japanese for guided reading (study works for any language)

---

## 2. Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Expo SDK 54, React 19, React Native 0.81 |
| Language | TypeScript |
| Local storage | AsyncStorage |
| Cloud | Supabase (Auth + Postgres JSONB) |
| Navigation | Custom state machine (no React Navigation) |
| Japanese NLP | TinySegmenter (bundled) |
| Dictionary | Jisho.org API (online, on tap) |
| News | NHK NEWS WEB EASY (via proxy) |

---

## 3. Navigation & screens

```
App launch
├── Loading (auth + data fetch)
├── SignInScreen (if Supabase configured; skippable as guest)
└── Main shell — bottom tabs: Home | Reading | Settings
    ├── Home → StacksScreen
    │   └── StackDetailScreen
    │       ├── Page 1: Goal (time/words, Start Studying)
    │       ├── Page 2: Reading (open Guided Reading)
    │       └── Page 3: Info (stats, Edit Stack)
    │       └── Overlays: StudySession, GuidedReadingScreen, StackEditScreen
    ├── Reading → ReadingHubScreen → GuidedReadingScreen
    └── Settings → SettingsScreen
```

---

## 4. Feature specification

### 4.1 Stacks & cards

| Feature | Description |
|---------|-------------|
| Create stack | Name-only; ID = timestamp |
| Delete stack | Confirmation alert from Home list |
| Demo data | 2 seed stacks on first launch if no local/cloud data (French 3 cards, Spanish 2 cards) |
| Stack list | Shows card count, last studied date, today's progress if any |
| Per-stack stats | Today: words studied, minutes, accuracy. All-time: words, time, session count |
| Saved goal | Optional per-stack goal with "Remember for this stack" |

**Card model:** front (target language) / back (English); multi-line supported.

**Card states:**

- `cardType: 1` — learning (new)
- `cardType: 2` — learned / in review

**Stack Edit:** add, inline edit, delete cards; mark as Known (promotes to type-2 with random 7–365 day interval); import CSV; session settings.

---

### 4.2 Spaced repetition

**Schedule:** intervals double after successful end-of-day review: 0 → 1 → 2 → 4 → 8 → 16… days.

**Due logic:** card due when `nextReviewDate <= today` (YYYY-MM-DD).

| Outcome | Effect |
|---------|--------|
| Known (end-of-day) | Promote to type-2, double interval, set next review date |
| Unknown (end-of-day) | Reset interval to 1 day, review tomorrow |
| Bump from reading | Existing card scheduled for review tomorrow |

---

### 4.3 Study session engine

Custom loop-based engine (not SM-2/Anki). Four phases:

1. **Loop** — active working set (default 4 cards); pattern fills new/review slots; min 2 type-1 slots maintained
2. **Short-term** — batch review when queue hits threshold (default 5); failures return to loop front
3. **End-of-day** — final pass; updates SR intervals
4. **Complete** — persists card updates + session stats

**In-loop behavior:**

- Type-1 known → promoted to type-2 in same slot (direction flips)
- Type-1 unknown → stays type-1, advance
- Type-2 known → exits to short-term queue
- Type-2 unknown → wrong streak++; at limit (default 3) reverts to type-1

**Card selection priority:**

1. Failed short-term cards
2. Maintain ≥2 type-1 slots
3. Global priority: New words first vs Review first (due type-2)

**Per-stack session settings** (Stack Edit):

- Loop size (default 4, min 2)
- Short-term queue size (default 5, min 1)
- Wrong streak limit (default 3, min 1)

**Study goals:**

- **Time goal** — wind-down when elapsed + estimated remaining ≥ target
- **Words goal** — target count of type-1 cards exiting loop into short-term

**Flashcard UX:** tap to flip; Knew It / Didn't Know; direction alternates by card type. Optional "See it in a sentence" (requires `EXPO_PUBLIC_API_BASE_URL`).

**HUD:** phase badge, short-term/end-of-day counters (tappable to jump phases), progress bar.

---

### 4.4 Guided reading

**Availability:** Japanese stacks only (detected via script in card fronts).

**Entry points:** Reading tab → stack picker, or Stack Detail → Reading page.

#### Setup (`GuidedReadingScreen`)

- Badges: detected language, learner level, recent word count
- Reading length: Short (~2 min), Medium (~5 min), Long (~10 min)
- Two modes (default: **NHK Easy News**):
  - **NHK Easy News** — live simplified news (internet + proxy required)
  - **Story library** — 32 offline curated stories

#### Curated story library (32 stories)

- 12 original + 20 additional beginner/intermediate stories
- Ranked by overlap with recent (7-day) and known stack words
- Filtered to ±1 level from detected learner level
- Unread stories preferred; random tie-break among top 4
- Actions: auto-pick best match or manual selection with overlap counts

#### NHK NEWS WEB EASY

- Up to 8 articles from today's feed
- "Read today's top story", browse list with read/unread markers
- "Read another" after finishing — picks from unread pool
- NHK attribution shown in reader

#### Story reader (`StoryReader`)

- Tokenized Japanese display; ruby/furigana for NHK articles
- Solid underline = word in stack; dotted = tap to look up
- Tap word → bottom sheet: reading, definition, Add to stack, Bump to tomorrow
- Dictionary: stack cards first → particles inline → Jisho.org API with deinflection fallback

#### Post-reading

- Feedback screen: Too Easy / Just Right / Too Hard
- **Stub:** feedback logged to console only — not persisted or used for calibration

#### Reading history

- Per-stack, local only (`focusaurus-reading-history:{stackId}`)
- Up to 30 curated IDs + 30 NHK IDs
- Not synced to cloud

---

### 4.5 Auth & cloud sync

**When Supabase is configured** (`EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`):

- Sign-in gate on launch
- Google OAuth via Supabase PKCE + expo-web-browser + deep link (`focasaurus://auth/callback`)
- Guest mode: "Continue without account" — local-only

**Cloud schema** (`user_data` table):

```
user_id (PK) | stacks (jsonb) | global_settings (jsonb) | updated_at
```

RLS: users read/write own row only.

**Sync behavior:**

- Logged in: cloud is source of truth after initial fetch
- First login with empty cloud: uploads local data
- Debounced save (~500ms) after changes; "saving…" / "synced" in Settings
- Offline/error: falls back to local data
- Sign out: clears session, returns to sign-in

**If Supabase env vars missing:** app skips auth, runs local-only.

---

### 4.6 Import / export

| Feature | Status |
|---------|--------|
| CSV import — new stack | ✅ Home → Import CSV |
| CSV import — into stack | ✅ Stack Edit → Import from CSV |
| CSV export | ❌ Not implemented |

**Import wizard:** file picker or paste → auto-detect separator → header toggle → column mapping → preview. Supports CSV, TSV, semicolon, Anki-style exports.

---

### 4.7 Global settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `useGlobalGoals` | false | Apply defaults to all stacks on Goal page |
| `defaultTimeGoal` | 15 min | Default time-based session goal |
| `defaultWordsGoal` | 10 | Default word-count session goal |
| `priority` | `"new-words"` | New words first vs solidify (review first) |

Explicit Save button. Account section when signed in: email, sync status, sign out.

---

## 5. Data model

### Card

```
id, front, back, cardType (1|2), interval (days), nextReviewDate (YYYY-MM-DD)
```

### Stack

```
id, name, cards[], lastStudied?, todayStats, allTimeStats, savedGoal?, stackSettings?
```

### Local storage keys

| Key | Content |
|-----|---------|
| `focasaurus-stacks` | Stack[] |
| `focasaurus-settings` | GlobalSettings |
| `focusaurus-reading-history:{stackId}` | { curated: string[], nhk: string[] } |

---

## 6. External services

| Service | Purpose | Config |
|---------|---------|--------|
| Supabase Auth | Google sign-in | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Supabase DB | Cloud sync | Same + migration applied |
| Supabase Edge Function `nhk-easy` | Production NHK proxy | Deploy + `EXPO_PUBLIC_NHK_USE_SUPABASE=1` |
| Local NHK proxy | Dev NHK access | Auto-started by `npm start` on port 3847 |
| Jisho.org API | Dictionary lookup | No key; internet required |
| Generate Sentence API | Study mode sentences | `EXPO_PUBLIC_API_BASE_URL` (optional) |
| NHK NEWS WEB EASY | News content | Via proxy only; attribution required |

### NHK proxy resolution order

1. `EXPO_PUBLIC_NHK_PROXY_URL` (set automatically by `npm start`)
2. If `EXPO_PUBLIC_NHK_USE_SUPABASE=1` → Supabase `nhk-easy` function

---

## 7. Known limitations & stubs

| Item | Status |
|------|--------|
| Reading difficulty feedback | UI exists; not persisted |
| Reading history cloud sync | Local only |
| CSV export | Not implemented |
| Guided reading non-Japanese | "Coming later" placeholder |
| Stack Detail copy mentions "AI-generated stories" | Outdated; mobile uses curated + NHK |
| `GlobalSettingsModal.tsx` | Unused; superseded by SettingsScreen |
| Web app | Broken / unmaintained |
| NHK on device without proxy | Cannot work (iOS cookie limitation) |
| Google OAuth in Expo Go | Can be flaky; dev build recommended for iOS |
| Generate sentence in study | Requires separate API backend |

---

## 8. Key user flows

1. **First launch (guest):** Home → demo stacks → tap stack → set goal → study → cards get SR dates → stats saved locally
2. **First launch (signed in):** Google sign-in → cloud fetch or upload → same study flow with sync
3. **Import vocabulary:** Home → Import CSV → map columns → new stack → study
4. **Daily review:** Stack Detail shows due count → Start Studying → loop prioritizes due cards per settings
5. **Guided reading:** Reading tab → pick Japanese stack → NHK or Story library → tap words → add to stack → words appear in next session
6. **Cross-device sync:** Sign in on second device → cloud stacks load → edits debounce-save to Supabase

---

## 9. Pre-production checklist

Use this before App Store / Play Store submission or a public beta.

### Infrastructure & backend

- [ ] Supabase project created and migration `001_user_data.sql` applied
- [ ] Supabase RLS policies verified (users cannot read/write other users' data)
- [ ] `nhk-easy` Edge Function deployed: `npx supabase functions deploy nhk-easy --project-ref <ref>`
- [ ] `EXPO_PUBLIC_NHK_USE_SUPABASE=1` set in production `.env`
- [ ] NHK Edge Function tested from a physical device (not on same Wi-Fi as dev PC)
- [ ] Supabase Auth redirect URLs configured: `focasaurus://auth/callback`, production deep link
- [ ] Google OAuth client configured in Google Cloud Console (Web application type)
- [ ] Google provider enabled in Supabase Auth with correct Client ID + Secret
- [ ] (Optional) Sentence generation API deployed if feature is kept; `EXPO_PUBLIC_API_BASE_URL` set

### Mobile build & config

- [ ] Production `.env` values set (no dev LAN proxy URL in production build)
- [ ] `app.json` version bumped appropriately
- [ ] App icons and splash assets finalized (`mobile/assets/`)
- [ ] iOS bundle identifier and Android package name configured for store
- [ ] EAS Build or local release build succeeds for iOS and Android
- [ ] Deep link scheme `focasaurus://` tested on both platforms
- [ ] Portrait-only orientation verified

### Auth & sync

- [ ] Google sign-in works on production build (not just Expo Go)
- [ ] Guest mode works without Supabase credentials
- [ ] Sign-in → data appears on second device within ~1 second of edit
- [ ] Sign-out clears session and returns to sign-in screen
- [ ] Offline edit → reconnect → changes sync without data loss
- [ ] First-login upload (local → cloud) tested with existing local stacks

### Core study flows

- [ ] Create / delete stack
- [ ] Add / edit / delete cards manually
- [ ] Mark card as Known
- [ ] Full study session: loop → short-term → end-of-day → complete
- [ ] Time goal wind-down behaves correctly
- [ ] Words goal wind-down behaves correctly
- [ ] Spaced repetition dates update correctly after session
- [ ] Per-stack session settings (loop size, queue size, streak limit) respected
- [ ] Global priority setting (new words vs review first) respected
- [ ] Session stats (today + all-time) update after session

### Import

- [ ] CSV import creates new stack (comma, tab, semicolon formats)
- [ ] CSV import into existing stack appends cards with fresh IDs
- [ ] Header row detection and column mapping work
- [ ] Large import (500+ cards) performs acceptably

### Guided reading

- [ ] Japanese stack detected correctly; non-Japanese shows placeholder
- [ ] Story library loads all 32 stories; ranking and unread rotation work
- [ ] NHK Easy loads article list and individual articles via production proxy
- [ ] Tap-to-define works (Jisho lookup + stack card match)
- [ ] Add word to stack from reader creates type-1 card
- [ ] Bump existing card schedules review for tomorrow
- [ ] NHK attribution displayed
- [ ] "Read another story" rotation works for both NHK and curated modes

### Settings

- [ ] Global settings save and persist across app restart
- [ ] Global goals apply when `useGlobalGoals` enabled
- [ ] Sync status indicator accurate (saving / synced / error)

### Quality & polish

- [ ] No console errors on happy-path flows
- [ ] Reading feedback stub: either implement persistence or update UI copy
- [ ] Remove or fix outdated "AI-generated stories" copy in Stack Detail
- [ ] Remove dead code (`GlobalSettingsModal`) or wire it up
- [ ] Duplicate React key warnings in StoryReader resolved
- [ ] App tested on iOS (physical device) and Android
- [ ] App tested on small and large phone screens
- [ ] Safe area / tab bar layout correct on notched devices

### Security & privacy

- [ ] No secrets committed to git (`.env` in `.gitignore`)
- [ ] Supabase anon key is public-safe; no service role key in mobile app
- [ ] Privacy policy covers: Google sign-in, cloud storage, Jisho API calls, NHK content attribution
- [ ] Terms cover NHK NEWS WEB EASY usage (NHK reception contract disclaimer on their site)

### Store submission

- [ ] App Store / Play Store listing copy written
- [ ] Screenshots captured (Home, Study, Reading, Settings)
- [ ] Age rating questionnaire completed
- [ ] Export compliance / encryption declaration (Expo apps typically use standard HTTPS only)

---

## 10. Environment variables reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | For sync/auth | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | For sync/auth | Supabase anon key |
| `EXPO_PUBLIC_NHK_PROXY_URL` | Dev only | Local NHK proxy (auto-set by `npm start`) |
| `EXPO_PUBLIC_NHK_USE_SUPABASE` | Production NHK | Set to `1` to use Edge Function |
| `EXPO_PUBLIC_API_BASE_URL` | Optional | Sentence generation in study mode |

---

## 11. Development commands

```bash
npm install --prefix mobile
npm start                    # Expo LAN + local NHK proxy (recommended)
npm run start:tunnel --prefix mobile   # Expo tunnel (OAuth debugging)
npx supabase functions deploy nhk-easy --project-ref <ref>   # Production NHK
```

---

*This document reflects the codebase as of June 2026. Update when features ship or scope changes.*
