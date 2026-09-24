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
- [ ] A — tokens, globals.css, layout, `ui/*` primitives
- [ ] B — Board.tsx (+ Card) on primitives with motion
- [ ] C — DetailPanel.tsx + page.tsx on primitives
- [ ] Review 1 (screenshots, spacing, motion, contrast) → fixes
- [ ] e2e smoke test green (`scripts/e2e-mock.mjs`), `npm run lint`, `npx tsc --noEmit`

## Needs Arshita
- (none yet)
