# Dabys.org Design System & Style Reference

Use this guide for **every** new page, component, or UI change.
The "gold standard" pages are the **TCG page**, **Quest Log sidebar**, and **Winners hero page**.

---

## Color Palette

### Primary Accent — Gold / Amber
Used for primary actions, active states, highlights, and important labels.

| Usage       | Class                                                   |
|-------------|---------------------------------------------------------|
| Text        | `text-amber-400`                                        |
| Background  | `bg-amber-500/10` (resting) / `bg-amber-500/15` (hover)|
| Border      | `border-amber-500/30` (resting) / `border-amber-500/50` (hover) |
| Ring        | `ring-2 ring-amber-400/50`                              |
| Gradient    | `from-amber-400/60 to-amber-500/60`                     |

### Secondary — Purple
Used for structural accents, codex/collection, avatar fallbacks, and ambient backgrounds.

| Usage       | Class                                                   |
|-------------|---------------------------------------------------------|
| Text        | `text-purple-400` / `text-purple-300`                   |
| Background  | `bg-purple-500/10` – `bg-purple-500/20`                 |
| Border      | `border-purple-500/30` – `border-purple-500/40`         |
| Avatar      | `bg-gradient-to-br from-purple-500 to-indigo-600`       |
| Ambient glow| `bg-purple-600/10 blur-[160px]`                         |

### Credit Blue — Sky
Used exclusively for credit/currency display and codex-upload/cyan actions.

| Usage       | Class                                                   |
|-------------|---------------------------------------------------------|
| Text        | `text-sky-300`                                          |
| Background  | `bg-sky-400/10` – `bg-sky-400/20`                       |
| Border      | `border-sky-400/20` – `border-sky-400/30`               |
| Cyan variant| `text-cyan-300`, `border-cyan-500/50`, `bg-cyan-500/20` |

### Semantic Colors

| Meaning  | Text             | Background            | Border                  |
|----------|------------------|-----------------------|-------------------------|
| Success  | `text-emerald-400`| `bg-emerald-500/10`  | `border-emerald-500/30` |
| Danger   | `text-red-400`   | `bg-red-500/10`       | `border-red-500/30`     |
| Warning  | `text-amber-400` | `bg-amber-500/10`     | `border-amber-500/30`   |

### White Opacity Hierarchy (text on dark background)

| Level     | Class           | Use                              |
|-----------|-----------------|----------------------------------|
| Primary   | `text-white/90` | Titles, primary content          |
| Secondary | `text-white/70` | Body text, descriptions          |
| Tertiary  | `text-white/60` | Section headers (uppercase)      |
| Muted     | `text-white/40` | Inactive tabs, subtle text       |
| Faint     | `text-white/30` | Timestamps, sub-labels           |
| Ghost     | `text-white/20` | Placeholders, disabled           |

---

## Glass Panel Standard

All major content panels use a frosted-glass style:

```
rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl
```

| Element           | Classes                                                                 |
|-------------------|-------------------------------------------------------------------------|
| Page panel        | `rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6` |
| Card / item       | `rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl`      |
| Modal overlay     | `fixed inset-0 z-50 bg-black/60 backdrop-blur-sm`                      |
| Modal panel       | `rounded-2xl border border-white/[0.18] bg-white/[0.06] backdrop-blur-2xl shadow-[0_22px_70px_rgba(0,0,0,0.85)]` |
| Connected panel   | `rounded-b-2xl rounded-t-none border border-t-0 border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6` |
| Tooltip / popover | `rounded-xl border border-white/20 bg-white/[0.08] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]` |

### Do NOT do:
- `bg-white/[0.02]` — too transparent, looks unfinished
- Panels without `backdrop-blur-xl` — no glass effect
- `border-white/[0.06]` — too invisible; use `[0.08]` minimum

---

## Tab Navigation

All tab bars follow the TCG bottom-border style:

### Container
```
flex border-b border-white/[0.08]
```

### Tab Button
```
px-4 py-3 text-sm font-medium transition-colors cursor-pointer
```

### Active State
```
text-amber-400 border-b-2 border-amber-400 -mb-px
```

### Inactive State
```
text-white/40 hover:text-white/60
```

### Do NOT do:
- Pill-in-container tabs (colored backgrounds on active)
- `bg-white/[0.1] text-white` active style — use amber underline instead
- Container backgrounds (`bg-white/[0.04]` wrappers)

---

## Typography

### Fonts
- **Body**: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (set on `<body>`)
- **Display / Hero Titles**: `.font-card-title` → Libre Baskerville serif
- **Site Logo**: `.font-site-title` → Bitcount Grid Double pixel font

### Text Scale

| Purpose         | Classes                                                     |
|-----------------|-------------------------------------------------------------|
| Hero title      | `text-3xl sm:text-4xl font-bold text-white/90`              |
| Page title      | `text-2xl font-bold text-white/90`                          |
| Section header  | `text-sm font-semibold text-white/60 uppercase tracking-widest` |
| Sub-label       | `text-[11px] uppercase tracking-widest text-white/35`       |
| Body            | `text-sm text-white/70`                                     |
| Caption / meta  | `text-xs text-white/40`                                     |
| Tiny label      | `text-[10px] text-white/30`                                 |

### Section Dividers (with centered label)
```html
<div class="flex items-center gap-3 mb-6">
  <div class="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
  <h2 class="text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">Section Title</h2>
  <div class="h-px flex-1 bg-gradient-to-l from-amber-500/20 to-transparent" />
</div>
```

---

## Buttons

### Primary (Amber)
```
px-5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md
text-amber-400 font-medium
hover:border-amber-500/50 hover:bg-amber-500/15
disabled:opacity-40 disabled:cursor-not-allowed
transition-all cursor-pointer
```

### Secondary (Purple / Cyan / Emerald)
Same structure, swap color:
```
border border-purple-500/30 bg-purple-500/10 text-purple-300
```

### Neutral / Ghost
```
px-4 py-2.5 rounded-xl border border-white/[0.12] bg-white/[0.04]
text-white/80 font-medium
hover:bg-white/[0.08] hover:border-white/[0.18]
transition-colors cursor-pointer
```

### Danger
```
border border-red-500/30 bg-red-500/10 text-red-400
hover:bg-red-500/15 hover:border-red-500/40
```

### Do NOT do:
- Solid gradient buttons (`bg-gradient-to-r from-purple-600 to-indigo-600`) — use glass style
- Missing `cursor-pointer`
- Missing `backdrop-blur-md`

---

## Ambient Background Glows

Every page should have subtle fixed ambient orbs for depth:

```html
<div class="fixed inset-0 pointer-events-none overflow-hidden">
  <div class="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
  <div class="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
  <div class="absolute top-1/3 left-1/2 w-[400px] h-[400px] rounded-full bg-amber-600/5 blur-[120px]" />
</div>
```

The purple/indigo orbs stay consistent; the amber is very subtle.

---

## Progress Bars

```html
<!-- Container -->
<div class="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
  <!-- Fill -->
  <div class="h-full rounded-full bg-gradient-to-r from-amber-400/60 to-amber-500/60 transition-all duration-700" style="width: XX%" />
</div>
```

Use amber for primary, purple for collection, sky for credits.

---

## Rarity Colors (TCG Cards)

| Rarity    | Border              | Glow / Accent   |
|-----------|---------------------|------------------|
| Uncommon  | `border-green-500/50` | green           |
| Rare      | `border-blue-500/50`  | blue            |
| Epic      | `border-purple-500/50`| purple          |
| Legendary | `border-amber-500/50` | amber/gold      |

---

## Loading Spinners

```
w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin
```

---

## Quick Checklist for New Components

1. Panel uses `bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl`
2. Tabs use bottom-border amber style (no pills)
3. Primary buttons use amber glass style
4. Section headers are `text-sm font-semibold text-white/60 uppercase tracking-widest`
5. Accent colors limited to amber, purple, sky — no rainbow
6. Font is system-ui body, Libre Baskerville for hero/display
7. No solid opaque backgrounds — everything is glass/transparent
8. Has `cursor-pointer` on interactive elements
