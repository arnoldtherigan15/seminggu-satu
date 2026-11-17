---
name: Seminggu Satu — Binder Diary
description: A 2000s school binder decorated by the community; the visual world of the public homepage.
colors:
  binder-blue: "#0046ff"
  sticker-yellow: "#ffe600"
  margin-pink: "#ff8fb8"
  ink-navy: "#10245e"
  ink-muted: "#4a5674"
  ink-soft: "#5f6b8a"
  desk: "#f4f7ff"
  paper: "#ffffff"
  rule-blue: "#d6e3ff"
  sticky-note: "#fff6a8"
  peel-back: "#dfe7fb"
  ok-green: "#0a7a3d"
  dark-desk: "#0d1526"
  dark-paper: "#18213b"
  dark-rule: "#27355e"
  dark-ink: "#eaeffc"
  dark-link: "#7aa2ff"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.85rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 800
    lineHeight: "28px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Open Sans, -apple-system, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: "28px"
  label:
    fontFamily: "Open Sans, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    letterSpacing: "0.04em"
rounded:
  tag: "6px"
  sticker: "12px"
  button: "14px"
  sheet: "6px 16px 16px 6px"
  cover: "14px 24px 24px 14px"
  pill: "999px"
spacing:
  rule: "28px"
  gutter: "16px"
  sheet-left: "62px"
  section: "2.6rem"
components:
  button-sticker:
    backgroundColor: "{colors.binder-blue}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.button}"
    height: "52px"
  button-sticker-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.button}"
    height: "52px"
  index-tab:
    backgroundColor: "{colors.sticker-yellow}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.headline}"
    rounded: "14px 14px 0 0"
  loose-leaf-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.sheet}"
    padding: "32px 18px 22px 62px"
  status-sticker:
    backgroundColor: "#d1fae5"
    textColor: "#065f46"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
  sticky-note:
    backgroundColor: "{colors.sticky-note}"
    textColor: "{colors.ink-navy}"
    padding: "16px"
---

# Design System: Seminggu Satu — Binder Diary

> **Scope.** This world currently lives on the public homepage (`index.html`). Other pages still follow `.claude/skills/seminggu-ui`, which stays binding for them; brand fonts (Outfit + Open Sans) and the blue/yellow palette are shared by both. The surface contract is `.impeccable/surfaces/index-html.md`.

## Overview

**Creative North Star: "The Community Binder"**

The page is a 2000s school binder that the warga have decorated together. The brand-blue cover has metal rings, a name label stuck on as a sticker, a taped polaroid of real people, and Mochi stuck in the corner. Behind it, every workshop is a loose-leaf sheet with pale-blue rules, a pink margin line and punched holes. Sections start at coloured index tabs. The register is playful and hand-made, but never messy: everything still lines up on the ruled pitch and reads in one pass on a phone.

Craft materials are rendered honestly and flat. Paper, photo, sticker and washi each have their own depth and edge, with no fake bevels or gloss. The page refuses the link-in-bio column of identical rounded cards that it replaced.

**Key Characteristics:**
- Blue binder cover → yellow index tab → loose-leaf sheets, read top to bottom.
- Three depth layers: paper < photo < sticker.
- Kiss-cut stickers with a 3px white die-cut ring; translucent striped washi.
- Real photography only (event photos, real reel posters); no illustration stand-ins.
- Motion: stickers "stick" once on load; nothing loops.

## Colors

Brand blue and sticker yellow carry the page, with pink as the craft accent. Everything else is an ink or a paper.

### Primary
- **Binder Blue** (#0046ff): the cover board, primary buttons (Daftar), the Balai Warga strip and the blue tab. On white it passes 4.5:1 for text.

### Secondary
- **Sticker Yellow** (#ffe600): the "Jadwal Workshop" index tab, round icon stickers, the play sticker, early-bird tags and one of the washi patterns. Always paired with Ink Navy text, never white.

### Tertiary
- **Margin Pink** (#ff8fb8): the loose-leaf margin line, the Cerita Warga tab, pink washi and link underlines. Decorative only; never used as a text colour.

### Neutral
- **Ink Navy** (#10245e): headings and primary text, and text on yellow or white stickers.
- **Ink Muted** (#4a5674) / **Ink Soft** (#5f6b8a): body and meta text.
- **Desk** (#f4f7ff): the page ground, with a 22px dot grid at 9% ink.
- **Paper** (#ffffff) with **Rule Blue** (#d6e3ff): loose-leaf sheets.
- **Sticky Note** (#fff6a8): notices and the WhatsApp ask.
- **Dark mode:** Desk #0d1526, Paper #18213b, Rule #27355e, Ink #eaeffc, links #7aa2ff. The polaroids and stickers stay white because they are physical objects.

### Named Rules
**The Yellow Carries Navy Rule.** Anything yellow takes Ink Navy text or icons (#10245e on #ffe600), never white.

**The Honest Colour Rule.** Status is shown by the sticker colour plus a word (Buka / Segera Dibuka / Segera Hadir) and by paper pattern: ruled for open, grid paper for not yet open. It is never shown by colour alone.

## Typography

**Display Font:** Outfit (with sans-serif)
**Body Font:** Open Sans (with -apple-system, sans-serif)

**Character:** Outfit at 800 is the rounded label-maker voice for names, tabs, titles and buttons. Open Sans does the reading. Both are brand-bound by seminggu-ui.

### Hierarchy
- **Display** (800, 1.85rem, line-height 1, -0.02em): the "Seminggu Satu" name label only.
- **Headline** (800, 1.15rem, 28px): index tabs and sheet titles; titles sit on the rule pitch.
- **Title** (800, ~1.05rem, 1.2): button labels, polaroid captions and story titles.
- **Body** (400, 0.9rem, 28px on sheets): text written *on* the loose-leaf lines. Off-sheet body copy uses 1.5–1.55.
- **Label** (800, 0.75rem, uppercase, 0.04em): status stickers and early-bird tags.

### Named Rules
**The Write-On-The-Lines Rule.** Text inside a loose-leaf sheet uses a 28px line-height, and the sheet's top padding is 32px, so each baseline sits about 5px above a rule. Rules never strike through text.

## Layout

The page is phone first, a single column with a max width of 520px and a 16px side gutter. Sections are spaced 2.6rem apart and each one opens with an index tab that overlaps its sheet by 0.35rem.

At 1024px and wider the binder opens up into a two-column grid (`minmax(360px,430px) minmax(0,580px)`, 3.5rem gap). The cover stays sticky on the left at top 3rem, and the sheets, stories and footer scroll on the right.

Loose-leaf sheets reserve 62px on the left for the punched holes and the margin line. The Cerita Warga polaroids sit in a horizontal snap strip with `scroll-padding-inline: 1rem`, and the next card is cropped to signal that the strip scrolls.

## Elevation & Depth

Depth comes from layered physical objects rather than UI elevation. There are three tiers, and they never mix up:

### Shadow Vocabulary
- **Paper** (`0 1px 2px rgba(16,36,94,.10), 0 6px 16px rgba(16,36,94,.06)`): sheets and sticky notes.
- **Photo** (`0 10px 22px rgba(16,36,94,.18)`): the cover, polaroids and the Balai Warga strip.
- **Sticker** (`0 0 0 3px #fff, 0 4px 8px rgba(16,36,94,.22)`): every kiss-cut sticker. The white ring is the die-cut edge.
- Shadow tint is the `--tint` token (16,36,94 in light mode, black in dark mode); never hardcode a new tint.

### Named Rules
**The Paper < Photo < Sticker Rule.** A sticker may sit on a photo or a sheet. A sheet never sits on a sticker. Nested "cards" are allowed only when they are distinct world objects in this order.

## Shapes

Loose-leaf sheets have a slightly asymmetric radius (6px on the binding edge, 16px on the free edge). The cover is 14/24px. Stickers are round or 12–14px. Washi is a rectangle 20–22px tall. Small rotations (−2° to +9°) apply to stickers, polaroids and notes, while sheets get only ±0.5°, so the text stays straight.

## Components

### Buttons (Daftar sticker)
- **Shape:** 14px radius, 52px minimum height, full width on sheets, rotated −0.6°.
- **Primary:** Binder Blue with white Outfit 800 text and a Lucide `arrow-right`.
- **Secondary:** white with Ink Navy text.
- **Hover / Press:** the bottom-right peel corner (`::after`, back colour `--peel`) grows from 14px to 30px. Hover also tilts the button to −1.4° and lifts it 2px. Press scales it to 0.98.
- **Disabled:** Accent Light fill, with no sticker ring and no peel.

### Loose-leaf Sheet (signature)
- White paper with pale-blue rules every 28px, a 2px pink margin at 46px and three punched holes drawn by `::before`. A washi strip is taped at the top (`::after`), cycling pink, blue and yellow.
- The status sticker hangs over the top-right edge (top −11px).
- **Variants:** an open event sits on ruled paper; a not-yet-open event sits on 22px grid paper; the empty state is a plain ruled sheet.

### Index Tab
- Outfit 800, 14px top radius, sitting 1.1rem in from the left and overlapping the sheet below. Yellow for the schedule, pink for stories, blue for tools.

### Polaroid Story Card
- White frame (8px with a 12px bottom), real reel poster at 4:5, Sticker Yellow play button and a small white tag. One tap opens the reel on Instagram; nothing is embedded.

### Sticky Note
- #fff6a8 with paper shadow, rotated ±0.8° and taped with washi. Used for notices (with a "Coba lagi" button) and the WhatsApp ask.

## Do's and Don'ts

### Do:
- **Do** place text on sheets at the 28px pitch with 32px top padding.
- **Do** use Lucide icons at the page stroke weight; put an icon inside a yellow round sticker when it needs presence.
- **Do** keep real data honest: when availability fails, show the last good dates and venue but hide seat counts.
- **Do** keep motion to a single settle on load using `cubic-bezier(.16,1,.3,1)`, and respect `prefers-reduced-motion`.
- **Do** give every reel a real poster in `images/stories/<shortcode>.webp` (480px wide).

### Don't:
- **Don't** use emoji or Unicode glyphs (→, 🏘️) as interface icons.
- **Don't** rebuild the uniform rounded-card link-in-bio column this world replaced.
- **Don't** put white text on Sticker Yellow, or use Margin Pink for text.
- **Don't** add looping or bouncy animation, fake urgency, or invented social proof (see seminggu-psych and PRODUCT.md).
