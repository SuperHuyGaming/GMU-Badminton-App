---
name: Multi-Device Conflict Prevention
description: Applies to all coding and git workflows.
---
# Multi-Device Workflow Rule

The user is actively developing this repository simultaneously across **1 Laptop** and **1 PC**. 

To prevent Git merge conflicts, you MUST permanently adhere to the following rules for EVERY task:
1. **Always Pull First:** Before you edit any files, run a tool, or start a new feature, you must ALWAYS run `git pull origin develop` (or `main`, depending on the target branch) to ensure you have the latest changes from the user's other devices.
2. **Commit Frequently:** Do not leave large sets of changes unstaged for long periods. Commit and push your changes to the remote branch as soon as a logical unit of work is done so the user's other devices can pull them.
3. **Never Force Push:** Never use `git push -f` or `--force-with-lease` on shared branches like `develop` or `main` unless explicitly instructed to overwrite the user's work.
