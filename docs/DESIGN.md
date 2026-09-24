# Job Kanban — Design System & Redesign Status (shared doc)

Every session working on the UI redesign reads this first and updates **Status** when done.
Scope: visual + interaction pass only. **All functionality stays identical.** API, types, data flow untouched.

## Vision (one paragraph)
Apple-inspired, calm, airy. Very light pastel-blue canvas with barely-there blurred orbs.
Frosted-glass cards/panels (translucent white, backdrop blur, hairline border, top edge highlight,
soft diffused shadow). Fully rounded pills. Neutral palette; the only real color is **status**
(muted yellow / green / red). Subtle, springy-but-calm micro-interactions via `motion` (Framer Motion v12,
import from `motion/react`). Reduced motion respected everywhere.

## Tokens — defined once in `src/app/globals.css` (CSS vars on `:root`, mapped into Tailwind v4 `@theme inline`)
Use the Tailwind utilities generated from these (e.g. `bg-canvas`, `text-ink-2`, `rounded-lg`, `shadow-glass`) or
`var(--…)` in CSS. **No hardcoded colors/radii/shadows/durations in components.**

### Color
| token | value | use |
|---|---|---|
| `--color-canvas` | `#eef2f9` | page background base |
| `--color-orb-1` | `#d6e4f7` | blurred orb (blue) |
| `--color-orb-2` | `#e6ebf6` | blurred orb (lavender-grey) |
| `--color-orb-3` | `#ffffff` | blurred orb (white glow) |
| `--color-ink` | `#1d1d1f` | primary text |
| `--color-ink-2` | `#515154` | secondary text |
| `--color-ink-3` | `#86868b` | tertiary / meta text |
| `--color-ink-4` | `#b4b4b8` | placeholder / disabled |
| `--color-line` | `rgba(29,29,31,0.08)` | hairline dividers |
| `--color-glass` | `rgba(255,255,255,0.55)` | card / panel fill |
| `--color-glass-strong` | `rgba(255,255,255,0.74)` | sheet / header / inputs |
| `--color-glass-soft` | `rgba(255,255,255,0.30)` | column fill |
| `--color-glass-border` | `rgba(255,255,255,0.70)` | inner light border |
| `--color-glass-edge` | `rgba(29,29,31,0.06)` | outer hairline |
| `--color-scrim` | `rgba(29,29,31,0.18)` | modal backdrop (blurred) |
| `--color-status-neutral` / `-neutral-bg` / `-neutral-fg` | `#a7aeb9` / `rgba(120,130,145,0.14)` / `#515154` | Applied, Ignored |
| `--color-status-yellow` / `-yellow-bg` / `-yellow-fg` | `#d9b44a` / `rgba(217,180,74,0.18)` / `#735a14` | Interviewing |
| `--color-status-green` / `-green-bg` / `-green-fg` | `#6fb58a` / `rgba(111,181,138,0.18)` / `#2c6a46` | Offer |
| `--color-status-red` / `-red-bg` / `-red-fg` | `#d98d8d` / `rgba(217,141,141,0.20)` / `#8a3b3b` | Rejected, danger actions |

Status → tone: `applied→neutral`, `interviewing→yellow`, `offer→green`, `rejected→red`, `ignored→neutral` (rendered at reduced opacity).

### Radius
`--radius-sm 10px` (inputs, small buttons) · `--radius-md 14px` (cards, buttons) · `--radius-lg 20px` (columns, panels) · `--radius-xl 28px` (sheet, sign-in card) · `--radius-pill 999px`.

### Blur
`--blur-glass 20px` · `--blur-glass-strong 32px` · `--blur-orb 90px`. Always pair `backdrop-filter` with `-webkit-backdrop-filter`.

### Shadows
- `--shadow-glass`: `0 1px 2px rgba(20,30,50,0.04), 0 10px 30px -10px rgba(20,30,50,0.12)`
- `--shadow-glass-hover`: `0 2px 4px rgba(20,30,50,0.05), 0 18px 44px -12px rgba(20,30,50,0.18)`
- `--shadow-sheet`: `0 30px 90px -20px rgba(20,30,50,0.28)`
- `--shadow-highlight` (inner top edge): `inset 0 1px 0 rgba(255,255,255,0.85)`
- `--shadow-focus`: `0 0 0 4px rgba(120,150,200,0.28)`
Glass elements combine `--shadow-highlight` + `--shadow-glass` + `0 0 0 1px var(--color-glass-edge)` — do this once in a `.glass` utility, not per component.

### Spacing
Tailwind's 4px scale. Conventions: page gutter `px-6`, section gap `gap-6`, column padding `p-3`, card padding `p-4`, card gap `gap-2.5`, inline gap `gap-2`.

### Type
Font: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (no Google-font import; drop Geist).
Scale (`--text-*` with matching line-heights): `xs 11/16` · `sm 13/18` · `base 15/22` · `lg 17/24` · `xl 22/28` · `2xl 30/36`.
Headings: `font-semibold`, `tracking-tight` (−0.01em / −0.02em on xl+). Meta text: `text-xs text-ink-3`. Numbers use `tabular-nums`.

### Motion
CSS: `--dur-fast 150ms` · `--dur-base 220ms` · `--dur-slow 360ms` · `--ease-out cubic-bezier(0.22,1,0.36,1)` · `--ease-in-out cubic-bezier(0.65,0,0.35,1)`.
Springs (exported from `src/components/ui/motion.ts`):
- `spring` (default, calm): `{ type:"spring", stiffness: 380, damping: 32, mass: 0.8 }`
- `springSoft` (sheets/layout): `{ type:"spring", stiffness: 260, damping: 30, mass: 1 }`
- `hoverLift`: `whileHover={{ y:-2 }}`, `whileTap={{ scale:0.98 }}`
- `fadeUp` variants: `hidden {opacity:0, y:6}` → `show {opacity:1, y:0}`; list stagger `0.03s`.
Reduced motion: `<MotionConfig reducedMotion="user">` in layout **and** a CSS `@media (prefers-reduced-motion: reduce)` block that sets transition/animation durations to ~0.

## Component list — `src/components/ui/` (Agent A builds; B/C consume)
| file | export | props (contract) |
|---|---|---|
| `motion.ts` | `spring`, `springSoft`, `fadeUp`, `listStagger` | constants only |
| `Glass.tsx` | `GlassPanel` | `{ as?: "div"\|"section"\|"header"\|"aside", strength?: "soft"\|"base"\|"strong", className?, children, ...divProps }` renders `.glass` with the fill by strength |
| `Button.tsx` | `Button` | `{ variant?: "primary"\|"secondary"\|"ghost"\|"danger", size?: "sm"\|"md", loading?: boolean, fullWidth?: boolean, ...buttonProps }` — motion tap/hover, spinner when loading, `disabled` handled |
| `Pill.tsx` | `Pill`, `StatusPill` | `Pill { tone?: "neutral"\|"yellow"\|"green"\|"red", dot?: boolean, size?: "xs"\|"sm", className?, children }`; `StatusPill { status: Status }` renders label + dot with tone from the map above |
| `Field.tsx` | `Field`, `Input`, `Select`, `Textarea` | `Field { label: string, children }` renders `<label>` with label text then the control (keep native `<label>` wrapping); `Input/Select/Textarea` = native elements with `fieldClass` glass styling (`Select` keeps native `<select>`) |
| `Column.tsx` | `Column` | `{ title: string, count: number, status: Status, isOver?: boolean, children, ...divProps(onDragOver/onDrop) }` glass-soft column; header with status dot + title + count pill; `isOver` = subtle lift/tint |
| `Sheet.tsx` | `Sheet` | `{ open: boolean, onClose: () => void, title: string, children }` right-side glass sheet with blurred scrim, `AnimatePresence`, spring slide, Escape closes, close button `aria-label="Close"` |
| `Toast.tsx` | `Toast` | `{ message: string \| null }` animated pill |
| `Spinner.tsx` | `Spinner` | `{ size?: number, className? }` |
| `Switch.tsx` | `Switch` | `{ checked, onChange, label: string, ...inputProps }` renders `<label>` containing a visually-hidden native checkbox + animated track/thumb + label text |
| `Background.tsx` | `Background` | fixed, pointer-events-none orb layer (3 orbs, blur-orb, very slow drift; none under reduced motion) |

## Screens
- `src/app/layout.tsx` — system font, `<Background/>`, `<MotionConfig reducedMotion="user">`, `bg-canvas text-ink`.
- `src/app/page.tsx` — sign-in card (GlassPanel strong, radius-xl, centered) + loading state.
- `src/components/Board.tsx` — glass top bar (title, email, sync meta, Toast, Switch "Show ignored", Sync now, Sign out); columns grid; `Card` (glass, hover lift, `layoutId` so a card animates between columns, StatusPill-free — status is implied by column, show "edited" Pill + email count Pill + relative time); loading / error / empty / session-expired states.
- `src/components/DetailPanel.tsx` — `Sheet` with `Field`s, Save (primary) + "Saved" fade, Mark not job-related (secondary), Delete (danger), Emails list as soft glass rows.

## Hard constraints (functionality + tests) — do not break
The Playwright smoke test `scripts/e2e-mock.mjs` relies on these selectors. Keep them working:
- text `Job Kanban` (header title), column titles `Applied` etc., `text=Application details` (sheet title)
- `label:has-text("Role") input`, `label:has-text("Status") select` (native select!), `label:has-text("Show ignored")` clickable to toggle
- `button:has-text("Save")`, `text=Saved`, `button[aria-label="Close"]`, `button:has-text("Mark not job-related")`, `button:has-text("Sync now")`
- columns must be `div.grid > div` children whose text includes the column title.
- native HTML5 drag & drop (`draggable`, `onDragStart/End/Over/Drop`) stays; keep `confirm()` on delete; keep all state/handlers in Board/DetailPanel as-is.

## Decisions
- Animation lib: `motion` v12 (`motion/react`). Use `motion.div`, `AnimatePresence`, `LayoutGroup`, `MotionConfig`.
- Status color lives on the **column header dot + pill tone** only; cards stay neutral glass so the board reads calm.
- Cards moving between columns: `layoutId={`app-${id}`}` inside a `LayoutGroup`, `layout` prop with `springSoft`.
- Drag ghost: we keep native DnD; while dragging, the source card gets `opacity-50 scale-[0.98]`.
- Drop target: column `isOver` → slightly brighter fill + inset ring in status tone.
- Glass readability: body text on glass is always `ink` / `ink-2`; never lighter than `ink-3` for anything a user must read.

## Status
- [x] A — tokens, globals.css, layout, `ui/*` primitives
- [x] B — Board.tsx (+ Card) on primitives with motion
- [x] C — DetailPanel.tsx + page.tsx on primitives

### Notes from A
- All tokens live in `src/app/globals.css` under `:root` and are mapped 1:1 (same
  variable names) into `@theme inline`. This is intentional and verified to work: Tailwind
  emits its own `@layer theme { :root { --color-canvas: var(--color-canvas); } }`, but that's
  a *layered* rule, and our own `:root { --color-canvas: #eef2f9; ... }` is unlayered, so per
  CSS cascade-layer rules the unlayered literal value always wins. Don't "fix" this into
  looking non-circular — it's correct and empirically checked with a standalone PostCSS build.
- Tone class names (use these exactly, not `bg-status-<tone>` alone unless you mean the solid dot color):
  - Solid (dots, `Pill dot`, `Column` status dot): `bg-status-neutral` / `bg-status-yellow` / `bg-status-green` / `bg-status-red`.
  - Tinted background+text pairs (pills, badges): `bg-status-<tone>-bg` + `text-status-<tone>-fg`.
  - Ring/opacity modifiers work via Tailwind's color-mix, e.g. `ring-status-green/40`, `border-status-red/50` — confirmed to compile correctly.
  - Status→tone mapping and labels are exported from `ui/Pill.tsx` as `STATUS_TONE` and `STATUS_LABEL` — import those instead of re-deriving them.
- `.glass` variants: base fill is plain `glass`. Soft/strong are **additive** modifier classes applied together with `glass`, i.e. `"glass glass-soft"` or `"glass glass-strong"` — `glass-soft`/`glass-strong` alone do nothing (no blur/border/shadow) since those live on `.glass`. `GlassPanel`'s `strength` prop (`"soft" | "base" | "strong"`) already produces the right combined className for you — prefer using `GlassPanel` over hand-rolling `.glass` combinations.
- `duration-(--dur-fast)` / `duration-(--dur-base)` and `ease-(--ease-out)` (Tailwind v4 arbitrary-var syntax) work as expected and are used throughout `ui/*` — no bracketed arbitrary-property fallback was needed.
- CAUTION for future editors of this file: Tailwind v4's automatic content scanner reads every project text file (including this markdown doc) for candidate class names, since no explicit `content` globs are configured. A bracket-arbitrary-value example previously written here — square-bracket property syntax wrapping a `var(` call with a literal ellipsis placeholder instead of a real CSS variable name — was picked up as a real candidate utility and generated invalid CSS, which broke `next dev`'s CSS build for the whole app with a 500. Never paste bracket-arbitrary-value Tailwind syntax with placeholder/ellipsis text in place of a real value into this doc (fenced code blocks are still scanned) — use prose or a fully valid, real example instead. (I hit this live and had to fix it — see Notes from B below.)
- `Column` uses a plain `div` (not `motion.div`) since the fill/ring change is handled by a CSS `transition-[...]` class; feel free to wrap children in `motion` yourselves (e.g. `layoutId`/`layout` for cards) — `Column` just passes through `children` and any extra div props (`onDragOver`, `onDrop`, `className`, etc.).
- `Switch`: the visible label text node is exactly the `label` prop, rendered as a plain `<span>{label}</span>` after the track, so `label:has-text("Show ignored")` will match the whole `<label>` element (input + track + text) — the click target is the entire component since it's one big native `<label>`.
- `Button` variants: `primary` = `bg-ink text-white` with `hover:brightness-110` (not opacity, to keep the white text at full contrast); `secondary` = `.glass glass-strong` fill; `ghost` = transparent with `hover:bg-ink/5`; `danger` = bordered outline (`border-status-red/50` + `text-status-red-fg` + `hover:bg-status-red-bg`), not a filled button. `md` size is `h-9.5` per the doc's first option.
- `npx tsc --noEmit`, `npm run lint`, and a runtime check against the already-running mock dev server (port 3120) all pass — see verification section of the handoff report for details. `Board.tsx`/`DetailPanel.tsx`/`page.tsx` were not touched and still use their old dark Tailwind classes, which is expected until B/C land.
- [ ] Review 1 (screenshots, spacing, motion, contrast) → fixes
- [ ] e2e smoke test green (`scripts/e2e-mock.mjs`), `npm run lint`, `npx tsc --noEmit`

### Notes from B
- `Board.tsx` rewritten on the `ui/*` primitives per spec: `GlassPanel as="header" strength="strong"` sticky top bar,
  `Switch` for "Show ignored" (label starts with the literal text so the e2e selector still matches, count suffix
  appended only when `ignoredCount > 0`), `Button variant="secondary" loading={syncing}` for Sync now (text flips
  to "Syncing…" while `syncing`), `Button variant="ghost"` for Sign out, `Toast` for the sync toast. All state/handlers
  (`loadApplications`, `doSync`, poll interval, `handleDrop` optimistic update + rollback, `handleUpdated`,
  `handleDeleted`, `showIgnored`, `selectedId`, `draggingId`) are byte-for-byte the same logic as before, just
  re-skinned. `DetailPanel` usage is untouched (`{selected && <DetailPanel key=… .../>}`).
- Added a `dragOverKey` state (not in the old file) purely for the `Column` `isOver` highlight, set on
  `onDragEnter`/`onDragOver`, cleared on `onDragLeave` only when `!e.currentTarget.contains(e.relatedTarget as Node)`,
  and cleared on drop/dragEnd — this is additive UI state, doesn't change any business logic.
- Columns render directly as `Column`'s own `div` inside `<div className="grid …">`, so `div.grid > div` with the
  title text still holds for the e2e selector.
- Card DnD/typing: `motion.div` conflicts with React's native `onDragStart`/`onDragEnd` typings, so the outer
  draggable element is a **plain** `<div draggable onDragStart onDragEnd onClick>` and the inner `motion.div` does
  `layout`/`layoutId`/hover/tap/variants — this keeps native HTML5 DnD (and the native drag-ghost image, since the
  plain div wraps the fully-styled inner card) while satisfying TypeScript cleanly. `LayoutGroup` wraps the whole
  grid; `AnimatePresence initial={false}` wraps each column's card list for exit fade+shrink; the list container
  uses `listStagger`/`fadeUp` for the first-load stagger-in.
- Loading state renders real `Column`s (title/status colors visible immediately) with two `glass rounded-md h-20
  animate-pulse` placeholder blocks each, instead of a plain "Loading…" line — matches the "skeleton preferred" note.
- **Tailwind scanner caveat:** Tailwind v4 scans every file in the project (including this markdown file) for class candidates. Never write a bracket-arbitrary-value class with placeholder text (square brackets, a colon, then a value containing literal dots) anywhere in the repo, or the CSS build fails with a 500 on every route. If that happens, remove the text and restart the dev server.
- Verification: `npx tsc --noEmit` — clean. `npm run lint` — clean, zero warnings. Manual check against the
  running mock server (port 3120) via the provided screenshot script for `board`, `ignored`, and `hover` modes —
  all render correctly (glass columns/cards, status dot colors, pills, sticky glass header, 5-column layout when
  "Show ignored" is on) with `errors: none` from the console-error capture. Did not run `scripts/e2e-mock.mjs`
  myself (left for the review step per Status above) but all selectors it depends on (`Job Kanban`, column titles,
  `label:has-text("Show ignored")`, `button:has-text("Sync now")`, `div.grid > div` columns) are preserved as noted.
- Files touched: `src/components/Board.tsx` (full rewrite, same file), `docs/DESIGN.md` (this Status section + the
  Tailwind-scanner fix above). Did not touch `DetailPanel.tsx`, `page.tsx`, `globals.css`, or anything in `ui/*`.
- No primitive changes needed — `Column`, `GlassPanel`, `Switch`, `Button`, `Pill`, `Toast` all covered the Board's
  needs as-is.

### Notes from C
- `DetailPanel.tsx` rebuilt on `Sheet` + `Field`/`Input`/`Select`/`Textarea` + `Button` + `StatusPill`; all behavior/state preserved exactly (local company/role/status/notes state, `save()`, `handleSave`, `handleMarkIgnored`, `handleDelete` with `confirm()`, 2s "Saved" timeout, error state, `sortedEmails`). The local Escape keydown effect was removed since `Sheet` now owns Escape-to-close.
- `Sheet` is rendered with `open` (always true) since Board only mounts `DetailPanel` when a card is selected — the unmount on close is what makes the exit animation moot, per the task brief.
- Status `Select` options use `value={s}` / label `STATUS_LABEL[s]` (imported from `@/components/ui`, not re-derived) so the native `<select>` still shows a real status key on `e.target.value`, matching `Status` exactly (test selector `label:has-text("Status") select` unaffected).
- Added a small `AnimatePresence mode="wait"` + `motion.div key={status}` row directly under the Status field that renders `StatusPill status={status}` so switching status visibly cross-fades/scales the pill; this is presentational only, not the `Field` label.
- Emails: each row is `glass glass-soft` (no hover lift, per spec), subject/meta/snippet colors per the token contract, "Open in Gmail →" is neutral `text-ink` (no accent) per the "no color except status" rule; when `email.detected_status` is set a `StatusPill size="xs"` renders inline in the meta line (wraps to its own line on narrow widths, which is fine — it's still the same flex row).
- `page.tsx`: kept `MOCK_MODE`/`AuthGate` logic identical; loading state is a centered `Spinner` + `text-sm text-ink-3` "Loading…"; sign-in state is a `motion.div` (`fadeUp`) wrapping `GlassPanel strength="strong"` (`rounded-xl p-8 text-center`) with title/body/`Button fullWidth` exactly as specified.
- No hardcoded colors/shadows/radii were added; only token utilities and `ui/*` primitives are used in both files.
- Hit the same live 500 Agent B already documented above (Tailwind v4's content scanner choking on a bracket-arbitrary-value example with an ellipsis placeholder that used to live in this doc's Notes-from-A section) while polling the mock dev server before my screenshot — no action needed on my end since B's fix (already in this file) resolved it; the server was healthy again a couple of minutes later and my screenshot came back clean (`errors: none`).
- Verification: `npx tsc --noEmit` clean, `npm run lint` clean (zero warnings), and a Playwright screenshot of the open sheet in mock mode (`Status: Rejected`, 3 linked emails) rendered correctly — labels, inputs, status pill, Save/secondary/danger buttons, and the email list are all legible on the glass sheet.

## Needs Arshita
- (none yet)
