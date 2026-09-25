/**
 * Telegram Exchange Bot — Cloudflare Workers Port
 * KV namespace: BOT_KVS (bind in wrangler.toml)
 * All persistent state lives in KV under typed key prefixes:
 *   user:<id>          → { lang, phone, full_name }
 *   currencies         → { currencies: [...] }
 *   wallets            → { wallets: { <id>: address } }
 *   spreads            → { spreads: { <id>: { give, take } } }
 *   orders             → { orders: [...] }
 *   config             → { button_styles: { <key>: style } }
 *   rateCache:usd_uzs  → { rate, updated_at }
 *   rateCache:<coinId> → { usd, updated_at }
 */

// =========================================================
// ============ CONSTANTS ==================================
// =========================================================

const SOM_CURRENCY_ID = "som_uzs";
const SOM_CURRENCY_NAME = "SO'M";
const RATES_CACHE_TTL = 300_000; // 5 min in ms

const BUTTON_KEYS = ["exchange", "support", "rate", "settings"];
const INLINE_BUTTON_KEYS = ["lang_latin", "lang_cyrillic", "home", "stg_lang", "stg_name", "stg_phone"];

const BUTTON_ADMIN_LABELS = {
  exchange: "💱 Valyuta ayirboshlash",
  rate: "📊 Kurs",
  settings: "⚙️ Sozlamalar",
  support: "☎️ Aloqa",
};
const INLINE_BUTTON_ADMIN_LABELS = {
  lang_latin: "🇺🇿 Oʻzbekcha (til tanlash)",
  lang_cyrillic: "🇺🇿 Кириллча (til tanlash)",
  home: "🏠 Bosh menyu",
  stg_lang: "🌐 Tilni o'zgartirish (Sozlamalar)",
  stg_name: "👤 Ismni o'zgartirish (Sozlamalar)",
  stg_phone: "📞 Telefonni o'zgartirish (Sozlamalar)",
};

const STYLE_OPTIONS = [
  ["default", "⚪ Standart"],
  ["primary", "🔵 Ko'k (Primary)"],
  ["success", "🟢 Yashil (Success)"],
  ["danger", "🔴 Qizil (Danger)"],
];
const STYLE_LABELS = Object.fromEntries(STYLE_OPTIONS);

const COINGECKO_IDS = {
  btc: "bitcoin", bitcoin: "bitcoin",
  eth: "ethereum", ethereum: "ethereum",
  usdt: "tether", tether: "tether",
  usdc: "usd-coin",
  trx: "tron", tron: "tron",
  bnb: "binancecoin", binancecoin: "binancecoin",
  sol: "solana", solana: "solana",
  ton: "the-open-network", toncoin: "the-open-network", gram: "the-open-network",
  doge: "dogecoin", dogecoin: "dogecoin",
  ltc: "litecoin", litecoin: "litecoin",
  matic: "matic-network", polygon: "matic-network",
  ada: "cardano", cardano: "cardano",
  xrp: "ripple", ripple: "ripple",
  dash: "dash", zec: "zcash",
  bch: "bitcoin-cash", etc: "ethereum-classic",
  sui: "sui", apt: "aptos",
};

// =========================================================
// ============ TEXTS ======================================
// =========================================================

const TEXTS = {
  uz_latin: {
    ask_phone: "Xush kelibsiz! Botdan foydalanishni boshlash uchun telefon raqamingizni yuboring:",
    phone_btn: "📱 Telefon raqamni yuborish",
    phone_received: "Raqamingiz qabul qilindi. Iltimos, ism va familiyangizni kiriting:",
    name_received: "✅ Rahmat! Quyidagi menyudan foydalaning:",
    menu: {
      exchange: "💱 Valyuta ayirboshlash",
      rate: "📊 Kurs",
      settings: "⚙️ Sozlamalar",
      support: "☎️ Aloqa",
    },
    exchange_header: "🔀 Almashuv: qaysi tomondan boshlaysiz (🔷 bering / 🔶 oling):",
    exchange_empty: "Hozircha valyutalar qo'shilmagan. Admin tez orada qo'shadi.",
    exchange_selected: "✅ Tanlandi: {name}",
    exchange_step2_header: "✅ 1-valyutani tanladingiz. Endi 2-valyutani (🔶) tanlang:",
    exchange_disabled_pair: "❌ Bu juftlik mos emas (Fiat↔Fiat yoki Kripto↔Kripto ishlamaydi)",
    exchange_summary: "📝 Sizning almashuv:\n\n⬆️: {give_name}\n⬇️: {take_name}\n🕐 Sana: {date}\n\n✍️ Endi miqdorni kiriting ({give_name}):",
    exchange_amount_invalid: "❌ Noto'g'ri qiymat. Faqat raqam kiriting (masalan: 150000).",
    exchange_amount_too_small: "❌ Miqdor juda kichik. Minimal: {min}",
    exchange_amount_too_big: "❌ Miqdor juda katta. Maksimal: {max}",
    ask_give_address_fiat: "💳 Siz to'lov qilmoqchi bo'lgan karta raqamingizni kiriting:\n\nMisol: (9860123456789123)",
    ask_give_address_crypto: "💳 Siz to'lov qilmoqchi bo'lgan {name} manzilingizni kiriting:\n\nMisol: (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t)",
    ask_take_address_fiat: "📥 Siz olmoqchi bo'lgan karta raqamingizni kiriting:\n\nMisol: (9860123456789123)",
    ask_take_address_crypto: "📥 Siz olmoqchi bo'lgan {name} manzilingizni kiriting:\n\nMisol: (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t)",
    address_empty: "❌ Bo'sh qiymat kiritib bo'lmaydi. Iltimos, qaytadan kiriting:",
    order_final: "📝 Sizning almashuv:\n\n🔀: {give_name} ➡️ {take_name}\n⬆️ Berish: {give_amount} {give_name}\n⬇️ Olish: {take_amount} {take_name}\n\n💳 {give_name}: {give_address}\n💳 {take_name}: {take_address}\n\n👉 To'lovga o'tish uchun «✅ To'lovga o'tish» tugmasini bosing.",
    order_pay_btn: "✅ To'lovga o'tish",
    order_cancel_btn: "❌ Bekor qilish",
    payment_info: "Almashuv muvaffaqiyatli amalga oshishi uchun quyidagi bosqichlarni bajaring:\n\n1️⃣ Istalgan toʻlov ilovasini oching.\n\n2️⃣ {wallet_label} kiriting: {wallet}\n\n3️⃣ Summani kiriting va oʻtkazing: {amount} {give_name}\n\n4️⃣ «📥 Chekni yuborish» tugmasini bosib, toʻlov oʻtkazilganligi haqidagi screenshotingizni yuboring.\n\n🧑‍💻Operator toʻlovni 2-30 daqiqada tekshiradi.",
    wallet_not_set: "❌ Bu valyuta uchun to'lov ma'lumotlari hali kiritilmagan.\n\nIltimos, keyinroq qayta urinib ko'ring yoki operator bilan bog'laning.",
    price_not_available: "❌ Hozircha bu valyuta uchun kurs mavjud emas.\n\nIltimos, keyinroq qayta urinib ko'ring.",
    payment_receipt_btn: "📥 Chekni yuborish",
    ask_receipt_photo: "📸 Chekni rasmga olib yuboring.\nFaqat rasmlar qabul qilinadi!",
    only_photo_accepted: "❌ Faqat rasmlar qabul qilinadi. Iltimos, chekni rasmga olib yuboring:",
    receipt_received: "✅ Chek qabul qilindi va bazada saqlandi.\n\n{give_name}: {give_address}\nMiqdor: {give_amount} {give_name}\n\n{take_name}: {take_address}\nMiqdor: {take_amount} {take_name}\n\n{status_line}\n\n📅 O'tkazma vaqti: {time}\n\n🙂 Hurmat bilan: {bot_username}\n\nℹ️ Bosh menyuga qaytish uchun /start ni bosing.",
    status_pending: "📌 Chek yuborildi, tekshirish kerak.",
    status_accepted: "✅ Admin tomonidan tasdiqlandi.",
    status_rejected: "❌ Arizangiz rad etildi.",
    order_cancelled: "❌ Ariza bekor qilindi.",
    support_prompt: "✍️ Xabaringizni yozing, u to'g'ridan-to'g'ri operatorga yuboriladi:",
    support_sent: "✅ Xabaringiz yuborildi! Tez orada javob beramiz.",
    support_admin_reply_prefix: "💬 Operator javobi:\n\n",
    rate_sell_header: "📉 Sotish kursi",
    rate_buy_header: "📈 Sotib olish kursi",
    rate_currency_unit: "so'm",
    rate_empty: "Hozircha valyutalar qo'shilmagan.",
    rate_not_set: "belgilanmagan",
    settings_header: "⚙️ Sozlamalar\n\n👤 Ism: {name}\n🌐 Til: {lang_label}\n📞 Telefon: {phone}\n\nO'zgartirmoqchi bo'lganingizni tanlang 👇",
    settings_change_lang: "🌐 Tilni o'zgartirish",
    settings_change_name: "👤 Ismni o'zgartirish",
    settings_change_phone: "📞 Telefonni o'zgartirish",
    settings_choose_new_lang: "🌐 Yangi tilni tanlang:",
    settings_lang_changed: "✅ Til o'zgartirildi!",
    settings_ask_new_name: "✍️ Yangi ism-familiyangizni kiriting:",
    settings_name_changed: "✅ Ism yangilandi!",
    settings_ask_new_phone: "📞 Yangi telefon raqamingizni yuboring:",
    settings_phone_changed: "✅ Telefon raqam yangilandi!",
    spread_header: "💰 Spread (bozor narxi)\n\nQaysi valyuta uchun spread kiritmoqchisiz?",
    spread_ask_give: "🪙 {name} uchun BERISH spreadini kiriting:\n\nBu qiymat bozor narxiga QO'SHILADI (user qimmatroq oladi).\n\nMisol: 400",
    spread_ask_take: "🪙 {name} uchun OLISH spreadini kiriting:\n\nBu qiymat bozor narxidan AYIRILADI (user arzonroq sotadi).\n\nMisol: 400",
    spread_saved: "✅ {name} uchun spread saqlandi:\n\nBerish: +{give} SO'M\nOlish: -{take} SO'M",
    spread_invalid: "❌ Noto'g'ri qiymat. Faqat raqam kiriting.",
  },
  uz_cyrillic: {
    ask_phone: "Хуш келибсиз! Ботдан фойдаланишни бошлаш учун телефон рақамингизни юборинг:",
    phone_btn: "📱 Телефон рақамни юбориш",
    phone_received: "Рақамингиз қабул қилинди. Илтимос, исм ва фамилиянгизни киритинг:",
    name_received: "✅ Раҳмат! Қуйидаги менюдан фойдаланинг:",
    menu: {
      exchange: "💱 Валюта айирбошлаш",
      rate: "📊 Курс",
      settings: "⚙️ Созламалар",
      support: "☎️ Алоқа",
    },
    exchange_header: "🔀 Алмашув: қайси томондан бошлайсиз (🔷 беринг / 🔶 олинг):",
    exchange_empty: "Ҳозирча валюталар қўшилмаган. Админ тез орада қўшади.",
    exchange_selected: "✅ Танланди: {name}",
    exchange_step2_header: "✅ 1-валютани танладингиз. Энди 2-валютани (🔶) танланг:",
    exchange_disabled_pair: "❌ Бу жуфтлик мос эмас (Fiat↔Fiat ёки Крипто↔Крипто ишламайди)",
    exchange_summary: "📝 Сизнинг алмашув:\n\n⬆️: {give_name}\n⬇️: {take_name}\n🕐 Сана: {date}\n\n✍️ Энди миқдорни киритинг ({give_name}):",
    exchange_amount_invalid: "❌ Нотўғри қиймат. Фақат рақам киритинг (масалан: 150000).",
    exchange_amount_too_small: "❌ Миқдор жуда кичик. Минимал: {min}",
    exchange_amount_too_big: "❌ Миқдор жуда катта. Максимал: {max}",
    ask_give_address_fiat: "💳 Сиз тўлов қилмоқчи бўлган карта рақамингизни киритинг:\n\nМисол: (9860123456789123)",
    ask_give_address_crypto: "💳 Сиз тўлов қилмоқчи бўлган {name} манзилингизни киритинг:\n\nМисол: (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t)",
    ask_take_address_fiat: "📥 Сиз олмоқчи бўлган карта рақамингизни киритинг:\n\nМисол: (9860123456789123)",
    ask_take_address_crypto: "📥 Сиз олмоқчи бўлган {name} манзилингизни киритинг:\n\nМисол: (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t)",
    address_empty: "❌ Бўш қиймат киритиб бўлмайди. Илтимос, қайтадан киритинг:",
    order_final: "📝 Сизнинг алмашув:\n\n🔀: {give_name} ➡️ {take_name}\n⬆️ Бериш: {give_amount} {give_name}\n⬇️ Олиш: {take_amount} {take_name}\n\n💳 {give_name}: {give_address}\n💳 {take_name}: {take_address}\n\n👉 Тўловга ўтиш учун «✅ Тўловга ўтиш» тугмасини босинг.",
    order_pay_btn: "✅ Тўловга ўтиш",
    order_cancel_btn: "❌ Бекор қилиш",
    payment_info: "Алмашув муваффақиятли амалга ошиши учун қуйидаги босқичларни бажаринг:\n\n1️⃣ Исталган тўлов иловасини очинг.\n\n2️⃣ {wallet_label} киритинг: {wallet}\n\n3️⃣ Суммани киритинг ва ўтказинг: {amount} {give_name}\n\n4️⃣ «📥 Чекни юбориш» тугмасини босиб, тўлов ўтказилганлиги ҳақидаги скриншотингизни юборинг.\n\n🧑‍💻Оператор тўловни 2-30 дақиқада текширади.",
    wallet_not_set: "❌ Бу валюта учун тўлов маълумотлари ҳали киритилмаган.\n\nИлтимос, кейинроқ қайта уриниб кўринг ёки оператор билан боғланинг.",
    price_not_available: "❌ Ҳозирча бу валюта учун курс мавжуд эмас.\n\nИлтимос, кейинроқ қайта уриниб кўринг.",
    payment_receipt_btn: "📥 Чекни юбориш",
    ask_receipt_photo: "📸 Чекни расмга олиб юборинг.\nФақат расмлар қабул қилинади!",
    only_photo_accepted: "❌ Фақат расмлар қабул қилинади. Илтимос, чекни расмга олиб юборинг:",
    receipt_received: "✅ Чек қабул қилинди ва базада сақланди.\n\n{give_name}: {give_address}\nМиқдор: {give_amount} {give_name}\n\n{take_name}: {take_address}\nМиқдор: {take_amount} {take_name}\n\n{status_line}\n\n📅 Ўтказма вақти: {time}\n\n🙂 Ҳурмат билан: {bot_username}\n\nℹ️ Бош менюга қайтиш учун /start ни босинг.",
    status_pending: "📌 Чек юборилди, текшириш керак.",
    status_accepted: "✅ Админ томонидан тасдиқланди.",
    status_rejected: "❌ Аризангиз рад этилди.",
    order_cancelled: "❌ Ариза бекор қилинди.",
    support_prompt: "✍️ Хабарингизни ёзинг, у тўғридан-тўғри операторга юборилади:",
    support_sent: "✅ Хабарингиз юборилди! Тез орада жавоб берамиз.",
    support_admin_reply_prefix: "💬 Оператор жавоби:\n\n",
    rate_sell_header: "📉 Сотиш курси",
    rate_buy_header: "📈 Сотиб олиш курси",
    rate_currency_unit: "сўм",
    rate_empty: "Ҳозирча валюталар қўшилмаган.",
    rate_not_set: "белгиланмаган",
    settings_header: "⚙️ Созламалар\n\n👤 Исм: {name}\n🌐 Тил: {lang_label}\n📞 Телефон: {phone}\n\nЎзгартирмоқчи бўлганингизни танланг 👇",
    settings_change_lang: "🌐 Тилни ўзгартириш",
    settings_change_name: "👤 Исмни ўзгартириш",
    settings_change_phone: "📞 Телефонни ўзгартириш",
    settings_choose_new_lang: "🌐 Янги тилни танланг:",
    settings_lang_changed: "✅ Тил ўзгартирилди!",
    settings_ask_new_name: "✍️ Янги исм-фамилиянгизни киритинг:",
    settings_name_changed: "✅ Исм янгиланди!",
    settings_ask_new_phone: "📞 Янги телефон рақамингизни юборинг:",
    settings_phone_changed: "✅ Телефон рақам янгиланди!",
    spread_header: "💰 Спред (бозор нархи)\n\nҚайси валюта учун спред киритмоқчисиз?",
    spread_ask_give: "🪙 {name} учун БЕРИШ спрединги киритинг:\n\nБу қиймат бозор нархига ҚЎШИЛАДИ (user қимматроқ олади).\n\nМисол: 400",
    spread_ask_take: "🪙 {name} учун ОЛИШ спрединги киритинг:\n\nБу қиймат бозор нархидан АЙИРИЛАДИ (user арзонроқ сотади).\n\nМисол: 400",
    spread_saved: "✅ {name} учун спред сақланди:\n\nБериш: +{give} СЎМ\nОлиш: -{take} СЎМ",
    spread_invalid: "❌ Нотўғри қиймат. Фақат рақам киритинг.",
  },
};

// =========================================================
// ============ KV HELPERS =================================
// =========================================================

async function kvGet(kv, key) {
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function kvPut(kv, key, value) {
  try {
    await kv.put(key, JSON.stringify(value));
  } catch (e) {
    console.error(`KV put failed [${key}]:`, e);
  }
}

// =========================================================
// ============ USER STATE (per-request, in-memory) ========
// =========================================================
// Cloudflare Workers are stateless per request.
// Per-user conversational state (awaiting_*, exch_pair, etc.)
// must persist across requests — store it in KV under state:<userId>.

async function getUserState(kv, userId) {
  return (await kvGet(kv, `state:${userId}`)) || {};
}

async function saveUserState(kv, userId, state) {
  await kvPut(kv, `state:${userId}`, state);
}

async function patchUserState(kv, userId, patch) {
  const current = await getUserState(kv, userId);
  const updated = { ...current, ...patch };
  await kvPut(kv, `state:${userId}`, updated);
}

// =========================================================
// ============ CONFIG =====================================
// =========================================================

async function loadConfig(kv) {
  return (await kvGet(kv, "config")) || { button_styles: {} };
}

async function getButtonStyle(kv, key) {
  const config = await loadConfig(kv);
  return (config.button_styles || {})[key] || "default";
}

async function setButtonStyle(kv, key, style) {
  const config = await loadConfig(kv);
  if (!config.button_styles) config.button_styles = {};
  config.button_styles[key] = style;
  await kvPut(kv, "config", config);
}

// =========================================================
// ============ USERS ======================================
// =========================================================

async function getUser(kv, userId) {
  return await kvGet(kv, `user:${userId}`);
}

async function saveUser(kv, userId, lang, phone, full_name) {
  await kvPut(kv, `user:${userId}`, { lang, phone, full_name });
}

// =========================================================
// ============ CURRENCIES =================================
// =========================================================

async function loadCurrencies(kv) {
  const data = await kvGet(kv, "currencies");
  return data ? data.currencies || [] : [];
}

async function saveCurrencies(kv, currencies) {
  await kvPut(kv, "currencies", { currencies });
}

async function ensureSomCurrency(kv) {
  const currencies = await loadCurrencies(kv);
  const som = currencies.find((c) => c.id === SOM_CURRENCY_ID);
  if (!som) {
    currencies.unshift({
      id: SOM_CURRENCY_ID,
      name: SOM_CURRENCY_NAME,
      category: "fiat",
      min_amount: 0,
      max_amount: 0,
      give_style: "default",
      take_style: "default",
      is_system: true,
    });
    await saveCurrencies(kv, currencies);
  }
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

async function addCurrency(kv, name, category = "crypto", min_amount = 0, max_amount = 0) {
  const currencies = await loadCurrencies(kv);
  const entry = {
    id: genId(),
    name,
    category,
    min_amount,
    max_amount,
    give_style: "default",
    take_style: "default",
    is_system: false,
  };
  currencies.push(entry);
  await saveCurrencies(kv, currencies);
  return entry;
}

async function removeCurrency(kv, currencyId) {
  if (currencyId === SOM_CURRENCY_ID) return false;
  const currencies = await loadCurrencies(kv);
  const next = currencies.filter((c) => c.id !== currencyId);
  if (next.length === currencies.length) return false;
  await saveCurrencies(kv, next);
  return true;
}

async function setCurrencyStyle(kv, currencyId, side, style) {
  const currencies = await loadCurrencies(kv);
  const field = side === "give" ? "give_style" : "take_style";
  let found = false;
  for (const c of currencies) {
    if (c.id === currencyId) {
      c[field] = style;
      found = true;
      break;
    }
  }
  if (found) await saveCurrencies(kv, currencies);
  return found;
}

// =========================================================
// ============ WALLETS ====================================
// =========================================================

async function loadWallets(kv) {
  const data = await kvGet(kv, "wallets");
  return data ? data.wallets || {} : {};
}

async function saveWallets(kv, wallets) {
  await kvPut(kv, "wallets", { wallets });
}

async function ensureSomWallet(kv) {
  const wallets = await loadWallets(kv);
  if (!(SOM_CURRENCY_ID in wallets)) {
    wallets[SOM_CURRENCY_ID] = "";
    await saveWallets(kv, wallets);
  }
}

async function getWallet(kv, currencyId) {
  const wallets = await loadWallets(kv);
  return wallets[currencyId] || "";
}

async function setWallet(kv, currencyId, address) {
  const wallets = await loadWallets(kv);
  wallets[currencyId] = address;
  await saveWallets(kv, wallets);
}

async function removeWallet(kv, currencyId) {
  if (currencyId === SOM_CURRENCY_ID) return;
  const wallets = await loadWallets(kv);
  delete wallets[currencyId];
  await saveWallets(kv, wallets);
}

async function ensureWalletsForCurrencies(kv) {
  const currencies = await loadCurrencies(kv);
  const wallets = await loadWallets(kv);
  let changed = false;
  for (const c of currencies) {
    if (!(c.id in wallets)) {
      wallets[c.id] = "";
      changed = true;
    }
  }
  const validIds = new Set(currencies.map((c) => c.id));
  for (const cid of Object.keys(wallets)) {
    if (!validIds.has(cid) && cid !== SOM_CURRENCY_ID) {
      delete wallets[cid];
      changed = true;
    }
  }
  if (changed) await saveWallets(kv, wallets);
}

// =========================================================
// ============ SPREADS ====================================
// =========================================================

async function loadSpreads(kv) {
  const data = await kvGet(kv, "spreads");
  return data ? data.spreads || {} : {};
}

async function saveSpreads(kv, spreads) {
  await kvPut(kv, "spreads", { spreads });
}

async function getSpread(kv, currencyId) {
  const spreads = await loadSpreads(kv);
  return spreads[currencyId] || { give: 0, take: 0 };
}

async function setSpread(kv, currencyId, give, take) {
  const spreads = await loadSpreads(kv);
  spreads[currencyId] = { give, take };
  await saveSpreads(kv, spreads);
}

async function ensureSpreadsForCurrencies(kv) {
  const currencies = await loadCurrencies(kv);
  const spreads = await loadSpreads(kv);
  let changed = false;
  for (const c of currencies) {
    if (c.id === SOM_CURRENCY_ID) continue;
    if (!(c.id in spreads)) {
      spreads[c.id] = { give: 0, take: 0 };
      changed = true;
    }
  }
  const validIds = new Set(currencies.filter((c) => c.id !== SOM_CURRENCY_ID).map((c) => c.id));
  for (const cid of Object.keys(spreads)) {
    if (!validIds.has(cid)) {
      delete spreads[cid];
      changed = true;
    }
  }
  if (changed) await saveSpreads(kv, spreads);
}

// =========================================================
// ============ ORDERS =====================================
// =========================================================

async function loadOrders(kv) {
  const data = await kvGet(kv, "orders");
  return data ? data.orders || [] : [];
}

async function saveOrders(kv, orders) {
  await kvPut(kv, "orders", { orders });
}

function generateNextOrderId(orders) {
  let maxNum = 0;
  for (const o of orders) {
    const oid = o.order_id || "";
    if (oid.startsWith("A-")) {
      const num = parseInt(oid.split("-")[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `A-${String(maxNum + 1).padStart(4, "0")}`;
}

async function addOrder(kv, orderData) {
  const orders = await loadOrders(kv);
  orderData.order_id = generateNextOrderId(orders);
  orderData.created_at = new Date().toISOString();
  orders.push(orderData);
  await saveOrders(kv, orders);
  return orderData;
}

async function getOrder(kv, orderId) {
  const orders = await loadOrders(kv);
  return orders.find((o) => o.order_id === orderId) || null;
}

async function updateOrderStatus(kv, orderId, status) {
  const orders = await loadOrders(kv);
  let found = false;
  for (const o of orders) {
    if (o.order_id === orderId) {
      o.status = status;
      o[`${status}_at`] = new Date().toISOString();
      found = true;
      break;
    }
  }
  if (found) await saveOrders(kv, orders);
  return found;
}

async function patchOrder(kv, orderId, patch) {
  const orders = await loadOrders(kv);
  for (const o of orders) {
    if (o.order_id === orderId) {
      Object.assign(o, patch);
      break;
    }
  }
  await saveOrders(kv, orders);
}

// =========================================================
// ============ RATE API ===================================
// =========================================================

async function getUsdUzsRate(kv) {
  try {
    const cached = await kvGet(kv, "rateCache:usd_uzs");
    if (cached && Date.now() - cached.updated_at < RATES_CACHE_TTL && cached.rate > 0) {
      return cached.rate;
    }
    const r = await fetch("https://cbu.uz/ru/arkhiv-kursov-valyut/json/", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const data = await r.json();
    for (const item of data) {
      if (item.Ccy === "USD") {
        const rate = parseFloat(item.Rate);
        await kvPut(kv, "rateCache:usd_uzs", { rate, updated_at: Date.now() });
        return rate;
      }
    }
  } catch (e) {
    console.error("CBU rate fetch failed:", e);
  }
  try {
    const cached = await kvGet(kv, "rateCache:usd_uzs");
    if (cached && cached.rate > 0) return cached.rate;
  } catch {}
  return 0;
}

async function getCryptoUsdPrice(kv, coinId) {
  try {
    const cached = await kvGet(kv, `rateCache:${coinId}`);
    if (cached && Date.now() - cached.updated_at < RATES_CACHE_TTL) return cached.usd;
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await r.json();
    const usd = parseFloat(data?.[coinId]?.usd || 0);
    if (usd > 0) {
      await kvPut(kv, `rateCache:${coinId}`, { usd, updated_at: Date.now() });
      return usd;
    }
  } catch (e) {
    console.error(`CoinGecko fetch failed [${coinId}]:`, e);
  }
  try {
    const cached = await kvGet(kv, `rateCache:${coinId}`);
    if (cached) return cached.usd;
  } catch {}
  return 0;
}

function resolveCoingeckoId(currencyName) {
  const name = currencyName.toLowerCase().trim();
  const clean = name.split("(")[0].trim().replace(/\s/g, "");
  if (COINGECKO_IDS[clean]) return COINGECKO_IDS[clean];
  if (COINGECKO_IDS[name]) return COINGECKO_IDS[name];
  for (const [key, cid] of Object.entries(COINGECKO_IDS)) {
    if (key.includes(clean) || clean.includes(key)) return cid;
  }
  return "";
}

async function getCryptoPriceInSom(kv, currency) {
  const coinId = resolveCoingeckoId(currency.name || "");
  if (!coinId) return 0;
  const usdPrice = await getCryptoUsdPrice(kv, coinId);
  if (usdPrice <= 0) return 0;
  const usdUzs = await getUsdUzsRate(kv);
  if (usdUzs <= 0) return 0;
  return usdPrice * usdUzs;
}

async function calculateTakeAmount(kv, giveCurrency, takeCurrency, giveAmount) {
  const isGiveSom = giveCurrency.id === SOM_CURRENCY_ID;
  const isTakeSom = takeCurrency.id === SOM_CURRENCY_ID;

  if (isGiveSom && !isTakeSom) {
    const priceSom = await getCryptoPriceInSom(kv, takeCurrency);
    if (priceSom <= 0) return 0;
    const spread = await getSpread(kv, takeCurrency.id);
    const priceWithSpread = priceSom + (spread.give || 0);
    if (priceWithSpread <= 0) return 0;
    return giveAmount / priceWithSpread;
  }

  if (!isGiveSom && isTakeSom) {
    const priceSom = await getCryptoPriceInSom(kv, giveCurrency);
    if (priceSom <= 0) return 0;
    const spread = await getSpread(kv, giveCurrency.id);
    const priceWithSpread = priceSom - (spread.take || 0);
    if (priceWithSpread <= 0) return 0;
    return giveAmount * priceWithSpread;
  }

  if (!isGiveSom && !isTakeSom) {
    const givePrice = await getCryptoPriceInSom(kv, giveCurrency);
    const takePrice = await getCryptoPriceInSom(kv, takeCurrency);
    if (givePrice <= 0 || takePrice <= 0) return 0;
    const giveSpread = await getSpread(kv, giveCurrency.id);
    const takeSpread = await getSpread(kv, takeCurrency.id);
    const effectiveGive = givePrice - (giveSpread.take || 0);
    const effectiveTake = takePrice + (takeSpread.give || 0);
    if (effectiveTake <= 0) return 0;
    return (giveAmount * effectiveGive) / effectiveTake;
  }

  return 0;
}

// =========================================================
// ============ FORMATTING =================================
// =========================================================

function formatAmount(value) {
  try {
    value = parseFloat(value);
  } catch {
    return "0";
  }
  if (isNaN(value)) return "0";
  if (value === Math.floor(value)) return Math.floor(value).toLocaleString("en").replace(/,/g, " ");
  return value.toFixed(8).replace(/\.?0+$/, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatPrice(value) {
  try {
    value = parseFloat(value);
  } catch {
    return "0";
  }
  if (isNaN(value)) return "0";
  return Math.round(value).toLocaleString("en").replace(/,/g, " ");
}

function formatCardNumber(card) {
  card = card.replace(/\s/g, "");
  return card.match(/.{1,4}/g)?.join(" ") || card;
}

function tpl(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

// =========================================================
// ============ TELEGRAM API ===============================
// =========================================================

async function tgCall(token, method, body) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) {
    console.error(`tgCall ${method} failed:`, e);
    return null;
  }
}

function ik(rows) {
  return { inline_keyboard: rows };
}

function btn(text, callback_data) {
  return { text, callback_data };
}

function urlBtn(text, url) {
  return { text, url };
}

// =========================================================
// ============ KEYBOARDS ==================================
// =========================================================

function languageKeyboard() {
  return ik([[btn("🇺🇿 Oʻzbekcha", "lang_uz_latin"), btn("🇺🇿 Кириллча", "lang_uz_cyrillic")]]);
}

function phoneKeyboard(lang) {
  return {
    keyboard: [[{ text: TEXTS[lang].phone_btn, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function mainMenuKeyboard(lang) {
  const m = TEXTS[lang].menu;
  return {
    keyboard: [
      [{ text: m.exchange }],
      [{ text: m.support }, { text: m.rate }],
      [{ text: m.settings }],
    ],
    resize_keyboard: true,
  };
}

function removeKeyboard() {
  return { remove_keyboard: true };
}

function homeButtonRow(lang) {
  const label = lang === "uz_latin" ? "🏠 Bosh menyu" : "🏠 Бош меню";
  return [btn(label, "exch_home")];
}

function exchangeKeyboard(lang, giveCurrencyId, currencies) {
  const rows = [];
  let giveCategory = null;
  if (giveCurrencyId) {
    const sel = currencies.find((c) => c.id === giveCurrencyId);
    giveCategory = sel?.category || "crypto";
  }
  for (const currency of currencies) {
    const isSelectedGive = giveCurrencyId && currency.id === giveCurrencyId;
    const giveLabel = isSelectedGive ? `🔷 ${currency.name} ✅` : `🔷 ${currency.name}`;
    const giveBtn = btn(giveLabel, `exch_give_${currency.id}`);
    let takeBtn;
    if (giveCurrencyId) {
      if (currency.category === giveCategory) {
        takeBtn = btn("⬛", "exch_disabled");
      } else {
        takeBtn = btn(`🔶 ${currency.name}`, `exch_take_${currency.id}`);
      }
    } else {
      takeBtn = btn(`🔶 ${currency.name}`, `exch_take_${currency.id}`);
    }
    rows.push([giveBtn, takeBtn]);
  }
  rows.push(homeButtonRow(lang));
  return ik(rows);
}

function rateKeyboard(lang) {
  return ik([homeButtonRow(lang)]);
}

function settingsKeyboard(lang) {
  const t = TEXTS[lang];
  return ik([
    [btn(t.settings_change_lang, "stg_lang")],
    [btn(t.settings_change_name, "stg_name")],
    [btn(t.settings_change_phone, "stg_phone")],
    homeButtonRow(lang),
  ]);
}

function orderFinalKeyboard(lang) {
  return ik([
    [btn(TEXTS[lang].order_pay_btn, "exch_order_pay")],
    [btn(TEXTS[lang].order_cancel_btn, "exch_order_cancel")],
  ]);
}

function paymentInfoKeyboard(lang) {
  return ik([
    [btn(TEXTS[lang].payment_receipt_btn, "exch_payment_receipt")],
    [btn(TEXTS[lang].order_cancel_btn, "exch_order_cancel")],
  ]);
}

function receiptAskKeyboard(lang) {
  return ik([[btn(TEXTS[lang].order_cancel_btn, "exch_order_cancel")]]);
}

function adminOrderKeyboard(orderId) {
  return ik([[btn("✅ Tasdiqlash", `order_accept_${orderId}`), btn("❌ Rad etish", `order_reject_${orderId}`)]]);
}

function adminHomeKeyboard() {
  return ik([
    [btn("🎨 Menyu tugmalari rangi", "admin_colors")],
    [btn("💱 Valyutalar ro'yxati", "admin_curr_home")],
    [btn("💳 Hamyonlar", "admin_wallet_home")],
    [btn("💰 Spread", "admin_spread_home")],
    [btn("🌐 Til / Boshqa tugmalar", "admin_inl_home")],
  ]);
}

function adminPanelKeyboard(styles) {
  const rows = BUTTON_KEYS.map((key) => {
    const cur = styles[key] || "default";
    const em = (STYLE_LABELS[cur] || "⚪ Standart").split(" ")[0];
    return [btn(`${em} ${BUTTON_ADMIN_LABELS[key]}`, `admin_pick_${key}`)];
  });
  rows.push([btn("⬅️ Admin menyu", "admin_home")]);
  return ik(rows);
}

function adminCurrenciesKeyboard(currencies) {
  const rows = [];
  for (const c of currencies) {
    const lock = c.is_system ? " 🔒" : "";
    rows.push([
      btn(`🔷 ${c.name}${lock}`, `admin_curr_side_${c.id}_give`),
      btn(`🔶 ${c.name}${lock}`, `admin_curr_side_${c.id}_take`),
    ]);
  }
  if (currencies.some((c) => !c.is_system)) {
    rows.push([btn("🗑 O'chirish", "admin_currdelmenu")]);
  }
  rows.push([btn("➕ Valyuta qo'shish", "admin_curr_add")]);
  rows.push([btn("⬅️ Admin menyu", "admin_home")]);
  return ik(rows);
}

function adminCurrenciesDeleteKeyboard(currencies) {
  const rows = currencies
    .filter((c) => !c.is_system)
    .map((c) => [btn(c.name, `admin_curr_del_${c.id}`)]);
  rows.push([btn("⬅️ Orqaga", "admin_curr_home")]);
  return ik(rows);
}

function currencyColorChoiceKeyboard(currencyId, side) {
  const rows = STYLE_OPTIONS.map(([sv, sl]) => [btn(sl, `admin_curr_set_${currencyId}_${side}_${sv}`)]);
  rows.push([btn("⬅️ Orqaga", "admin_curr_home")]);
  return ik(rows);
}

function colorChoiceKeyboard(key) {
  const rows = STYLE_OPTIONS.map(([sv, sl]) => [btn(sl, `admin_set_${key}_${sv}`)]);
  rows.push([btn("⬅️ Orqaga", "admin_back")]);
  return ik(rows);
}

function adminInlineButtonsKeyboard(styles) {
  const rows = INLINE_BUTTON_KEYS.map((key) => {
    const cur = styles[key] || "default";
    const em = (STYLE_LABELS[cur] || "⚪ Standart").split(" ")[0];
    return [btn(`${em} ${INLINE_BUTTON_ADMIN_LABELS[key]}`, `admin_inl_pick_${key}`)];
  });
  rows.push([btn("⬅️ Admin menyu", "admin_home")]);
  return ik(rows);
}

function inlineColorChoiceKeyboard(key) {
  const rows = STYLE_OPTIONS.map(([sv, sl]) => [btn(sl, `admin_inl_set_${key}_${sv}`)]);
  rows.push([btn("⬅️ Orqaga", "admin_inl_home")]);
  return ik(rows);
}

function adminWalletsKeyboard(currencies, wallets) {
  const rows = currencies.map((c) => {
    const wallet = wallets[c.id] || "";
    const short = wallet
      ? wallet.length > 20
        ? wallet.slice(0, 10) + "..." + wallet.slice(-6)
        : wallet
      : "kiritilmagan";
    const label = wallet ? `✅ ${c.name} → ${short}` : `❌ ${c.name} → kiritilmagan`;
    return [btn(label, `admin_wallet_pick_${c.id}`)];
  });
  rows.push([btn("⬅️ Admin menyu", "admin_home")]);
  return ik(rows);
}

function adminWalletEditKeyboard(currencyId) {
  const rows = [];
  if (currencyId !== SOM_CURRENCY_ID) rows.push([btn("🗑 O'chirish", `admin_wallet_del_${currencyId}`)]);
  rows.push([btn("⬅️ Orqaga", "admin_wallet_home")]);
  return ik(rows);
}

function adminSpreadsKeyboard(currencies, spreads) {
  const rows = currencies.map((c) => {
    if (c.id === SOM_CURRENCY_ID) return [btn(`❌ ${c.name} (spread yo'q)`, "admin_spread_som_info")];
    const sp = spreads[c.id] || { give: 0, take: 0 };
    const label = `🪙 ${c.name}  →  +${formatAmount(sp.give)} / -${formatAmount(sp.take)}`;
    return [btn(label, `admin_spread_pick_${c.id}`)];
  });
  rows.push([btn("⬅️ Admin menyu", "admin_home")]);
  return ik(rows);
}

function adminSpreadEditKeyboard(currencyId) {
  return ik([
    [btn("✏️ O'zgartirish", `admin_spread_edit_${currencyId}`)],
    [btn("⬅️ Orqaga", "admin_spread_home")],
  ]);
}

// =========================================================
// ============ RATE TEXT ==================================
// =========================================================

async function buildRateText(kv, lang, currencies) {
  const unit = TEXTS[lang].rate_currency_unit;
  const notSet = TEXTS[lang].rate_not_set;
  const nonSom = currencies.filter((c) => c.id !== SOM_CURRENCY_ID);
  if (!nonSom.length) return TEXTS[lang].rate_empty;

  const buyLines = [TEXTS[lang].rate_buy_header];
  const sellLines = [TEXTS[lang].rate_sell_header];

  for (const currency of nonSom) {
    const priceSom = await getCryptoPriceInSom(kv, currency);
    const spread = await getSpread(kv, currency.id);
    if (priceSom > 0) {
      buyLines.push(`1 ${currency.name} = ${formatPrice(priceSom - (spread.take || 0))} ${unit}`);
      sellLines.push(`1 ${currency.name} = ${formatPrice(priceSom + (spread.give || 0))} ${unit}`);
    } else {
      buyLines.push(`1 ${currency.name} = ${notSet}`);
      sellLines.push(`1 ${currency.name} = ${notSet}`);
    }
  }
  return buyLines.join("\n") + "\n\n" + sellLines.join("\n");
}

// =========================================================
// ============ ADMIN IDS ==================================
// =========================================================

function getAdminIds(env) {
  // Set via environment variable ADMIN_IDS as comma-separated list
  // e.g. ADMIN_IDS = "8758410535,123456789"
  const raw = env.ADMIN_IDS || "8758410535";
  return new Set(raw.split(",").map((s) => s.trim()).map(Number).filter(Boolean));
}

function isAdmin(env, userId) {
  return getAdminIds(env).has(userId);
}

// =========================================================
// ============ SETTINGS TEXT ==============================
// =========================================================

function settingsText(lang, name, phone) {
  const langLabel = lang === "uz_latin" ? "🇺🇿 Oʻzbekcha (lotin)" : "🇺🇿 Кириллча";
  return tpl(TEXTS[lang].settings_header, {
    name: name || "—",
    lang_label: langLabel,
    phone: phone || "—",
  });
}

// =========================================================
// ============ FIND MENU KEY ==============================
// =========================================================

function findMenuKey(text) {
  for (const [lng, lt] of Object.entries(TEXTS)) {
    for (const [key, value] of Object.entries(lt.menu)) {
      if (value === text) return { key, lang: lng };
    }
  }
  return { key: null, lang: null };
}

// =========================================================
// ============ BUILD EXCHANGE SUMMARY =====================
// =========================================================

function buildExchangeSummary(lang, giveName, takeName) {
  const dateStr = new Date().toLocaleDateString("ru-RU");
  return tpl(TEXTS[lang].exchange_summary, { give_name: giveName, take_name: takeName, date: dateStr });
}

// =========================================================
// ============ MAIN HANDLER ===============================
// =========================================================

export default {
  async fetch(request, env) {
    // Always return 200 to Telegram — no matter what.
    try {
      if (request.method !== "POST") return new Response("OK", { status: 200 });
      const update = await request.json().catch(() => null);
      if (!update) return new Response("OK", { status: 200 });
      await handleUpdate(update, env);
    } catch (err) {
      console.error("Top-level fatal:", err);
    }
    return new Response("OK", { status: 200 });
  },
};

// =========================================================
// ============ UPDATE ROUTER ==============================
// =========================================================

async function handleUpdate(update, env) {
  const token = env.BOT_TOKEN;
  const kv = env.BOT_KVS;

  try {
    if (update.message) {
      await handleMessage(update.message, token, kv, env);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, token, kv, env);
    }
  } catch (err) {
    console.error("handleUpdate error:", err);
  }
}

// =========================================================
// ============ MESSAGE HANDLER ============================
// =========================================================

async function handleMessage(msg, token, kv, env) {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const state = await getUserState(kv, userId);

    // /start
    if (msg.text === "/start") {
      await handleStart(msg, token, kv, state);
      return;
    }

    // /admin
    if (msg.text === "/admin") {
      if (!isAdmin(env, userId)) {
        await tgCall(token, "sendMessage", { chat_id: chatId, text: "⛔ Sizda admin panelga kirish huquqi yo'q." });
        return;
      }
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "🛠 Admin panel\n\nBo'limni tanlang:", reply_markup: adminHomeKeyboard() });
      return;
    }

    // Contact (phone)
    if (msg.contact) {
      await handleContact(msg, token, kv, state);
      return;
    }

    // Photo (receipt)
    if (msg.photo) {
      await handlePhoto(msg, token, kv, state, env);
      return;
    }

    // Text
    if (msg.text) {
      await handleText(msg, token, kv, state, env);
      return;
    }
  } catch (err) {
    console.error("handleMessage error:", err);
  }
}

// =========================================================
// ============ /START =====================================
// =========================================================

async function handleStart(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  try {
    const savedUser = await getUser(kv, userId);
    if (savedUser) {
      const lang = savedUser.lang || "uz_latin";
      await patchUserState(kv, userId, {
        lang,
        phone: savedUser.phone,
        full_name: savedUser.full_name,
        awaiting_name: false,
        awaiting_name_change: false,
        awaiting_phone_change: false,
        awaiting_support_message: false,
        awaiting_exchange_amount: null,
        awaiting_give_address: false,
        awaiting_take_address: false,
        awaiting_receipt_photo: false,
        awaiting_currency_name: false,
        awaiting_wallet_currency: null,
        awaiting_spread_give: null,
        awaiting_spread_take: null,
        changing_language: false,
        awaiting_reply_to: null,
        exch_give_selected: null,
        exch_pair: null,
        exch_amount: null,
        exch_take_amount: null,
        exch_give_address: null,
        exch_take_address: null,
      });
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: TEXTS[lang].name_received,
        reply_markup: mainMenuKeyboard(lang),
      });
    } else {
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: "🌐 Tilni tanlang / Тилни танланг:",
        reply_markup: languageKeyboard(),
      });
    }
  } catch (err) {
    console.error("handleStart error:", err);
  }
}

// =========================================================
// ============ CONTACT ====================================
// =========================================================

async function handleContact(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  try {
    const lang = state.lang || "uz_latin";
    const phone = msg.contact.phone_number;

    if (state.awaiting_phone_change) {
      const existing = (await getUser(kv, userId)) || {};
      const fullName = existing.full_name || state.full_name || "";
      await saveUser(kv, userId, lang, phone, fullName);
      await patchUserState(kv, userId, { awaiting_phone_change: false, phone });
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: TEXTS[lang].settings_phone_changed,
        reply_markup: mainMenuKeyboard(lang),
      });
      return;
    }

    await patchUserState(kv, userId, { phone, awaiting_name: true });
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: TEXTS[lang].phone_received,
      reply_markup: removeKeyboard(),
    });
  } catch (err) {
    console.error("handleContact error:", err);
  }
}

// =========================================================
// ============ TEXT HANDLER ===============================
// =========================================================

async function handleText(msg, token, kv, state, env) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text || "";
  try {
    const lang = state.lang || "uz_latin";

    // Check menu key first — always takes priority
    const { key: menuKey, lang: menuLang } = findMenuKey(text);
    if (menuKey) {
      // Reset all awaiting states
      await patchUserState(kv, userId, {
        awaiting_currency_name: false,
        awaiting_name_change: false,
        awaiting_support_message: false,
        awaiting_phone_change: false,
        awaiting_give_address: false,
        awaiting_take_address: false,
        awaiting_receipt_photo: false,
        changing_language: false,
        awaiting_exchange_amount: null,
        awaiting_wallet_currency: null,
        awaiting_spread_give: null,
        awaiting_spread_take: null,
        awaiting_reply_to: null,
        lang: menuLang,
      });
      const freshState = await getUserState(kv, userId);
      await handleMenuKey(menuKey, menuLang, msg, token, kv, freshState);
      return;
    }

    // Route to awaiting handler
    if (isAdmin(env, userId) && state.awaiting_reply_to) {
      await handleAdminReply(msg, token, kv, state);
    } else if (state.awaiting_spread_give) {
      await handleSpreadGive(msg, token, kv, state);
    } else if (state.awaiting_spread_take) {
      await handleSpreadTake(msg, token, kv, state);
    } else if (state.awaiting_wallet_currency) {
      await handleWalletAddress(msg, token, kv, state);
    } else if (state.awaiting_currency_name) {
      await handleCurrencyName(msg, token, kv, state);
    } else if (state.awaiting_name) {
      await handleName(msg, token, kv, state);
    } else if (state.awaiting_name_change) {
      await handleNameChange(msg, token, kv, state);
    } else if (state.awaiting_exchange_amount) {
      await handleExchangeAmount(msg, token, kv, state);
    } else if (state.awaiting_give_address) {
      await handleGiveAddress(msg, token, kv, state);
    } else if (state.awaiting_take_address) {
      await handleTakeAddress(msg, token, kv, state);
    } else if (state.awaiting_receipt_photo) {
      // Sent text instead of photo
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: TEXTS[lang].only_photo_accepted,
        reply_markup: receiptAskKeyboard(lang),
      });
    } else if (state.awaiting_support_message) {
      await handleSupportMessage(msg, token, kv, state, env);
    }
  } catch (err) {
    console.error("handleText error:", err);
  }
}

// =========================================================
// ============ MENU KEY HANDLER ===========================
// =========================================================

async function handleMenuKey(key, lang, msg, token, kv, state) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  try {
    if (key === "exchange") {
      await patchUserState(kv, userId, { exch_give_selected: null });
      const currencies = await loadCurrencies(kv);
      if (!currencies.length) {
        await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].exchange_empty });
        return;
      }
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: TEXTS[lang].exchange_header,
        reply_markup: exchangeKeyboard(lang, null, currencies),
      });
      return;
    }

    if (key === "support") {
      await patchUserState(kv, userId, { awaiting_support_message: true });
      await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].support_prompt });
      return;
    }

    if (key === "rate") {
      const currencies = await loadCurrencies(kv);
      const rateText = await buildRateText(kv, lang, currencies);
      await tgCall(token, "sendMessage", { chat_id: chatId, text: rateText, reply_markup: rateKeyboard(lang) });
      return;
    }

    if (key === "settings") {
      const saved = (await getUser(kv, userId)) || {};
      const name = saved.full_name || state.full_name || "";
      const phone = saved.phone || state.phone || "";
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: settingsText(lang, name, phone),
        reply_markup: settingsKeyboard(lang),
      });
      return;
    }
  } catch (err) {
    console.error("handleMenuKey error:", err);
  }
}

// =========================================================
// ============ NAME HANDLERS ==============================
// =========================================================

async function handleName(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const lang = state.lang || "uz_latin";
  try {
    const fullName = (msg.text || "").trim();
    const phone = state.phone || "";
    await saveUser(kv, userId, lang, phone, fullName);
    await patchUserState(kv, userId, { full_name: fullName, awaiting_name: false });
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: TEXTS[lang].name_received,
      reply_markup: mainMenuKeyboard(lang),
    });
  } catch (err) {
    console.error("handleName error:", err);
  }
}

async function handleNameChange(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const lang = state.lang || "uz_latin";
  try {
    const newName = (msg.text || "").trim();
    if (!newName) {
      await patchUserState(kv, userId, { awaiting_name_change: true });
      await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].settings_ask_new_name });
      return;
    }
    const existing = (await getUser(kv, userId)) || {};
    const phone = existing.phone || state.phone || "";
    await saveUser(kv, userId, lang, phone, newName);
    await patchUserState(kv, userId, { full_name: newName, awaiting_name_change: false });
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: TEXTS[lang].settings_name_changed,
      reply_markup: mainMenuKeyboard(lang),
    });
  } catch (err) {
    console.error("handleNameChange error:", err);
  }
}

// =========================================================
// ============ CURRENCY NAME ==============================
// =========================================================

async function handleCurrencyName(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  try {
    await patchUserState(kv, userId, { awaiting_currency_name: false });
    const name = (msg.text || "").trim();
    if (!name) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "Bo'sh nom kiritib bo'lmaydi." });
      return;
    }
    const upper = name.toUpperCase();
    if (["SO'M", "SOM", "СЎМ", "СУМ", "СОМ"].includes(upper)) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "⚠️ SO'M allaqachon tizimda mavjud." });
      return;
    }
    await addCurrency(kv, name);
    await ensureWalletsForCurrencies(kv);
    await ensureSpreadsForCurrencies(kv);
    const cid = resolveCoingeckoId(name);
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: cid ? `✅ '${name}' qo'shildi. (CoinGecko: ${cid})` : `⚠️ '${name}' qo'shildi, lekin CoinGecko ID topilmadi.`,
    });
    const currencies = await loadCurrencies(kv);
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: "💱 Valyutalar ro'yxati:",
      reply_markup: adminCurrenciesKeyboard(currencies),
    });
  } catch (err) {
    console.error("handleCurrencyName error:", err);
  }
}

// =========================================================
// ============ WALLET ADDRESS =============================
// =========================================================

async function handleWalletAddress(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const currencyId = state.awaiting_wallet_currency;
  try {
    await patchUserState(kv, userId, { awaiting_wallet_currency: null });
    const value = (msg.text || "").trim();
    if (!value) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "❌ Bo'sh qiymat kiritib bo'lmaydi." });
      return;
    }
    await setWallet(kv, currencyId, value);
    const currencies = await loadCurrencies(kv);
    const currency = currencies.find((c) => c.id === currencyId);
    const name = currency?.name || "Valyuta";
    await tgCall(token, "sendMessage", { chat_id: chatId, text: `✅ ${name} hamyoni saqlandi:\n\n${value}` });
    const wallets = await loadWallets(kv);
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: "💳 Hamyonlar:",
      reply_markup: adminWalletsKeyboard(currencies, wallets),
    });
  } catch (err) {
    console.error("handleWalletAddress error:", err);
  }
}

// =========================================================
// ============ SPREAD HANDLERS ============================
// =========================================================

async function handleSpreadGive(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const lang = state.lang || "uz_latin";
  const currencyId = state.awaiting_spread_give;
  try {
    const raw = (msg.text || "").replace(/,/g, "").replace(/\s/g, "");
    const value = parseFloat(raw);
    if (isNaN(value)) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].spread_invalid });
      return;
    }
    const currencies = await loadCurrencies(kv);
    const currency = currencies.find((c) => c.id === currencyId);
    const name = currency?.name || "Valyuta";
    await patchUserState(kv, userId, {
      awaiting_spread_give: null,
      spread_give_temp: value,
      awaiting_spread_take: currencyId,
    });
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: tpl(TEXTS[lang].spread_ask_take, { name }),
    });
  } catch (err) {
    console.error("handleSpreadGive error:", err);
  }
}

async function handleSpreadTake(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const lang = state.lang || "uz_latin";
  const currencyId = state.awaiting_spread_take;
  try {
    const raw = (msg.text || "").replace(/,/g, "").replace(/\s/g, "");
    const takeValue = parseFloat(raw);
    if (isNaN(takeValue)) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].spread_invalid });
      return;
    }
    const giveValue = state.spread_give_temp || 0;
    await setSpread(kv, currencyId, giveValue, takeValue);
    await patchUserState(kv, userId, { awaiting_spread_take: null, spread_give_temp: null });
    const currencies = await loadCurrencies(kv);
    const currency = currencies.find((c) => c.id === currencyId);
    const name = currency?.name || "Valyuta";
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: tpl(TEXTS[lang].spread_saved, {
        name,
        give: formatAmount(giveValue),
        take: formatAmount(takeValue),
      }),
    });
    const spreads = await loadSpreads(kv);
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: "💰 Spread:",
      reply_markup: adminSpreadsKeyboard(currencies, spreads),
    });
  } catch (err) {
    console.error("handleSpreadTake error:", err);
  }
}

// =========================================================
// ============ SUPPORT MESSAGE ============================
// =========================================================

async function handleSupportMessage(msg, token, kv, state, env) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const lang = state.lang || "uz_latin";
  try {
    const text = (msg.text || "").trim();
    if (!text) {
      await patchUserState(kv, userId, { awaiting_support_message: true });
      await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].support_prompt });
      return;
    }
    await patchUserState(kv, userId, { awaiting_support_message: false });
    const savedUser = (await getUser(kv, userId)) || {};
    const fullName = savedUser.full_name || msg.from.first_name || "Noma'lum";
    const phone = savedUser.phone || "—";
    const username = msg.from.username ? `@${msg.from.username}` : "—";
    const adminText = `📩 Yangi xabar (Aloqa)\n\n👤 Ism: ${fullName}\n📱 Tel: ${phone}\n🔗 Username: ${username}\n🆔 ID: ${userId}\n\n💬 Xabar:\n${text}`;
    const replyKb = ik([[btn("💬 Javob yozish", `admin_reply_${userId}`)]]);
    for (const adminId of getAdminIds(env)) {
      try {
        await tgCall(token, "sendMessage", { chat_id: adminId, text: adminText, reply_markup: replyKb });
      } catch {}
    }
    await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].support_sent });
  } catch (err) {
    console.error("handleSupportMessage error:", err);
  }
}

// =========================================================
// ============ ADMIN REPLY ================================
// =========================================================

async function handleAdminReply(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const targetUserId = state.awaiting_reply_to;
  try {
    await patchUserState(kv, userId, { awaiting_reply_to: null });
    const replyText = (msg.text || "").trim();
    if (!targetUserId || !replyText) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "Xatolik: javob yuborilmadi." });
      return;
    }
    const targetUser = await getUser(kv, targetUserId);
    const targetLang = targetUser?.lang || "uz_latin";
    const prefix = TEXTS[targetLang].support_admin_reply_prefix;
    try {
      await tgCall(token, "sendMessage", { chat_id: targetUserId, text: `${prefix}${replyText}` });
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "✅ Javob yuborildi." });
    } catch {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "❌ Xatolik: foydalanuvchiga yuborib bo'lmadi." });
    }
  } catch (err) {
    console.error("handleAdminReply error:", err);
  }
}

// =========================================================
// ============ EXCHANGE AMOUNT ============================
// =========================================================

async function handleExchangeAmount(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const lang = state.lang || "uz_latin";
  try {
    const pair = state.exch_pair || {};
    const currencies = await loadCurrencies(kv);
    const giveCurrency = currencies.find((c) => c.id === pair.give);
    if (!giveCurrency) {
      await patchUserState(kv, userId, { awaiting_exchange_amount: null });
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "Xatolik yuz berdi, qaytadan boshlang." });
      return;
    }
    const raw = (msg.text || "").replace(/,/g, "").replace(/\s/g, "");
    const amount = parseFloat(raw);
    if (isNaN(amount)) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].exchange_amount_invalid });
      return;
    }
    const minAmount = giveCurrency.min_amount || 0;
    const maxAmount = giveCurrency.max_amount || 0;
    if (minAmount && amount < minAmount) {
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: tpl(TEXTS[lang].exchange_amount_too_small, { min: formatAmount(minAmount) }),
      });
      return;
    }
    if (maxAmount && amount > maxAmount) {
      await tgCall(token, "sendMessage", {
        chat_id: chatId,
        text: tpl(TEXTS[lang].exchange_amount_too_big, { max: formatAmount(maxAmount) }),
      });
      return;
    }
    const takeCurrency = currencies.find((c) => c.id === pair.take);
    if (!takeCurrency) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "Xatolik yuz berdi." });
      return;
    }
    const takeAmount = await calculateTakeAmount(kv, giveCurrency, takeCurrency, amount);
    if (takeAmount <= 0) {
      await patchUserState(kv, userId, { awaiting_exchange_amount: null, exch_pair: null, exch_amount: null });
      await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].price_not_available });
      return;
    }
    await patchUserState(kv, userId, {
      awaiting_exchange_amount: null,
      exch_amount: amount,
      exch_take_amount: takeAmount,
      awaiting_give_address: true,
    });
    const addressText =
      giveCurrency.category === "fiat"
        ? TEXTS[lang].ask_give_address_fiat
        : tpl(TEXTS[lang].ask_give_address_crypto, { name: giveCurrency.name });
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: addressText,
      reply_markup: ik([homeButtonRow(lang)]),
    });
  } catch (err) {
    console.error("handleExchangeAmount error:", err);
  }
}

// =========================================================
// ============ ADDRESS HANDLERS ===========================
// =========================================================

async function handleGiveAddress(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const lang = state.lang || "uz_latin";
  try {
    const value = (msg.text || "").trim();
    if (!value) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].address_empty });
      return;
    }
    await patchUserState(kv, userId, {
      awaiting_give_address: false,
      exch_give_address: value,
      awaiting_take_address: true,
    });
    const pair = state.exch_pair || {};
    const currencies = await loadCurrencies(kv);
    const takeCurrency = currencies.find((c) => c.id === pair.take);
    if (!takeCurrency) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "Xatolik yuz berdi." });
      return;
    }
    const addressText =
      takeCurrency.category === "fiat"
        ? TEXTS[lang].ask_take_address_fiat
        : tpl(TEXTS[lang].ask_take_address_crypto, { name: takeCurrency.name });
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: addressText,
      reply_markup: ik([homeButtonRow(lang)]),
    });
  } catch (err) {
    console.error("handleGiveAddress error:", err);
  }
}

async function handleTakeAddress(msg, token, kv, state) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const lang = state.lang || "uz_latin";
  try {
    const value = (msg.text || "").trim();
    if (!value) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: TEXTS[lang].address_empty });
      return;
    }
    await patchUserState(kv, userId, { awaiting_take_address: false, exch_take_address: value });
    const pair = state.exch_pair || {};
    const currencies = await loadCurrencies(kv);
    const giveCurrency = currencies.find((c) => c.id === pair.give);
    const takeCurrency = currencies.find((c) => c.id === pair.take);
    if (!giveCurrency || !takeCurrency) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "Xatolik yuz berdi." });
      return;
    }
    const giveAmount = state.exch_amount || 0;
    const takeAmount = state.exch_take_amount || 0;
    const giveAddress = state.exch_give_address || "—";
    const text = tpl(TEXTS[lang].order_final, {
      give_name: giveCurrency.name,
      take_name: takeCurrency.name,
      give_amount: formatAmount(giveAmount),
      take_amount: formatAmount(takeAmount),
      give_address: giveAddress,
      take_address: value,
    });
    await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: orderFinalKeyboard(lang),
    });
  } catch (err) {
    console.error("handleTakeAddress error:", err);
  }
}

// =========================================================
// ============ PHOTO HANDLER (RECEIPT) ====================
// =========================================================

async function handlePhoto(msg, token, kv, state, env) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  try {
    if (!state.awaiting_receipt_photo) return;
    await patchUserState(kv, userId, { awaiting_receipt_photo: false });
    const lang = state.lang || "uz_latin";
    const pair = state.exch_pair || {};
    const currencies = await loadCurrencies(kv);
    const giveCurrency = currencies.find((c) => c.id === pair.give);
    const takeCurrency = currencies.find((c) => c.id === pair.take);
    if (!giveCurrency || !takeCurrency) {
      await tgCall(token, "sendMessage", { chat_id: chatId, text: "Xatolik yuz berdi." });
      return;
    }
    const giveAmount = state.exch_amount || 0;
    const takeAmount = state.exch_take_amount || 0;
    const giveAddress = state.exch_give_address || "—";
    const takeAddress = state.exch_take_address || "—";

    const now = new Date();
    const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleString("ru-RU");

    const botInfo = await tgCall(token, "getMe", {});
    const botUsername = botInfo?.result?.username ? `@${botInfo.result.username}` : "@bot";

    const savedUser = (await getUser(kv, userId)) || {};
    const fullName = savedUser.full_name || msg.from.first_name || "Noma'lum";
    const phone = savedUser.phone || "—";
    const username = msg.from.username || "—";

    const orderData = {
      user_id: userId,
      user_chat_id: chatId,
      full_name: fullName,
      phone,
      username,
      give_currency_id: giveCurrency.id,
      give_currency_name: giveCurrency.name,
      take_currency_id: takeCurrency.id,
      take_currency_name: takeCurrency.name,
      give_amount: giveAmount,
      take_amount: takeAmount,
      give_address: giveAddress,
      take_address: takeAddress,
      status: "pending",
      date: dateStr,
      time: timeStr,
      bot_username: botUsername,
      lang,
      user_message_id: null,
      admin_message_ids: {},
    };
    const order = await addOrder(kv, orderData);
    const orderId = order.order_id;

    const userText = tpl(TEXTS[lang].receipt_received, {
      give_name: giveCurrency.name,
      take_name: takeCurrency.name,
      give_address: giveAddress,
      give_amount: formatAmount(giveAmount),
      take_address: takeAddress,
      take_amount: formatAmount(takeAmount),
      status_line: TEXTS[lang].status_pending,
      time: timeStr,
      bot_username: botUsername,
    });

    const userMsgResp = await tgCall(token, "sendMessage", {
      chat_id: chatId,
      text: userText,
      reply_markup: removeKeyboard(),
    });

    const userMsgId = userMsgResp?.result?.message_id || null;
    await patchOrder(kv, orderId, { user_message_id: userMsgId });

    const adminText =
      `🔔 <b>BUYURTMA №:</b> ${orderId}\n` +
      `───────────────────────────────\n\n` +
      `👤 <b>MIJOZ MA'LUMOTLARI:</b>\n` +
      `  ├─ 👤 Ism: ${fullName}\n` +
      `  ├─ 📱 Tel: ${phone}\n` +
      `  ├─ 🔗 Profil: @${username}\n` +
      `  └─ 🆔 ID: ${userId}\n\n` +
      `🔀 <b>ALMASHUV YO'NALISHI:</b>\n` +
      `  └─ 🔴 ${giveCurrency.name} ➔ 🟢 ${takeCurrency.name}\n\n` +
      `📥 <b>MIJOZDAN KELDI (Kutilmoqda):</b>\n` +
      `  ├─ 💰 Miqdor: ${formatAmount(giveAmount)} ${giveCurrency.name}\n` +
      `  └─ 💳 Hamyon: <code>${giveAddress}</code>\n\n` +
      `📤 <b>MIJOZGA YUBORILADI (To'lov):</b>\n` +
      `  ├─ 💰 Miqdor: ${formatAmount(takeAmount)} ${takeCurrency.name}\n` +
      `  └─ 💳 Hamyon: <code>${takeAddress}</code>\n\n` +
      `───────────────────────────────\n` +
      `📅 Sana: ${dateStr}\n` +
      `📸 Status: Chek tekshirilmoqda...`;

    const photoFileId = msg.photo[msg.photo.length - 1].file_id;
    const adminMsgIds = {};

    for (const adminId of getAdminIds(env)) {
      try {
        const sent = await tgCall(token, "sendPhoto", {
          chat_id: adminId,
          photo: photoFileId,
          caption: adminText,
          parse_mode: "HTML",
          reply_markup: adminOrderKeyboard(orderId),
        });
        if (sent?.result?.message_id) adminMsgIds[String(adminId)] = sent.result.message_id;
      } catch {}
    }

    await patchOrder(kv, orderId, { admin_message_ids: adminMsgIds });

    // Clear exchange state
    await patchUserState(kv, userId, {
      exch_pair: null,
      exch_amount: null,
      exch_take_amount: null,
      exch_give_address: null,
      exch_take_address: null,
    });
  } catch (err) {
    console.error("handlePhoto error:", err);
  }
}

// =========================================================
// ============ CALLBACK QUERY HANDLER =====================
// =========================================================

async function handleCallbackQuery(query, token, kv, env) {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const data = query.data || "";

  const answer = (text, alert = false) =>
    tgCall(token, "answerCallbackQuery", {
      callback_query_id: query.id,
      text,
      show_alert: alert,
    });

  const editText = (text, reply_markup) =>
    tgCall(token, "editMessageText", { chat_id: chatId, message_id: msgId, text, reply_markup }).catch(() => {});

  const editCaption = (caption, reply_markup) =>
    tgCall(token, "editMessageCaption", { chat_id: chatId, message_id: msgId, caption, reply_markup }).catch(() => {});

  const sendMsg = (text, extra = {}) =>
    tgCall(token, "sendMessage", { chat_id: chatId, text, ...extra });

  const deleteMsg = () =>
    tgCall(token, "deleteMessage", { chat_id: chatId, message_id: msgId }).catch(() => {});

  try {
    const state = await getUserState(kv, userId);
    const lang = state.lang || "uz_latin";

    // ---- ORDER ACCEPT/REJECT ----
    if (data.startsWith("order_accept_") || data.startsWith("order_reject_")) {
      if (!isAdmin(env, userId)) { await answer("⛔ Ruxsat yo'q.", true); return; }
      const action = data.startsWith("order_accept_") ? "accepted" : "rejected";
      const orderId = data.replace(/^order_(accept|reject)_/, "");
      const order = await getOrder(kv, orderId);
      if (!order) { await answer("❌ Buyurtma topilmadi.", true); return; }
      if (["accepted", "rejected"].includes(order.status)) {
        const lbl = order.status === "accepted" ? "tasdiqlangan" : "rad etilgan";
        await answer(`⚠️ Bu buyurtma allaqachon ${lbl}!`, true); return;
      }
      await updateOrderStatus(kv, orderId, action);

      const orderLang = order.lang || "uz_latin";
      const statusLine = action === "accepted" ? TEXTS[orderLang].status_accepted : TEXTS[orderLang].status_rejected;
      const newText = tpl(TEXTS[orderLang].receipt_received, {
        give_name: order.give_currency_name,
        take_name: order.take_currency_name,
        give_address: order.give_address,
        give_amount: formatAmount(order.give_amount),
        take_address: order.take_address,
        take_amount: formatAmount(order.take_amount),
        status_line: statusLine,
        time: order.time,
        bot_username: order.bot_username,
      });
      if (order.user_chat_id && order.user_message_id) {
        tgCall(token, "editMessageText", {
          chat_id: order.user_chat_id,
          message_id: order.user_message_id,
          text: newText,
        }).catch(() => {});
      }
      await answer(action === "accepted" ? "✅ Buyurtma tasdiqlandi!" : "❌ Buyurtma rad etildi!");
      return;
    }

    // ---- ADMIN REPLY ----
    if (data.startsWith("admin_reply_")) {
      if (!isAdmin(env, userId)) { await answer("⛔", true); return; }
      const target = parseInt(data.replace("admin_reply_", ""), 10);
      if (!target) { await answer(); return; }
      await patchUserState(kv, userId, { awaiting_reply_to: target });
      await answer();
      await sendMsg("✍️ Javobingizni yozing:");
      return;
    }

    // ---- LANGUAGE SELECT ----
    if (data.startsWith("lang_")) {
      const langMap = { lang_uz_latin: "uz_latin", lang_uz_cyrillic: "uz_cyrillic" };
      const selected = langMap[data];
      if (!selected) { await answer(); return; }

      if (state.changing_language) {
        const existing = (await getUser(kv, userId)) || {};
        const phone = existing.phone || state.phone || "";
        const fullName = existing.full_name || state.full_name || "";
        await saveUser(kv, userId, selected, phone, fullName);
        await patchUserState(kv, userId, { changing_language: false, lang: selected });
        await answer();
        await deleteMsg();
        await sendMsg(TEXTS[selected].settings_lang_changed, { reply_markup: mainMenuKeyboard(selected) });
        return;
      }

      await patchUserState(kv, userId, { lang: selected });
      await answer();
      // Remove inline keyboard
      tgCall(token, "editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: ik([]) }).catch(() => {});
      await sendMsg(TEXTS[selected].ask_phone, { reply_markup: phoneKeyboard(selected) });
      return;
    }

    // ---- SETTINGS CALLBACKS ----
    if (data === "stg_lang") {
      await patchUserState(kv, userId, { changing_language: true });
      await answer();
      await sendMsg(TEXTS[lang].settings_choose_new_lang, { reply_markup: languageKeyboard() });
      return;
    }
    if (data === "stg_name") {
      await patchUserState(kv, userId, { awaiting_name_change: true });
      await answer();
      await sendMsg(TEXTS[lang].settings_ask_new_name);
      return;
    }
    if (data === "stg_phone") {
      await patchUserState(kv, userId, { awaiting_phone_change: true });
      await answer();
      await sendMsg(TEXTS[lang].settings_ask_new_phone, { reply_markup: phoneKeyboard(lang) });
      return;
    }

    // ---- EXCHANGE CALLBACKS ----
    if (data === "exch_home") {
      await patchUserState(kv, userId, {
        exch_give_selected: null,
        awaiting_exchange_amount: null,
        awaiting_give_address: false,
        awaiting_take_address: false,
        awaiting_receipt_photo: false,
      });
      await answer();
      await deleteMsg();
      await sendMsg(TEXTS[lang].name_received, { reply_markup: mainMenuKeyboard(lang) });
      return;
    }

    if (data === "exch_disabled") {
      await answer(TEXTS[lang].exchange_disabled_pair, true);
      return;
    }

    if (data === "exch_order_pay") {
      const pair = state.exch_pair || {};
      const currencies = await loadCurrencies(kv);
      const giveCurrency = currencies.find((c) => c.id === pair.give);
      const giveAmount = state.exch_amount || 0;
      if (!giveCurrency) { await answer("Xatolik", true); return; }
      const wallet = await getWallet(kv, giveCurrency.id);
      if (!wallet) {
        await answer("❌", true);
        await deleteMsg();
        await sendMsg(TEXTS[lang].wallet_not_set, { reply_markup: mainMenuKeyboard(lang) });
        await patchUserState(kv, userId, { exch_pair: null, exch_amount: null });
        return;
      }
      await answer("✅");
      const isCard = giveCurrency.category === "fiat";
      const walletLabel = isCard ? "Karta raqamini" : "Manzilni";
      const walletDisplay = isCard && /^\d+$/.test(wallet.replace(/\s/g, "")) ? formatCardNumber(wallet) : wallet;
      const paymentText = tpl(TEXTS[lang].payment_info, {
        wallet_label: walletLabel,
        wallet: walletDisplay,
        amount: formatAmount(giveAmount),
        give_name: giveCurrency.name,
      });
      await deleteMsg();
      await sendMsg(paymentText, { reply_markup: paymentInfoKeyboard(lang) });
      return;
    }

    if (data === "exch_payment_receipt") {
      await patchUserState(kv, userId, { awaiting_receipt_photo: true });
      await answer("📸");
      await deleteMsg();
      await sendMsg(TEXTS[lang].ask_receipt_photo, { reply_markup: receiptAskKeyboard(lang) });
      return;
    }

    if (data === "exch_order_cancel") {
      await answer("❌");
      await deleteMsg();
      await sendMsg(TEXTS[lang].order_cancelled, { reply_markup: mainMenuKeyboard(lang) });
      await patchUserState(kv, userId, {
        exch_pair: null,
        exch_amount: null,
        exch_take_amount: null,
        exch_give_address: null,
        exch_take_address: null,
        awaiting_receipt_photo: false,
      });
      return;
    }

    if (data.startsWith("exch_give_")) {
      const currencyId = data.replace("exch_give_", "");
      const currencies = await loadCurrencies(kv);
      const currency = currencies.find((c) => c.id === currencyId);
      if (!currency) { await answer(); return; }
      await patchUserState(kv, userId, { exch_give_selected: currencyId });
      await answer();
      await editText(TEXTS[lang].exchange_step2_header, exchangeKeyboard(lang, currencyId, currencies));
      return;
    }

    if (data.startsWith("exch_take_")) {
      const currencyId = data.replace("exch_take_", "");
      const currencies = await loadCurrencies(kv);
      const takeCurrency = currencies.find((c) => c.id === currencyId);
      if (!takeCurrency) { await answer(); return; }
      const giveId = state.exch_give_selected;
      const giveCurrency = giveId ? currencies.find((c) => c.id === giveId) : null;
      if (!giveCurrency) { await answer(tpl(TEXTS[lang].exchange_selected, { name: takeCurrency.name })); return; }
      await patchUserState(kv, userId, {
        exch_give_selected: null,
        exch_pair: { give: giveCurrency.id, take: takeCurrency.id },
        awaiting_exchange_amount: "give",
      });
      await answer();
      await editText(
        buildExchangeSummary(lang, giveCurrency.name, takeCurrency.name),
        ik([homeButtonRow(lang)])
      );
      return;
    }

    // ---- ADMIN CALLBACKS ----
    if (!isAdmin(env, userId)) { await answer(); return; }

    if (data === "admin_home") {
      await answer();
      await editText("🛠 Admin panel\n\nBo'limni tanlang:", adminHomeKeyboard());
      return;
    }

    if (data === "admin_colors") {
      const config = await loadConfig(kv);
      await answer();
      await editText("🎨 Tugmalar rangini boshqarish\n\nO'zgartirmoqchi bo'lgan tugmani tanlang:", adminPanelKeyboard(config.button_styles || {}));
      return;
    }

    if (data === "admin_back") {
      const config = await loadConfig(kv);
      await answer();
      await editText("🎨 Tugmalar rangini boshqarish\n\nO'zgartirmoqchi bo'lgan tugmani tanlang:", adminPanelKeyboard(config.button_styles || {}));
      return;
    }

    if (data.startsWith("admin_pick_")) {
      const key = data.replace("admin_pick_", "");
      if (!BUTTON_KEYS.includes(key)) { await answer(); return; }
      const cur = await getButtonStyle(kv, key);
      await answer();
      await editText(
        `🎨 ${BUTTON_ADMIN_LABELS[key]}\nJoriy rang: ${STYLE_LABELS[cur] || "⚪ Standart"}\n\nYangi rangni tanlang:`,
        colorChoiceKeyboard(key)
      );
      return;
    }

    if (data.startsWith("admin_set_")) {
      const remainder = data.replace("admin_set_", "");
      const lastIdx = remainder.lastIndexOf("_");
      const key = remainder.slice(0, lastIdx);
      const style = remainder.slice(lastIdx + 1);
      if (!BUTTON_KEYS.includes(key) || !STYLE_LABELS[style]) { await answer(); return; }
      await setButtonStyle(kv, key, style);
      await answer(`✅ ${BUTTON_ADMIN_LABELS[key]} rangi o'zgartirildi`);
      const config = await loadConfig(kv);
      await editText("🎨 Tugmalar rangini boshqarish\n\nO'zgartirmoqchi bo'lgan tugmani tanlang:", adminPanelKeyboard(config.button_styles || {}));
      return;
    }

    if (data === "admin_curr_home") {
      const currencies = await loadCurrencies(kv);
      await answer();
      await editText(currencies.length ? "💱 Valyutalar ro'yxati:" : "💱 Valyutalar ro'yxati hozircha bo'sh.", adminCurrenciesKeyboard(currencies));
      return;
    }

    if (data === "admin_currdelmenu") {
      const currencies = await loadCurrencies(kv);
      const deletable = currencies.filter((c) => !c.is_system);
      await answer();
      if (!deletable.length) {
        await editText("🗑 O'chirish mumkin bo'lgan valyuta yo'q.", adminCurrenciesKeyboard(currencies));
        return;
      }
      await editText("🗑 Qaysi valyutani o'chirmoqchisiz?", adminCurrenciesDeleteKeyboard(currencies));
      return;
    }

    if (data === "admin_curr_add") {
      await patchUserState(kv, userId, { awaiting_currency_name: true });
      await answer();
      await sendMsg("✍️ Yangi valyuta nomini yozing (masalan: USDT (Trc20)):\n\nℹ️ Faqat kripto valyutalar. SO'M tizimda mavjud.");
      return;
    }

    if (data.startsWith("admin_curr_side_")) {
      const remainder = data.replace("admin_curr_side_", "");
      const lastIdx = remainder.lastIndexOf("_");
      const currencyId = remainder.slice(0, lastIdx);
      const side = remainder.slice(lastIdx + 1);
      if (!["give", "take"].includes(side)) { await answer(); return; }
      const currencies = await loadCurrencies(kv);
      const currency = currencies.find((c) => c.id === currencyId);
      if (!currency) { await answer("Topilmadi", true); return; }
      const field = side === "give" ? "give_style" : "take_style";
      const cur = currency[field] || "default";
      const sideLabel = side === "give" ? "🔷 Berish" : "🔶 Olish";
      const lockNote = currency.is_system ? "\n\n🔒 Tizim valyutasi" : "";
      await answer();
      await editText(
        `🎨 ${currency.name} — ${sideLabel}\nJoriy rang: ${STYLE_LABELS[cur] || "⚪ Standart"}\n\nYangi rangni tanlang:${lockNote}`,
        currencyColorChoiceKeyboard(currencyId, side)
      );
      return;
    }

    if (data.startsWith("admin_curr_set_")) {
      const remainder = data.replace("admin_curr_set_", "");
      const parts = remainder.split("_");
      const style = parts.pop();
      const side = parts.pop();
      const currencyId = parts.join("_");
      if (!["give", "take"].includes(side) || !STYLE_LABELS[style]) { await answer(); return; }
      const ok = await setCurrencyStyle(kv, currencyId, side, style);
      await answer(ok ? "✅ Rang o'zgartirildi" : "Topilmadi");
      const currencies = await loadCurrencies(kv);
      await editText(currencies.length ? "💱 Valyutalar ro'yxati:" : "💱 Valyutalar ro'yxati hozircha bo'sh.", adminCurrenciesKeyboard(currencies));
      return;
    }

    if (data.startsWith("admin_curr_del_")) {
      const currencyId = data.replace("admin_curr_del_", "");
      if (currencyId === SOM_CURRENCY_ID) { await answer("⛔ SO'M o'chirilmaydi!", true); return; }
      const removed = await removeCurrency(kv, currencyId);
      await removeWallet(kv, currencyId);
      await answer(removed ? "✅ O'chirildi" : "Topilmadi");
      const currencies = await loadCurrencies(kv);
      await editText(currencies.length ? "💱 Valyutalar ro'yxati:" : "💱 Valyutalar ro'yxati hozircha bo'sh.", adminCurrenciesKeyboard(currencies));
      return;
    }

    if (data === "admin_wallet_home") {
      await ensureWalletsForCurrencies(kv);
      const currencies = await loadCurrencies(kv);
      const wallets = await loadWallets(kv);
      await answer();
      await editText("💳 Hamyonlar\n\nHar bir valyuta uchun to'lov manzilini kiriting:", adminWalletsKeyboard(currencies, wallets));
      return;
    }

    if (data.startsWith("admin_wallet_pick_")) {
      const currencyId = data.replace("admin_wallet_pick_", "");
      const currencies = await loadCurrencies(kv);
      const currency = currencies.find((c) => c.id === currencyId);
      if (!currency) { await answer("Topilmadi", true); return; }
      const wallet = await getWallet(kv, currencyId);
      const current = wallet ? `Joriy: ${wallet}` : "Joriy: kiritilmagan";
      await patchUserState(kv, userId, { awaiting_wallet_currency: currencyId });
      await answer();
      await editText(
        `💳 ${currency.name} uchun hamyon raqamini kiriting:\n\n${current}\n\nYangi raqamni yozib yuboring:`,
        adminWalletEditKeyboard(currencyId)
      );
      return;
    }

    if (data.startsWith("admin_wallet_del_")) {
      const currencyId = data.replace("admin_wallet_del_", "");
      if (currencyId === SOM_CURRENCY_ID) { await answer("⛔ SO'M hamyoni o'chirilmaydi!", true); return; }
      await removeWallet(kv, currencyId);
      await answer("✅ O'chirildi");
      const currencies = await loadCurrencies(kv);
      const wallets = await loadWallets(kv);
      await editText("💳 Hamyonlar:", adminWalletsKeyboard(currencies, wallets));
      return;
    }

    if (data === "admin_spread_home") {
      await ensureSpreadsForCurrencies(kv);
      const currencies = await loadCurrencies(kv);
      const spreads = await loadSpreads(kv);
      await answer();
      await editText(TEXTS[lang].spread_header, adminSpreadsKeyboard(currencies, spreads));
      return;
    }

    if (data === "admin_spread_som_info") {
      await answer("SO'M uchun spread qo'yib bo'lmaydi.", true);
      return;
    }

    if (data.startsWith("admin_spread_pick_")) {
      const currencyId = data.replace("admin_spread_pick_", "");
      const currencies = await loadCurrencies(kv);
      const currency = currencies.find((c) => c.id === currencyId);
      if (!currency) { await answer("Topilmadi", true); return; }
      const sp = await getSpread(kv, currencyId);
      await answer();
      await editText(
        `🪙 ${currency.name}\n\nBerish: +${formatAmount(sp.give)} SO'M\nOlish: -${formatAmount(sp.take)} SO'M`,
        adminSpreadEditKeyboard(currencyId)
      );
      return;
    }

    if (data.startsWith("admin_spread_edit_")) {
      const currencyId = data.replace("admin_spread_edit_", "");
      const currencies = await loadCurrencies(kv);
      const currency = currencies.find((c) => c.id === currencyId);
      if (!currency) { await answer("Topilmadi", true); return; }
      await patchUserState(kv, userId, { awaiting_spread_give: currencyId });
      await answer();
      await editText(
        tpl(TEXTS[lang].spread_ask_give, { name: currency.name }),
        ik([[btn("⬅️ Orqaga", "admin_spread_home")]])
      );
      return;
    }

    if (data === "admin_inl_home") {
      const config = await loadConfig(kv);
      await answer();
      await editText("🌐 Til / Boshqa tugmalar\n\nO'zgartirmoqchi bo'lgan tugmani tanlang:", adminInlineButtonsKeyboard(config.button_styles || {}));
      return;
    }

    if (data.startsWith("admin_inl_pick_")) {
      const key = data.replace("admin_inl_pick_", "");
      if (!INLINE_BUTTON_KEYS.includes(key)) { await answer(); return; }
      const cur = await getButtonStyle(kv, key);
      await answer();
      await editText(
        `🎨 ${INLINE_BUTTON_ADMIN_LABELS[key]}\nJoriy rang: ${STYLE_LABELS[cur] || "⚪ Standart"}\n\nYangi rangni tanlang:`,
        inlineColorChoiceKeyboard(key)
      );
      return;
    }

    if (data.startsWith("admin_inl_set_")) {
      const remainder = data.replace("admin_inl_set_", "");
      const lastIdx = remainder.lastIndexOf("_");
      const key = remainder.slice(0, lastIdx);
      const style = remainder.slice(lastIdx + 1);
      if (!INLINE_BUTTON_KEYS.includes(key) || !STYLE_LABELS[style]) { await answer(); return; }
      await setButtonStyle(kv, key, style);
      await answer(`✅ ${INLINE_BUTTON_ADMIN_LABELS[key]} rangi o'zgartirildi`);
      const config = await loadConfig(kv);
      await editText("🌐 Til / Boshqa tugmalar\n\nO'zgartirmoqchi bo'lgan tugmani tanlang:", adminInlineButtonsKeyboard(config.button_styles || {}));
      return;
    }

    await answer();
  } catch (err) {
    console.error("handleCallbackQuery error:", err);
    try {
      await tgCall(token, "answerCallbackQuery", { callback_query_id: query.id });
    } catch {}
  }
}
