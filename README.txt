AGNKS — AVTOMATIK TELEGRAM XABAR

Bu versiyada Web App ichidagi “📨 МУҲАНДИСГА АВТОМАТИК ЮБОРИШ” tugmasi server orqali Telegram botga murojaat qiladi va muhandisga xabar yuboradi.

MUHIM:
Bot tokenni index.html ichiga yozmang. Token faqat serverdagi BOT_TOKEN o'zgaruvchisida turishi kerak.

1) Node.js o'rnating.
2) Papkada terminal oching va:
   npm install
3) Muhit o'zgaruvchilarini belgilang:
   BOT_TOKEN=BotFather tokeni
   ENGINEER_CHAT_ID=muhandisning Telegram chat IDsi
4) Ishga tushiring:
   npm start
5) Brauzerda:
   http://localhost:3000

ENGINEER_CHAT_ID olishning oddiy usuli:
- Muhandis botni ochib /start yuboradi.
- Keyin backendga chat ID ni berish kerak.
- Eng to'g'ri usul: botga kelgan update ichidan message.chat.id ni olish yoki alohida /myid komandasi qo'shish.

KEYINGI QADAM:
Telegram Web App ichidan ochilganda ham ishlashi uchun BotFather Web App URL manzilini serveringizga bog'lang.

XAVFSIZLIK:
Agar bot token tasodifan ochiq joyga yuborilgan bo'lsa, BotFather orqali tokenni yangilang.
