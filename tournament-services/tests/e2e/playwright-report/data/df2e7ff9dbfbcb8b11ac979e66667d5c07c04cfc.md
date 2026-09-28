# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: websocket-live.spec.ts >> Real-Time WebSocket & Notification Toast >> should display WebSocket connection badge in the navbar
- Location: websocket-live.spec.ts:4:7

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> C:\Users\Huy\AppData\Local\ms-playwright\webkit-2359\Playwright.exe --inspector-pipe --disable-accelerated-compositing --headless --no-startup-window
<launched> pid=43256
Call log:
  - <launching> C:\Users\Huy\AppData\Local\ms-playwright\webkit-2359\Playwright.exe --inspector-pipe --disable-accelerated-compositing --headless --no-startup-window
  - <launched> pid=43256
  - [pid=43256] <gracefully close start>
  - [pid=43256] <kill>
  - [pid=43256] <will force kill>
  - [pid=43256] taskkill stderr: ERROR: The process "43256" not found.
  - [pid=43256] <process did exit: exitCode=3236495362, signal=null>
  - [pid=43256] starting temporary directories cleanup
  - [pid=43256] finished temporary directories cleanup
  - [pid=43256] <gracefully close end>

```