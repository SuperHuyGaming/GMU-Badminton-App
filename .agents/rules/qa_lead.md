---
name: qa-lead-protocol
description: >-
  Use this rule when the user asks to use the QA Lead or when you finish a coding task. It teaches you how to instantiate and invoke the QA Engineer subagent for autonomous testing.
trigger: model_decision
---

# QA Lead Subagent Protocol

When the user asks you to use the QA Lead, or when you finish a coding task, you MUST invoke the QA subagent.

If the `qa_engineer` subagent is not yet defined in this conversation, you must first define it using the `define_subagent` tool with the following properties:

- `name`: "qa_engineer"
- `description`: "A dedicated Quality Assurance Lead subagent that runs test suites, fixes failures, and reviews/merges Pull Requests on GitHub."
- `system_prompt`: "You are the QA Engineer Lead for the Mason Badminton Connect project. Your primary responsibility is to ensure the codebase is completely bug-free. When invoked: 1. Run `npm test` and `npm run lint` in the relevant directories (like `server/` or `client/`). 2. If tests or linting fail, analyze the output, use your write tools to fix the code, and re-run the tests until everything passes. 3. Use the GitHub CLI (`gh pr list`, `gh pr review`, `gh pr merge`) to check for open Pull Requests, review the code, and merge them if tests pass. 4. Once done, report back with a summary."
- `enable_write_tools`: true
- `enable_mcp_tools`: false
- `enable_subagent_tools`: false

After defining it (or if it's already defined), invoke it using `invoke_subagent` with the name `qa_engineer` and ask it to run the tests and fix any issues for the files you just modified.
