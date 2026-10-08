---
name: Triptic Travel Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3e4947'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#216963'
  on-secondary: '#ffffff'
  secondary-container: '#a8ece5'
  on-secondary-container: '#266d68'
  tertiary: '#6a4c07'
  on-tertiary: '#ffffff'
  tertiary-container: '#856421'
  on-tertiary-container: '#ffe7c2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#abefe8'
  secondary-fixed-dim: '#8fd3cc'
  on-secondary-fixed: '#00201e'
  on-secondary-fixed-variant: '#00504b'
  tertiary-fixed: '#ffdea7'
  tertiary-fixed-dim: '#ebc073'
  on-tertiary-fixed: '#271900'
  on-tertiary-fixed-variant: '#5e4200'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system is tailored for an intuitive, serene, and modern Korean travel-planning web platform. Travel planning can easily become overwhelming; the primary objective of this system is to convey clarity, calm organization, and effortless momentum.

### Brand Personality & Emotional Atmosphere
- **Refined & Crisp:** Clean white card architecture set over an organic, off-white canvas provides breathing room for vibrant destination imagery.
- **Calm & Purposeful:** The deep teal primary palette paired with warm gold tertiary accents creates a sophisticated, grounded tone inspired by nature, travel journals, and calm waters.
- **Welcoming & Efficient:** Friendly geometric curves combined with clear Korean microcopy guide users systematically from inspiration to detailed itinerary creation.

### Design Movement: Modern Card-Based Minimalism
The visual language merges modern digital minimalism with tactile card layers. Surfaces rely on bright white containers outlined with hairline structural borders (`#E2E8F0`), softened by subtle drop shadows. Accent elements employ gentle teal washes (`#F0FDFA`) and warm gold highlights (`#CEA65C`) to draw focus without inducing visual fatigue.

## Colors

The color palette centers on a disciplined range of teals paired with clean architectural neutrals and a warm gold tertiary accent. It delivers high contrast for legibility while keeping visual noise minimal.

### Palette Architecture
- **Primary (`#0F766E`):** Deep oceanic teal used for key call-to-actions, brand identity accents, active navigation states, and step markers.
- **Primary Hover (`#115E59`):** Deepened teal providing tactile visual feedback on interactive states.
- **Tertiary Accent (`#CEA65C`):** Warm gold accent used for highlighted badges, premium features, and special travel markers.
- **Primary Soft Tint (`#F0FDFA`):** Low-saturation teal background for step pill badges, active list rows, tag backgrounds, and subtle highlight banners.
- **Canvas Base (`#F9FAF8`):** Gentle warm off-white canvas creating separation behind crisp white cards.
- **Surface Cards (`#FFFFFF`):** High-brightness card surfaces for listings, search bars, and modal sheets.
- **Card Borders (`#E2E8F0`):** Neutral slate hairline borders defining shape boundaries without heavy shadows.
- **Typography Spectrum:**
  - **Headings & Body (`#0F172A`):** Deep slate black delivering optimal contrast and Korean font legibility.
  - **Secondary Supporting Text (`#475569`):** Medium slate for descriptions, subtitles, and metadata.
  - **Muted & Placeholder Text (`#94A3B8`):** Soft slate for form hints, inactive icons, and disclaimers.

## Typography

Typography prioritizes Korean readability alongside alphanumeric clarity. When deployed in Korean production environments, Plus Jakarta Sans cascades cleanly into `Pretendard`, maintaining consistent x-heights, letter spacing, and optical weights across both character sets.

### Typographic Principles
- **Title Hierarchy:** Section headers (such as "추천 여행지", "트립틱 시작하기") employ tight negative tracking (`-0.02em`) with strong semi-bold and bold weights to ground each section.
- **Body & Subtitle Clarity:** Body and description lines maintain generous line heights (`1.5` to `1.6`) to prevent dense Hangul glyphs from clustering.
- **Functional Labels:** Button texts, tab headers, and pill numbers rely on centered alignment and balanced medium/semibold weights to ensure fast scannability.

## Layout & Spacing

The design system implements a 12-column responsive fluid grid anchored by a maximum container width of `1200px` for desktop viewports.

### Grid Rhythm & Breakpoints
- **Desktop (≥ 1024px):** 12 columns, `1.5rem` (24px) gutters, and `2rem` (32px) minimum outer page margins. Section blocks carry `3.5rem` to `4rem` vertical breathing room.
- **Tablet (768px - 1023px):** 8 columns, `1.25rem` (20px) gutters, and `1.5rem` (24px) page margins. Destination cards reflow into a 2-up grid or horizontal carousel.
- **Mobile (< 768px):** 4 columns, `1rem` (16px) gutters, and `1rem` (16px) page margins. Action bars become fixed or edge-to-edge floating bars.

### Spatial Discipline
Internal component spacing follows strict 4px/8px increments:
- **Card Interior Padding:** 20px (`1.25rem`) to 24px (`1.5rem`).
- **Input & Search Field Padding:** 12px vertical by 20px horizontal.
- **Grouped Stack Spacing:** 8px between title and subtitle; 16px between media and textual details.

## Elevation & Depth

Visual hierarchy uses flat structural boundaries backed by diffused, low-opacity drop shadows. Cards hover subtly above the `#F9FAF8` canvas without heavy skeuomorphic effects.

### Elevation Hierarchy
- **Level 0 (Canvas):** `#F9FAF8` base canvas layer, completely flat.
- **Level 1 (Default Cards & Containers):** `#FFFFFF` fill with a crisp `1px solid #E2E8F0` border and shadow `0 2px 4px -1px rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Level 2 (Hovered Cards & Interactive Controls):** Raised state on card hover or active carousel control buttons (`#FFFFFF` circle navigation arrows): shadow `0 10px 20px -3px rgba(15, 23, 42, 0.07), 0 4px 6px -2px rgba(15, 23, 42, 0.03)` with a smooth `200ms ease-out` translateY transition (-2px).
- **Level 3 (Floating Search Bar & Popovers):** Elevated search capsule: shadow `0 12px 28px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.03)` with `1px solid #E2E8F0`.

## Shapes

The geometric personality of this design system is balanced and friendly, utilizing distinct corner radii to denote interactive scale:

- **Cards (`16px` / `1rem`):** Primary destination display cards, onboarding step boxes, and module containers. Card image masks strictly follow the parent radius on top corners (`16px 16px 0 0`).
- **Buttons & Controls (`10px` / `0.625rem`):** Standard interactive elements such as secondary buttons, input fields, dropdown triggers, and modal actions.
- **Pills & Circular Badges (`9999px`):** Master search input capsule, search submit buttons, floating navigation arrows, tag filters, and step index badges (`w-7 h-7` circular indicators).

## Components

### Buttons
- **Primary Action Button:** Background `#0F766E`, text `#FFFFFF`, font weight 600, border radius `10px` (or `9999px` inside search capsule). Hover state `#115E59`. Active compression: `scale(0.98)`.
- **Secondary Outlined Button:** Background `#FFFFFF`, text `#0F766E`, border `1px solid #0F766E`, radius `10px`. Hover: background `#F0FDFA`.
- **Icon Action Buttons (Carousel Navigation):** Circular `40px x 40px`, background `#FFFFFF`, border `1px solid #E2E8F0`, shadow level 1, chevron icon colored `#475569`. Hover: border color `#94A3B8`, shadow level 2.

### Search Capsule Bar
- Centered prominent container with pill shape (`rounded-full`), white background, border `1px solid #E2E8F0`, and level 3 elevation.
- Houses a search icon (`#94A3B8`), auto-expanding text input with placeholder `#94A3B8`, and an integrated primary pill button ("여행 계획하기").

### Destination & Travel Cards
- Outer container: `16px` border radius, `#FFFFFF` background, `1px solid #E2E8F0` border, overflow hidden.
- Top section: Image container with fixed aspect ratio (`4:3` or `16:10`), `object-fit: cover`.
- Content section: Padding `20px`. Contains title (`headline-sm`, `#0F172A`) and supporting copy (`body-md`, `#475569`).

### Step & Onboarding Cards ("트립틱 시작하기")
- Background `#ECEFE9` or soft tinted slate-teal `#F1F5F2`, radius `16px`, padding `24px`.
- Features an index pill: `28px x 28px` circle with `#CCFBF1` surface and `#0F766E` bold numeral text.
- Step title (`headline-sm`, `#0F172A`) followed by auxiliary subtitle (`body-md`, `#475569`).

### Chips & Filter Pills
- Inactive: Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#475569`. Radius `9999px`, padding `8px 16px`.
- Active: Background `#F0FDFA`, border `1px solid #0F766E`, text `#0F766E`, font weight 600.

### Input Fields & Checkboxes
- **Inputs:** Height `44px`, radius `10px`, background `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`. Focus ring: `2px solid #0F766E` with offset `2px`.
- **Checkboxes & Radios:** `18px x 18px`, border `1.5px solid #94A3B8`, radius `4px` (checkbox) or `9999px` (radio). Checked state: fill `#0F766E` with white checkmark glyph.