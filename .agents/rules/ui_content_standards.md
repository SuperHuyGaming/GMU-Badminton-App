---
name: ui-content-standards
description: >-
  Enterprise UI content standards, premier platform UX patterns (Start.gg, Luma, Outrally), inclusive community copy, and editable admin contexts.
trigger: always_on
---

# UI Content Standards & Premier Platform UX

## 1. Avoid "AI-Generated" Visual Clutter
- **No Artificial Badge Clutter**: Never generate multi-emoji, all-caps banners or pill badges (e.g., `🏆 🏸 MASON COLLEGIATE CIRCUIT & DMV OPEN HUB`).
- **No Empty Metric Card Walls**: Do not render prominent stat counter blocks (e.g., `0 ACTIVE EVENTS`, `0 HOST CLUBS`) when counts are zero or uninformative. Favor clean whitespace or subtle secondary text.
- **Design Alignment with Community Directory**: Follow the human design language established in `CommunityDirectory.jsx`:
  - Crisp, confident typography (`variant="h3"`, `fontWeight: 900`, `letterSpacing: '-0.5px'`).
  - Human, concise subtitles with generous line spacing.
  - Subtle borders (`1px solid divider`) and soft elevation instead of harsh heavy gradients.

## 2. Copy Premier Large-Company Design & Smooth UX (Start.gg / Luma / Outrally)
- **Fluid Micro-Interactions**:
  - Cards should smoothly elevate on hover (`transform: translateY(-4px)`, `boxShadow: '0 12px 28px rgba(0,0,0,0.08)'`).
  - Hovering a card should smoothly highlight its title (`& .tournament-title: { color: 'primary.main' }`).
  - Image containers should implement subtle zoom transitions on card hover (`& img: { transform: 'scale(1.04)', transition: 'transform 0.35s ease' }`).
- **Keyboard-First Accessibility**:
  - Support instant search focus when pressing `/` or `Ctrl+K` / `Cmd+K`.
  - Render a clean keyboard hint pill (`/`) inside search inputs when unfocused.
- **Instant Filtering & Feedback**:
  - Support quick-filter pills (e.g., "Upcoming", "This Weekend", skill levels) with instant in-memory filtering.
  - Provide a clear "Reset Filters" action when filters are active.

## 3. Inclusive Public Scope (Open to Everyone)
- The platform serves the entire badminton community: recreational players, local club members, juniors, open tournament competitors, and collegiate teams.
- Never use exclusionary copy or fallback labels like `"Collegiate Tournament"` or `"Collegiate Circuit"` unless an event is strictly limited to active university students. Default to `"Open Tournament"` or `"Community Event"`.

## 4. Editable Scraped Context in Admin Workflows
- **Interactive Flyer Management**: Always provide admins the ability to preview, enter image URLs directly, upload image files, or remove flyer graphics.
- **Editable OCR Captions**: Always render scraped captions and OCR text in multiline editable fields (`TextField multiline`) rather than static read-only containers.
- **Data Persistence**: Ensure backend PUT and approval routes persist updated flyer URLs and sanitized captions into both `ProposedTournament` and live `Tournament` collections.
