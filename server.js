const express = require('express');
const crypto = require('crypto');
const path = require('path');
const journals = require('./journals-store');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEB_APP_URL = process.env.WEB_APP_URL || '';

const ENGINEER_CHAT_ID = process.env.ENGINEER_CHAT_ID || '';
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID || '';

const JAMSHID_CHAT_ID = process.env.JAMSHID_CHAT_ID || '';
const MANSUR_CHAT_ID = process.env.MANSUR_CHAT_ID || '';

const MACHINISTS = [
  {
    id: String(JAMSHID_CHAT_ID).trim(),
    name: 'Мадаминов Жамшидбек'
  },
  {
    id: String(MANSUR_CHAT_ID).trim(),
    name: 'Жалолов Мансурбек'
  }
].filter(x => x.id);

let latestMachinistMessage = null;

// Файл юбориш (PDF/Excel) каттароқ бўлгани учун алоҳида чегара билан ўқилади
const smallJson = express.json({ limit: '200kb' });
app.use((req, res, next) =>
  req.path === '/api/journals/send-file' ? next() : smallJson(req, res, next)
);
app.use(express.static(path.join(__dirname, 'public')));


// =====================================================
// TELEGRAM WEB APP INITDATA ТЕКШИРИШ
// =====================================================

function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) return null;

    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash.length !== hash.length) return null;

    if (
      !crypto.timingSafeEqual(
        Buffer.from(calculatedHash),
        Buffer.from(hash)
      )
    ) {
      return null;
    }

    const authDate = Number(params.get('auth_date') || 0);

    // 24 соатдан эски initData қабул қилинмайди
    if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) {
      return null;
    }

    const user = JSON.parse(params.get('user') || '{}');

    return user;

  } catch (error) {
    console.error('InitData verification error:', error.message);
    return null;
  }
}


// =====================================================
// ФОЙДАЛАНУВЧИНИ АНИҚЛАШ
// =====================================================

function getUserFromRequest(req) {
  const initData = String(req.body?.initData || '');
  const user = verifyTelegramInitData(initData);

  if (!user?.id) return null;

  const telegramId = String(user.id);

  if (telegramId === String(ENGINEER_CHAT_ID).trim()) {
    return {
      id: telegramId,
      name: user.first_name || 'Муҳандис',
      role: 'engineer'
    };
  }

  if (telegramId === String(MANAGER_CHAT_ID).trim()) {
    return {
      id: telegramId,
      name: user.first_name || 'Раҳбар',
      role: 'manager'
    };
  }

  const machinist = MACHINISTS.find(x => x.id === telegramId);

  if (machinist) {
    return {
      id: telegramId,
      name: machinist.name,
      role: 'machinist'
    };
  }

  return {
    id: telegramId,
    name: user.first_name || 'Номаълум',
    role: 'unknown'
  };
}


// =====================================================
// TELEGRAM ХАБАР ЮБОРИШ
// =====================================================

async function sendTelegramMessage(chatId, text, extra = {}) {
  if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN созланмаган.');
  }

  if (!chatId) {
    throw new Error('Telegram chat_id мавжуд эмас.');
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        ...extra
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.description || 'Telegram API хатоси.');
  }

  return data;
}


// =====================================================
// /START — TELEGRAM БОТ
// =====================================================

app.post('/telegram/webhook', async (req, res) => {
  try {
    const update = req.body || {};
    const message = update.message;

    if (!message?.chat?.id) {
      return res.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = String(message.text || '').trim();

    if (text === '/start' || text.startsWith('/start ')) {

      await sendTelegramMessage(
        chatId,
        '👋 AGNKS NAZORAT тизимига хуш келибсиз.\n\n' +
        'Техник назоратни очиш учун қуйидаги тугмани босинг.',
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📋 AGNKS назоратни очиш',
                  web_app: {
                    url: WEB_APP_URL
                  }
                }
              ],
              [
                {
                  text: '📒 Техник журналлар',
                  web_app: {
                    url: `${WEB_APP_URL.replace(/\/$/, '')}/journals.html`
                  }
                }
              ]
            ]
          }
        }
      );

      return res.json({ ok: true });
    }

    // Telegram ID ни аниқлаш учун
    if (text === '/id') {
      await sendTelegramMessage(
        chatId,
        `🆔 Сизнинг Telegram ID рақамингиз:\n\n${chatId}`
      );

      return res.json({ ok: true });
    }

    return res.json({ ok: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.json({ ok: true });
  }
});


// =====================================================
// WEB APP — КИМ КИРГАНИНИ АНИҚЛАШ
// =====================================================

app.post('/api/me', (req, res) => {
  const user = getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({
      ok: false,
      error: 'Telegram маълумотлари тасдиқланмади.'
    });
  }

  if (user.role === 'unknown') {
    return res.status(403).json({
      ok: false,
      error: 'Сиз AGNKS NAZORAT тизимига рўйхатдан ўтмагансиз.',
      telegramId: user.id
    });
  }

  return res.json({
    ok: true,
    me: user
  });
});


// =====================================================
// МАШИНИСТ ҲИСОБОТИ
// =====================================================

app.post('/api/send-report', async (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: 'Telegram маълумотлари тасдиқланмади.'
      });
    }

    if (user.role !== 'machinist') {
      return res.status(403).json({
        ok: false,
        error: 'Фақат машинист ҳисобот юбориши мумкин.'
      });
    }

    const message = String(req.body?.message || '').trim();

    if (!message) {
      return res.status(400).json({
        ok: false,
        error: 'Ҳисобот бўш.'
      });
    }

    // Охирги машинист хабарини сақлаймиз
    latestMachinistMessage = {
      text: message,
      senderId: user.id,
      senderName: user.name,
      createdAt: new Date().toISOString()
    };

    const recipients = new Set();

    // Муҳандисга
    if (ENGINEER_CHAT_ID) {
      recipients.add(String(ENGINEER_CHAT_ID).trim());
    }

    // Иккинчи машинистга
    for (const machinist of MACHINISTS) {
      if (
        machinist.id &&
        machinist.id !== user.id
      ) {
        recipients.add(machinist.id);
      }
    }

    const results = [];

    for (const chatId of recipients) {
      try {
        await sendTelegramMessage(chatId, message);
        results.push({
          chatId,
          ok: true
        });
      } catch (error) {
        console.error(
          `Message send error ${chatId}:`,
          error.message
        );

        results.push({
          chatId,
          ok: false,
          error: error.message
        });
      }
    }

    return res.json({
      ok: true,
      sender: user.name,
      results
    });

  } catch (error) {
    console.error('Send report error:', error.message);

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});


// =====================================================
// МУҲАНДИС — ОХИРГИ МАШИНИСТ ХАБАРИ
// =====================================================

app.post('/api/latest-machinist-message', (req, res) => {
  const user = getUserFromRequest(req);

  if (!user) {
    return res.status(401).json({
      ok: false,
      error: 'Telegram маълумотлари тасдиқланмади.'
    });
  }

  if (user.role !== 'engineer') {
    return res.status(403).json({
      ok: false,
      error: 'Фақат муҳандис бу маълумотни кўриши мумкин.'
    });
  }

  return res.json({
    ok: true,
    message: latestMachinistMessage
  });
});


// =====================================================
// МУҲАНДИС → РАҲБАР
// =====================================================

app.post('/api/send-to-manager', async (req, res) => {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: 'Telegram маълумотлари тасдиқланмади.'
      });
    }

    if (user.role !== 'engineer') {
      return res.status(403).json({
        ok: false,
        error: 'Фақат муҳандис раҳбарга хабар юбориши мумкин.'
      });
    }

    if (!latestMachinistMessage?.text) {
      return res.status(400).json({
        ok: false,
        error: 'Машинист хабари мавжуд эмас.'
      });
    }

    if (!MANAGER_CHAT_ID) {
      return res.status(500).json({
        ok: false,
        error: 'MANAGER_CHAT_ID созланмаган.'
      });
    }

    // Фақат қўшимча изоҳ оламиз.
    // Машинистнинг асл хабари клиентдан қабул қилинмайди.
    const note = String(req.body?.note || '').trim();

    let finalMessage = latestMachinistMessage.text;

    if (note) {
      finalMessage += `\n\nМуҳандис қўшимча изоҳи:\n${note}`;
    }

    await sendTelegramMessage(
      MANAGER_CHAT_ID,
      finalMessage
    );

    return res.json({
      ok: true
    });

  } catch (error) {
    console.error(
      'Send manager error:',
      error.message
    );

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});


// =====================================================
// ТЕХНИК ЖУРНАЛЛАР
// =====================================================

const JOURNAL_IDS = new Set([
  '16d', '10', '15', 'chiller', 'drill', 'produvka', 'quritish', '21', '3b'
]);

const WRITER_ROLES = new Set(['machinist', 'engineer']);

function journalUser(req, res) {
  const user = getUserFromRequest(req);

  if (!user) {
    res.status(401).json({ ok: false, error: 'Telegram маълумотлари тасдиқланмади.' });
    return null;
  }

  if (user.role === 'unknown') {
    res.status(403).json({
      ok: false,
      error: 'Сиз AGNKS NAZORAT тизимига рўйхатдан ўтмагансиз.',
      telegramId: user.id
    });
    return null;
  }

  return user;
}

// Мижоздан келган ёзувни текшириш: фақат маълум журнал,
// қисқа матнлар ва продувка соатлари рўйхати.
function cleanEntry(body) {
  const j = String(body?.j || '');
  if (!JOURNAL_IDS.has(j)) return null;

  const d = String(body?.d || '');
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;

  const raw = body?.v;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const v = {};
  const keys = Object.keys(raw);
  if (keys.length > 40) return null;

  for (const k of keys) {
    if (!/^[a-zA-Z0-9]{1,20}$/.test(k)) return null;
    const val = raw[k];

    if (Array.isArray(val)) {
      const hours = val.map(Number).filter(h => Number.isInteger(h) && h >= 1 && h <= 24);
      v[k] = [...new Set(hours)].slice(0, 24);
    } else if (typeof val === 'string' || typeof val === 'number') {
      const text = String(val).trim().slice(0, 2000);
      if (text) v[k] = text;
    }
  }

  return { j, d, v };
}

app.post('/api/journals/entries', async (req, res) => {
  const user = journalUser(req, res);
  if (!user) return;

  try {
    return res.json({
      ok: true,
      me: user,
      canWrite: WRITER_ROLES.has(user.role),
      staff: MACHINISTS.map(x => x.name),
      entries: await journals.list()
    });
  } catch (error) {
    console.error('Journal list error:', error.message);
    return res.status(500).json({ ok: false, error: 'Журнал ёзувлари ўқилмади.' });
  }
});

app.post('/api/journals/save', async (req, res) => {
  const user = journalUser(req, res);
  if (!user) return;

  if (!WRITER_ROLES.has(user.role)) {
    return res.status(403).json({ ok: false, error: 'Сизда журналга ёзиш ҳуқуқи йўқ.' });
  }

  const entry = cleanEntry(req.body?.entry);
  if (!entry) {
    return res.status(400).json({ ok: false, error: 'Ёзув нотўғри тўлдирилган.' });
  }

  try {
    const id = String(req.body?.entry?.id || '');
    let saved;

    if (id) {
      const old = await journals.get(id);
      if (!old) return res.status(404).json({ ok: false, error: 'Ёзув топилмади.' });
      if (old.j !== entry.j) return res.status(400).json({ ok: false, error: 'Ёзув бошқа журналга тегишли.' });
      saved = await journals.put({ ...entry, id, editedBy: user.id, editedByName: user.name });
    } else {
      saved = await journals.put({ ...entry, by: user.id, byName: user.name });
    }

    return res.json({ ok: true, entry: saved });
  } catch (error) {
    console.error('Journal save error:', error.message);
    return res.status(500).json({ ok: false, error: 'Ёзув сақланмади.' });
  }
});

app.post('/api/journals/delete', async (req, res) => {
  const user = journalUser(req, res);
  if (!user) return;

  try {
    const id = String(req.body?.id || '');
    const old = await journals.get(id);
    if (!old) return res.status(404).json({ ok: false, error: 'Ёзув топилмади.' });

    // Ёзувни муҳандис ёки уни киритган машинист ўчира олади
    if (user.role !== 'engineer' && old.by !== user.id) {
      return res.status(403).json({ ok: false, error: 'Бу ёзувни фақат муҳандис ёки уни киритган ходим ўчира олади.' });
    }

    await journals.remove(id);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Journal delete error:', error.message);
    return res.status(500).json({ ok: false, error: 'Ёзув ўчирилмади.' });
  }
});

// Telegram ичида файл юклаб олиш ишламайди, шунинг учун тайёр PDF/Excel
// фойдаланувчининг ўзига бот орқали юборилади.
const FILE_TYPES = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

app.post('/api/journals/send-file', express.json({ limit: '8mb' }), async (req, res) => {
  const user = journalUser(req, res);
  if (!user) return;

  try {
    const filename = String(req.body?.filename || '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .slice(0, 120);
    const ext = filename.split('.').pop().toLowerCase();

    if (!FILE_TYPES[ext]) {
      return res.status(400).json({ ok: false, error: 'Фақат PDF ёки Excel файл юбориш мумкин.' });
    }

    const bytes = Buffer.from(String(req.body?.data || ''), 'base64');
    if (!bytes.length || bytes.length > 6 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: 'Файл бўш ёки жуда катта.' });
    }

    const form = new FormData();
    form.append('chat_id', user.id);
    form.append('document', new Blob([bytes], { type: FILE_TYPES[ext] }), filename);

    const caption = String(req.body?.caption || '').slice(0, 900);
    if (caption) form.append('caption', caption);

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
      { method: 'POST', body: form }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || 'Telegram API хатоси.');
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Journal send-file error:', error.message);
    return res.status(500).json({ ok: false, error: 'Файл Telegram га юборилмади.' });
  }
});


// =====================================================
// БОТНИ ҚЎЛДА ИШГА ТУШИРИШ
// =====================================================

app.post('/api/start-bot', async (req, res) => {
  try {
    if (!BOT_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: 'BOT_TOKEN созланмаган.'
      });
    }

    return res.json({
      ok: true,
      message: 'Бот тайёр.'
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});


// =====================================================
// WEBHOOK АВТОМАТИК СОЗИШ
// =====================================================

async function setupWebhook() {
  if (!BOT_TOKEN || !WEB_APP_URL) {
    console.log(
      'Webhook skipped: BOT_TOKEN ёки WEB_APP_URL йўқ.'
    );
    return;
  }

  try {
    const webhookUrl =
      `${WEB_APP_URL.replace(/\/$/, '')}/telegram/webhook`;

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: webhookUrl
        })
      }
    );

    const data = await response.json();

    console.log(
      'Telegram webhook:',
      data.ok ? 'CONNECTED' : data.description
    );

  } catch (error) {
    console.error(
      'Webhook setup error:',
      error.message
    );
  }
}


// =====================================================
// САЙТ
// =====================================================

app.use((req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});


// =====================================================
// SERVER
// =====================================================

app.listen(PORT, async () => {
  console.log(`AGNKS server started on port ${PORT}`);

  await setupWebhook();
});
