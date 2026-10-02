## Description
Fixes a UI glitch where the Facebook-style profile peak (the large avatar, name, and friend status) was being rendered at the very root of the DOM instead of inside the chat window container. It is now properly nested so it scrolls naturally with the messages.

## Type of Change
- [x] ?? Bug fix (non-breaking change which fixes an issue)
- [ ] ? New feature (non-breaking change which adds functionality)
- [ ] ?? Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] ?? Documentation update
- [x] ?? UI / Styling update

## UI Screenshots (Required for UI changes)
**Before:** N/A
**After:** N/A

## Testing Checklist
- [x] My code follows the style guidelines of this project.
- [x] I have performed a self-review of my own code.
- [x] I have commented my code, particularly in hard-to-understand areas.
- [x] I have verified the React UI locally (`npm run dev`).
- [ ] I have verified the Java/Python microservices locally via Docker (`docker compose up --build`).
- [x] I have run the automated testing suites (Jest / Vitest) and all tests pass.
- [x] Any dependent changes have been merged and published.
