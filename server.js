const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ENGINEER_CHAT_ID = process.env.ENGINEER_CHAT_ID;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/send-report', async (req, res) => {
  try {
    if (!BOT_TOKEN || !ENGINEER_CHAT_ID) {
      return res.status(500).json({ ok: false, error: 'BOT_TOKEN ёки ENGINEER_CHAT_ID созланмаган.' });
    }
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ ok: false, error: 'Хабар бўш.' });

    const tg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ENGINEER_CHAT_ID,
        text: message
      })
    });
    const data = await tg.json();
    if (!tg.ok || !data.ok) {
      return res.status(502).json({ ok: false, error: data.description || 'Telegram API хатоси.' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`AGNKS server: http://localhost:${PORT}`));
