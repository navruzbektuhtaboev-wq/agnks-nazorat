AGNKS NAZORAT — Telegram Web App MVP

1) Render Environment Variables:
BOT_TOKEN
ENGINEER_CHAT_ID
MANAGER_CHAT_ID
JAMSHID_CHAT_ID
MANSUR_CHAT_ID
WEB_APP_URL=https://agnks-nazorat.onrender.com

2) Deploy from GitHub to Render.
Start command: npm start

3) After deployment set Telegram webhook:
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://agnks-nazorat.onrender.com/telegram/webhook
Do not publish BOT_TOKEN.

4) Each machinist uses their own Telegram account. Their Telegram IDs are mapped by environment variables; no name-selection dropdown is used.

5) Reports are sent to engineer + the other machinist.
6) Engineer can forward the latest machinist message to manager unchanged, with an optional note appended at the bottom.

7) Техник журналлар: /journals.html (ботда "📒 Техник журналлар" тугмаси).
   Машинист ва муҳандис ёзади, раҳбар фақат кўради. Excel/PDF файл фойдаланувчининг
   Telegram чатига бот орқали юборилади.
   Ёзувлар DATA_DIR/journal-entries.json файлида сақланади (DATA_DIR берилмаса ./data).
   Render бепул тарифида диск доимий эмас: қайта ишга тушганда ёзувлар ўчади.
   Доимий сақлаш учун Render Persistent Disk улаб, DATA_DIR ни шу дискка йўналтиринг.

Note: Google Sheets archiving and scheduled 08:00/12:00/17:00 reminders are the next backend module; this MVP keeps the core Telegram workflow ready first.
