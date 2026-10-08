console.log("!!! НОВЫЙ SERVER.JS ЗАПУЩЕН !!!");
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const NODE_ENV = process.env.NODE_ENV || "production";

const ROOT = __dirname;
const INDEX_FILE = path.join(ROOT, "index.html");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "autoimperiya.db");

const db = new Database(DB_PATH);

// SQLite настройки
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// ============================================================
// DATABASE
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  balance INTEGER NOT NULL DEFAULT 5000000,
  spent INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  referral_earned INTEGER NOT NULL DEFAULT 0,
  last_daily TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS garage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  car_name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  action TEXT NOT NULL,
  car_name TEXT DEFAULT '',
  rarity TEXT DEFAULT '',
  value INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS openings (
  telegram_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  started_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_garage_user
ON garage(telegram_id);

CREATE INDEX IF NOT EXISTS idx_history_user
ON history(telegram_id);

CREATE INDEX IF NOT EXISTS idx_history_date
ON history(telegram_id, created_at);
`);

// ============================================================
// CASES
// ============================================================

const CASES = {
  starter: {
    id: "starter",
    name: "Стартовый кейс",
    price: 300000,
    chances: {
      common: 92,
      rare: 7,
      epic: 0.9,
      legendary: 0.09,
      mythic: 0.01
    }
  },

  street: {
    id: "street",
    name: "Уличный кейс",
    price: 900000,
    chances: {
      common: 65,
      rare: 29,
      epic: 5,
      legendary: 0.9,
      mythic: 0.1
    }
  },

  premium: {
    id: "premium",
    name: "Премиум кейс",
    price: 5000000,
    chances: {
      common: 25,
      rare: 45,
      epic: 25,
      legendary: 4.5,
      mythic: 0.5
    }
  },

  elite: {
    id: "elite",
    name: "Элитный кейс",
    price: 15000000,
    chances: {
      common: 5,
      rare: 25,
      epic: 45,
      legendary: 23,
      mythic: 2
    }
  },

  imperial: {
    id: "imperial",
    name: "Императорский кейс",
    price: 100000000,
    chances: {
      common: 0,
      rare: 5,
      epic: 20,
      legendary: 45,
      mythic: 30
    }
  }
};

// ============================================================
// CARS
// ============================================================

const CARS = [
  // COMMON
  {
    name: "Lada VAZ 2114",
    rarity: "common",
    value: 180000
  },
  {
    name: "Lada VAZ 2109",
    rarity: "common",
    value: 160000
  },
  {
    name: "Lada Priora",
    rarity: "common",
    value: 350000
  },
  {
    name: "Lada Granta",
    rarity: "common",
    value: 550000
  },
  {
    name: "Daewoo Matiz",
    rarity: "common",
    value: 280000
  },
  {
    name: "Daewoo Nexia",
    rarity: "common",
    value: 420000
  },
  {
    name: "УАЗ Patriot",
    rarity: "common",
    value: 750000
  },
  {
    name: "Lada Vesta",
    rarity: "common",
    value: 1000000
  },
  {
    name: "Hyundai Solaris",
    rarity: "common",
    value: 1100000
  },
  {
    name: "Kia Rio",
    rarity: "common",
    value: 1150000
  },
  {
    name: "Renault Logan",
    rarity: "common",
    value: 850000
  },
  {
    name: "Ford Focus",
    rarity: "common",
    value: 1300000
  },
  {
    name: "Skoda Octavia",
    rarity: "common",
    value: 1700000
  },
  {
    name: "Toyota Corolla",
    rarity: "common",
    value: 1800000
  },

  // RARE
  {
    name: "Volkswagen Passat",
    rarity: "rare",
    value: 1900000
  },
  {
    name: "Haval F7",
    rarity: "rare",
    value: 2200000
  },
  {
    name: "Toyota Camry 70",
    rarity: "rare",
    value: 3000000
  },
  {
    name: "BMW E60",
    rarity: "rare",
    value: 2200000
  },
  {
    name: "BMW E90",
    rarity: "rare",
    value: 2400000
  },
  {
    name: "Mercedes W212",
    rarity: "rare",
    value: 3000000
  },
  {
    name: "Audi A6 C7",
    rarity: "rare",
    value: 3000000
  },
  {
    name: "Subaru WRX",
    rarity: "rare",
    value: 1900000
  },

  // EPIC
  {
    name: "BMW M4 F82",
    rarity: "epic",
    value: 5000000
  },
  {
    name: "BMW M5 F10",
    rarity: "epic",
    value: 6000000
  },
  {
    name: "BMW M6",
    rarity: "epic",
    value: 7000000
  },
  {
    name: "BMW M3 Competition",
    rarity: "epic",
    value: 7500000
  },
  {
    name: "BMW M4 Competition",
    rarity: "epic",
    value: 8500000
  },
  {
    name: "Mercedes-AMG GT",
    rarity: "epic",
    value: 9000000
  },
  {
    name: "Nissan GT-R R35",
    rarity: "epic",
    value: 9500000
  },

  // LEGENDARY
  {
    name: "Audi RS6 C8",
    rarity: "legendary",
    value: 10000000
  },
  {
    name: "BMW M5 CS",
    rarity: "legendary",
    value: 10000000
  },
  {
    name: "BMW M8 Competition",
    rarity: "legendary",
    value: 12000000
  },
  {
    name: "Mercedes-AMG GT 63",
    rarity: "legendary",
    value: 14000000
  },
  {
    name: "Porsche 911 Turbo S",
    rarity: "legendary",
    value: 16000000
  },

  // MYTHIC
  {
    name: "Lamborghini Huracan",
    rarity: "mythic",
    value: 20000000
  },
  {
    name: "Lamborghini Urus",
    rarity: "mythic",
    value: 22000000
  },
  {
    name: "McLaren 720S",
    rarity: "mythic",
    value: 25000000
  },
  {
    name: "Lamborghini Aventador",
    rarity: "mythic",
    value: 25000000
  },
  {
    name: "Ferrari 488",
    rarity: "mythic",
    value: 28000000
  },
  {
    name: "Ferrari F8 Tributo",
    rarity: "mythic",
    value: 32000000
  },
  {
    name: "McLaren 765LT",
    rarity: "mythic",
    value: 35000000
  },
  {
    name: "Bentley Continental GT",
    rarity: "mythic",
    value: 15000000
  },
  {
    name: "Porsche 918 Spyder",
    rarity: "mythic",
    value: 45000000
  },
  {
    name: "Rolls-Royce Phantom",
    rarity: "mythic",
    value: 50000000
  },
  {
    name: "Bugatti Chiron",
    rarity: "mythic",
    value: 100000000
  }
];

// ============================================================
// HELPERS
// ============================================================

function now() {
  return Date.now();
}

function todayString() {
  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function json(res, status, data) {
  const body = JSON.stringify(data);

  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function text(res, status, value, contentType = "text/plain; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.end(value);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Telegram-Init-Data, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
}

function sendError(res, status, message) {
  return json(res, status, {
    ok: false,
    error: message
  });
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function randomFrom(array) {
  return array[randomInt(array.length)];
}

function weightedRarity(chances) {
  const entries = Object.entries(chances);

  let total = 0;

  for (const [, weight] of entries) {
    total += Number(weight) || 0;
  }

  if (total <= 0) {
    return "common";
  }

  let random = Math.random() * total;

  for (const [rarity, weight] of entries) {
    random -= Number(weight) || 0;

    if (random <= 0) {
      return rarity;
    }
  }

  return entries[entries.length - 1][0];
}

function getCarByRarity(rarity) {
  const list = CARS.filter(car => car.rarity === rarity);

  if (!list.length) {
    return CARS[0];
  }

  return randomFrom(list);
}

function generateReferralCode(telegramId) {
  const hash = crypto
    .createHash("sha256")
    .update(String(telegramId))
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

  return "AE" + hash;
}

function levelFromSpent(spent) {
  spent = Number(spent) || 0;

  if (spent < 1000000) return 1;
  if (spent < 5000000) return 2;
  if (spent < 10000000) return 3;
  if (spent < 25000000) return 4;
  if (spent < 50000000) return 5;
  if (spent < 100000000) return 6;
  if (spent < 250000000) return 7;
  if (spent < 500000000) return 8;
  if (spent < 1000000000) return 9;

  return 10;
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.telegram_id,
    telegram_id: user.telegram_id,
    username: user.username || "",
    first_name: user.first_name || "",
    last_name: user.last_name || "",

    balance: Number(user.balance) || 0,
    spent: Number(user.spent) || 0,
    opened: Number(user.opened) || 0,
    sold: Number(user.sold) || 0,

    level: levelFromSpent(user.spent),

    referralCode: user.referral_code || "",
    referral_code: user.referral_code || "",

    referralEarned: Number(user.referral_earned) || 0,
    referral_earned: Number(user.referral_earned) || 0,

    lastDaily: user.last_daily || ""
  };
}

function serializeGarage(telegramId) {
  return db
    .prepare(`
      SELECT
        id,
        car_name AS name,
        car_name,
        rarity,
        value,
        created_at AS createdAt
      FROM garage
      WHERE telegram_id = ?
      ORDER BY id DESC
    `)
    .all(telegramId);
}

function serializeHistory(telegramId) {
  return db
    .prepare(`
      SELECT
        id,
        action,
        car_name AS name,
        car_name,
        rarity,
        value,
        amount,
        created_at AS createdAt
      FROM history
      WHERE telegram_id = ?
      ORDER BY id DESC
      LIMIT 100
    `)
    .all(telegramId);
}

function serializeCases() {
  return Object.values(CASES).map(c => ({
    id: c.id,
    name: c.name,
    price: c.price,
    chances: c.chances
  }));
}

function getUser(telegramId) {
  return db
    .prepare(`
      SELECT *
      FROM users
      WHERE telegram_id = ?
    `)
    .get(String(telegramId));
}

function ensureUser(tgUser) {
  const telegramId = String(tgUser.id);

  let user = getUser(telegramId);

  if (user) {
    db.prepare(`
      UPDATE users
      SET
        username = ?,
        first_name = ?,
        last_name = ?,
        updated_at = ?
      WHERE telegram_id = ?
    `).run(
      tgUser.username || "",
      tgUser.first_name || "",
      tgUser.last_name || "",
      now(),
      telegramId
    );

    return getUser(telegramId);
  }

  const referralCode = generateReferralCode(telegramId);

  db.prepare(`
    INSERT INTO users (
      telegram_id,
      username,
      first_name,
      last_name,
      balance,
      spent,
      opened,
      sold,
      referral_code,
      referral_earned,
      last_daily,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, 0, '', ?, ?)
  `).run(
    telegramId,
    tgUser.username || "",
    tgUser.first_name || "",
    tgUser.last_name || "",
    5000000,
    referralCode,
    now(),
    now()
  );

  return getUser(telegramId);
}

// ============================================================
// TELEGRAM AUTH
// ============================================================

function getInitDataFromRequest(req, body) {
  const header = req.headers["x-telegram-init-data"];

  if (header) {
    return String(header);
  }

  if (body && body.initData) {
    return String(body.initData);
  }

  if (body && body.init_data) {
    return String(body.init_data);
  }

  return "";
}

function validateTelegramInitData(initData) {
  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN не настроен на сервере");
  }

  if (!initData) {
    throw new Error("Telegram initData отсутствует");
  }

  const params = new URLSearchParams(initData);

  const hash = params.get("hash");

  if (!hash) {
    throw new Error("Telegram hash отсутствует");
  }

  params.delete("hash");

  const pairs = [];

  for (const [key, value] of params.entries()) {
    pairs.push(`${key}=${value}`);
  }

  pairs.sort();

  const dataCheckString = pairs.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (
    calculatedHash.length !== hash.length ||
    !crypto.timingSafeEqual(
      Buffer.from(calculatedHash),
      Buffer.from(hash)
    )
  ) {
    throw new Error("Неверная Telegram авторизация");
  }

  const authDate = Number(params.get("auth_date") || 0);

  if (authDate) {
    const age = Math.floor(Date.now() / 1000) - authDate;

    // 24 часа
    if (age > 86400) {
      throw new Error("Telegram авторизация устарела");
    }

    if (age < -60) {
      throw new Error("Некорректная дата Telegram авторизации");
    }
  }

  const userRaw = params.get("user");

  if (!userRaw) {
    throw new Error("Telegram user отсутствует");
  }

  let tgUser;

  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    throw new Error("Не удалось прочитать Telegram user");
  }

  if (!tgUser.id) {
    throw new Error("Telegram user.id отсутствует");
  }

  return tgUser;
}

// ============================================================
// REQUEST BODY
// ============================================================

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", chunk => {
      data += chunk.toString();

      if (data.length > 2 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Слишком большой запрос"));
      }
    });

    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });

    req.on("error", reject);
  });
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

async function authenticate(req, body) {
  const initData = getInitDataFromRequest(req, body);

  const tgUser = validateTelegramInitData(initData);

  const user = ensureUser(tgUser);

  return {
    tgUser,
    user
  };
}

// ============================================================
// DAILY REWARD
// ============================================================

function dailyReward(user) {
  const today = todayString();

  if (user.last_daily === today) {
    return {
      claimed: false,
      reward: 0,
      balance: Number(user.balance)
    };
  }

  const reward = 250000;

  db.prepare(`
    UPDATE users
    SET
      balance = balance + ?,
      last_daily = ?,
      updated_at = ?
    WHERE telegram_id = ?
  `).run(
    reward,
    today,
    now(),
    user.telegram_id
  );

  db.prepare(`
    INSERT INTO history (
      telegram_id,
      action,
      car_name,
      rarity,
      value,
      amount,
      created_at
    )
    VALUES (?, 'daily', '', '', 0, ?, ?)
  `).run(
    user.telegram_id,
    reward,
    now()
  );

  const updated = getUser(user.telegram_id);

  return {
    claimed: true,
    reward,
    balance: Number(updated.balance)
  };
}

// ============================================================
// OPEN CASE
// ============================================================

function openCase(user, caseId) {
  const selectedCase = CASES[caseId];

  if (!selectedCase) {
    throw new Error("Кейс не найден");
  }

  const existingOpening = db
    .prepare(`
      SELECT *
      FROM openings
      WHERE telegram_id = ?
    `)
    .get(user.telegram_id);

  // Защита от одновременного открытия
  if (existingOpening) {
    const age = now() - Number(existingOpening.started_at);

    if (age < 10 * 60 * 1000) {
      throw new Error("Кейс уже открывается");
    }

    db.prepare(`
      DELETE FROM openings
      WHERE telegram_id = ?
    `).run(user.telegram_id);
  }

  if (Number(user.balance) < selectedCase.price) {
    throw new Error("Недостаточно средств");
  }

  db.prepare(`
    INSERT INTO openings (
      telegram_id,
      case_id,
      started_at
    )
    VALUES (?, ?, ?)
  `).run(
    user.telegram_id,
    selectedCase.id,
    now()
  );

  try {
    const rarity = weightedRarity(selectedCase.chances);
    const car = getCarByRarity(rarity);

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE users
        SET
          balance = balance - ?,
          spent = spent + ?,
          opened = opened + 1,
          updated_at = ?
        WHERE telegram_id = ?
      `).run(
        selectedCase.price,
        selectedCase.price,
        now(),
        user.telegram_id
      );

      db.prepare(`
        INSERT INTO garage (
          telegram_id,
          car_name,
          rarity,
          value,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        user.telegram_id,
        car.name,
        car.rarity,
        car.value,
        now()
      );

      db.prepare(`
        INSERT INTO history (
          telegram_id,
          action,
          car_name,
          rarity,
          value,
          amount,
          created_at
        )
        VALUES (?, 'open', ?, ?, ?, ?, ?)
      `).run(
        user.telegram_id,
        car.name,
        car.rarity,
        car.value,
        selectedCase.price,
        now()
      );
    });

    transaction();

    // Реферальный бонус
    const currentUser = getUser(user.telegram_id);

    if (
      currentUser &&
      Number(currentUser.spent) > 0 &&
      currentUser.referred_by
    ) {
      // Бонус начисляется только от фактически потраченной суммы.
      // Чтобы не начислять повторно на каждый запрос,
      // используем 1% от открытия.
      const referrer = getUser(currentUser.referred_by);

      if (referrer) {
        const bonus = Math.floor(selectedCase.price * 0.01);

        db.prepare(`
          UPDATE users
          SET
            balance = balance + ?,
            referral_earned = referral_earned + ?,
            updated_at = ?
          WHERE telegram_id = ?
        `).run(
          bonus,
          bonus,
          now(),
          referrer.telegram_id
        );
      }
    }

    return {
      car: {
        name: car.name,
        rarity: car.rarity,
        value: car.value
      },
      case: {
        id: selectedCase.id,
        name: selectedCase.name,
        price: selectedCase.price
      },
      user: publicUser(getUser(user.telegram_id)),
      balance: Number(getUser(user.telegram_id).balance),
      garage: serializeGarage(user.telegram_id)
    };
  } finally {
    db.prepare(`
      DELETE FROM openings
      WHERE telegram_id = ?
    `).run(user.telegram_id);
  }
}

// ============================================================
// KEEP CAR
// ============================================================

function keepCar(user, name) {
  const car = db
    .prepare(`
      SELECT *
      FROM garage
      WHERE telegram_id = ?
        AND car_name = ?
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(user.telegram_id, name);

  if (!car) {
    throw new Error("Автомобиль не найден");
  }

  return {
    ok: true,
    user: publicUser(getUser(user.telegram_id)),
    garage: serializeGarage(user.telegram_id)
  };
}

// ============================================================
// SELL CAR FROM CASE
// ============================================================

function sellCarByName(user, name) {
  const car = db
    .prepare(`
      SELECT *
      FROM garage
      WHERE telegram_id = ?
        AND car_name = ?
      ORDER BY id DESC
      LIMIT 1
    `)
    .get(user.telegram_id, name);

  if (!car) {
    throw new Error("Автомобиль не найден");
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      DELETE FROM garage
      WHERE id = ?
    `).run(car.id);

    db.prepare(`
      UPDATE users
      SET
        balance = balance + ?,
        sold = sold + 1,
        updated_at = ?
      WHERE telegram_id = ?
    `).run(
      car.value,
      now(),
      user.telegram_id
    );

    db.prepare(`
      INSERT INTO history (
        telegram_id,
        action,
        car_name,
        rarity,
        value,
        amount,
        created_at
      )
      VALUES (?, 'sell', ?, ?, ?, ?, ?)
    `).run(
      user.telegram_id,
      car.car_name,
      car.rarity,
      car.value,
      car.value,
      now()
    );
  });

  transaction();

  const updated = getUser(user.telegram_id);

  return {
    ok: true,
    sold: {
      name: car.car_name,
      rarity: car.rarity,
      value: car.value
    },
    balance: Number(updated.balance),
    user: publicUser(updated),
    garage: serializeGarage(user.telegram_id)
  };
}

// ============================================================
// GARAGE SELL BY INDEX
// ============================================================

function sellGarageByIndex(user, index) {
  const cars = serializeGarage(user.telegram_id);

  const numericIndex = Number(index);

  if (
    !Number.isInteger(numericIndex) ||
    numericIndex < 0 ||
    numericIndex >= cars.length
  ) {
    throw new Error("Автомобиль не найден");
  }

  const selected = cars[numericIndex];

  const car = db
    .prepare(`
      SELECT *
      FROM garage
      WHERE id = ?
        AND telegram_id = ?
    `)
    .get(
      selected.id,
      user.telegram_id
    );

  if (!car) {
    throw new Error("Автомобиль не найден");
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      DELETE FROM garage
      WHERE id = ?
    `).run(car.id);

    db.prepare(`
      UPDATE users
      SET
        balance = balance + ?,
        sold = sold + 1,
        updated_at = ?
      WHERE telegram_id = ?
    `).run(
      car.value,
      now(),
      user.telegram_id
    );

    db.prepare(`
      INSERT INTO history (
        telegram_id,
        action,
        car_name,
        rarity,
        value,
        amount,
        created_at
      )
      VALUES (?, 'sell', ?, ?, ?, ?, ?)
    `).run(
      user.telegram_id,
      car.car_name,
      car.rarity,
      car.value,
      car.value,
      now()
    );
  });

  transaction();

  const updated = getUser(user.telegram_id);

  return {
    ok: true,
    sold: {
      name: car.car_name,
      rarity: car.rarity,
      value: car.value
    },
    balance: Number(updated.balance),
    user: publicUser(updated),
    garage: serializeGarage(user.telegram_id)
  };
}

// ============================================================
// MARKET BUY
// ============================================================

function marketBuy(user, name) {
  const car = CARS.find(car => car.name === name);

  if (!car) {
    throw new Error("Автомобиль не найден");
  }

  if (Number(user.balance) < car.value) {
    throw new Error("Недостаточно средств");
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE users
      SET
        balance = balance - ?,
        spent = spent + ?,
        updated_at = ?
      WHERE telegram_id = ?
    `).run(
      car.value,
      car.value,
      now(),
      user.telegram_id
    );

    db.prepare(`
      INSERT INTO garage (
        telegram_id,
        car_name,
        rarity,
        value,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      user.telegram_id,
      car.name,
      car.rarity,
      car.value,
      now()
    );

    db.prepare(`
      INSERT INTO history (
        telegram_id,
        action,
        car_name,
        rarity,
        value,
        amount,
        created_at
      )
      VALUES (?, 'market_buy', ?, ?, ?, ?, ?)
    `).run(
      user.telegram_id,
      car.name,
      car.rarity,
      car.value,
      car.value,
      now()
    );
  });

  transaction();

  const updated = getUser(user.telegram_id);

  return {
    ok: true,
    bought: {
      name: car.name,
      rarity: car.rarity,
      value: car.value
    },
    balance: Number(updated.balance),
    user: publicUser(updated),
    garage: serializeGarage(user.telegram_id)
  };
}

// ============================================================
// REFERRAL
// ============================================================

function applyReferral(user, code) {
  if (!code) {
    return publicUser(user);
  }

  const cleanCode = String(code).trim().toUpperCase();

  if (!cleanCode) {
    return publicUser(user);
  }

  if (user.referred_by) {
    return publicUser(user);
  }

  const referrer = db
    .prepare(`
      SELECT *
      FROM users
      WHERE referral_code = ?
      LIMIT 1
    `)
    .get(cleanCode);

  if (!referrer) {
    throw new Error("Реферальный код не найден");
  }

  if (referrer.telegram_id === user.telegram_id) {
    throw new Error("Нельзя использовать собственный код");
  }

  db.prepare(`
    UPDATE users
    SET
      referred_by = ?,
      updated_at = ?
    WHERE telegram_id = ?
  `).run(
    referrer.telegram_id,
    now(),
    user.telegram_id
  );

  return publicUser(getUser(user.telegram_id));
}

// ============================================================
// CLEAN STALE OPENINGS
// ============================================================

function cleanupOpenings() {
  db.prepare(`
    DELETE FROM openings
    WHERE started_at < ?
  `).run(
    now() - 10 * 60 * 1000
  );
}

setInterval(cleanupOpenings, 60 * 1000);

// ============================================================
// ROUTER
// ============================================================

async function handleApi(req, res, url, body) {
  const pathname = url.pathname;

  // ----------------------------------------------------------
  // HEALTH
  // ----------------------------------------------------------

  if (pathname === "/api/health" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      status: "ok",
      service: "autoimperiya",
      node: process.version,
      time: new Date().toISOString()
    });
  }

  // ----------------------------------------------------------
  // CONFIG
  // ----------------------------------------------------------

  if (pathname === "/api/config" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      cases: serializeCases(),
      cars: CARS,
      features: {
        referrals: true,
        daily: true,
        garage: true,
        market: true,
        telegramAuth: true
      }
    });
  }

  // ----------------------------------------------------------
  // AUTH
  // ----------------------------------------------------------

  if (
    pathname === "/api/auth" &&
    (
      req.method === "POST" ||
      req.method === "GET"
    )
  ) {
    try {
      let authBody = body;

      if (req.method === "GET") {
        authBody = {};

        if (url.searchParams.get("initData")) {
          authBody.initData = url.searchParams.get("initData");
        }

        if (url.searchParams.get("init_data")) {
          authBody.init_data = url.searchParams.get("init_data");
        }
      }

      const { user } = await authenticate(req, authBody);

      if (authBody.referral || authBody.ref) {
        try {
          applyReferral(
            user,
            authBody.referral || authBody.ref
          );
        } catch {
          // Неверный реферальный код не ломает авторизацию
        }
      }

      const updated = getUser(user.telegram_id);

      return json(res, 200, {
        ok: true,
        user: publicUser(updated),
        balance: Number(updated.balance),
        garage: serializeGarage(updated.telegram_id),
        history: serializeHistory(updated.telegram_id),
        cases: serializeCases()
      });
    } catch (error) {
      return sendError(
        res,
        401,
        error.message || "Ошибка авторизации"
      );
    }
  }

  // Все остальные API требуют Telegram auth
  let auth;

  try {
    auth = await authenticate(req, body);
  } catch (error) {
    return sendError(
      res,
      401,
      error.message || "Ошибка авторизации"
    );
  }

  const user = auth.user;

  // ----------------------------------------------------------
  // USER
  // ----------------------------------------------------------

  if (pathname === "/api/user" && req.method === "GET") {
    const fresh = getUser(user.telegram_id);

    return json(res, 200, {
      ok: true,
      user: publicUser(fresh),
      balance: Number(fresh.balance),
      garage: serializeGarage(fresh.telegram_id),
      history: serializeHistory(fresh.telegram_id)
    });
  }

  // ----------------------------------------------------------
  // CASES
  // ----------------------------------------------------------

  if (pathname === "/api/cases" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      cases: serializeCases()
    });
  }

  // ----------------------------------------------------------
  // OPEN CASE
  // ----------------------------------------------------------

  if (
    pathname === "/api/cases/open" &&
    req.method === "POST"
  ) {
    try {
      const result = openCase(
        user,
        body.caseId || body.case_id
      );

      return json(res, 200, {
        ok: true,
        ...result
      });
    } catch (error) {
      return sendError(
        res,
        400,
        error.message || "Не удалось открыть кейс"
      );
    }
  }

  // ----------------------------------------------------------
  // KEEP
  // ----------------------------------------------------------

  if (
    pathname === "/api/cases/keep" &&
    req.method === "POST"
  ) {
    try {
      const result = keepCar(
        user,
        body.name
      );

      return json(res, 200, result);
    } catch (error) {
      return sendError(
        res,
        400,
        error.message || "Не удалось сохранить автомобиль"
      );
    }
  }

  // ----------------------------------------------------------
  // SELL
  // ----------------------------------------------------------

  if (
    pathname === "/api/cases/sell" &&
    req.method === "POST"
  ) {
    try {
      const result = sellCarByName(
        user,
        body.name
      );

      return json(res, 200, result);
    } catch (error) {
      return sendError(
        res,
        400,
        error.message || "Не удалось продать автомобиль"
      );
    }
  }

  // ----------------------------------------------------------
  // GARAGE
  // ----------------------------------------------------------

  if (
    pathname === "/api/garage" &&
    req.method === "GET"
  ) {
    return json(res, 200, {
      ok: true,
      garage: serializeGarage(user.telegram_id)
    });
  }

  if (
    pathname === "/api/garage/sell" &&
    req.method === "POST"
  ) {
    try {
      const result = sellGarageByIndex(
        user,
        body.index
      );

      return json(res, 200, result);
    } catch (error) {
      return sendError(
        res,
        400,
        error.message || "Не удалось продать автомобиль"
      );
    }
  }

  // ----------------------------------------------------------
  // MARKET
  // ----------------------------------------------------------

  if (
    pathname === "/api/market" &&
    req.method === "GET"
  ) {
    return json(res, 200, {
      ok: true,
      cars: CARS
    });
  }

  if (
    pathname === "/api/market/buy" &&
    req.method === "POST"
  ) {
    try {
      const result = marketBuy(
        user,
        body.name
      );

      return json(res, 200, result);
    } catch (error) {
      return sendError(
        res,
        400,
        error.message || "Не удалось купить автомобиль"
      );
    }
  }

  // ----------------------------------------------------------
  // HISTORY
  // ----------------------------------------------------------

  if (
    pathname === "/api/history" &&
    req.method === "GET"
  ) {
    return json(res, 200, {
      ok: true,
      history: serializeHistory(user.telegram_id)
    });
  }

  // ----------------------------------------------------------
  // DAILY
  // ----------------------------------------------------------

  if (
    pathname === "/api/daily" &&
    req.method === "POST"
  ) {
    try {
      const result = dailyReward(user);

      const updated = getUser(user.telegram_id);

      return json(res, 200, {
        ok: true,
        ...result,
        user: publicUser(updated)
      });
    } catch (error) {
      return sendError(
        res,
        400,
        error.message || "Ошибка ежедневной награды"
      );
    }
  }

  if (
    pathname === "/api/daily" &&
    req.method === "GET"
  ) {
    const fresh = getUser(user.telegram_id);
    const today = todayString();

    return json(res, 200, {
      ok: true,
      claimed: fresh.last_daily === today,
      reward: 250000
    });
  }

  // ----------------------------------------------------------
  // REFERRAL
  // ----------------------------------------------------------

  if (
    pathname === "/api/referral" &&
    req.method === "GET"
  ) {
    const fresh = getUser(user.telegram_id);

    const count = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE referred_by = ?
      `)
      .get(user.telegram_id);

    return json(res, 200, {
      ok: true,
      code: fresh.referral_code,
      referralCode: fresh.referral_code,
      referrals: Number(count.count) || 0,
      earned: Number(fresh.referral_earned) || 0,
      referralEarned: Number(fresh.referral_earned) || 0
    });
  }

  if (
    pathname === "/api/referral/apply" &&
    req.method === "POST"
  ) {
    try {
      const updatedUser = applyReferral(
        user,
        body.code || body.referralCode
      );

      return json(res, 200, {
        ok: true,
        user: updatedUser
      });
    } catch (error) {
      return sendError(
        res,
        400,
        error.message || "Не удалось применить код"
      );
    }
  }

  // ----------------------------------------------------------
  // 404
  // ----------------------------------------------------------

  return sendError(
    res,
    404,
    "API route not found"
  );
}

// ============================================================
// STATIC FILES
// ============================================================

function serveIndex(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendError(
      res,
      405,
      "Method Not Allowed"
    );
  }

  if (!fs.existsSync(INDEX_FILE)) {
    return sendError(
      res,
      500,
      "index.html не найден"
    );
  }

  const stat = fs.statSync(INDEX_FILE);

  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    "text/html; charset=utf-8"
  );
  res.setHeader(
    "Cache-Control",
    "no-cache, no-store, must-revalidate"
  );
  res.setHeader(
    "Content-Length",
    stat.size
  );

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(INDEX_FILE).pipe(res);
}

// ============================================================
// SERVER
// ============================================================

const server = http.createServer(async (req, res) => {
  setCors(res);

  // OPTIONS
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const parsedUrl = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );

    const pathname = parsedUrl.pathname;

    // API
    if (pathname.startsWith("/api/")) {
      const body = await readBody(req);

      await handleApi(
        req,
        res,
        parsedUrl,
        body
      );

      return;
    }

    // favicon
    if (pathname === "/favicon.ico") {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Всё остальное отдаём как Mini App
    serveIndex(req, res);
  } catch (error) {
    console.error("SERVER ERROR:", error);

    if (!res.headersSent) {
      sendError(
        res,
        500,
        NODE_ENV === "production"
          ? "Внутренняя ошибка сервера"
          : error.message
      );
    } else {
      res.end();
    }
  }
});

server.on("error", error => {
  console.error("HTTP SERVER ERROR:", error);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("======================================");
  console.log("🚗 АВТОИМПЕРИЯ SERVER");
  console.log("======================================");
  console.log(`PORT: ${PORT}`);
  console.log(`NODE: ${process.version}`);
  console.log(`ENV: ${NODE_ENV}`);
  console.log(`DB: ${DB_PATH}`);
  console.log(`BOT TOKEN: ${BOT_TOKEN ? "configured" : "NOT SET"}`);
  console.log("======================================");
  console.log("SERVER STARTED");
  console.log("======================================");
});
