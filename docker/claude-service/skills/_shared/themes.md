## Design styles

The following styles apply to both presentations and videos. When a "Design style preference" is given in the task, use the matching style. If no preference is given, use `default`.

| Style | Audience / tone | Pacing | Layout bias |
|-------|----------------|--------|-------------|
| `default` | Professional, informative | Steady | Mix of all layouts |
| `corporate-minimal` | Formal, precise, no filler | Tight (6 slides) | `title` + `bullets` heavy |
| `tech-forward` | Energetic, jargon-ok, future-focused | Fast (7–8 slides) | `image-right` heavy |
| `data-driven` | Analytical, cite numbers, lead with metrics | Steady (6–7 slides) | `bullets` with stats |
| `magazine-editorial` | Bold, punchy, short declarative sentences | Punchy (6 slides) | `full-image` + `text` mix |
| `executive-brief` | Authoritative, outcome-first, zero fluff | Very tight (6 slides) | `text` + `bullets` |

Apply the style throughout — do not mention the style name in output or headings.

`default` uses the **CORPORATE MINIMAL** visual rules below.

---

## Presentation visual rules

For HTML presentations, apply the full visual spec for the chosen style. When no style is specified, apply **CORPORATE MINIMAL**:

**1. CORPORATE MINIMAL** (Default for business/enterprise contexts)
*Philosophy:* Clarity over decoration. Maximum information density without clutter. Trust through restraint.
- **Color Palette:**
  - Primary: Deep navy (#0f172a) or charcoal (#1e293b)
  - Background: Pure white (#ffffff) or off-white (#f8fafc)
  - Accent: Single bold color (electric blue #2563eb, or emerald #059669)
  - Use 90-10 rule: 90% neutrals, 10% accent color for CTAs and key data
- **Typography:**
  - Headings: Inter, "SF Pro Display", or system-ui (600-700 weight) at 2.5-4rem, white-space: nowrap to prevent wrapping
  - Body: Inter or system-ui (400 weight) at 1.125-1.25rem, line-height: 1.6, opacity: 0.85 minimum
  - Data/numbers: Tabular figures, mono fallback for alignment
  - Limit to 2 font weights maximum per deck
- **Layout Patterns:**
  - Generous whitespace: min 15% of viewport should be empty space per slide
  - Strict grid alignment: everything snaps to 12-column or 16-column grid
  - Asymmetric layouts: 60/40 or 70/30 splits, never 50/50
  - Text max-width: 65ch for readability
- **Components:**
  - **Accent line above headings:** Use a solid accent color horizontal line (60-80px wide, 2-3px height) positioned 12-16px above headings
  - Subtle shadows: `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` only
  - Border radius: 0.5rem max, prefer sharp corners
  - Icons: Use inline SVG icons (never rely on external CDNs)
  - Data cards: Clean borders, minimal padding, left-aligned content
- **Slide Templates:**
  - Title slide: Large centered heading + subtitle, minimal logo placement
  - Section divider: Full-screen text, single accent color background
  - Content slide: Heading top-left, body in 60% width column, visual in 40% column
  - Data slide: Large numbers (3-4rem) with small labels, grid of 2-4 metrics
  - Comparison: Side-by-side tables or cards with clear visual separation
  - Full-bleed image: Image covering 60-70% of screen with overlay text box
- **Animation/Transitions:**
  - **Fade-in animation:** When a slide loads, its child elements fade in sequentially from top to bottom with a slight upward translation (20px). Use CSS animations with staggered delays (0.15s increments) based on element order. Elements start with `opacity: 0; transform: translateY(20px)` and animate to `opacity: 1; transform: translateY(0)`. Animation duration: 0.6s with ease-out timing. Apply via JavaScript after slide becomes active using `IntersectionObserver` or scroll event detection.
  - No slide transitions (rely on scroll-snap)
  - Hover states: slight scale (1.02) or opacity change (0.85)

**2. TECH FORWARD** (For product launches, SaaS demos, AI/tech topics)
*Philosophy:* Modern, confident, slightly futuristic. Show technical sophistication through visual polish.
- **Color Palette:**
  - Glassmorphic backgrounds: `background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1)`
  - Dark mode by default: #0a0a0a background with gradient overlays
  - Vibrant accents: Gradient combinations (purple-to-blue, cyan-to-teal)
  - Glowing effects: `box-shadow: 0 0 20px rgba(59,130,246,0.5)` for key elements
- **Typography:**
  - Headings: "Space Grotesk", "Outfit", or geometric sans-serif (500-600 weight), white-space: nowrap to prevent wrapping
  - Body: "Inter" or "DM Sans" (400 weight), opacity: 0.85 minimum for legibility
  - Code/technical: "Fira Code" or "JetBrains Mono"
- **Layout:**
  - Diagonal elements: rotated containers, skewed backgrounds (`transform: skewY(-2deg)`)
  - Overlapping layers with z-index depth
  - Grid patterns or dot patterns in backgrounds
- **Effects:**
  - CSS gradients: `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
  - Animated gradient backgrounds: subtle color shifting via CSS animations
  - Particle effects (optional): Canvas-based stars or floating dots in background
  - Glow on hover: `filter: drop-shadow(0 0 10px rgba(99,102,241,0.8))`
- **Components:**
  - Glass cards: translucent with blur
  - Neon borders: `border: 1px solid rgba(139,92,246,0.5); box-shadow: 0 0 10px rgba(139,92,246,0.3)`
  - Progress bars: animated gradient fills
  - Icons: Filled style with gradient overlays
- **Slide Templates:**
  - Title: Full-screen gradient background with centered text
  - Demo: Split screen with live code on left, output on right
  - Feature showcase: Card grid with hover-reveal details
  - Metrics: Large animated numbers with sparkle/glow effects

**3. DATA-DRIVEN** (For analytics, reports, dashboards, metrics-heavy presentations)
*Philosophy:* Information density without cognitive overload. Make data tell the story.
- **Color Palette:**
  - Semantic colors: Green (positive), red (negative), blue (neutral), amber (warning)
  - Muted backgrounds: #fafafa or #f5f5f5
  - Chart colors: Distinct, colorblind-safe palette (use ColorBrewer schemes)
- **Typography:**
  - Headings: "IBM Plex Sans" or "Roboto" (500 weight), white-space: nowrap to prevent wrapping
  - Body text: opacity: 0.85 minimum for legibility
  - Data labels: Tabular figures, right-aligned numbers
  - Footnotes: 0.875rem with reduced opacity
- **Layout:**
  - Dashboard grid: 2x2 or 3x2 metric cards per slide
  - Clear visual hierarchy: KPI → Chart → Supporting data
  - Consistent spacing: 1.5-2rem gaps between elements
- **Components:**
  - KPI cards: Large number, small label, +/- indicator, inline SVG sparklines
  - Charts: Build with inline SVG or HTML Canvas (no external libraries) for bar, line, doughnut charts
  - Tables: Striped rows, right-aligned numbers, bold headers
  - Heat maps: Color-coded cells with value overlays
- **Visualizations:**
  - Bar charts for comparisons
  - Line charts for trends over time
  - Donut charts for composition (avoid pie charts)
  - Sparklines for inline trend indicators
  - Always include: title, axis labels, legend, data source
- **Slide Templates:**
  - Executive summary: 3-4 large KPIs in a row
  - Trend analysis: Full-width line chart with annotations
  - Breakdown: Donut chart + table of values
  - Comparison: Grouped bar chart with clear categories

**4. MAGAZINE EDITORIAL** (For thought leadership, storytelling, culture-focused content)
*Philosophy:* Restraint over flash. Structure over decoration. Typography creates hierarchy, not effects.
- **Color Palette:**
  - Choose one preset:
    - Ink Classic: --ink: #0a1f3d; --ink-rgb: 10,31,61; --paper: #f1f3f5; --paper-rgb: 241,243,245; --accent: #23d2d6
    - Indigo Porcelain: --ink: #0e2841; --ink-rgb: 14,40,65; --paper: #f7f8fa; --paper-rgb: 247,248,250; --accent: #23d2d6
    - Forest Ink: --ink: #1c2617; --paper: #f5f5f0; --accent: #15803d
- **Typography (Three-Tier System):**
  - Serif headlines: "Playfair Display", "Source Serif 4", "Noto Serif SC" (600-900 weight) for main titles
  - Sans-serif body: "Noto Sans SC", "Noto Sans", "Inter" (300-500 weight) for paragraphs
  - Monospace metadata: "IBM Plex Mono" or "Fira Mono" (400-600 weight) for technical specs, timestamps
  - **CRITICAL: All headings must use white-space: nowrap to prevent text wrapping across lines**
  - **Font Sizes (use max() for responsiveness):**
    - Hero display: 7.5vw (font-weight: 900, line-height: 0.96, white-space: nowrap)
    - XL heading: 6.2vw (font-weight: 700, line-height: 1.08, white-space: nowrap)
    - Medium heading: 2.3vw (font-weight: 600, line-height: 1.3, white-space: nowrap)
    - Body text: max(15px, 1.22vw) (font-weight: 400, line-height: 1.75, opacity: 0.85)
    - Lead text: 1.75vw (font-weight: 400, line-height: 1.5, opacity: 0.88)
    - Metadata/chrome: max(11px, 0.78vw) (letter-spacing: 0.18-0.2em, text-transform: uppercase)
- **Layout:**
  - Slide padding: 5.6vh 6vw 9.6vh 6vw (top, sides, bottom)
  - Asymmetric grid: 60/40 or 70/30 splits
  - Generous whitespace: 8vh minimum vertical rhythm between sections
  - Images align with text columns (never float randomly)
  - No border-radius, no box-shadow, no background boxes
- **Fixed Page Elements (CRITICAL):**
  - **Chrome (top bar):** `<div class="chrome"><div>Section Title</div><div>03 / 24</div></div>`
    - Position: Top of slide, first element after opening `<section>` tag
    - Style: `display: flex; justify-content: space-between; font-family: var(--mono); font-size: max(11px, 0.78vw); letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.62`
    - Left side: Section name or context
    - Right side: Slide number format "XX / YY" (current / total)
  - **Foot (bottom bar):** `<div class="foot"><div>Opening Frame</div><div>2026</div></div>`
    - Position: Bottom of slide (`margin-top: auto` to push to bottom)
    - Style: `display: flex; justify-content: space-between; font-family: var(--mono); font-size: max(11px, 0.78vw); letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.5`
    - Left side: Slide description or section name (can use lowercase with `.foot .title` class for serif styling)
    - Right side: Year or date
  - **Frame (main content):** `<div class="frame">...</div>` goes between chrome and foot
    - Style: `flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden`
- **Image Treatment:**
  - Standard ratios only: 16:9, 16:10, 4:3, 3:2, 1:1
  - Captions: Small monospace font below images
  - Full-bleed images on hero slides
  - Greyscale or muted color filters for photographic consistency
- **Components:**
  - **Heading stack (CRITICAL ORDER for content slides):**
    1. Kicker text (if present): Small monospace uppercase label in accent color (color: var(--accent), opacity: 0.75)
    2. Accent line: Solid horizontal line (90px wide, 3px height, background: var(--accent), no border-radius)
    3. Main heading: Large serif heading with white-space: nowrap
    - Spacing: kicker → 1.2vh gap → accent-line → 1.8vh gap → heading
  - **Hero slide heading stack (DIFFERENT from content slides):**
    1. **Full-width horizontal line at very top of frame** (NOT a short 90px line — must span entire slide width using negative margins or absolute positioning on the frame itself, placed IMMEDIATELY below chrome bar as the first visual element)
    2. Kicker (motto/slogan) below the line
    3. Main heading (h-hero)
    4. Subtitle (lead text or h-sub)
    5. Additional body text if needed
    - The horizontal line is a defining visual element and must extend edge-to-edge and appear as the FIRST element in the frame, directly below the chrome bar
  - Pull quotes: Large serif text, minimal decoration, left border accent (3px solid)
  - Callouts: Simple left border, monospace label, semi-transparent background
  - Section markers: Large serif numerals (01, 02, 03)
  - Stat cards: Large numbers (5-6vw), monospace labels, top border
  - No card UI patterns, no shadows, no rounded corners
- **Color & Contrast:**
  - Text should be bright and legible: minimum opacity 0.85 for body text (increased from 0.82)
  - Lead text and subtitles: minimum opacity 0.88
  - Metadata elements: opacity 0.5-0.7 range
  - Use rgba() with CSS variables for consistency: `rgba(var(--ink-rgb), 0.85)`
  - Dark slides: light text on dark backgrounds with proper contrast
  - Light slides: dark text on light backgrounds
- **Slide Structure Template:**
  ```html
  <section class="slide dark"> <!-- or class="slide light" -->
    <div class="chrome"><div>Section Name</div><div>03 / 24</div></div>
    <div class="frame">
      <!-- Main content here -->
    </div>
    <div class="foot"><div>slide description</div><div>2026</div></div>
  </section>
  ```
- **Navigation Elements (outside slides):**
  - Navigation dots: `<div class="nav-dots" id="nav-dots"></div>` (centered bottom)
  - Keyboard hint: `<div id="hint">← → Navigate · ESC Index</div>` (bottom right corner)
  - Both elements should be placed after the presentation container, before the closing `</body>` tag
- **Slide Templates:**
  - **Hero slide (CRITICAL LAYOUT):** Add `hero` class to slide. Structure from top to bottom:
    1. **Chrome bar** at top (section name + slide number)
    2. **Frame** with **horizontal accent line as first child spanning full slide width** — this line must be the VERY FIRST element inside the frame
    3. **Kicker** (motto/slogan): small monospace uppercase text in accent color, positioned below the line
    4. **Main heading** (h-hero): large serif display title
    5. **Subtitle/Lead paragraph**: verbose mission statement/description
    6. **Additional body text** (optional): supplementary information
    7. **Foot bar** at bottom
    - **Layout rules:**
      - Content aligns to CENTER of slide vertically (using flexbox with justify-content: center) but LEFT-ALIGNED horizontally (text-align: left)
      - Frame uses `justify-content: center` to center content vertically in available space
      - Text and content should be left-aligned, not centered
      - Moderate vertical spacing between elements (2-3vh gaps)
      - **CRITICAL: Frame itself must have a full-width horizontal line as its FIRST child** (use ::before pseudo-element on .slide.hero .frame with negative left/right margins to extend beyond content padding, positioned at top: 0)
      - The accent line should use a gradient: `background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.9) 0%, rgba(var(--accent-rgb), 0.7) 40%, rgba(var(--accent-rgb), 0.4) 80%, rgba(var(--accent-rgb), 0.2) 100%)`
      - Example CSS for frame top line: `.slide.hero .frame { position: relative; } .slide.hero .frame::before { content: ''; position: absolute; left: -6vw; right: -6vw; top: 0; height: 1px; background: linear-gradient(...); }`
  - Body: Max-width 65ch text block, ample margins
  - Image + Quote: Large image (60%) with overlaid quote in serif
  - Chapter divider: Just a number and title, centered
  - Stat grid: Use .grid-3 or .grid-4 for stat cards

**5. EXECUTIVE BRIEF** (For C-suite, board meetings, investor pitches)
*Philosophy:* Confidence through simplicity. Every slide earns its place. High-signal, zero-noise.
- **Color Palette:**
  - Monochrome with single accent: Black/white/grey + one bold color (red, blue, or gold)
  - Dark backgrounds for gravitas: #0f0f0f with white text
  - High contrast: AAA accessibility compliance
- **Typography:**
  - Headings: "Helvetica Neue", "Arial", or system-ui (700 weight) — maximum trust, white-space: nowrap to prevent wrapping
  - Body: Same family, 400 weight, larger size (1.25-1.5rem), opacity: 0.85 minimum
  - Numbers: Extra bold (800 weight), 3-5rem size
- **Layout:**
  - One idea per slide (strict rule)
  - Centered alignment for key messages
  - Left-aligned for body content
  - Maximum 30 words per slide (excluding data tables)
- **Components:**
  - Statement slides: One sentence in 2-3rem text, centered
  - Impact numbers: `<div style="font-size: 5rem; font-weight: 800;">$2.4M</div>` with small context below
  - Before/After: Split screen with clear visual contrast
  - Timeline: Horizontal line with milestone markers
- **Animation:**
  - **Fade-in animation:** When a slide loads, its child elements fade in sequentially from top to bottom with a slight upward translation (20px). Use CSS animations with staggered delays (0.15s increments) based on element order. Elements start with `opacity: 0; transform: translateY(20px)` and animate to `opacity: 1; transform: translateY(0)`. Animation duration: 0.6s with ease-out timing.
  - Possible exception: Number counter animation for impact
- **Slide Templates:**
  - Opening: Company logo, presentation title, date (minimal)
  - Problem statement: Large headline, 2-3 supporting bullets max
  - Solution: Visual + short description
  - Traction: 2-3 large metrics in a row
  - Closing: Clear call-to-action, contact info

**ALTERNATIVE STYLES (Brief Mentions):**
When user specifically requests these, apply core principles but keep details lighter:
- **Brutalist Web:** Raw HTML aesthetics, Times New Roman, black/white/blue hyperlinks, `<table>` layouts, monospace, zero effects, embrace default browser styling, hard edges everywhere
- **Neubrutalism:** Bold sans-serif (800+ weight), thick black borders (3-5px), hard shadows (`box-shadow: 8px 8px 0 black`), bright saturated colors (yellow, magenta, cyan), playful rotation, chunky buttons
- **Apple Keynote Style:** San Francisco font family, massive amounts of whitespace (60%+ empty space), one word or short phrase per slide, full-bleed product photos, subtle gradients, rounded corners (1rem), fade transitions only
- **Cyberpunk/Terminal:** Monospace fonts exclusively, neon green/cyan/magenta on black, CRT scanline effect (`repeating-linear-gradient`), ASCII art borders, glitch effects, matrix-style animations
- **Swiss/International Style:** Grid-obsessed, left-aligned everything, Helvetica or Univers only, mathematical proportions (Golden Ratio), no decoration, red as only accent color, extreme precision
