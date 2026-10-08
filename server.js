// ============================================================
// АВТОИМПЕРИЯ — SERVER.JS
// Telegram Mini App / Express / SQLite
// ============================================================

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();

// ============================================================
// CONFIG
// ============================================================

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const NODE_ENV = process.env.NODE_ENV || "production";

const DB_PATH =
  process.env.DB_PATH ||
  path.join(__dirname, "autoempire.sqlite");

const START_BALANCE = 5000000;
const REFERRAL_BONUS = 500000;

// ============================================================
// DATABASE
// ============================================================

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// ============================================================
// TABLES
// ============================================================

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  balance INTEGER NOT NULL DEFAULT ${START_BALANCE},
  spent INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  referral_id INTEGER DEFAULT NULL,
  referral_bonus_received INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS garage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  rarity TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  name TEXT DEFAULT '',
  rarity TEXT DEFAULT '',
  price INTEGER DEFAULT 0,
  case_id TEXT DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS openings (
  user_id INTEGER PRIMARY KEY,
  case_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_garage_user
ON garage(user_id);

CREATE INDEX IF NOT EXISTS idx_history_user
ON history(user_id);

CREATE INDEX IF NOT EXISTS idx_openings_created
ON openings(created_at);
`);

// ============================================================
// EXPRESS
// ============================================================

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ============================================================
// CORS
// ============================================================

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Telegram-Init-Data, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

// ============================================================
// API CACHE PROTECTION
// ============================================================

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ============================================================
// CASES
// ============================================================

const CASES = {
  starter: {
    id: "starter",
    name: "СТАРТОВЫЙ КЕЙС",
    price: 300000,
    weights: {
      common: 92,
      rare: 7,
      epic: 0.9,
      legendary: 0.09,
      mythic: 0.01
    }
  },

  street: {
    id: "street",
    name: "ГОРОДСКОЙ КЕЙС",
    price: 900000,
    weights: {
      common: 65,
      rare: 29,
      epic: 5,
      legendary: 0.9,
      mythic: 0.1
    }
  },

  premium: {
    id: "premium",
    name: "ПРЕМИУМ КЕЙС",
    price: 5000000,
    weights: {
      common: 25,
      rare: 45,
      epic: 25,
      legendary: 4.5,
      mythic: 0.5
    }
  },

  elite: {
    id: "elite",
    name: "ЭЛИТНЫЙ КЕЙС",
    price: 15000000,
    weights: {
      common: 5,
      rare: 25,
      epic: 45,
      legendary: 23,
      mythic: 2
    }
  },

  imperial: {
    id: "imperial",
    name: "ИМПЕРСКИЙ КЕЙС",
    price: 100000000,
    weights: {
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

const CARS = {
  common: [
    { name: "Lada VAZ 2114", price: 180000 },
    { name: "Lada VAZ 2109", price: 160000 },
    { name: "Lada Priora", price: 350000 },
    { name: "Lada Granta", price: 550000 },
    { name: "Daewoo Matiz", price: 280000 },
    { name: "Daewoo Nexia", price: 420000 },
    { name: "УАЗ Patriot", price: 750000 },
    { name: "Lada Vesta", price: 1000000 },
    { name: "Hyundai Solaris", price: 1100000 },
    { name: "Kia Rio", price: 1150000 },
    { name: "Renault Logan", price: 850000 },
    { name: "Ford Focus", price: 1300000 },
    { name: "Skoda Octavia", price: 1700000 },
    { name: "Toyota Corolla", price: 1800000 }
  ],

  rare: [
    { name: "Volkswagen Passat", price: 1900000 },
    { name: "Haval F7", price: 2200000 },
    { name: "Toyota Camry 70", price: 3000000 },
    { name: "BMW E60", price: 2200000 },
    { name: "BMW E90", price: 2400000 },
    { name: "Mercedes W212", price: 3000000 },
    { name: "Audi A6 C7", price: 3000000 },
    { name: "Subaru WRX", price: 1900000 }
  ],

  epic: [
    { name: "BMW M4 F82", price: 5000000 },
    { name: "BMW M5 F10", price: 6000000 },
    { name: "BMW M6", price: 7000000 },
    { name: "BMW M3 Competition", price: 7500000 },
    { name: "BMW M4 Competition", price: 8500000 },
    { name: "Mercedes-AMG GT", price: 9000000 },
    { name: "Nissan GT-R R35", price: 9500000 }
  ],

  legendary: [
    { name: "Audi RS6 C8", price: 10000000 },
    { name: "BMW M5 CS", price: 10000000 },
    { name: "BMW M8 Competition", price: 12000000 },
    { name: "Mercedes-AMG GT 63", price: 14000000 },
    { name: "Porsche 911 Turbo S", price: 16000000 }
  ],

  mythic: [
    { name: "Lamborghini Huracan", price: 20000000 },
    { name: "Lamborghini Urus", price: 22000000 },
    { name: "McLaren 720S", price: 25000000 },
    { name: "Lamborghini Aventador", price: 25000000 },
    { name: "Ferrari 488", price: 28000000 },
    { name: "Ferrari F8 Tributo", price: 32000000 },
    { name: "McLaren 765LT", price: 35000000 },
    { name: "Bentley Continental GT", price: 15000000 },
    { name: "Porsche 918 Spyder", price: 45000000 },
    { name: "Rolls-Royce Phantom", price: 50000000 },
    { name: "Bugatti Chiron", price: 100000000 }
  ]
};

const RARITY_ORDER = [
  "common",
  "rare",
  "epic",
  "legendary",
  "mythic"
];

// ============================================================
// LEVEL
// ============================================================

function calculateLevel(spent) {
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

// ============================================================
// UTILS
// ============================================================

function now() {
  return Math.floor(Date.now() / 1000);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function weightedRarity(weights) {
  const total = Object.values(weights).reduce(
    (sum, value) => sum + Number(value || 0),
    0
  );

  if (total <= 0) {
    return "common";
  }

  let random = Math.random() * total;

  for (const rarity of RARITY_ORDER) {
    const weight = Number(weights[rarity] || 0);

    if (random < weight) {
      return rarity;
    }

    random -= weight;
  }

  return "common";
}

function getCarByName(name) {
  const target = normalizeString(name);

  for (const rarity of RARITY_ORDER) {
    const found = CARS[rarity].find(
      car => car.name === target
    );

    if (found) {
      return {
        ...found,
        rarity
      };
    }
  }

  return null;
}

function getRandomCar(caseId) {
  const gameCase = CASES[caseId];

  if (!gameCase) {
    throw new Error("Кейс не найден");
  }

  const rarity = weightedRarity(gameCase.weights);
  const pool = CARS[rarity];

  if (!pool || pool.length === 0) {
    return getRandomCar(caseId);
  }

  const car = pickRandom(pool);

  return {
    ...car,
    rarity
  };
}

// ============================================================
// TELEGRAM AUTH
// ============================================================

function validateTelegramInitData(initData) {
  if (!BOT_TOKEN) {
    return {
      ok: false,
      error: "BOT_TOKEN не настроен на сервере"
    };
  }

  if (!initData || typeof initData !== "string") {
    return {
      ok: false,
      error: "Telegram initData отсутствует"
    };
  }

  try {
    const params = new URLSearchParams(initData);

    const hash = params.get("hash");

    if (!hash) {
      return {
        ok: false,
        error: "Telegram hash отсутствует"
      };
    }

    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const hashBuffer = Buffer.from(hash, "hex");
    const calculatedBuffer = Buffer.from(calculatedHash, "hex");

    if (
      hashBuffer.length !== calculatedBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)
    ) {
      return {
        ok: false,
        error: "Неверная подпись Telegram"
      };
    }

    const authDate = Number(params.get("auth_date") || 0);

    if (authDate > 0) {
      const age = Math.floor(Date.now() / 1000) - authDate;

      // Telegram initData не должен быть старше 24 часов.
      if (age > 86400) {
        return {
          ok: false,
          error: "Telegram initData устарел"
        };
      }
    }

    const userRaw = params.get("user");

    if (!userRaw) {
      return {
        ok: false,
        error: "Данные пользователя Telegram отсутствуют"
      };
    }

    let user;

    try {
      user = JSON.parse(userRaw);
    } catch {
      return {
        ok: false,
        error: "Некорректные данные пользователя Telegram"
      };
    }

    if (!user || !user.id) {
      return {
        ok: false,
        error: "ID пользователя Telegram отсутствует"
      };
    }

    return {
      ok: true,
      user
    };
  } catch (error) {
    console.error("Telegram auth error:", error);

    return {
      ok: false,
      error: "Ошибка проверки Telegram initData"
    };
  }
}

// ============================================================
// INIT DATA FROM REQUEST
// ============================================================

function getInitDataFromRequest(req) {
  const header =
    req.headers["x-telegram-init-data"];

  const body =
    req.body?.initData ||
    req.body?.init_data ||
    "";

  const query =
    req.query?.initData ||
    req.query?.init_data ||
    "";

  return (
    normalizeString(header) ||
    normalizeString(body) ||
    normalizeString(query) ||
    ""
  );
}

// ============================================================
// USER
// ============================================================

function ensureUser(telegramUser) {
  const id = Number(telegramUser.id);

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Некорректный Telegram ID");
  }

  const existing = db
    .prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `)
    .get(id);

  if (existing) {
    db.prepare(`
      UPDATE users
      SET
        username = ?,
        first_name = ?,
        last_name = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      telegramUser.username || "",
      telegramUser.first_name || "",
      telegramUser.last_name || "",
      now(),
      id
    );

    return db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(id);
  }

  db.prepare(`
    INSERT INTO users (
      id,
      username,
      first_name,
      last_name,
      balance,
      spent,
      opened,
      sold,
      referral_id,
      referral_bonus_received,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 0, 0, 0, NULL, 0, ?, ?)
  `).run(
    id,
    telegramUser.username || "",
    telegramUser.first_name || "",
    telegramUser.last_name || "",
    START_BALANCE,
    now(),
    now()
  );

  return db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(id);
}

// ============================================================
// USER DATA
// ============================================================

function buildUserData(userId) {
  const user = db
    .prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `)
    .get(userId);

  if (!user) {
    throw new Error("Пользователь не найден");
  }

  const garage = db
    .prepare(`
      SELECT
        id,
        name,
        price,
        rarity,
        created_at
      FROM garage
      WHERE user_id = ?
      ORDER BY id DESC
    `)
    .all(userId);

  const history = db
    .prepare(`
      SELECT
        id,
        type,
        name,
        rarity,
        price,
        case_id,
        created_at
      FROM history
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 100
    `)
    .all(userId);

  return {
    id: user.id,
    username: user.username || "",
    first_name: user.first_name || "",
    last_name: user.last_name || "",

    balance: Number(user.balance || 0),
    spent: Number(user.spent || 0),
    opened: Number(user.opened || 0),
    sold: Number(user.sold || 0),

    level: calculateLevel(Number(user.spent || 0)),

    referralId:
      user.referral_id !== null
        ? Number(user.referral_id)
        : null,

    referralBonusReceived:
      Boolean(user.referral_bonus_received),

    garage,
    history
  };
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function authenticateRequest(req, res, next) {
  try {
    const initData = getInitDataFromRequest(req);

    if (!initData) {
      return res.status(401).json({
        ok: false,
        error: "Telegram initData не получен"
      });
    }

    const auth = validateTelegramInitData(initData);

    if (!auth.ok) {
      return res.status(401).json({
        ok: false,
        error: auth.error
      });
    }

    const user = ensureUser(auth.user);

    req.telegramUser = auth.user;
    req.user = user;

    next();
  } catch (error) {
    console.error("AUTH MIDDLEWARE:", error);

    return res.status(500).json({
      ok: false,
      error: "Ошибка авторизации"
    });
  }
}

// ============================================================
// ROOT
// ============================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ============================================================
// HEALTH
// ============================================================

app.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();

    return res.json({
      ok: true,
      status: "online",
      service: "autoempire",
      environment: NODE_ENV,
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error("HEALTH:", error);

    return res.status(500).json({
      ok: false,
      error: "Database error"
    });
  }
});

// ============================================================
// CONFIG
// ============================================================

app.get("/api/config", (req, res) => {
  return res.json({
    ok: true,

    startBalance: START_BALANCE,

    referralBonus: REFERRAL_BONUS,

    cases: Object.values(CASES).map(gameCase => ({
      id: gameCase.id,
      name: gameCase.name,
      price: gameCase.price,
      weights: gameCase.weights
    }))
  });
});

// ============================================================
// AUTH
// IMPORTANT:
// app.all() intentionally accepts GET / POST / OPTIONS.
// This prevents method-related 405 on Telegram Mini App auth.
// ============================================================

async function authHandler(req, res) {
  try {
    const initData = getInitDataFromRequest(req);

    if (!initData) {
      return res.status(401).json({
        ok: false,
        error: "Telegram initData не получен"
      });
    }

    const auth = validateTelegramInitData(initData);

    if (!auth.ok) {
      return res.status(401).json({
        ok: false,
        error: auth.error
      });
    }

    const user = ensureUser(auth.user);
    const data = buildUserData(user.id);

    return res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error("AUTH ROUTE:", error);

    return res.status(500).json({
      ok: false,
      error: "Ошибка авторизации: " + error.message
    });
  }
}

app.all("/api/auth", (req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return authHandler(req, res, next);
});

// ============================================================
// ME
// ============================================================

app.get("/api/me", authenticateRequest, (req, res) => {
  try {
    return res.json({
      ok: true,
      data: buildUserData(req.user.id)
    });
  } catch (error) {
    console.error("ME:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось получить данные пользователя"
    });
  }
});

// ============================================================
// OPEN CASE
// ============================================================

app.post("/api/cases/open", authenticateRequest, (req, res) => {
  const userId = req.user.id;
  const caseId = normalizeString(req.body?.caseId);

  try {
    const gameCase = CASES[caseId];

    if (!gameCase) {
      return res.status(400).json({
        ok: false,
        error: "Кейс не найден"
      });
    }

    // --------------------------------------------------------
    // Проверяем активное открытие
    // --------------------------------------------------------

    const activeOpening = db
      .prepare(`
        SELECT *
        FROM openings
        WHERE user_id = ?
      `)
      .get(userId);

    if (activeOpening) {
      return res.status(409).json({
        ok: false,
        error: "У тебя уже есть открываемый кейс"
      });
    }

    // --------------------------------------------------------
    // Проверяем баланс
    // --------------------------------------------------------

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE id = ?
      `)
      .get(userId);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "Пользователь не найден"
      });
    }

    if (Number(user.balance) < Number(gameCase.price)) {
      return res.status(400).json({
        ok: false,
        error: "Недостаточно средств"
      });
    }

    // --------------------------------------------------------
    // Результат кейса выбирается СЕРВЕРОМ
    // --------------------------------------------------------

    const car = getRandomCar(caseId);

    const transaction = db.transaction(() => {
      // Снимаем деньги сразу.
      db.prepare(`
        UPDATE users
        SET
          balance = balance - ?,
          spent = spent + ?,
          opened = opened + 1,
          updated_at = ?
        WHERE id = ?
      `).run(
        gameCase.price,
        gameCase.price,
        now(),
        userId
      );

      // Ставим блокировку открытия.
      db.prepare(`
        INSERT INTO openings (
          user_id,
          case_id,
          created_at
        )
        VALUES (?, ?, ?)
      `).run(
        userId,
        caseId,
        now()
      );

      // История самого открытия.
      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          name,
          rarity,
          price,
          case_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        "open",
        car.name,
        car.rarity,
        car.price,
        caseId,
        now()
      );
    });

    transaction();

    const data = buildUserData(userId);

    return res.json({
      ok: true,

      result: {
        name: car.name,
        price: car.price,
        rarity: car.rarity,
        caseId
      },

      data
    });
  } catch (error) {
    console.error("CASE OPEN:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось открыть кейс"
    });
  }
});

// ============================================================
// KEEP CASE RESULT
// ============================================================

app.post("/api/cases/keep", authenticateRequest, (req, res) => {
  const userId = req.user.id;
  const name = normalizeString(req.body?.name);

  try {
    const opening = db
      .prepare(`
        SELECT *
        FROM openings
        WHERE user_id = ?
      `)
      .get(userId);

    if (!opening) {
      return res.status(400).json({
        ok: false,
        error: "Активное открытие не найдено"
      });
    }

    const car = getCarByName(name);

    if (!car) {
      return res.status(400).json({
        ok: false,
        error: "Автомобиль не найден"
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO garage (
          user_id,
          name,
          price,
          rarity,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        car.name,
        car.price,
        car.rarity,
        now()
      );

      db.prepare(`
        DELETE FROM openings
        WHERE user_id = ?
      `).run(userId);
    });

    transaction();

    return res.json({
      ok: true,
      data: buildUserData(userId)
    });
  } catch (error) {
    console.error("CASE KEEP:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось сохранить автомобиль"
    });
  }
});

// ============================================================
// SELL CASE RESULT
// ============================================================

app.post("/api/cases/sell", authenticateRequest, (req, res) => {
  const userId = req.user.id;
  const name = normalizeString(req.body?.name);

  try {
    const opening = db
      .prepare(`
        SELECT *
        FROM openings
        WHERE user_id = ?
      `)
      .get(userId);

    if (!opening) {
      return res.status(400).json({
        ok: false,
        error: "Активное открытие не найдено"
      });
    }

    const car = getCarByName(name);

    if (!car) {
      return res.status(400).json({
        ok: false,
        error: "Автомобиль не найден"
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE users
        SET
          balance = balance + ?,
          sold = sold + 1,
          updated_at = ?
        WHERE id = ?
      `).run(
        car.price,
        now(),
        userId
      );

      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          name,
          rarity,
          price,
          case_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        "sell_case",
        car.name,
        car.rarity,
        car.price,
        opening.case_id,
        now()
      );

      db.prepare(`
        DELETE FROM openings
        WHERE user_id = ?
      `).run(userId);
    });

    transaction();

    return res.json({
      ok: true,
      data: buildUserData(userId)
    });
  } catch (error) {
    console.error("CASE SELL:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось продать автомобиль"
    });
  }
});

// ============================================================
// GARAGE SELL
// ============================================================

app.post("/api/garage/sell", authenticateRequest, (req, res) => {
  const userId = req.user.id;
  const index = Number(req.body?.index);

  try {
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({
        ok: false,
        error: "Некорректный автомобиль"
      });
    }

    const cars = db
      .prepare(`
        SELECT *
        FROM garage
        WHERE user_id = ?
        ORDER BY id DESC
      `)
      .all(userId);

    const car = cars[index];

    if (!car) {
      return res.status(404).json({
        ok: false,
        error: "Автомобиль не найден в гараже"
      });
    }

    const transaction = db.transaction(() => {
      const deleted = db.prepare(`
        DELETE FROM garage
        WHERE id = ?
          AND user_id = ?
      `).run(
        car.id,
        userId
      );

      if (deleted.changes !== 1) {
        throw new Error("Автомобиль уже продан");
      }

      db.prepare(`
        UPDATE users
        SET
          balance = balance + ?,
          sold = sold + 1,
          updated_at = ?
        WHERE id = ?
      `).run(
        car.price,
        now(),
        userId
      );

      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          name,
          rarity,
          price,
          case_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        "sell_garage",
        car.name,
        car.rarity,
        car.price,
        "",
        now()
      );
    });

    transaction();

    return res.json({
      ok: true,
      data: buildUserData(userId)
    });
  } catch (error) {
    console.error("GARAGE SELL:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось продать автомобиль"
    });
  }
});

// ============================================================
// MARKET BUY
// ============================================================

app.post("/api/market/buy", authenticateRequest, (req, res) => {
  const userId = req.user.id;
  const name = normalizeString(req.body?.name);

  try {
    const car = getCarByName(name);

    if (!car) {
      return res.status(404).json({
        ok: false,
        error: "Автомобиль не найден"
      });
    }

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE id = ?
      `)
      .get(userId);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "Пользователь не найден"
      });
    }

    if (Number(user.balance) < Number(car.price)) {
      return res.status(400).json({
        ok: false,
        error: "Недостаточно средств"
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE users
        SET
          balance = balance - ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        car.price,
        now(),
        userId
      );

      db.prepare(`
        INSERT INTO garage (
          user_id,
          name,
          price,
          rarity,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        car.name,
        car.price,
        car.rarity,
        now()
      );

      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          name,
          rarity,
          price,
          case_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        "market_buy",
        car.name,
        car.rarity,
        car.price,
        "",
        now()
      );
    });

    transaction();

    return res.json({
      ok: true,
      data: buildUserData(userId)
    });
  } catch (error) {
    console.error("MARKET BUY:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось купить автомобиль"
    });
  }
});

// ============================================================
// REFERRAL
// ============================================================

app.post("/api/referral", authenticateRequest, (req, res) => {
  const userId = req.user.id;
  const referralId = Number(req.body?.referralId);

  try {
    if (
      !Number.isInteger(referralId) ||
      referralId <= 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "Некорректный реферальный ID"
      });
    }

    if (referralId === Number(userId)) {
      return res.status(400).json({
        ok: false,
        error: "Нельзя пригласить самого себя"
      });
    }

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE id = ?
      `)
      .get(userId);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "Пользователь не найден"
      });
    }

    if (user.referral_id) {
      return res.status(400).json({
        ok: false,
        error: "Реферальный код уже использован"
      });
    }

    const referrer = db
      .prepare(`
        SELECT *
        FROM users
        WHERE id = ?
      `)
      .get(referralId);

    if (!referrer) {
      return res.status(404).json({
        ok: false,
        error: "Реферальный пользователь не найден"
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE users
        SET
          referral_id = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        referralId,
        now(),
        userId
      );

      if (!user.referral_bonus_received) {
        db.prepare(`
          UPDATE users
          SET
            balance = balance + ?,
            referral_bonus_received = 1,
            updated_at = ?
          WHERE id = ?
        `).run(
          REFERRAL_BONUS,
          now(),
          userId
        );
      }

      db.prepare(`
        UPDATE users
        SET
          balance = balance + ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        REFERRAL_BONUS,
        now(),
        referralId
      );
    });

    transaction();

    return res.json({
      ok: true,
      bonus: REFERRAL_BONUS,
      data: buildUserData(userId)
    });
  } catch (error) {
    console.error("REFERRAL:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось применить реферальный код"
    });
  }
});

// ============================================================
// DAILY LOGIN
// ============================================================

app.post("/api/daily", authenticateRequest, (req, res) => {
  const userId = req.user.id;

  try {
    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE id = ?
      `)
      .get(userId);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "Пользователь не найден"
      });
    }

    const today = new Date();

    const dayKey =
      today.getUTCFullYear() +
      "-" +
      String(today.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getUTCDate()).padStart(2, "0");

    const settingKey = `daily_${dayKey}_${userId}`;

    const exists = db
      .prepare(`
        SELECT id
        FROM history
        WHERE user_id = ?
          AND type = ?
        LIMIT 1
      `)
      .get(
        userId,
        settingKey
      );

    if (exists) {
      return res.json({
        ok: true,
        claimed: false,
        data: buildUserData(userId)
      });
    }

    const reward = 100000;

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE users
        SET
          balance = balance + ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        reward,
        now(),
        userId
      );

      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          name,
          rarity,
          price,
          case_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        settingKey,
        "Daily reward",
        "",
        reward,
        "",
        now()
      );
    });

    transaction();

    return res.json({
      ok: true,
      claimed: true,
      reward,
      data: buildUserData(userId)
    });
  } catch (error) {
    console.error("DAILY:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось получить ежедневную награду"
    });
  }
});

// ============================================================
// STATS
// ============================================================

app.get("/api/stats", (req, res) => {
  try {
    const users = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM users
      `)
      .get();

    const openings = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM history
        WHERE type = 'open'
      `)
      .get();

    const garage = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM garage
      `)
      .get();

    const money = db
      .prepare(`
        SELECT COALESCE(SUM(spent), 0) AS total
        FROM users
      `)
      .get();

    return res.json({
      ok: true,
      stats: {
        users: Number(users.count || 0),
        openings: Number(openings.count || 0),
        garage: Number(garage.count || 0),
        totalSpent: Number(money.total || 0)
      }
    });
  } catch (error) {
    console.error("STATS:", error);

    return res.status(500).json({
      ok: false,
      error: "Не удалось получить статистику"
    });
  }
});

// ============================================================
// CLEAN STALE OPENINGS
// ============================================================
//
// Если пользователь закрыл приложение прямо во время открытия,
// техническая блокировка не должна оставаться навсегда.
//
// Блокировка старше 10 минут считается зависшей и удаляется.
//

function cleanupStaleOpenings() {
  try {
    const limit = now() - 600;

    const result = db
      .prepare(`
        DELETE FROM openings
        WHERE created_at < ?
      `)
      .run(limit);

    if (result.changes > 0) {
      console.log(
        `[AUTO] Очищено зависших открытий: ${result.changes}`
      );
    }
  } catch (error) {
    console.error(
      "STALE OPENINGS CLEANUP:",
      error
    );
  }
}

setInterval(
  cleanupStaleOpenings,
  60 * 1000
);

// ============================================================
// API 404
// ============================================================

app.use("/api", (req, res) => {
  return res.status(404).json({
    ok: false,
    error: "API route not found",
    method: req.method,
    path: req.path
  });
});

// ============================================================
// STATIC
// ============================================================

app.use(express.static(__dirname));

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    ok: false,
    error: "Внутренняя ошибка сервера"
  });
});

// ============================================================
// START
// ============================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("==========================================");
  console.log("        АВТОИМПЕРИЯ SERVER ONLINE");
  console.log("==========================================");
  console.log(`PORT: ${PORT}`);
  console.log(`ENV: ${NODE_ENV}`);
  console.log(`DB: ${DB_PATH}`);
  console.log(`BOT TOKEN: ${BOT_TOKEN ? "SET" : "NOT SET"}`);
  console.log("==========================================");
});
