const express = require('express');
const crypto = require('crypto');
const path = require('path');

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

app.use(express.json({ limit: '200kb' }));
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
