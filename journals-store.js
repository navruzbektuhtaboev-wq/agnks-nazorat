// =====================================================
// ТЕХНИК ЖУРНАЛЛАР — ЁЗУВЛАРНИ САҚЛАШ
// =====================================================
//
// Ёзувлар битта JSON файлда сақланади: DATA_DIR/journal-entries.json
// Render да маълумот йўқолмаслиги учун DATA_DIR доимий дискка
// (Persistent Disk) улаган бўлиши керак.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'journal-entries.json');

// Биринчи ишга туширишда авария ва ёнғинга қарши машғулотлар жадвали
// эски Excel журналдаги 12 та мавзу билан тўлдирилади.
const DRILLS = [
  ['Авария', 'Маиший хизмат хонасида қисқа туташув натижасида ёнғин чиқиши', 'АГТКШ бошлиғи'],
  ['Ёнғин', 'Аккумулятор бункерида ёнғин', 'АГТКШ бошлиғи'],
  ['Авария', 'Газни иситувчи блокда электр туташуви', 'АГТКШ бошлиғи, энергетик'],
  ['Ёнғин', 'Газ тўлдириш колонкасида ёнғин', 'АГТКШ бошлиғи, ТХ муҳандиси'],
  ['Авария', 'Компрессор 4-босқичи ишдан чиқиб, газ чиқиши', 'АГТКШ бошлиғи'],
  ['Ёнғин', 'Бошқарув пультида ёнғин чиқиши', 'АГТКШ бошлиғи, КИП устаси'],
  ['Авария', 'Қуритиш блокида газ қувурининг ёрилиши', 'АГТКШ бошлиғи'],
  ['Ёнғин', 'Ишчилар кийиниш хонасида ёнғин', 'АГТКШ бошлиғи'],
  ['Авария', 'Газ тўлдириш колонкаси вентили беркитилмагани сабабли газ чиқиши', 'АГТКШ бошлиғи, ТХ муҳандиси'],
  ['Ёнғин', 'Ошхона қозонида ёғ ёниб кетиши', 'АГТКШ устаси'],
  ['Авария', 'Цехдаги сув қувурининг ёрилиши', 'АГТКШ бошлиғи'],
  ['Ёнғин', 'Газ тўлдириш колонкасидан ёнғин чиқиши', 'ТХ муҳандиси']
];

function seed() {
  return DRILLS.map(([tur, mavzu, mas], i) => ({
    id: 'drill-' + String(i + 1).padStart(2, '0'),
    j: 'drill', d: '', v: { tur, mavzu, mas }, at: i + 1, upd: i + 1
  }));
}

let cache = null;
let queue = Promise.resolve();

function load() {
  if (cache) return cache;

  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      cache = seed();
    } else {
      // Бузилган файлни устидан ёзиб юбормаслик учун ишни тўхтатамиз
      console.error('Journal store read error:', error.message);
      throw error;
    }
  }

  return cache;
}

// Ёзишлар навбат билан бажарилади, файл аввал вақтинчалик номга ёзилиб,
// кейин алмаштирилади — ярим ёзилган файл қолмайди.
function persist() {
  const snapshot = JSON.stringify({ entries: cache });

  queue = queue.then(async () => {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    await fs.promises.writeFile(tmp, snapshot);
    await fs.promises.rename(tmp, FILE);
  });

  return queue;
}

async function list() {
  return load().slice();
}

async function get(id) {
  return load().find(x => x.id === id) || null;
}

async function put(entry) {
  const entries = load();
  const now = Date.now();

  if (entry.id) {
    const i = entries.findIndex(x => x.id === entry.id);
    if (i === -1) return null;
    entries[i] = { ...entries[i], ...entry, upd: now };
    await persist();
    return entries[i];
  }

  const created = { ...entry, id: crypto.randomUUID(), at: now, upd: now };
  entries.push(created);
  await persist();
  return created;
}

async function remove(id) {
  const entries = load();
  const i = entries.findIndex(x => x.id === id);
  if (i === -1) return false;
  entries.splice(i, 1);
  await persist();
  return true;
}

module.exports = { list, get, put, remove, DATA_DIR };
