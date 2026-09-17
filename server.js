const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEB_APP_URL = process.env.WEB_APP_URL || '';
const ENGINEER_CHAT_ID = process.env.ENGINEER_CHAT_ID || '';
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID || '';

const MACHINISTS = [
  { id: String(process.env.JAMSHID_CHAT_ID || ''), name: 'Мадаминов Жамшидбек' },
  { id: String(process.env.MANSUR_CHAT_ID || ''), name: 'Жалолов Мансурбек' }
].filter(x => x.id);

const engineers = new Set(String(ENGINEER_CHAT_ID).split(',').map(s => s.trim()).filter(Boolean));
const sessions = new Map();
let lastMachinistMessage = '';
let lastReport = null;

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (expected.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;
  try { return JSON.parse(params.get('user') || '{}'); } catch { return null; }
}

function getUser(req) {
  const user = verifyTelegramInitData(req.body?.initData || req.headers['x-telegram-init-data'] || '');
  if (!user?.id) return null;
  return { id: String(user.id), firstName: user.first_name || '', lastName: user.last_name || '', username: user.username || '' };
}

function roleOf(id) {
  if (engineers.has(String(id))) return 'engineer';
  if (String(MANAGER_CHAT_ID) === String(id)) return 'manager';
  const m = MACHINISTS.find(x => x.id === String(id));
  if (m) return 'machinist';
  return 'unknown';
}

async function telegram(method, payload) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN созланмаган.');
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.description || 'Telegram API хатоси.');
  return data;
}

function rememberMessage(user, message) {
  lastMachinistMessage = message;
  lastReport = { userId: user.id, message, createdAt: new Date().toISOString() };
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'AGNKS NAZORAT' }));

app.post('/api/me', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ ok:false, error:'Telegram аккаунти тасдиқланмади.' });
  const role = roleOf(user.id);
  const machinist = MACHINISTS.find(x => x.id === user.id);
  res.json({ ok:true, user, role, name: machinist?.name || `${user.firstName} ${user.lastName}`.trim() });
});

app.post('/api/send-report', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user || roleOf(user.id) !== 'machinist') return res.status(403).json({ok:false,error:'Фақат машинист ҳисобот юборади.'});
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ok:false,error:'Хабар бўш.'});

    rememberMessage(user, message);
    const recipients = new Set();
    if (ENGINEER_CHAT_ID) recipients.add(String(ENGINEER_CHAT_ID));
    for (const m of MACHINISTS) if (m.id && m.id !== user.id) recipients.add(m.id);
    if (!recipients.size) return res.status(500).json({ok:false,error:'Қабул қилувчилар созланмаган.'});

    for (const chat_id of recipients) await telegram('sendMessage', { chat_id, text: message });
    res.json({ok:true, sentTo:[...recipients]});
  } catch (e) { res.status(500).json({ok:false,error:e.message}); }
});

app.post('/api/send-to-manager', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user || roleOf(user.id) !== 'engineer') return res.status(403).json({ok:false,error:'Бу бўлим фақат муҳандис учун.'});
    if (!MANAGER_CHAT_ID) return res.status(500).json({ok:false,error:'MANAGER_CHAT_ID созланмаган.'});
    const original = String(req.body?.originalMessage || '').trim();
    const note = String(req.body?.note || '').trim();
    if (!original) return res.status(400).json({ok:false,error:'Юбориладиган асосий хабар йўқ.'});
    const finalMessage = note ? `${original}\n\nҚўшимча изоҳ:\n${note}` : original;
    await telegram('sendMessage', {chat_id: MANAGER_CHAT_ID, text: finalMessage});
    res.json({ok:true});
  } catch (e) { res.status(500).json({ok:false,error:e.message}); }
});

app.get('/api/latest-machinist-message', (req, res) => {
  res.json({ok:true, message:lastMachinistMessage, report:lastReport});
});

app.post('/telegram/webhook', async (req, res) => {
  try {
    const msg = req.body?.message;
    const text = msg?.text || '';
    const chatId = msg?.chat?.id;
    if (!chatId) return res.sendStatus(200);
    if (text.startsWith('/start')) {
      if (!WEB_APP_URL) {
        await telegram('sendMessage', {chat_id:chatId, text:'Web App URL созланмаган.'});
      } else {
        await telegram('sendMessage', {
          chat_id: chatId,
          text: '📋 AGNKS назорат тизимини очинг:',
          reply_markup: { inline_keyboard: [[{ text:'📋 AGNKS назоратни очиш', web_app:{url:WEB_APP_URL} }]] }
        });
      }
    }
    res.sendStatus(200);
  } catch { res.sendStatus(200); }
});

app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`AGNKS server listening on ${PORT}`));
