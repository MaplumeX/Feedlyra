# Research: RSS Automation Rules Patterns

- **Query**: How mainstream RSS readers implement automation rules, filters, smart actions
- **Scope**: External (documentation, source code, blog posts)
- **Date**: 2026-06-09

## Findings

### 1. Inoreader (Most Comprehensive)

Inoreader has the most fully-featured automation system among RSS readers, organized under the **Automate** tab.

#### Triggers
- New article in account, specific feed, or folder
- New article assigned a specific tag
- New article in Read later list
- New web page saved
- New file uploaded
- New Intelligence report generated
- Another rule matched

#### Conditions
- Title and/or content (keyword matching)
- Author
- URL
- Attachments, images, or videos
- Language
- RSS categories
- Multiple conditions combinable with **AND / OR** operators

#### Actions
- Assign tags
- Save to Read later
- Send by email
- Create summary (AI-generated)
- Translate article (up to 100/day auto-translations)
- Show desktop notifications
- Send mobile push notifications
- Add notes
- Mark as read
- Trigger webhooks
- Send to external services: Google Drive, Instapaper, OneNote, Evernote, Dropbox, Raindrop.io

#### Filters (separate from Rules)
Two types:
1. **Content filters** - keep or remove articles matching conditions (title, content, author, URL, attachments, language, RSS categories; AND/OR combinable)
2. **Duplicate filters** - auto-detect and remove repeating articles by: same URL, same title, or nearly identical titles. Comparison period: 6 hours to 1 month.

#### Scope
- Per-feed, per-folder, global

#### Quotas
- Pro plan: 30 rules, 50 filters included; additional via add-ons

#### UI Pattern
- Rules dashboard with daily match counts, enable/disable toggle, edit/delete
- "Create rule" wizard: Name -> Trigger -> Conditions -> Actions -> Save
- "Run rule" test button for verification

Source: Inoreader blog post "Save time with automations" (Jan 2026) and "Introducing new rule triggers and actions" (Oct 2025)

---

### 2. FreshRSS (Filter Actions - Search-Based)

FreshRSS uses a **search-condition + action** model called "filter actions", exposed via the `FilterActionsTrait` PHP trait applied to feeds, categories, and user configuration.

#### Architecture
- `FreshRSS_FilterAction` model: pairs a `BooleanSearch` (condition) with a list of `actions` (strings)
- Stored as JSON in an `attributes` column: `{"search": "...", "actions": ["read", "star"]}`
- `applyFilterActions()` method iterates all filter actions, matches entry against BooleanSearch, applies matching actions

#### Supported Actions
1. **read** - Auto-mark as read
2. **star** - Auto-mark as favorite (not applied to updated articles to avoid overriding manual actions)
3. **label** - Auto-apply a label/tag (not applied to updated articles)

#### Condition Syntax (Full BooleanSearch)
Conditions use FreshRSS's powerful search query language:
- `author:name` / `intitle:keyword` / `intext:keyword` / `inurl:keyword`
- `#tag` / `f:123` (feed ID) / `c:23` (category ID) / `L:12` (label ID)
- `date:P1Y/` (past year) / `pubdate:` / `mdate:` / `userdate:`
- Regex support: `/pattern/i` (case-insensitive, multiline)
- Logical operators: AND (space), OR (`OR` keyword), NOT (`!` or `-` prefix)
- Parentheses for grouping: `(author:Alice OR intitle:hello) !(author:Bob intitle:world)`

#### Scope Hierarchy
1. **Global** (Reading configuration) - `filteractions_read`, `filteractions_star` textareas
2. **Category** - filter actions applied to all feeds in a category
3. **Feed** - filter actions for a single feed

Category and feed-level actions also include:
- `mark_updated_article_unread` (yes/no/default)
- `read_when_same_title_in_feed/category` (with threshold count)
- `read_when_same_guid_in_category`
- `read_upon_reception` (auto-mark all new articles as read)
- `read_upon_gone` (auto-mark when article disappears from feed)
- `keep_max_n_unread` (cap unread count)

#### Other Automation Features
- **User Queries**: Saved searches that can be bookmarked, shared (HTML/RSS/OPML), with tokens
- **20+ sharing services**: Pocket, Pinboard, Raindrop.io, Wallabag, Mastodon, etc. (manual one-click)

Source: FreshRSS GitHub source code (`FilterActionsTrait.php`, `FilterAction.php`, feed/category/reading config views, docs)

---

### 3. Miniflux (Regex-Based Filtering)

Miniflux takes a regex-centric approach to filtering, with no "action" concept beyond block/keep.

#### Filter Types
1. **Block rules** - regex that ignores matching articles (never saved to DB)
2. **Keep rules** - regex that retains only matching articles
3. **Content rewrite rules** - transform article content (add_image_title, add_dynamic_image, replace(), remove(), fix_medium_images, etc.)
4. **URL rewrite rules** - rewrite entry URLs before fetching content
5. **Scraper rules** - CSS selectors for full-content extraction

#### Entry Filtering Rules Format
```
FieldName=RegEx
```
Each rule on a separate line. Available fields:
- `EntryTitle`
- `EntryURL`
- `EntryCommentsURL`
- `EntryContent`
- `EntryAuthor`
- `EntryTag`
- `EntryDate` (supports: `future`, `before:YYYY-MM-DD`, `after:YYYY-MM-DD`, `between:YYYY-MM-DD,YYYY-MM-DD`, `max-age:7d`)

#### Processing Order
1. Global Block Rules
2. Feed Block Rules
3. Global Keep Rules
4. Feed Keep Rules

#### Scope
- Global (Settings page) and per-feed

Source: Miniflux docs (miniflux.app/docs/rules.html)

---

### 4. Feedly (Enterprise-Focused, No Consumer Rules)

Feedly does **not** offer a rule/automation system for regular users. Its automation is enterprise/API-focused.

#### Available Features
- **Team Boards**: Manual curation; API supports `PUT /v3/tags/{boardId}` to add articles programmatically
- **Mute feeds**: Hide feed articles from main stream
- **Priorities**: Mark feeds as must-read (priority) or hidden
- **Webhooks** (Enterprise): `NewEntrySaved`, `NewAnnotation`, `NewWebAlertEntry` events
- **AI Feeds / Ask AI**: Enterprise threat intelligence features, not user-facing automation
- **Highlights/Boards**: Manual save-and-organize

#### API-Level Automation
The Feedly API exposes webhooks and board management, enabling external automation pipelines, but there is no in-app rule builder or filter system for consumers.

Source: Feedly developers.feedly.com API docs

---

### 5. NetNewsWire (Minimal - Smart Feeds Only)

NetNewsWire offers **built-in smart feeds only** with no custom rule/filter creation.

#### Smart Feeds (Built-in)
- All Unread
- Today
- Starred

#### Other Features
- Folders for feed organization
- Search across feeds
- AppleScript support (macOS) for advanced external automation
- OPML import/export

NetNewsWire is intentionally simple. No filter, rule, or automation system exists in the app.

Source: ranchero.com/netnewswire/ product description

---

### 6. Feedbin (Saved Searches)

Feedbin provides **saved searches** as its closest feature to automation rules.

#### Saved Searches
- API: `POST /v2/saved_searches.json` with `name` and `query`
- Query syntax example: `"javascript is:unread"`
- Can list, create, update, delete saved searches
- Returns matching entry IDs or full entry objects

#### Tagging
- Tags applied to feeds (not articles) for organization
- API: `POST /v2/taggings.json` with `feed_id` and `name`

Feedbin does not have automated rule execution or filter actions. Saved searches are passive (user must open them).

Source: Feedbin API GitHub repository (feedbin/feedbin-api)

---

### 7. Fever API (Basic Sync Protocol)

Fever is a minimal RSS sync API with **no automation features**. It supports:
- Groups, Feeds, Items (entries), Links
- Mark actions: mark as read, mark as starred, mark feed/group as read

Fever-compatible servers (like FreshRSS's Fever extension) inherit the parent app's automation but do not expose it through the Fever API.

---

### 8. BazQux (Smart Streams + Filters)

BazQux offers:
- **Filters and smart streams**
- **Star, tag, share, read later** (Pocket, Instapaper, Pinboard)
- Mixed view mode for feeds
- Themes and typography

Limited public documentation; filter/smart stream specifics not detailed.

---

## Cross-Reader Comparison

### Actions Supported (By Reader)

| Action | Inoreader | FreshRSS | Miniflux | Feedly | NetNewsWire | Feedbin |
|--------|-----------|----------|----------|--------|-------------|---------|
| Mark as read | Yes | Yes | Block (implicit) | No | No | No |
| Star/Favorite | Yes | Yes | No | Boards (manual) | Built-in only | No |
| Tag/Label | Yes | Yes | No | No | No | No |
| Delete/Filter out | Yes (filter) | No | Yes (block) | Mute feed | No | No |
| Notify (push/desktop) | Yes | HTML5 notif | No | No | No | No |
| Send email | Yes | Yes | No | No | No | No |
| Send to read-later | Yes (Pocket, Instapaper, etc.) | Yes (20+ services) | No | No | No | No |
| Webhook | Yes | No | No | Yes (Enterprise) | No | No |
| AI Summary | Yes | No | No | Yes (Enterprise) | No | No |
| AI Translate | Yes | Yes (per-feed) | No | No | No | No |
| Content Rewrite | No | No | Yes | No | No | No |

### Conditions Supported (By Reader)

| Condition | Inoreader | FreshRSS | Miniflux |
|-----------|-----------|----------|----------|
| Title contains | Yes | Yes (`intitle:`) | Yes (`EntryTitle=`) |
| Content contains | Yes | Yes (`intext:`) | Yes (`EntryContent=`) |
| Author matches | Yes | Yes (`author:`) | Yes (`EntryAuthor=`) |
| URL contains | Yes | Yes (`inurl:`) | Yes (`EntryURL=`) |
| Feed matches | Yes (trigger) | Yes (`f:ID`) | Per-feed scoping |
| Category matches | Yes (trigger) | Yes (`c:ID`) | No |
| Tag/Label matches | Yes (trigger) | Yes (`#tag`, `L:ID`) | Yes (`EntryTag=`) |
| Language | Yes | No | No |
| Date/Age | No | Yes (`date:`, `pubdate:`) | Yes (`EntryDate=`) |
| Regex | No (keyword) | Yes (`/pattern/i`) | Yes (RE2 syntax) |
| Attachments/media | Yes | No | No |
| AND/OR logic | Yes | Yes | Implicit (rule list order) |
| NOT/negation | Yes | Yes (`!`, `-`) | No (separate block/keep) |

### Scope (By Reader)

| Scope | Inoreader | FreshRSS | Miniflux | Feedly | Feedbin |
|-------|-----------|----------|----------|--------|---------|
| Global | Yes (Account) | Yes (Reading config) | Yes (Settings) | No | No |
| Per-Category/Folder | Yes | Yes | No | No | No |
| Per-Feed | Yes | Yes | Yes | No | No |
| Per-Tag/Label | No | Yes (tag update) | No | No | No |

### UI Patterns

**Inoreader**: Wizard-style "Create rule" form (Name -> Trigger dropdown -> Condition builder -> Action checkboxes) with test button. Dashboard view with daily match counts.

**FreshRSS**: Textarea-based search query input under "Filter actions" fieldset. Separate textareas for `filteractions_read` and `filteractions_star` at global/category/feed levels. Tag-level `filteractions_label`. "View filter" button to preview matching articles.

**Miniflux**: Inline text input for blocklist/keeplist rules per feed. FieldName=RegEx format. Global rules in Settings page. Content rewrite rules as comma-separated predefined rule names.

**Feedbin**: Saved searches with simple query string. No rule builder UI.

## Summary of Common Patterns

1. **Trigger-Condition-Action model** is the most powerful (Inoreader). Simpler alternatives include **Condition-Action pairs** (FreshRSS) and **Block/Keep rules** (Miniflux).

2. The three most common actions are: **mark as read**, **star/favorite**, and **tag/label**. External service integration (Pocket, Instapaper, email, webhooks) is common in commercial products.

3. **Search-based condition syntax** (FreshRSS, Feedbin) is simpler to implement than a full visual condition builder (Inoreader) but less accessible to non-technical users.

4. **Three-tier scope** (global, category, feed) is the standard pattern. FreshRSS adds a fourth tier (per-label/tag).

5. **Regex support** for conditions is common in self-hosted readers (Miniflux, FreshRSS) but rare in commercial SaaS products (Inoreader uses keyword matching).

6. **Duplicate detection** is a distinct sub-feature of filtering (Inoreader has a separate duplicate filter system).

7. **Content transformation** (rewrite rules, scraper rules) is unique to Miniflux and goes beyond simple filter/action patterns.

## Related Specs

- `.trellis/spec/backend/directory-structure.md` - Backend module organization
- `.trellis/spec/frontend/directory-structure.md` - Frontend component organization
- `.trellis/spec/backend/database-guidelines.md` - ORM patterns
- `.trellis/spec/backend/index.md` - Backend key conventions

## Caveats / Not Found

- Inoreader's help center (help.inoreader.com) was inaccessible due to SSL errors
- Feedly's consumer rule/filter features are absent; their blog posts now redirect to the landing page
- Fever API documentation was not accessible (feedafever.com SSL issues)
- BazQux's filter/smart stream details are not publicly documented
- NetNewsWire's smart feed implementation details were not retrieved (GitHub search requires auth)
- Some Inoreader older blog posts have been removed or restructured
