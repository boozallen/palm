# Create HTML Presentation

You are generating a self-contained HTML presentation file. Write ALL output to the specified output path using the Bash tool.

The following are detailed instructions for how to build the HTML presentation:


- Use ".html" for HTML content such as web pages, email templates, interactive dashboards, data visualizations, horizontal-scrolling presentations, or any content the user explicitly requests in HTML format. The system will render a live preview of the HTML in a sandboxed iframe.
  - **HTML artifacts must be fully self-contained in a single file.** All CSS must be inline via `<style>` tags (no external stylesheets). All JavaScript must be inline via `<script>` tags (no external scripts or CDN dependencies). Build all visualizations and icons using inline SVG or HTML Canvas. **Never create separate .css or .js artifacts to accompany an .html artifact** — everything belongs in one file.
  - **Build interactive, polished web pages by default.** Use modern CSS (flexbox, grid, transitions, animations, gradients, shadows) and vanilla JavaScript to create engaging, visually appealing experiences. Think of each HTML artifact as a compact, self-contained web app — not a multi-file project.
  - Include hover effects, smooth transitions, responsive layouts, and thoughtful color schemes. Use CSS custom properties (variables) for consistent theming.
  - For data-driven content, prefer interactive elements: sortable tables, expandable sections, tooltips, tabs, modals, filterable lists, or simple charts built with SVG/Canvas.
  - Always include a complete HTML structure: `<!DOCTYPE html>`, `<html>`, `<head>` with `<meta charset="UTF-8">` and `<meta name="viewport">`, and `<body>`.

**PRESENTATION MODE - Horizontal Scrolling Slide Decks:**
This skill is only invoked when the user has explicitly asked for an HTML, web-based, or interactive presentation (plain "presentation"/"slide deck" requests default to PowerPoint upstream). When that's the case — or the user mentions creating slides for a demo/meeting — create a **horizontal-scrolling HTML presentation** with the following specifications:

**CRITICAL: Presentations are ALWAYS horizontal (landscape) format with horizontal scrolling unless the user explicitly requests vertical orientation. Never create vertical/portrait presentations by default.**

**Core Architecture:**
- Each slide is a full-viewport `<section>` element with `scroll-snap-align: start`
- Each slide MUST be `min-width: 100vw; height: 100vh; flex: 0 0 100vw;` (landscape format)
- Container uses `scroll-snap-type: x mandatory` (x = horizontal) for smooth slide-to-slide navigation
- Container must be `display: flex; flex-wrap: nowrap;` to force horizontal layout
- Full-viewport height slides only (100vh) — no vertical scrolling within slides
- Horizontal scrolling via: keyboard arrows (← →), scroll wheel, touch swipe gestures
- **Required navigation elements:**
  - Navigation dots/progress indicator at the bottom center (clickable for direct navigation)
  - Keyboard hint in bottom right corner: `<div id="hint">← → Navigate · ESC Index</div>` (in overview mode, all arrow keys work + ENTER to select)
  - ESC key triggers "overview/index mode" showing all slides in a grid with clickable previews
- Include slide numbers in a subtle position (format varies by aesthetic)
- Smooth transitions between slides using `scroll-behavior: smooth`

**Design Aesthetic Selection:**
Apply the visual rules for the chosen style as defined in the shared style reference above.

**TECHNICAL IMPLEMENTATION REQUIREMENTS:**

**CRITICAL: Always use horizontal (landscape) scrolling unless explicitly requested otherwise.**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presentation Title</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      /* Define CSS variables for chosen aesthetic */
      --primary: #0f172a;
      --accent: #2563eb;
      --bg: #ffffff;
      --text: #1e293b;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      overflow-x: hidden;  /* Hide horizontal scrollbar on body */
      overflow-y: hidden;  /* Prevent any vertical scrolling */
    }
    /* CRITICAL: Container must use flexbox for horizontal layout */
    .presentation-container {
      display: flex;
      flex-wrap: nowrap;           /* Force single horizontal row */
      scroll-snap-type: x mandatory; /* x = horizontal snapping */
      overflow-x: auto;            /* Enable horizontal scrolling */
      overflow-y: hidden;          /* Disable vertical scrolling */
      height: 100vh;
      scroll-behavior: smooth;
    }
    .presentation-container::-webkit-scrollbar { display: none; }
    .presentation-container { -ms-overflow-style: none; scrollbar-width: none; }
    /* CRITICAL: Each slide must be full-width landscape format */
    .slide {
      min-width: 100vw;      /* Full viewport width */
      width: 100vw;          /* Fixed width */
      height: 100vh;         /* Full viewport height */
      flex: 0 0 100vw;       /* No grow, no shrink, 100vw basis */
      scroll-snap-align: start;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 4rem;
      position: relative;
    }
    .slide-number {
      position: absolute;
      bottom: 2rem;
      right: 2rem;
      font-size: 0.875rem;
      opacity: 0.5;
    }
    /* Fade-in animation for slide elements (only in normal mode) */
    body:not(.overview-mode) .slide > *:not(.slide-number) {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }
    body:not(.overview-mode) .slide.active > *:not(.slide-number) {
      opacity: 1;
      transform: translateY(0);
    }
    /* Stagger animation delays for sequential fade-in */
    body:not(.overview-mode) .slide.active > *:nth-child(1) { transition-delay: 0s; }
    body:not(.overview-mode) .slide.active > *:nth-child(2) { transition-delay: 0.15s; }
    body:not(.overview-mode) .slide.active > *:nth-child(3) { transition-delay: 0.3s; }
    body:not(.overview-mode) .slide.active > *:nth-child(4) { transition-delay: 0.45s; }
    body:not(.overview-mode) .slide.active > *:nth-child(5) { transition-delay: 0.6s; }
    body:not(.overview-mode) .slide.active > *:nth-child(6) { transition-delay: 0.75s; }
    body:not(.overview-mode) .slide.active > *:nth-child(7) { transition-delay: 0.9s; }
    body:not(.overview-mode) .slide.active > *:nth-child(8) { transition-delay: 1.05s; }
    .nav-dots {
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 0.5rem;
      z-index: 1000;
    }
    .nav-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(0,0,0,0.3);
      cursor: pointer;
      transition: all 0.3s;
    }
    .nav-dot.active { background: var(--accent); transform: scale(1.5); }
    /* Keyboard navigation hint */
    #hint {
      position: fixed;
      bottom: 3vh;
      right: 3vw;
      z-index: 1000;
      font-family: monospace;
      font-size: 10px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      opacity: 0.4;
      mix-blend-mode: difference;
      color: #aaa;
    }
    /* Overview mode (triggered by ESC key) */
    body.overview-mode .presentation-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      gap: 2.5rem;
      padding: 4rem 3rem;
      overflow-y: auto;
      overflow-x: hidden;
      height: 100vh;
      scroll-snap-type: none;
      align-items: start;
    }
    body.overview-mode .slide {
      min-width: 420px;
      width: 100%;
      height: 0;
      padding: 0 !important;
      padding-bottom: 56.25% !important; /* 16:9 aspect ratio */
      cursor: pointer;
      border: 3px solid rgba(127, 127, 127, 0.25);
      transition: border-color 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
      opacity: 0.75;
      outline: none;
      position: relative;
      overflow: hidden;
      flex: none;
    }
    body.overview-mode .slide::before {
      opacity: 1 !important;
      backdrop-filter: none !important;
      position: absolute;
      top: 0;
      left: 0;
      transform: scale(0.25);
      transform-origin: top left;
      width: 400%;
      height: 400%;
    }
    body.overview-mode .slide::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      box-shadow: inset 0 0 0 1.5vw rgba(0, 0, 0, 0.02);
    }
    body.overview-mode .slide > * {
      position: absolute;
      top: 0;
      left: 0;
      transform: scale(0.25);
      transform-origin: top left;
      width: 400%;
      height: 400%;
      pointer-events: none;
      padding: 4rem;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      opacity: 1 !important; /* Override fade-in animation in overview mode */
    }
    body.overview-mode .slide:hover {
      border-color: rgba(var(--accent), 0.6);
      opacity: 0.9;
    }
    body.overview-mode .slide.focused {
      border-color: var(--accent);
      opacity: 1;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    body.overview-mode .nav-dots {
      display: none;
    }
  </style>
</head>
<body>
  <div class="presentation-container" id="presentation">
    <section class="slide" id="slide-1">
      <h1>Slide Title</h1>
      <p>Slide content</p>
      <div class="slide-number">1 / 5</div>
    </section>
    <!-- More slides... -->
  </div>
  <div class="nav-dots" id="nav-dots"></div>
  <div id="hint">← → Navigate · ESC Index</div>

  <script>
    // Navigation dots
    const container = document.getElementById('presentation');
    const slides = document.querySelectorAll('.slide');
    const navDots = document.getElementById('nav-dots');

    slides.forEach((slide, index) => {
      const dot = document.createElement('div');
      dot.className = 'nav-dot' + (index === 0 ? ' active' : '');
      dot.addEventListener('click', () => {
        slide.scrollIntoView({ behavior: 'smooth' });
      });
      navDots.appendChild(dot);
    });

    // Update active dot and slide animation on scroll
    container.addEventListener('scroll', () => {
      const scrollLeft = container.scrollLeft;
      const slideWidth = slides[0].offsetWidth;
      const activeIndex = Math.round(scrollLeft / slideWidth);
      document.querySelectorAll('.nav-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === activeIndex);
      });
      // Trigger fade-in animation for active slide
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === activeIndex);
      });
    });

    // Set initial slide as active after a brief delay to allow fade-in animation
    setTimeout(() => {
      slides[0].classList.add('active');
    }, 50);

    // Track focused slide index in overview mode
    let focusedSlideIndex = 0;

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const isOverview = document.body.classList.contains('overview-mode');

      if (isOverview) {
        // Overview mode: arrow keys navigate between slide previews
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          focusedSlideIndex = Math.min(focusedSlideIndex + 1, slides.length - 1);
          updateFocusedSlide();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          focusedSlideIndex = Math.max(focusedSlideIndex - 1, 0);
          updateFocusedSlide();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const cols = Math.floor(window.innerWidth / 420);
          focusedSlideIndex = Math.min(focusedSlideIndex + cols, slides.length - 1);
          updateFocusedSlide();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const cols = Math.floor(window.innerWidth / 420);
          focusedSlideIndex = Math.max(focusedSlideIndex - cols, 0);
          updateFocusedSlide();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          exitOverviewToSlide(focusedSlideIndex);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          exitOverviewToSlide(focusedSlideIndex);
        }
      } else {
        // Normal mode: arrow keys navigate between slides
        const currentScroll = container.scrollLeft;
        const slideWidth = slides[0].offsetWidth;
        if (e.key === 'ArrowRight') {
          container.scrollLeft = currentScroll + slideWidth;
        } else if (e.key === 'ArrowLeft') {
          container.scrollLeft = currentScroll - slideWidth;
        } else if (e.key === 'Escape') {
          const activeIndex = Math.round(currentScroll / slideWidth);
          focusedSlideIndex = activeIndex;
          document.body.classList.add('overview-mode');
          setTimeout(() => updateFocusedSlide(), 100);
        }
      }
    });

    // Update focused slide visual indicator in overview
    function updateFocusedSlide() {
      slides.forEach((slide, index) => {
        slide.classList.toggle('focused', index === focusedSlideIndex);
      });
      slides[focusedSlideIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Exit overview and navigate to specific slide
    function exitOverviewToSlide(index) {
      document.body.classList.remove('overview-mode');
      setTimeout(() => {
        container.scrollLeft = index * slides[0].offsetWidth;
      }, 100);
    }

    // Click to exit overview mode
    document.querySelectorAll('.slide').forEach((slide, index) => {
      slide.addEventListener('click', () => {
        if (document.body.classList.contains('overview-mode')) {
          exitOverviewToSlide(index);
        }
      });
      // Hover updates focus in overview
      slide.addEventListener('mouseenter', () => {
        if (document.body.classList.contains('overview-mode')) {
          focusedSlideIndex = index;
          updateFocusedSlide();
        }
      });
    });
  </script>
</body>
</html>
```

**IMPORTANT: The following features shown in the technical implementation are REQUIRED for ALL presentation aesthetics, not just Magazine Editorial. Every presentation must include:**
- Navigation dots at bottom center
- Keyboard hint in bottom right (`<div id="hint">← → Navigate · ESC Index</div>`)
- ESC key functionality for overview/index mode
- Arrow key navigation
- Click-to-navigate in overview mode
- **Fade-in animation:** Elements fade in sequentially from top to bottom when slide becomes active (applies to all aesthetics)

**CRITICAL: Overview Mode 1:1 Preview Implementation**
To ensure slide previews display correctly at 1:1 scale in overview mode, the CSS uses:
1. **Padding-based aspect ratio**: `height: 0; padding-bottom: 56.25%;` (16:9 ratio) on slide container
2. **Remove slide padding**: `padding: 0 !important` (except padding-bottom for aspect ratio)
3. **Apply padding to children**: Children get slide padding (e.g., `padding: 5.6vh 6vw 9.6vh 6vw`)
4. **Absolute positioning**: All slide children get `position: absolute; top: 0; left: 0;`
5. **Scale transformation**: All children scaled to 0.25 (25%) with `width: 400%; height: 400%;`
6. **Transform origin**: `top left` to ensure proper alignment from top-left corner
7. **Background scaling**: `::before` pseudo-element also gets scaled with `transform: scale(0.25)`
8. **Background override**: `::before` gets `opacity: 1 !important` to show backgrounds properly
9. **Fixed border width**: Always 3px border (not 2px changing to 3px) to prevent layout jumping on focus
10. **Specific transitions**: Only transition `border-color`, `opacity`, and `box-shadow` (not `all`) to prevent layout shifts
11. **Hide scrollbar**: Container gets `::-webkit-scrollbar { display: none; }` and `scrollbar-width: none`
12. **Pseudo-element fixes**: Any `::before` or `::after` pseudo-elements on scaled children must override their positioning in overview mode (e.g., `body.overview-mode .slide.hero .frame::before { left: 0; right: 0; transform: none; }`) to prevent compound transformation issues

This technique scales the ENTIRE slide proportionally at 0.25x size while maintaining proper padding appearance in the preview.

**MAGAZINE EDITORIAL SPECIFIC CSS TEMPLATE:**
When using Magazine Editorial aesthetic, include these CSS definitions (adapt color variables as needed):

```css
:root {
  /* Color palette - Indigo Porcelain */
  --ink: #0e2841;
  --ink-rgb: 14,40,65;
  --paper: #f7f8fa;
  --paper-rgb: 247,248,250;
  --accent: #23d2d6;
  --accent-rgb: 35,210,214;
  --accent-2: #00a5b5;

  /* Typography */
  --mono: "IBM Plex Mono", ui-monospace, monospace;
  --serif-en: "Playfair Display", "Source Serif 4", Georgia, serif;
  --serif-body-en: "Source Serif 4", Georgia, serif;
  --serif-zh: "Noto Serif SC", serif;
  --sans-zh: "Noto Sans SC", "Noto Sans", sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--sans-zh);
  -webkit-font-smoothing: antialiased;
}

/* Presentation container - HORIZONTAL SCROLLING */
.presentation-container {
  display: flex;
  flex-wrap: nowrap;           /* Single horizontal row */
  scroll-snap-type: x mandatory; /* x = horizontal */
  overflow-x: auto;            /* Enable horizontal scroll */
  overflow-y: hidden;          /* Disable vertical scroll */
  height: 100vh;
  scroll-behavior: smooth;
}

/* Hide scrollbar in presentation mode */
.presentation-container::-webkit-scrollbar {
  display: none;
}

.presentation-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Slide base - LANDSCAPE FORMAT */
.slide {
  min-width: 100vw;      /* Full viewport width */
  width: 100vw;          /* Fixed width */
  height: 100vh;         /* Full viewport height */
  scroll-snap-align: start;
  flex: 0 0 100vw;       /* No grow/shrink, 100vw basis */
  position: relative;
  padding: 5.6vh 6vw 9.6vh 6vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.slide.light { color: var(--ink); background: var(--paper); }
.slide.dark { color: var(--paper); background: var(--ink); }

/* Fade-in animation for slide elements (only in normal mode) */
body:not(.overview-mode) .slide > *:not(.slide-number) {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}
body:not(.overview-mode) .slide.active > *:not(.slide-number) {
  opacity: 1;
  transform: translateY(0);
}
/* Stagger animation delays for sequential fade-in */
body:not(.overview-mode) .slide.active > *:nth-child(1) { transition-delay: 0s; }
body:not(.overview-mode) .slide.active > *:nth-child(2) { transition-delay: 0.15s; }
body:not(.overview-mode) .slide.active > *:nth-child(3) { transition-delay: 0.3s; }
body:not(.overview-mode) .slide.active > *:nth-child(4) { transition-delay: 0.45s; }
body:not(.overview-mode) .slide.active > *:nth-child(5) { transition-delay: 0.6s; }
body:not(.overview-mode) .slide.active > *:nth-child(6) { transition-delay: 0.75s; }
body:not(.overview-mode) .slide.active > *:nth-child(7) { transition-delay: 0.9s; }
body:not(.overview-mode) .slide.active > *:nth-child(8) { transition-delay: 1.05s; }
/* In overview mode, ensure all elements are visible */
body.overview-mode .slide > * {
  opacity: 1 !important;
  transform: scale(0.25) !important;
}

/* Background overlays for readability */
.slide::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  transition: background 0.7s ease;
}
.slide.light::before { background: rgba(var(--paper-rgb), 0.76); backdrop-filter: blur(2px); }
.slide.dark::before { background: rgba(var(--ink-rgb), 0.76); backdrop-filter: blur(2px); }

/* Hero slides - lighter overlay for impact */
.slide.hero.light::before { background: rgba(var(--paper-rgb), 0.18); backdrop-filter: none; }
.slide.hero.dark::before { background: rgba(var(--ink-rgb), 0.16); backdrop-filter: none; }

/* Chrome (top bar with slide numbers) */
.chrome {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-family: var(--mono);
  font-size: max(11px, 0.78vw);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.62;
  margin-bottom: 2vh;
}

/* Foot (bottom bar with year) */
.foot {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  font-family: var(--mono);
  font-size: max(12px, 0.79vw);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.58;
  padding-top: 2vh;
}

.foot .title {
  font-family: var(--serif-zh);
  font-weight: 400;
  letter-spacing: 0.05em;
  text-transform: none;
  opacity: 0.82;
  font-size: max(14px, 1.01vw);
}

/* Frame (main content area) */
.frame {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* Hero slide: full-width accent line at top of frame */
.slide.hero .frame {
  position: relative;
  padding-top: 2.5vh;
  margin-top: -5vh;
  justify-content: center;
}
.slide.hero .frame::before {
  content: '';
  position: absolute;
  left: -6vw;
  right: -6vw;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.9) 0%, rgba(var(--accent-rgb), 0.7) 40%, rgba(var(--accent-rgb), 0.4) 80%, rgba(var(--accent-rgb), 0.2) 100%);
}

/* Typography hierarchy */
.h-hero {
  font-family: var(--serif-zh);
  font-weight: 900;
  font-size: 7.5vw;
  line-height: 0.96;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.h-xl {
  font-family: var(--serif-zh);
  font-weight: 700;
  font-size: 6.2vw;
  line-height: 1.08;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.h-md {
  font-family: var(--serif-zh);
  font-weight: 600;
  font-size: 2.3vw;
  line-height: 1.3;
  white-space: nowrap;
}

.lead {
  font-family: var(--serif-body-en);
  font-weight: 400;
  font-size: 1.75vw;
  line-height: 1.5;
  opacity: 0.88;
}

.body-zh {
  font-family: var(--sans-zh);
  font-weight: 400;
  font-size: max(15px, 1.22vw);
  line-height: 1.75;
  opacity: 0.85;
  letter-spacing: 0.01em;
}

.kicker {
  font-family: var(--mono);
  font-size: max(11px, 0.88vw);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent);
  opacity: 0.75;
  margin-bottom: 1.2vh;
}

/* Accent line (goes between kicker and heading on non-hero slides) */
.accent-line {
  width: 90px;
  height: 3px;
  background: var(--accent);
  margin-bottom: 1.8vh;
  border-radius: 0;
}

/* Layout utilities */
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.4vh 2vw;
}

.grid-4 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 4vh 6vw;
}

.grid-2-7-5 {
  display: grid;
  grid-template-columns: 7fr 5fr;
  gap: 3vw 4vh;
  align-items: start;
}

/* Stat cards */
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.8vh;
  align-items: flex-start;
  padding-top: 1.6vh;
  border-top: 1px solid rgba(127, 127, 127, 0.3);
}

.stat-card .stat-label {
  font-family: var(--mono);
  font-size: max(10px, 0.78vw);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  opacity: 0.55;
}

.stat-card .stat-nb {
  font-family: var(--serif-en);
  font-weight: 800;
  font-size: 5.8vw;
  line-height: 0.9;
  letter-spacing: -0.03em;
  font-feature-settings: "tnum";
  margin-top: 0.4vh;
}

.stat-card .stat-note {
  font-family: var(--sans-zh);
  font-weight: 400;
  font-size: max(13px, 1.05vw);
  line-height: 1.5;
  opacity: 0.72;
  margin-top: 0.6vh;
}

/* Callout boxes */
.callout {
  padding: 3vh 2.4vw;
  border-left: 3px solid var(--accent);
  font-family: var(--serif-zh);
  font-size: max(15px, 1.2vw);
  line-height: 1.55;
  opacity: 0.92;
}

.slide.dark .callout {
  background: rgba(var(--paper-rgb), 0.06);
}

.slide.light .callout {
  background: rgba(var(--ink-rgb), 0.05);
}

/* Navigation dots */
.nav-dots {
  position: fixed;
  bottom: 2.6vh;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(10px);
}

.nav-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 0;
  padding: 0;
}

.nav-dot:hover {
  background: rgba(255, 255, 255, 0.5);
  transform: scale(1.15);
}

.nav-dot.active {
  background: rgba(255, 255, 255, 0.95);
  width: 22px;
  border-radius: 999px;
}

/* Keyboard navigation hint (bottom right) */
#hint {
  position: fixed;
  bottom: 3vh;
  right: 3vw;
  z-index: 30;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.4;
  mix-blend-mode: difference;
  color: #aaa;
}

/* Overview/Index mode (triggered by ESC key) */
body.overview-mode .presentation-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 2.5rem;
  padding: 4rem 3rem;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100vh;
  scroll-snap-type: none;
  align-items: start;
}

body.overview-mode .slide {
  min-width: 420px;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  scroll-snap-align: start;
  cursor: pointer;
  border: 3px solid rgba(127, 127, 127, 0.25);
  transition: border-color 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
  opacity: 0.75;
  outline: none;
  position: relative;
  overflow: hidden;
  flex: none;
  padding: 0 !important; /* Remove default padding */
}

body.overview-mode .slide::before {
  opacity: 1 !important;
  backdrop-filter: none !important;
  position: absolute;
  top: 0;
  left: 0;
  transform: scale(0.25);
  transform-origin: top left;
  width: 400%;
  height: 400%;
}

body.overview-mode .slide::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Add subtle inner padding effect to match slide appearance */
  box-shadow: inset 0 0 0 1.5vw rgba(0, 0, 0, 0.02);
}

body.overview-mode .slide > * {
  position: absolute;
  top: 0;
  left: 0;
  transform: scale(0.25);
  transform-origin: top left;
  width: 400%;
  height: 400%;
  pointer-events: none;
  /* Ensure slide padding is maintained */
  padding: 5.6vh 6vw 9.6vh 6vw;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* Fix hero slide frame ::before pseudo-element in overview mode */
body.overview-mode .slide.hero .frame::before {
  display: none;
}

body.overview-mode .slide:hover,
body.overview-mode .slide:focus {
  border-color: rgba(var(--accent-rgb), 0.6);
  opacity: 0.9;
}

body.overview-mode .slide.focused {
  border-color: var(--accent);
  opacity: 1;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

body.overview-mode .nav-dots {
  display: none;
}

body.overview-mode #hint {
  opacity: 0.7;
}
```

**Magazine Editorial HTML Structure Example:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presentation Title</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Source+Serif+4:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&family=Noto+Serif+SC:wght@400;500;600;700;900&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
    /* Include all CSS from Magazine Editorial CSS template above */
  </style>
</head>
<body>
  <div class="presentation-container" id="presentation">
    <!-- Hero slide: full-width line is automatically added via .frame::before -->
    <section class="slide dark hero" id="slide-1">
      <div class="chrome"><div>Opening</div><div>01 / 08</div></div>
      <div class="frame" style="justify-content: center;">
        <div class="kicker">ORGANIZATION NAME OR CONTEXT</div>
        <h1 class="h-hero" style="margin-top: 2vh;">Presentation Title</h1>
        <p class="lead" style="margin-top: 3vh;">Subtitle or tagline goes here</p>
      </div>
      <div class="foot"><div class="title">Opening Frame</div><div>2026</div></div>
    </section>

    <!-- Content slide: uses explicit accent-line div -->
    <section class="slide light" id="slide-2">
      <div class="chrome"><div>Section Name</div><div>02 / 08</div></div>
      <div class="frame">
        <div class="kicker">SECTION LABEL</div>
        <div class="accent-line"></div>
        <h2 class="h-xl" style="margin-bottom: 3vh;">Content Slide Title</h2>
        <p class="body-zh">Content goes here...</p>
      </div>
      <div class="foot"><div>section description</div><div>2026</div></div>
    </section>

    <!-- More slides... -->
  </div>

  <div class="nav-dots" id="nav-dots"></div>
  <div id="hint">← → Navigate · ESC Index</div>

  <script>
    const container = document.getElementById('presentation');
    const slides = document.querySelectorAll('.slide');
    const navDots = document.getElementById('nav-dots');

    // Create navigation dots
    slides.forEach((slide, index) => {
      const dot = document.createElement('div');
      dot.className = 'nav-dot' + (index === 0 ? ' active' : '');
      dot.addEventListener('click', () => {
        slide.scrollIntoView({ behavior: 'smooth' });
      });
      navDots.appendChild(dot);
    });

    // Update active dot and slide animation on scroll
    container.addEventListener('scroll', () => {
      const scrollLeft = container.scrollLeft;
      const slideWidth = slides[0].offsetWidth;
      const activeIndex = Math.round(scrollLeft / slideWidth);
      document.querySelectorAll('.nav-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === activeIndex);
      });
      // Trigger fade-in animation for active slide
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === activeIndex);
      });
    });

    // Set initial slide as active after a brief delay to allow fade-in animation
    setTimeout(() => {
      slides[0].classList.add('active');
    }, 50);

    // Track focused slide index in overview mode
    let focusedSlideIndex = 0;

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const isOverview = document.body.classList.contains('overview-mode');

      if (isOverview) {
        // Overview mode navigation
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          focusedSlideIndex = Math.min(focusedSlideIndex + 1, slides.length - 1);
          updateFocusedSlide();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          focusedSlideIndex = Math.max(focusedSlideIndex - 1, 0);
          updateFocusedSlide();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const cols = Math.floor(window.innerWidth / 420); // Approximate columns
          focusedSlideIndex = Math.min(focusedSlideIndex + cols, slides.length - 1);
          updateFocusedSlide();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const cols = Math.floor(window.innerWidth / 420);
          focusedSlideIndex = Math.max(focusedSlideIndex - cols, 0);
          updateFocusedSlide();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          exitOverviewToSlide(focusedSlideIndex);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          exitOverviewToSlide(focusedSlideIndex);
        }
      } else {
        // Normal slide navigation
        const currentScroll = container.scrollLeft;
        const slideWidth = slides[0].offsetWidth;

        if (e.key === 'ArrowRight') {
          container.scrollLeft = currentScroll + slideWidth;
        } else if (e.key === 'ArrowLeft') {
          container.scrollLeft = currentScroll - slideWidth;
        } else if (e.key === 'Escape') {
          const activeIndex = Math.round(currentScroll / slideWidth);
          focusedSlideIndex = activeIndex;
          document.body.classList.add('overview-mode');
          setTimeout(() => updateFocusedSlide(), 100);
        }
      }
    });

    // Update focused slide visual indicator
    function updateFocusedSlide() {
      slides.forEach((slide, index) => {
        slide.classList.toggle('focused', index === focusedSlideIndex);
      });
      // Scroll focused slide into view
      slides[focusedSlideIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Exit overview and go to specific slide
    function exitOverviewToSlide(index) {
      document.body.classList.remove('overview-mode');
      setTimeout(() => {
        container.scrollLeft = index * slides[0].offsetWidth;
      }, 100);
    }

    // Click to exit overview mode and navigate to slide
    slides.forEach((slide, index) => {
      slide.addEventListener('click', () => {
        if (document.body.classList.contains('overview-mode')) {
          exitOverviewToSlide(index);
        }
      });

      // Mouse hover updates focus in overview
      slide.addEventListener('mouseenter', () => {
        if (document.body.classList.contains('overview-mode')) {
          focusedSlideIndex = index;
          updateFocusedSlide();
        }
      });
    });
  </script>
</body>
</html>
```

**QUALITY CHECKLIST FOR PRESENTATIONS:**
- [ ] **Presentation is horizontal (landscape) format** - slides scroll left/right, not up/down
- [ ] Container uses `display: flex; flex-wrap: nowrap; scroll-snap-type: x mandatory;`
- [ ] **Horizontal scrollbar is hidden** - use `::-webkit-scrollbar { display: none; }` and `scrollbar-width: none`
- [ ] Each slide has `min-width: 100vw; height: 100vh; flex: 0 0 100vw;`
- [ ] Every slide is exactly 100vh (no vertical overflow)
- [ ] Scroll-snap works smoothly between all slides
- [ ] **Fade-in animation implemented:** Elements fade in from top to bottom with slight upward translation (20px), staggered delays (0.15s increments), 0.6s duration, ease-out timing
- [ ] Active slide class toggles correctly on scroll and initial load
- [ ] First slide has `active` class on page load
- [ ] Navigation dots render and update correctly
- [ ] **Normal mode keyboard controls:**
  - Arrow keys (← →) navigate between slides
  - ESC enters overview/index mode
- [ ] **Overview mode keyboard controls:**
  - Arrow keys (← → ↑ ↓) navigate between slide previews with visual focus indicator
  - ENTER selects focused slide and exits overview
  - ESC exits overview mode
- [ ] Clicking slides in overview mode exits overview and navigates to that slide
- [ ] Hovering slides in overview mode updates the focus indicator
- [ ] Focused slide in overview has subtle border highlight (accent color, 3px border, no excessive scale)
- [ ] Overview mode shows 1:1 design preview using padding-bottom technique (height: 0, padding-bottom: 56.25%)
- [ ] Slide padding removed in overview (`padding: 0 !important`), padding applied to children
- [ ] All slide children get `position: absolute; transform: scale(0.25); width: 400%; height: 400%`
- [ ] Children maintain slide padding (e.g., `padding: 5.6vh 6vw 9.6vh 6vw`) with proper box-sizing
- [ ] Slide ::before backgrounds also scaled with `transform: scale(0.25)`
- [ ] Overview slides are 420px min-width with 16:9 aspect ratio
- [ ] Slide ::before backgrounds work correctly in overview (opacity: 1 !important)
- [ ] Border is always 3px (not 2px → 3px) to prevent jumping when focused
- [ ] Transitions only on border-color, opacity, box-shadow (not "all") to prevent layout shifts
- [ ] Slide numbers are present and accurate in correct format (XX / YY)
- [ ] Chosen aesthetic is consistently applied across all slides
- [ ] Color contrast meets WCAG AA standards minimum
- [ ] Typography hierarchy is clear (max 3 levels per slide)
- [ ] No more than one main idea per slide
- [ ] Images use standard aspect ratios
- [ ] All resources are inline (no external dependencies)
- [ ] No horizontal scrollbar appears (except for slide navigation)

**ADDITIONAL CHECKLIST FOR MAGAZINE EDITORIAL:**
- [ ] Chrome (top bar) includes section name on left and slide count "XX / YY" on right
- [ ] Foot (bottom bar) includes description on left and year/date on right
- [ ] Frame wraps all main content between chrome and foot
- [ ] Navigation hint element `<div id="hint">← → Navigate · ESC Index</div>` is present in bottom right
- [ ] Navigation dots `<div class="nav-dots" id="nav-dots"></div>` is centered at bottom
- [ ] ESC key functionality implemented to toggle overview mode
- [ ] Overview mode displays slides in grid (420px min-width, padding-bottom: 56.25% for 16:9)
- [ ] Preview shows 1:1 design (all children: position: absolute, scale(0.25), width/height: 400%)
- [ ] Arrow key navigation works in overview mode with visual focus (.focused class)
- [ ] ENTER key in overview mode selects focused slide
- [ ] Hover updates focus indicator in overview mode
- [ ] Focused slide has subtle accent-colored border (always 3px to prevent jumping)
- [ ] Focus transition only changes border-color, opacity, box-shadow (not width/size)
- [ ] Clicking slides in overview mode navigates back to that slide
- [ ] Font sizes use max() for responsive scaling (e.g., max(15px, 1.22vw))
- [ ] Text is bright and legible with proper opacity values (body: 0.85+, lead: 0.88+, meta: 0.5-0.7)
- [ ] Slide padding is consistent: 5.6vh 6vw 9.6vh 6vw
- [ ] CSS variables are defined in :root for colors (--ink, --paper, --accent with RGB variants)
- [ ] Three-tier typography system is used: serif headlines, sans-serif body, monospace metadata
- [ ] No rounded corners, shadows, or card-style containers (flat design only)
- [ ] **Heading stack follows proper order: kicker (accent color) → accent-line → heading**
- [ ] Kicker text uses accent color (color: var(--accent), opacity: 0.75)
- [ ] Accent line is solid color (90px wide, 3px height, no gradient, no border-radius)
- [ ] All headings use white-space: nowrap to prevent text wrapping
- [ ] Stat cards have proper top borders and monospace labels
- [ ] Callouts use 3px left border with accent color
- [ ] Grid layouts use proper gap values (2vh-4vh vertical, 2vw-6vw horizontal)