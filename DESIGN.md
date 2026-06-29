---
name: Feedlyra
description: Self-hosted RSS reader with quiet, reading-first UI and AI as a silent collaborator.
colors:
  primary-indigo: "#3a3dee"
  primary-indigo-dark: "#6969e2"
  primary-amber: "#f37b12"
  primary-amber-dark: "#fa9f38"
  primary-forest: "#288f5f"
  primary-forest-dark: "#40bf84"
  background: "#f9fafb"
  background-dark: "#14171f"
  foreground: "#0f1729"
  foreground-dark: "#ebecf0"
  card: "#f9fafb"
  card-dark: "#181c25"
  popover: "#f9fafb"
  popover-dark: "#1b2029"
  secondary: "#f3f4f6"
  secondary-dark: "#222731"
  muted: "#f3f4f6"
  muted-dark: "#222731"
  muted-foreground: "#6b7280"
  muted-foreground-dark: "#848b9a"
  accent: "#ebecf0"
  accent-dark: "#2b2f3b"
  destructive: "#dc2828"
  destructive-dark: "#cf5a5a"
  border: "#e5e7eb"
  border-dark: "#2b2f3b"
  sidebar-bg: "#f3f4f7"
  sidebar-bg-dark: "#0e1016"
  sidebar-hover: "#ebecf0"
  sidebar-selected: "#e2e4e9"
  article-hover: "#eeeff2"
  chat-bubble-user: "rgba(58,61,238,0.12)"
  chat-bubble-ai: "#f3f4f6"
typography:
  display:
    fontFamily: "Space Grotesk, Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 700
    letterSpacing: "-0.02em"
    lineHeight: "1.1"
  heading:
    fontFamily: "Space Grotesk, Onest, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "1.25"
  body-ui:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5"
  body-reader:
    fontFamily: "Merriweather, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: "1.75"
  label:
    fontFamily: "Onest, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0"
    lineHeight: "1.4"
rounded:
  sm: "2px"
  md: "6px"
  lg: "6px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-indigo}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.body-ui}"
  button-primary-hover:
    backgroundColor: "rgba(58,61,238,0.9)"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input-text:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  chip-unread-dot:
    backgroundColor: "{colors.primary-indigo}"
    size: "8px"
    rounded: "{rounded.pill}"
  article-list-item:
    backgroundColor: "transparent"
    rounded: "{md}"
    padding: "8px 12px"
  article-list-item-selected:
    backgroundColor: "{colors.article-hover}"
  sidebar-feed-item:
    backgroundColor: "transparent"
    rounded: "{md}"
    padding: "6px 10px"
  sidebar-feed-item-selected:
    backgroundColor: "{colors.sidebar-selected}"
  chat-bubble-user:
    backgroundColor: "{colors.chat-bubble-user}"
    rounded: "{lg}"
    padding: "10px 14px"
  chat-bubble-ai:
    backgroundColor: "{colors.chat-bubble-ai}"
    rounded: "{lg}"
    padding: "10px 14px"
---

# Design System: Feedlyra

## 1. Overview

**Creative North Star: "The Reading Room"**

Feedlyra's interface is a private reading room: walls lined with subscriptions you chose, a quiet desk with a single open article, an assistant who waits in the corner and speaks only when addressed. The chrome withdraws; the text takes the chair. Every surface is calibrated so that typography, line length, and reading rhythm carry the experience, not ornament.

The system runs Restrained by default — one accent carries primary actions and current state, everything else is tinted neutral. Depth comes from subtle tonal layering (sidebar cooler than content, selected states denser than hover), not from shadow or blur. Motion is 100–150ms and only conveys state (hover, active, generating, error); nothing choreographs on load. AI is visually co-author with the reader's prose: same color family, same density, never a louder surface than the article it serves.

The system explicitly rejects the visual moves cataloged in PRODUCT.md: SaaS gradient washes and gradient text, enterprise slate-gray sterility, template card grids of icon+heading+text, the all-caps tracked eyebrow above every section, and AI surfaces that demand attention with colored typing halos or blinking cursors. If a generated variant reads as "an AI made this reading app," it has failed the reading room.

**Key Characteristics:**
- Reading rhythm over information density; whitespace is structural, not absence.
- One accent, three switchable hues (Indigo / Amber / Forest) for accessibility and mood.
- Tonal layering carries depth; shadow is reserved for floating layers (dialog, popover, toast).
- Chrome stays neutral until touched; interaction is the only thing that lights up.
- Dark mode is a first-class citizen, tuned for long evening reading sessions, not a inverted afterthought.

## 2. Colors: The Quiet Indigo Palette

A single accent does all the work; the rest is a cool, near-neutral ramp that lets text breathe. The palette is user-switchable across three hues — Indigo (default, rational), Amber (warm, evening reading), Forest (calm, natural) — so the accent's identity is "the one saturated mark on the page," never "the page's mood." The neutral ramp carries the mood; the accent carries the action.

### Primary
- **Indigo** (`#3a3dee` light / `#6969e2` dark): the default accent. Primary actions ("Subscribe", "Send"), the unread-article dot, current selection ring, prose links, the blockquote left border. Used on ≤10% of any screen. Its rarity is the signal.
- **Amber** (`#f37b12` light / `#fa9f38` dark): opt-in alternate hue for users who read at night or prefer warmth. Same role, same restraint.
- **Forest** (`#288f5f` light / `#40bf84` dark): opt-in alternate hue; calm and naturalistic. Same role, same restraint.

### Neutral
- **Background** (`#f9fafb` / `#14171f`): the reading surface. Light mode is a cool near-white (chroma toward blue, not toward cream); dark mode is a deep slate-blue tuned to stay legible for hours without harshness.
- **Foreground** (`#0f1729` / `#ebecf0`): body and heading ink. Near-black with a blue undertone in light; soft off-white in dark. Contrast comfortably exceeds 4.5:1.
- **Card / Popover** (`#f9fafb` / `#181c25`, `#1b2029`): floating surfaces sit one tonal step above the background. Popovers (dropdown menus, command palette) in dark mode lift slightly lighter than cards to separate from content.
- **Muted / Muted-foreground** (`#f3f4f6` / `#6b7280` light): metadata, timestamps, secondary labels. `muted-foreground` stays above 4.5:1 — never the washed-out gray that makes AI reading apps feel thin.
- **Border** (`#e5e7eb` / `#2b2f3b`): hairline dividers and input strokes. Kept low-chroma so structure reads as structure, not as decoration.

### Semantic (layer-specific)
- **Sidebar background** (`#f3f4f7` / `#0e1016`): slightly cooler and (in dark) deeper than the content surface, marking it as chrome. Selected feed items use **sidebar-selected** (`#e2e4e9` / `#2b2f3b`); hover uses **sidebar-hover** (`#ebecf0`).
- **Article hover** (`#eeeff2` / `#1e2129`): the row's hover and selected state in the article list — denser than sidebar hover, so the reader's eye tracks the focused row.
- **Destructive** (`#dc2828` / `#cf5a5a`): delete and destructive confirmations only. Never decorative.

### Named Rules
**The One Accent Rule.** The primary hue appears on no more than ~10% of any given screen — primary buttons, the unread dot, current selection, prose links. If the accent starts filling backgrounds or large surfaces, the reading room has become a dashboard.

**The Three Hues Rule.** Indigo, Amber, and Forest are the only accents that exist. They are mutually exclusive per session, set once via the theme toggle. Never combine two hues on one screen, and never introduce a fourth.

**The Blue-Undertone Rule.** All neutrals carry a faint blue undertone (hue ≈ 220–225°, chroma < 0.06) to keep the surface cohesive with the cool reading-room identity. Do not drift toward cream, sand, or warm parchment — that is the saturated AI default this product refuses.

## 3. Typography: One System, Two Voices

**Display / Heading Font:** Space Grotesk (with Onest fallback)
**UI / Body Font:** Onest (with system sans fallback)
**Reader Body Font:** Merriweather (with Georgia serif fallback)

**Character:** Two voices, one family feeling. Onest handles every piece of chrome — buttons, sidebar items, labels, metadata — with a calm geometric humanism that disappears into the task. Space Grotesk, used only for headings, adds a touch of editorial confidence without becoming a display face. Merriweather lives only inside the article reader, where a serif body rewards long-form reading; it never leaks into the app chrome.

### Hierarchy
- **Display** (Space Grotesk, 700, `clamp(2rem, 4vw, 3rem)`, line-height 1.1, letter-spacing -0.02em): auth/login hero only. Never appears inside the reading app shell.
- **Heading** (Space Grotesk, 600, 1.5rem, line-height 1.25): section titles in settings, dialog titles, the settings panels' H2s.
- **Body UI** (Onest, 400, 0.875rem, line-height 1.5): every label, list item, button caption, metadata line. The workhorse.
- **Body Reader** (Merriweather, 400, 1.0625rem, line-height 1.75): the article prose only. Capped at 65–75ch via the reader's content-width setting.
- **Label** (Onest, 600, 0.75rem, line-height 1.4): unread counts in badges, tab triggers, eyebrow-free small captions. Sentence case, never all-caps tracked.

### Named Rules
**The Chrome Serif-Free Rule.** Merriweather appears only inside the article reader `.prose`. Buttons, sidebars, chat bubbles, and settings chrome run Onest. Mixing the serif into chrome makes the reading room feel like a marketing site.

**The Fixed-Scale Rule.** UI type uses fixed rem values, not fluid clamp scales. A user resizes their reader font; they do not resize the chrome. Fluid headings belong on landing pages, not in a tool used for hours.

**The No-Eyebrow Rule.** Section headings stand on their own typographic weight. No small all-caps tracked kicker ("ABOUT" / "FEEDS" / "SETTINGS") above them. If a section needs a label, it is a sentence-case label at `label` size, or nothing.

## 4. Elevation: Flat by Default, Lift Only on Demand

Feedlyra is flat-by-default. Depth is conveyed through tonal layering — sidebar cooler and (in dark) deeper than content, selected states denser than hover, floating surfaces one tonal step above their origin — not through shadow. The single `shadow-sm` on cards is the ceiling for resting elevation; everything beyond it belongs to layers that have physically left the page (dialogs, popovers, command palette, toasts).

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)` — Tailwind `shadow-sm`): the only resting shadow, used by `Card`. Most surfaces below this use background tint + border instead.
- **Floating layer** (Radix popover/dialog default elevation): dialogs, dropdown menus, popovers, command palette. These escape the page; their shadow is structural, signaling "you are now above the reading room," not decorative.

### Named Rules
**The Flat-By-Default Rule.** A surface at rest has no shadow. Shadow appears only when a layer is floating above the page (dialog, popover, toast) or in response to interaction that genuinely lifts the element. Adding `shadow-md` to a resting card to "give it depth" is the SaaS-dashboard reflex this system refuses.

**The Tonal-Layering Rule.** When two regions need to feel different, change the background tint (sidebar vs. content, hover vs. selected vs. resting), not the shadow. Two tones do the work that a drop shadow would do worse.

## 5. Components: Refined and Restrained — Chrome Recedes, Interaction Rises

Every component ships with default / hover / focus-visible / active / disabled / loading states. Half-built state machines are the most common product-UI failure; the reading room is no exception.

### Buttons
- **Shape:** 6px radius (`rounded-md`); height 40px default, 36px small, 44px large.
- **Primary:** `bg-primary text-primary-foreground`, 8px 16px padding. Hover darkens to `primary/90`. Default action: Subscribe, Send, Save.
- **Secondary:** `bg-secondary text-secondary-foreground`, hover `secondary/80`. Lower-priority confirmations.
- **Outline:** `border border-input bg-background`, hover `bg-accent`. Destructive-adjacent or "cancel" actions.
- **Ghost:** transparent, hover `bg-accent`. Sidebar tool buttons, icon-only toolbar actions.
- **Link:** `text-primary underline-offset-4`, underline on hover. Inline text actions.
- **Focus:** `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background` — always visible, never removed. The offset matches the background so the ring reads as a frame, not a halo.
- **Disabled:** `opacity-50 pointer-events-none`. Loading states replace label + icon with a spinner, never disable without feedback.

### Chips (Unread Dot / Badge)
- **Unread dot:** 8px (`h-2 w-2`) solid primary, `rounded-full`. The single most-used accent mark in the app. Absent on read articles.
- **Count badge** (`badge` default): `bg-primary text-primary-foreground`, `rounded-full`, 10px 2.5px padding, 0.75rem font-semibold. Sidebar unread counts.
- **Outline badge:** `text-foreground`, transparent. Article tags, non-numeric metadata.

### Cards / Containers
- **Corner:** 6px (`rounded-lg`).
- **Background:** `bg-card` (= background in this palette; the card's distinction is its border + `shadow-sm`, not a different tint).
- **Border:** `1px solid var(--border)`.
- **Shadow:** `shadow-sm` (resting ceiling — see Elevation).
- **Internal padding:** 24px (`p-6`) on CardHeader / CardContent / CardFooter. Used sparingly in Feedlyra; the app's content surfaces are lists and reader prose, not card grids. Nested cards are forbidden.

### Inputs / Fields
- **Shape:** 6px radius, 40px height (`h-10`).
- **Style:** `border border-input bg-background`, 12px horizontal padding, 0.875rem text.
- **Placeholder:** `text-muted-foreground` — kept above 4.5:1 contrast; never the dim-gray default that makes search fields feel empty.
- **Focus:** `focus-visible:ring-2 ring-ring ring-offset-2`. Same ring vocabulary as buttons, so the focus language is one system across the app.
- **Error:** destructive red border + helper text; never just a border color change (color alone is not a state).

### Navigation (Sidebar)
- **Structure:** virtual folder list — All Feeds / Unread / Starred (with live counts), collapsible per category, context-menu per feed.
- **Feed item:** transparent resting, `hover:bg-sidebar-hover`, `selected:bg-sidebar-selected`. 6px 10px padding, 0.875rem, truncate title, unread count right-aligned.
- **Active affordance:** selected = denser background tint, not a side-stripe border. (Side-stripe as accent is an absolute ban.)
- **Collapse:** resizable panel (`react-resizable-panels`), persisted to localStorage; keyboard `Shift+S` toggles.

### Article List
- **Row:** `border-b px-3 py-2`, transparent resting, `hover:bg-article-hover/70`, selected `bg-article-hover`. 100ms color transition.
- **Unread indicator:** the 8px primary dot to the left of the title; present = unread, absent = read.
- **Title:** `text-sm font-medium`, truncate single-line.
- **New-articles banner:** `bg-primary/5 text-primary border-b`, `text-xs font-medium`, centered — the only place primary fills a (very transparent) background, to surface "new content arrived" without hijacking focus.

### AI Chat Panel (signature component)
- **Assistant avatar:** 28px circle, `bg-primary/10`, Bot icon at `text-primary`. Deliberately understated — the assistant is a quiet presence, not a glowing orb.
- **User bubble:** `bg-chat-bubble-user` (primary at 12% alpha). Same hue family as the reader's prose links, so the user's voice is visibly part of the article's color world.
- **AI bubble:** `bg-chat-bubble-ai` (muted). Slightly recessed vs. the user bubble, so the reader's eye stays with their own input and the article.
- **Typing indicator:** three 6px dots, `bg-foreground/50`, staggered bounce (150ms offsets). No colored halo, no blinking cursor. State feedback only.
- **Input:** same field vocabulary as the rest of the app — one input language across reading and chat.

### Signature: Reader Prose (`.prose`)
- **Body text:** Merriweather, `--tw-prose-body = var(--foreground)`.
- **Links:** `var(--prose-link)` color, no underline, 1px border-bottom at `prose-link / 0.3` alpha that fills on hover. The link is identified by color + a whisper of border, not a loud underline.
- **Blockquotes:** 3px left border in `var(--prose-blockquote-border)` (the accent), italic-free. The accent appears here and only here in the reader, marking cited text — a deliberate echo of the unread dot.
- **Code:** inline `bg-prose-code-bg`, 2px 4px padding, 0.875em; blocks get a bordered `pre` with `shadow`-less surface.

## 6. Do's and Don'ts

### Do:
- **Do** keep the primary accent under ~10% of any screen — buttons, unread dot, selection, links, blockquote border. Its rarity is the signal.
- **Do** use tonal layering (sidebar cooler/deeper than content, selected denser than hover) instead of shadow to separate regions.
- **Do** ship every interactive component with default / hover / focus-visible / active / disabled / loading — the reading room is a tool used for hours; half-states erode trust.
- **Do** use Merriweather only inside `.prose` (article reader). Everything else runs Onest.
- **Do** keep the focus ring vocabulary identical across buttons and inputs (`focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`).
- **Do** respect `prefers-reduced-motion`: the 150ms color transition and the chat typing dots must fall back to instant/crossfade.
- **Do** let the user switch hues (Indigo / Amber / Forest) and themes (light / dark / system) — accessibility is a first-class feature, not a patch.
- **Do** cap reader prose at 65–75ch and honor the user's font/size/line-height/width settings from the reading popover.

### Don't:
- **Don't** use gradients — gradient backgrounds, gradient text (`background-clip: text`), colored glows. This is the SaaS-dashboard reflex PRODUCT.md explicitly bans.
- **Don't** use glassmorphism / backdrop-blur decoratively. Blur is allowed only inside genuinely floating layers (dialogs, popovers) where it earned its place.
- **Don't** apply `border-left`/`border-right` greater than 1px as a colored accent on cards, list items, or alerts. (The blockquote's 3px left border is the sole, named exception.)
- **Don't** put a small all-caps tracked eyebrow ("ABOUT" / "FEEDS" / "FEEDS") above every section heading — it is the AI-grammar reflex this product refuses.
- **Don't** lay out identical icon+heading+text cards in a grid. The article list is rows with typography + unread dot, not a card grid.
- **Don't** make the AI chat panel louder than the article: no colored typing halos, no blinking cursors, no full-saturation bubble backgrounds. AI bubbles use muted; user bubbles use accent alpha.
- **Don't** drift the neutral background toward cream / sand / parchment / warm paper. The neutral ramp is cool, blue-undertoned, low-chroma — that is the reading room's identity, not the 2026 AI-cream default.
- **Don't** use fluid `clamp()` scales for chrome (sidebar, buttons, labels). Fixed rem values; the reader's own font setting is the only fluid type.
- **Don't** introduce a fourth accent hue. Three (Indigo, Amber, Forest) is the complete vocabulary, mutually exclusive per session.
- **Don't** ship a resting surface with `shadow-md` or heavier. `shadow-sm` is the resting ceiling; heavier shadows belong only to floating layers.
