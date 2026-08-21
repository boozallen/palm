# Create Video

You are generating a video script for an animated explainer video. Write ALL output to the specified output path using the Bash tool.

The output is a `.mp4` file whose content is a raw JSON object. The frontend renders this into a real video using Remotion + AWS Polly (text-to-speech).

## VideoSlide schema

Each object in the slides array:

```json
{
  "id": "<unique string, e.g. slide-1>",
  "heading": "<slide title — short, punchy, under 8 words>",
  "layout": "<one of: title | text | bullets | image-right | full-image>",
  "body": "<optional prose paragraph — 1-2 sentences max>",
  "bullets": ["<bullet item>", "..."],
  "narration": "<text read aloud by text-to-speech for this slide — see rules below>"
}
```

Required fields on every slide: `id`, `heading`, `narration`.

## Layout guide

- `title` — use for the first slide only; large centered heading + subtitle
- `bullets` — use for feature lists, key points, comparisons (3–5 bullets max)
- `text` — use for prose slides: problem statements, context, narrative transitions
- `image-right` — heading + body text on left, accent panel on right; good for "how it works" slides
- `full-image` — accent-color full background with heading at bottom; use sparingly

## Slide structure rules

- 6–8 slides total; do not pad or truncate to hit a number
- Slide 1: `layout: "title"` — demo name, one-liner tagline as `body`
- Slide 2: Problem — what pain point does this solve? Use `layout: "text"` with quantified impact if available
- Slides 3–5: Solution / key features — use `layout: "bullets"` or `layout: "image-right"`
- Slide 6 (or second-to-last): Differentiation / why this team
- Last slide: Call to action / next steps — `layout: "title"` or `layout: "text"`

## Narration rules — the most important part

The `narration` field is read aloud word-for-word by text-to-speech. Write it as natural spoken language, not slide bullets or headline fragments.

### Length and tone
- Title slides: 1–2 sentences
- Content slides: 3–5 sentences
- Executive audience — clear, authoritative tone; explain concepts as if speaking to decision-makers
- Active voice and concrete language: "This saves 40 hours per analyst per month" beats "significant time savings are achieved"
- Never repeat the heading verbatim — it is already on screen
- No visual references: never say "as you can see", "on screen now", "the slide shows"
- No stage directions or meta-commentary

### Content order
Narrate the slide heading first, then cover each body item in exact top-to-bottom order. Do NOT resequence or skip content for narrative flow. A listener should be able to follow along reading the slide while hearing the narration.

### Acronym expansion — critical for TTS
Replace ALL-CAPS acronyms with pronounceable text every time they appear. TTS mispronounces bare acronyms.

Rules:
- If it reads as a word (CIRRUS, NOAA), write it normally: "Cirrus", "Noah"
- If it sounds like a letter-string (API, DoD, AWS), spell it with hyphens: "A-P-I", "Department of Defense", "Amazon Web Services"
- When in doubt, expand it — mispronunciation is the #1 quality failure

Examples: `NOAA` → "Noah" · `API` → "A-P-I" · `DoD` → "Department of Defense" · `AWS` → "Amazon Web Services" (first use) · `ML` → "M-L"

### Narrative arc
The narration across all slides must tell a complete story: problem → solution → outcome → call to action. End the last slide with a clear call to action.

## Style guide

Apply the design style from the shared style table above to **narration tone**, **slide count**, and **layout choices**. Do not mention the style name in narration or headings.

## Quality standards

- Never invent statistics or facts not present in the source content — use TBD if unknown
- If the source content has a quantified problem statement (unit × volume = impact), use it on slide 2
- `bullets` items: 5–10 words each, parallel structure, no punctuation at the end

## Output format

Write a single `.mp4` file containing only a JSON object — no markdown fences, no explanation. The object has two fields: `theme` (the style key) and `slides` (the array). Example:

```
{
  "theme": "default",
  "slides": [
    {
      "id": "slide-1",
      "heading": "Demo Title",
      "layout": "title",
      "body": "One-liner tagline goes here",
      "narration": "Opening narration that sets the stage for what this demo is about and why it matters."
    },
    ...
  ]
}
```

Set `theme` to match the design style preference: `default`, `corporate-minimal`, `tech-forward`, `data-driven`, `magazine-editorial`, or `executive-brief`. If no style preference is given, use `default`.
