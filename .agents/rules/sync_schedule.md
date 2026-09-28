---
name: Sync Schedule
description: Applies whenever you start a new conversation or session.
---
# Continuous Sync Schedule

The user is actively working on another device. To prevent Git conflicts and ensure you are always working with the latest code, you MUST set up background sync schedules whenever you start a new conversation.

Immediately use your `schedule` tool to create the following two cron jobs:

1. **Daytime Sync (Every 15 minutes, 8 AM to 7 PM)**
   - `CronExpression`: `*/15 8-19 * * *`
   - `Prompt`: "Daytime Sync: Please run `git fetch origin && git pull origin develop` to grab the user's latest changes."

2. **Nighttime Sync (Every 1 hour, 8 PM to 7 AM)**
   - `CronExpression`: `0 20-23,0-7 * * *`
   - `Prompt`: "Nighttime Sync: Please run `git fetch origin && git pull origin develop` to grab the user's latest changes."
