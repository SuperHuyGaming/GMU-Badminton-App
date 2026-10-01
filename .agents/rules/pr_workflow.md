---
name: pr-workflow-protocol
description: >-
  MANDATORY rule: After every coding task, create a feature branch, push, open a Pull Request on GitHub with labels and assignees, post a QA Bot comment, and invoke the QA Engineer to review and comment on the PR before merging.
trigger: always_on
---

# MANDATORY Pull Request & QA Workflow

> [!CAUTION]
> **NEVER COMMIT OR PUSH DIRECTLY TO `develop` OR `main`.** This is a strict repository invariant. All changes must be pushed to a feature branch.

After EVERY coding task (no exceptions), you MUST follow this exact workflow:

## Step 1: Feature Branch
- Create a descriptive feature branch (e.g., `feature/search-ui-polish`, `fix/cors-hotfix`).
- Do NOT commit directly to `develop` or `main`.

## Step 2: Commit & Push
- Stage all changes with `git add`.
- Write a conventional commit message (e.g., `feat(ui): ...`, `fix(security): ...`).
- Push the branch to `origin`.

## Step 3: Create Pull Request
- Use the GitHub CLI to create a PR targeting `develop`:
  ```
  gh pr create --base develop --head <branch> --title "<title>" --body "<detailed description>" --assignee SuperHuyGaming --label "QA Pipeline" --label "Automated"
  ```
- The PR body MUST include:
  - A summary of what changed
  - Testing results (build, lint, test pass/fail)

## Step 4: QA Bot Comment
- Immediately post an automated QA Bot comment on the PR:
  ```
  gh pr comment <PR#> --body "🤖 **Automated QA Pipeline:** ..."
  ```
- The comment should announce that the QA Engineer has been assigned and tests are running.

## Step 5: Invoke QA Engineer
- Invoke the `qa_engineer` subagent and instruct it to:
  1. Checkout the feature branch
  2. Run `npm test` and `npm run lint` in `client/` and `server/`
  3. Run `npm run build` in `client/`
  4. Post their own review comment on the PR using `gh pr comment`
  5. Report back with PASS/FAIL

## Step 6: Merge Only After QA
- Do NOT merge the PR until the QA Engineer reports a full PASS.
- Once green, merge with `gh pr merge <PR#> --squash --delete-branch`.

## NEVER skip this workflow. It applies to every single code change, no matter how small.
