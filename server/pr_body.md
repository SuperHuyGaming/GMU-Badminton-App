## Description
Reverts the Dependabot Express 5 bump (PR #53) back down to Express `4.21.2`. Express 5 changes `req.query` and `req.body` to getters, which completely breaks `express-mongo-sanitize` globally and crashes the backend on every single request.

## Type of Change
- [x] ?? Bug fix (non-breaking change which fixes an issue)
- [ ] ? New feature (non-breaking change which adds functionality)
- [ ] ?? Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] ?? Documentation update
- [ ] ?? UI / Styling update

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
