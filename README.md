# AI Inbox

Chrome/Chromium extension that tracks working and unread ChatGPT or DeepSeek conversations.

## Develop

```sh
npm install
npm run check
npm run build
```

Load `dist/` through `chrome://extensions` → **Developer mode** → **Load unpacked**.

The toolbar icon spins while any task is working, and its count includes both working and unread conversations. Completed items clear after their conversation remains in the active tab of the focused browser window for one second. State is kept in memory and resets whenever the extension service worker restarts.
