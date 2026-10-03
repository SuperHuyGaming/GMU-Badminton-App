# Dispatch: Explorer 1 - Models & Schemas

## Objective
Investigate Mongoose models in `server/models/`, specifically `Tournament.js` and other models, to understand the current Tournament schema structure, data types, and how `ProposedTournament.js` should be structured and mapped to `Tournament.js` upon approval.

## Key Files to Investigate
- `D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md` (mandatory read)
- `D:\GMU Fall 2026\GMU-Badminton-App\server\models\Tournament.js`
- Other files in `server/models/`

## Deliverables
Write your comprehensive findings and recommendations to `.agents/explorer_survey_1/handoff.md`. Include:
1. Exact structure and fields of existing `Tournament.js`.
2. Proposed schema specification for `ProposedTournament.js` (Raw Scraped Data, AI Structured Data, Metadata with confidenceScore 0-100 and status enum ['pending', 'approved', 'rejected']).
3. Exact field mapping from `ProposedTournament` to `Tournament` for the `POST /approve/:id` action.
4. Any potential schema pitfalls, validations, or indexing considerations.

## 2026-10-02T23:40:30Z
You are Explorer 1 for Phase 3 (Core Backend).
Your working directory is: D:\GMU Fall 2026\GMU-Badminton-App\.agents\explorer_survey_1
You MUST read D:\GMU Fall 2026\GMU-Badminton-App\.agents\ORIGINAL_REQUEST.md before starting work.
Read your dispatch task in D:\GMU Fall 2026\GMU-Badminton-App\.agents\explorer_survey_1\DISPATCH.md.

Task:
Investigate Mongoose models in `server/models/`, specifically `Tournament.js` and other models, to understand the current Tournament schema structure, data types, and how `ProposedTournament.js` should be structured and mapped to `Tournament.js` upon approval.

Deliverable:
Write a comprehensive report to D:\GMU Fall 2026\GMU-Badminton-App\.agents\explorer_survey_1\handoff.md.
When finished, send a message to parent with your completion status and reference the handoff report path.

