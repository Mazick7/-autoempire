const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

console.log("!!! НОВЫЙ SERVER.JS ЗАПУЩЕН !!!");

const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const NODE_ENV = process.env.NODE_ENV || "production";

const DB_PATH =
  process.env.DB_PATH ||
  path.join(__dirname, "autoimperiya.db");

const INDEX_PATH = path.join(__dirname, "index.html");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

console.log("======================================");
console.log("🚗 АВТОИМПЕРИЯ SERVER");
console.log("======================================");
console.log("PORT:", PORT);
console.log("NODE:", process.version);
console.log("ENV:", NODE_ENV);
console.log("DB:", DB_PATH);
console.log("BOT TOKEN:", BOT_TOKEN ? "configured" : "NOT CONFIGURED");
console.log("======================================");


/* =========================================================
   DATABASE
========================================================= */

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
  level INTEGER NOT NULL DEFAULT 1,
  referral_code TEXT UNIQUE,
  referred_by TEXT DEFAULT '',
  referral_earned INTEGER NOT NULL DEFAULT 0,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  daily_last TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS garage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  car_name TEXT DEFAULT '',
  rarity TEXT DEFAULT '',
  value INTEGER NOT NULL DEFAULT 0,
  case_id TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS openings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  case_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER DEFAULT 0,
  result_name TEXT DEFAULT '',
  result_rarity TEXT DEFAULT '',
  result_value INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_telegram
ON users(telegram_id);

CREATE INDEX IF NOT EXISTS idx_garage_user
ON garage(user_id);

CREATE INDEX IF NOT EXISTS idx_history_user
ON history(user_id);

CREATE INDEX IF NOT EXISTS idx_openings_user
ON openings(user_id);
`);


/* =========================================================
   CASES
========================================================= */

const CASES = [
  {
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
  {
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
  {
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
  {
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
  {
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
];


/* =========================================================
   CARS
========================================================= */

const CARS = [
  { name: "Lada VAZ 2114", rarity: "common", value: 180000 },
  { name: "Lada VAZ 2109", rarity: "common", value: 160000 },
  { name: "Lada Priora", rarity: "common", value: 350000 },
  { name: "Lada Granta", rarity: "common", value: 550000 },
  { name: "Daewoo Matiz", rarity: "common", value: 280000 },
  { name: "Daewoo Nexia", rarity: "common", value: 420000 },
  { name: "УАЗ Patriot", rarity: "common", value: 750000 },
  { name: "Lada Vesta", rarity: "common", value: 1000000 },
  { name: "Hyundai Solaris", rarity: "common", value: 1100000 },
  { name: "Kia Rio", rarity: "common", value: 1150000 },
  { name: "Renault Logan", rarity: "common", value: 850000 },
  { name: "Ford Focus", rarity: "common", value: 1300000 },
  { name: "Skoda Octavia", rarity: "common", value: 1700000 },
  { name: "Toyota Corolla", rarity: "common", value: 1800000 },

  { name: "Volkswagen Passat", rarity: "rare", value: 1900000 },
  { name: "Haval F7", rarity: "rare", value: 2200000 },
  { name: "Toyota Camry 70", rarity: "rare", value: 3000000 },
  { name: "BMW E60", rarity: "rare", value: 2200000 },
  { name: "BMW E90", rarity: "rare", value: 2400000 },
  { name: "Mercedes W212", rarity: "rare", value: 3000000 },
  { name: "Audi A6 C7", rarity: "rare", value: 3000000 },
  { name: "Subaru WRX", rarity: "rare", value: 1900000 },

  { name: "BMW M4 F82", rarity: "epic", value: 5000000 },
  { name: "BMW M5 F10", rarity: "epic", value: 6000000 },
  { name: "BMW M6", rarity: "epic", value: 7000000 },
  { name: "BMW M3 Competition", rarity: "epic", value: 7500000 },
  { name: "BMW M4 Competition", rarity: "epic", value: 8500000 },
  { name: "Mercedes-AMG GT", rarity: "epic", value: 9000000 },
  { name: "Nissan GT-R R35", rarity: "epic", value: 9500000 },

  { name: "Audi RS6 C8", rarity: "legendary", value: 10000000 },
  { name: "BMW M5 CS", rarity: "legendary", value: 10000000 },
  { name: "BMW M8 Competition", rarity: "legendary", value: 12000000 },
  { name: "Mercedes-AMG GT 63", rarity: "legendary", value: 14000000 },
  { name: "Porsche 911 Turbo S", rarity: "legendary", value: 16000000 },

  { name: "Lamborghini Huracan", rarity: "mythic", value: 20000000 },
  { name: "Lamborghini Urus", rarity: "mythic", value: 22000000 },
  { name: "McLaren 720S", rarity: "mythic", value: 25000000 },
  { name: "Lamborghini Aventador", rarity: "mythic", value: 25000000 },
  { name: "Ferrari 488", rarity: "mythic", value: 28000000 },
  { name: "Ferrari F8 Tributo", rarity: "mythic", value: 32000000 },
  { name: "McLaren 765LT", rarity: "mythic", value: 35000000 },
  { name: "Bentley Continental GT", rarity: "mythic", value: 15000000 },
  { name: "Porsche 918 Spyder", rarity: "mythic", value: 45000000 },
  { name: "Rolls-Royce Phantom", rarity: "mythic", value: 50000000 },
  { name: "Bugatti Chiron", rarity: "mythic", value: 100000000 }
];


const RARITIES = [
  "common",
  "rare",
  "epic",
  "legendary",
  "mythic"
];


/* =========================================================
   HELPERS
========================================================= */

function json(res, status, data) {
  const body = JSON.stringify(data);

  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}


function text(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(value);
}


function cors(res) {
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
}


function sendError(res, status, message) {
  return json(res, status, {
    ok: false,
    error: message
  });
}


function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", chunk => {
      data += chunk;

      if (data.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      const contentType =
        String(req.headers["content-type"] || "").toLowerCase();

      if (contentType.includes("application/json")) {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON"));
        }

        return;
      }

      try {
        const params = new URLSearchParams(data);
        const obj = {};

        for (const [key, value] of params.entries()) {
          obj[key] = value;
        }

        resolve(obj);
      } catch {
        resolve({});
      }
    });

    req.on("error", reject);
  });
}


function getTelegramInitData(req, body = {}) {
  return (
    req.headers["x-telegram-init-data"] ||
    body.initData ||
    body.init_data ||
    ""
  );
}


function parseTelegramInitData(initData) {
  const params = new URLSearchParams(initData);

  const result = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
}


function validateTelegramInitData(initData) {
  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN is not configured");
  }

  if (!initData) {
    throw new Error("Telegram initData is missing");
  }

  const params = new URLSearchParams(initData);

  const hash = params.get("hash");

  if (!hash) {
    throw new Error("Telegram hash is missing");
  }

  params.delete("hash");

  const pairs = [];

  for (const [key, value] of [...params.entries()].sort()) {
    pairs.push(`${key}=${value}`);
  }

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
    throw new Error("Telegram initData validation failed");
  }

  const authDate = Number(params.get("auth_date") || 0);

  if (authDate) {
    const age = Math.floor(Date.now() / 1000) - authDate;

    if (age > 86400) {
      throw new Error("Telegram initData expired");
    }
  }

  const userRaw = params.get("user");

  if (!userRaw) {
    throw new Error("Telegram user is missing");
  }

  let user;

  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new Error("Invalid Telegram user data");
  }

  if (!user.id) {
    throw new Error("Telegram user id is missing");
  }

  return user;
}


function getLevel(spent) {
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


function generateReferralCode(telegramId) {
  return crypto
    .createHash("sha256")
    .update(String(telegramId) + ":" + BOT_TOKEN)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}


function randomFloat() {
  return Math.random() * 100;
}


function pickRarity(chances) {
  const roll = randomFloat();

  let cursor = 0;

  for (const rarity of RARITIES) {
    cursor += Number(chances[rarity] || 0);

    if (roll < cursor) {
      return rarity;
    }
  }

  return "common";
}


function pickCar(caseData) {
  const rarity = pickRarity(caseData.chances);

  let cars = CARS.filter(car => car.rarity === rarity);

  if (!cars.length) {
    cars = CARS.filter(car => car.rarity === "common");
  }

  return cars[Math.floor(Math.random() * cars.length)];
}


function findCase(caseId) {
  return CASES.find(item => item.id === String(caseId));
}


function publicUser(user) {
  return {
    id: user.id,
    telegram_id: user.telegram_id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    balance: user.balance,
    spent: user.spent,
    opened: user.opened,
    sold: user.sold,
    level: getLevel(user.spent),
    referral_code: user.referral_code,
    referred_by: user.referred_by,
    referral_earned: user.referral_earned,
    daily_streak: user.daily_streak,
    daily_last: user.daily_last
  };
}


function getUserByTelegramId(telegramId) {
  return db
    .prepare("SELECT * FROM users WHERE telegram_id = ?")
    .get(String(telegramId));
}


function getUserById(id) {
  return db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(Number(id));
}


function createOrUpdateUser(tgUser) {
  const telegramId = String(tgUser.id);

  let user = getUserByTelegramId(telegramId);

  if (!user) {
    const referralCode = generateReferralCode(telegramId);

    const insert = db.prepare(`
      INSERT INTO users (
        telegram_id,
        username,
        first_name,
        last_name,
        balance,
        spent,
        opened,
        sold,
        level,
        referral_code
      )
      VALUES (?, ?, ?, ?, 5000000, 0, 0, 1, 1, ?)
    `);

    insert.run(
      telegramId,
      tgUser.username || "",
      tgUser.first_name || "",
      tgUser.last_name || "",
      referralCode
    );

    user = getUserByTelegramId(telegramId);

    return user;
  }

  db.prepare(`
    UPDATE users
    SET
      username = ?,
      first_name = ?,
      last_name = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `).run(
    tgUser.username || "",
    tgUser.first_name || "",
    tgUser.last_name || "",
    telegramId
  );

  return getUserByTelegramId(telegramId);
}


function getUserFromRequest(req, body) {
  const initData = getTelegramInitData(req, body);

  if (!initData) {
    throw new Error("Telegram initData is missing");
  }

  const tgUser = validateTelegramInitData(initData);

  return createOrUpdateUser(tgUser);
}


/* =========================================================
   AUTH
========================================================= */

async function handleAuth(req, res, body) {
  /*
    ВАЖНО:
    Этот endpoint специально принимает POST.
    Также OPTIONS обрабатывается глобально выше.
  */

  try {
    const initData = getTelegramInitData(req, body);

    if (!initData) {
      return sendError(
        res,
        401,
        "Telegram initData не передан"
      );
    }

    const tgUser = validateTelegramInitData(initData);

    const user = createOrUpdateUser(tgUser);

    return json(res, 200, {
      ok: true,
      authenticated: true,
      user: publicUser(user)
    });
  } catch (error) {
    console.error("AUTH ERROR:", error.message);

    return sendError(
      res,
      401,
      error.message || "Ошибка авторизации"
    );
  }
}


/* =========================================================
   API HANDLERS
========================================================= */

async function handleApi(req, res, pathname, body) {

  if (pathname === "/api/health") {
    return json(res, 200, {
      ok: true,
      status: "ok",
      service: "autoimperiya",
      node: process.version,
      time: new Date().toISOString()
    });
  }


  if (pathname === "/api/config") {
    return json(res, 200, {
      ok: true,
      cases: CASES,
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


  /*
    Главный фикс.
    При любом POST на /api/auth попадаем сюда.
  */

  if (pathname === "/api/auth") {

    if (req.method !== "POST") {
      return sendError(
        res,
        405,
        "Method Not Allowed. Используйте POST /api/auth"
      );
    }

    return handleAuth(req, res, body);
  }


  /* Все остальные API требуют Telegram */

  let user;

  try {
    user = getUserFromRequest(req, body);
  } catch (error) {
    return sendError(
      res,
      401,
      error.message || "Необходима авторизация Telegram"
    );
  }


  if (pathname === "/api/user") {
    return json(res, 200, {
      ok: true,
      user: publicUser(user)
    });
  }


  if (pathname === "/api/cases") {
    return json(res, 200, {
      ok: true,
      cases: CASES
    });
  }


  /* =======================================================
     OPEN CASE
  ======================================================= */

  if (pathname === "/api/cases/open") {

    if (req.method !== "POST") {
      return sendError(res, 405, "Method Not Allowed");
    }

    const caseId = body.caseId || body.case_id;
    const caseData = findCase(caseId);

    if (!caseData) {
      return sendError(res, 400, "Кейс не найден");
    }

    /*
      Защита от одновременного открытия нескольких кейсов.
      Активная попытка считается зависшей после 2 минут.
    */

    const staleTime = Date.now() - 120000;

    db.prepare(`
      UPDATE openings
      SET status = 'expired'
      WHERE user_id = ?
        AND status = 'active'
        AND started_at < ?
    `).run(user.id, staleTime);

    const activeOpening = db.prepare(`
      SELECT *
      FROM openings
      WHERE user_id = ?
        AND status = 'active'
      LIMIT 1
    `).get(user.id);

    if (activeOpening) {
      return sendError(
        res,
        409,
        "Кейс уже открывается"
      );
    }


    const freshUser = getUserById(user.id);

    if (freshUser.balance < caseData.price) {
      return sendError(
        res,
        400,
        "Недостаточно средств"
      );
    }


    const transaction = db.transaction(() => {

      const startedAt = Date.now();

      db.prepare(`
        INSERT INTO openings (
          user_id,
          case_id,
          started_at,
          status
        )
        VALUES (?, ?, ?, 'active')
      `).run(
        user.id,
        caseData.id,
        startedAt
      );


      const car = pickCar(caseData);

      const newBalance =
        freshUser.balance - caseData.price;

      const newSpent =
        freshUser.spent + caseData.price;

      const newOpened =
        freshUser.opened + 1;

      const newLevel =
        getLevel(newSpent);


      db.prepare(`
        UPDATE users
        SET
          balance = ?,
          spent = ?,
          opened = ?,
          level = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        newBalance,
        newSpent,
        newOpened,
        newLevel,
        user.id
      );


      const opening = db.prepare(`
        SELECT id
        FROM openings
        WHERE user_id = ?
          AND case_id = ?
          AND status = 'active'
        ORDER BY id DESC
        LIMIT 1
      `).get(
        user.id,
        caseData.id
      );


      db.prepare(`
        UPDATE openings
        SET
          finished_at = ?,
          result_name = ?,
          result_rarity = ?,
          result_value = ?,
          status = 'finished'
        WHERE id = ?
      `).run(
        Date.now(),
        car.name,
        car.rarity,
        car.value,
        opening.id
      );


      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          car_name,
          rarity,
          value,
          case_id
        )
        VALUES (?, 'open', ?, ?, ?, ?)
      `).run(
        user.id,
        car.name,
        car.rarity,
        car.value,
        caseData.id
      );


      return {
        car,
        balance: newBalance,
        spent: newSpent,
        opened: newOpened,
        level: newLevel
      };
    });


    const result = transaction();

    return json(res, 200, {
      ok: true,
      result: {
        name: result.car.name,
        rarity: result.car.rarity,
        value: result.car.value
      },
      user: {
        balance: result.balance,
        spent: result.spent,
        opened: result.opened,
        level: result.level
      }
    });
  }


  /* =======================================================
     KEEP CAR
  ======================================================= */

  if (pathname === "/api/cases/keep") {

    if (req.method !== "POST") {
      return sendError(res, 405, "Method Not Allowed");
    }

    const name = String(body.name || "");

    const car = CARS.find(
      item => item.name === name
    );

    if (!car) {
      return sendError(res, 404, "Машина не найдена");
    }

    db.prepare(`
      INSERT INTO garage (
        user_id,
        name,
        rarity,
        value
      )
      VALUES (?, ?, ?, ?)
    `).run(
      user.id,
      car.name,
      car.rarity,
      car.value
    );

    return json(res, 200, {
      ok: true,
      message: "Машина добавлена в гараж"
    });
  }


  /* =======================================================
     SELL CASE RESULT
  ======================================================= */

  if (pathname === "/api/cases/sell") {

    if (req.method !== "POST") {
      return sendError(res, 405, "Method Not Allowed");
    }

    const name = String(body.name || "");

    const car = CARS.find(
      item => item.name === name
    );

    if (!car) {
      return sendError(res, 404, "Машина не найдена");
    }

    const transaction = db.transaction(() => {

      const currentUser = getUserById(user.id);

      const balance =
        currentUser.balance + car.value;

      const sold =
        currentUser.sold + 1;

      db.prepare(`
        UPDATE users
        SET
          balance = ?,
          sold = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        balance,
        sold,
        user.id
      );


      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          car_name,
          rarity,
          value,
          case_id
        )
        VALUES (?, 'sell', ?, ?, ?, '')
      `).run(
        user.id,
        car.name,
        car.rarity,
        car.value
      );


      return {
        balance,
        sold
      };
    });


    const result = transaction();

    return json(res, 200, {
      ok: true,
      balance: result.balance,
      sold: result.sold
    });
  }


  /* =======================================================
     GARAGE
  ======================================================= */

  if (pathname === "/api/garage") {

    const cars = db.prepare(`
      SELECT
        id,
        name,
        rarity,
        value,
        created_at
      FROM garage
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(user.id);

    return json(res, 200, {
      ok: true,
      garage: cars
    });
  }


  /* =======================================================
     GARAGE SELL
  ======================================================= */

  if (pathname === "/api/garage/sell") {

    if (req.method !== "POST") {
      return sendError(res, 405, "Method Not Allowed");
    }

    const index =
      Number(body.index);

    if (!Number.isInteger(index) || index < 0) {
      return sendError(
        res,
        400,
        "Некорректный индекс машины"
      );
    }


    const cars = db.prepare(`
      SELECT
        id,
        name,
        rarity,
        value
      FROM garage
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(user.id);


    const car = cars[index];

    if (!car) {
      return sendError(
        res,
        404,
        "Машина не найдена в гараже"
      );
    }


    const transaction = db.transaction(() => {

      const currentUser = getUserById(user.id);

      const balance =
        currentUser.balance + car.value;

      const sold =
        currentUser.sold + 1;


      db.prepare(`
        DELETE FROM garage
        WHERE id = ?
          AND user_id = ?
      `).run(
        car.id,
        user.id
      );


      db.prepare(`
        UPDATE users
        SET
          balance = ?,
          sold = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        balance,
        sold,
        user.id
      );


      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          car_name,
          rarity,
          value,
          case_id
        )
        VALUES (?, 'garage_sell', ?, ?, ?, '')
      `).run(
        user.id,
        car.name,
        car.rarity,
        car.value
      );


      return {
        balance,
        sold
      };
    });


    const result = transaction();

    return json(res, 200, {
      ok: true,
      balance: result.balance,
      sold: result.sold
    });
  }


  /* =======================================================
     MARKET
  ======================================================= */

  if (pathname === "/api/market") {

    return json(res, 200, {
      ok: true,
      cars: CARS.map(car => ({
        name: car.name,
        rarity: car.rarity,
        value: car.value
      }))
    });
  }


  /* =======================================================
     MARKET BUY
  ======================================================= */

  if (pathname === "/api/market/buy") {

    if (req.method !== "POST") {
      return sendError(res, 405, "Method Not Allowed");
    }

    const name = String(body.name || "");

    const car = CARS.find(
      item => item.name === name
    );

    if (!car) {
      return sendError(
        res,
        404,
        "Машина не найдена"
      );
    }


    const transaction = db.transaction(() => {

      const currentUser = getUserById(user.id);

      if (currentUser.balance < car.value) {
        throw new Error("Недостаточно средств");
      }


      const balance =
        currentUser.balance - car.value;


      db.prepare(`
        UPDATE users
        SET
          balance = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        balance,
        user.id
      );


      db.prepare(`
        INSERT INTO garage (
          user_id,
          name,
          rarity,
          value
        )
        VALUES (?, ?, ?, ?)
      `).run(
        user.id,
        car.name,
        car.rarity,
        car.value
      );


      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          car_name,
          rarity,
          value,
          case_id
        )
        VALUES (?, 'market_buy', ?, ?, ?, '')
      `).run(
        user.id,
        car.name,
        car.rarity,
        car.value
      );


      return {
        balance
      };
    });


    try {
      const result = transaction();

      return json(res, 200, {
        ok: true,
        balance: result.balance,
        car
      });
    } catch (error) {
      return sendError(
        res,
        400,
        error.message || "Не удалось купить машину"
      );
    }
  }


  /* =======================================================
     HISTORY
  ======================================================= */

  if (pathname === "/api/history") {

    const history = db.prepare(`
      SELECT
        id,
        type,
        car_name,
        rarity,
        value,
        case_id,
        created_at
      FROM history
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 100
    `).all(user.id);

    return json(res, 200, {
      ok: true,
      history
    });
  }


  /* =======================================================
     DAILY
  ======================================================= */

  if (pathname === "/api/daily") {

    if (req.method !== "POST" && req.method !== "GET") {
      return sendError(res, 405, "Method Not Allowed");
    }

    const currentUser = getUserById(user.id);

    const today =
      new Date().toISOString().slice(0, 10);

    if (currentUser.daily_last === today) {
      return json(res, 200, {
        ok: true,
        claimed: true,
        reward: 0,
        user: publicUser(currentUser)
      });
    }


    const yesterdayDate =
      new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);


    let streak = Number(
      currentUser.daily_streak || 0
    );

    if (currentUser.daily_last === yesterdayDate) {
      streak++;
    } else {
      streak = 1;
    }


    const rewards = [
      100000,
      150000,
      200000,
      300000,
      400000,
      500000,
      1000000
    ];

    const reward =
      rewards[Math.min(streak, 7) - 1];


    db.prepare(`
      UPDATE users
      SET
        balance = balance + ?,
        daily_streak = ?,
        daily_last = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      reward,
      streak,
      today,
      user.id
    );


    const updated =
      getUserById(user.id);


    return json(res, 200, {
      ok: true,
      claimed: true,
      reward,
      streak,
      user: publicUser(updated)
    });
  }


  /* =======================================================
     REFERRAL
  ======================================================= */

  if (pathname === "/api/referral") {

    if (req.method !== "POST" && req.method !== "GET") {
      return sendError(res, 405, "Method Not Allowed");
    }


    const currentUser =
      getUserById(user.id);


    const referralCode =
      String(
        body.referralCode ||
        body.referral_code ||
        body.code ||
        ""
      ).trim();


    if (!referralCode) {
      return json(res, 200, {
        ok: true,
        referral_code: currentUser.referral_code,
        referral_earned: currentUser.referral_earned
      });
    }


    if (currentUser.referred_by) {
      return sendError(
        res,
        400,
        "Реферальный код уже использован"
      );
    }


    if (
      referralCode === currentUser.referral_code
    ) {
      return sendError(
        res,
        400,
        "Нельзя использовать свой код"
      );
    }


    const inviter = db.prepare(`
      SELECT *
      FROM users
      WHERE referral_code = ?
      LIMIT 1
    `).get(referralCode);


    if (!inviter) {
      return sendError(
        res,
        404,
        "Реферальный код не найден"
      );
    }


    const transaction = db.transaction(() => {

      const bonus = 100000;


      db.prepare(`
        UPDATE users
        SET
          referred_by = ?,
          balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        inviter.referral_code,
        bonus,
        user.id
      );


      db.prepare(`
        UPDATE users
        SET
          balance = balance + ?,
          referral_earned = referral_earned + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        bonus,
        bonus,
        inviter.id
      );


      db.prepare(`
        INSERT INTO history (
          user_id,
          type,
          car_name,
          rarity,
          value,
          case_id
        )
        VALUES (?, 'referral', '', '', ?, '')
      `).run(
        user.id,
        bonus
      );
    });


    try {
      transaction();

      const updated =
        getUserById(user.id);

      return json(res, 200, {
        ok: true,
        bonus: 100000,
        user: publicUser(updated)
      });

    } catch (error) {
      return sendError(
        res,
        400,
        error.message || "Ошибка реферала"
      );
    }
  }


  return sendError(
    res,
    404,
    "API endpoint not found"
  );
}


/* =========================================================
   STATIC FILE
========================================================= */

function serveIndex(req, res) {

  if (!fs.existsSync(INDEX_PATH)) {
    return sendError(
      res,
      500,
      "index.html не найден"
    );
  }

  fs.readFile(
    INDEX_PATH,
    (error, data) => {

      if (error) {
        console.error(
          "INDEX READ ERROR:",
          error
        );

        return sendError(
          res,
          500,
          "Не удалось прочитать index.html"
        );
      }

      res.statusCode = 200;

      res.setHeader(
        "Content-Type",
        "text/html; charset=utf-8"
      );

      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );

      res.end(data);
    }
  );
}


/* =========================================================
   SERVER
========================================================= */

const server = http.createServer(
  async (req, res) => {

    cors(res);

    const method =
      String(req.method || "GET").toUpperCase();

    const host =
      String(req.headers.host || "");

    const rawUrl =
      String(req.url || "/");

    let url;

    try {
      url = new URL(
        rawUrl,
        `http://${host || "localhost"}`
      );
    } catch {
      return sendError(
        res,
        400,
        "Invalid URL"
      );
    }

    const pathname = url.pathname;


    /*
      OPTIONS должен отвечать 204.
      Это особенно важно для Telegram Mini App
      и CORS preflight.
    */

    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }


    /*
      API
    */

    if (pathname.startsWith("/api/")) {

      let body = {};

      try {
        if (
          method === "POST" ||
          method === "PUT" ||
          method === "PATCH"
        ) {
          body = await readBody(req);
        }
      } catch (error) {
        return sendError(
          res,
          400,
          error.message || "Invalid request body"
        );
      }


      try {
        await handleApi(
          req,
          res,
          pathname,
          body
        );
      } catch (error) {

        console.error(
          "API ERROR:",
          error
        );

        if (!res.writableEnded) {
          sendError(
            res,
            500,
            "Внутренняя ошибка сервера"
          );
        }
      }

      return;
    }


    /*
      favicon
    */

    if (pathname === "/favicon.ico") {
      res.statusCode = 204;
      res.end();
      return;
    }


    /*
      Главная страница
    */

    if (
      pathname === "/" ||
      pathname === "/index.html"
    ) {

      if (
        method !== "GET" &&
        method !== "HEAD"
      ) {
        return sendError(
          res,
          405,
          "Method Not Allowed"
        );
      }

      return serveIndex(req, res);
    }


    /*
      Остальные статические файлы.
      Если они понадобятся фронтенду.
    */

    const requestedPath =
      path.normalize(
        path.join(
          __dirname,
          pathname.replace(/^\/+/, "")
        )
      );


    if (
      requestedPath.startsWith(__dirname) &&
      fs.existsSync(requestedPath) &&
      fs.statSync(requestedPath).isFile()
    ) {

      if (
        method !== "GET" &&
        method !== "HEAD"
      ) {
        return sendError(
          res,
          405,
          "Method Not Allowed"
        );
      }


      const ext =
        path.extname(requestedPath)
          .toLowerCase();


      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg"
      };


      res.statusCode = 200;

      res.setHeader(
        "Content-Type",
        types[ext] ||
        "application/octet-stream"
      );

      res.setHeader(
        "Cache-Control",
        "no-store"
      );


      if (method === "HEAD") {
        res.end();
        return;
      }


      fs.createReadStream(
        requestedPath
      ).pipe(res);

      return;
    }


    sendError(
      res,
      404,
      "Not Found"
    );
  }
);


/* =========================================================
   START
========================================================= */

server.on("error", error => {
  console.error("SERVER ERROR:", error);

  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use`
    );
  }
});


server.listen(
  PORT,
  HOST,
  () => {

    console.log("======================================");
    console.log("SERVER STARTED");
    console.log("======================================");
    console.log(
      `Listening on http://${HOST}:${PORT}`
    );
    console.log(
      `Health: http://${HOST}:${PORT}/api/health`
    );
    console.log(
      `Config: http://${HOST}:${PORT}/api/config`
    );
    console.log("======================================");
  }
);


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown(signal) {

  console.log(
    `Received ${signal}. Shutting down...`
  );

  try {
    server.close(() => {

      try {
        db.close();
      } catch {}

      process.exit(0);
    });

  } catch {
    process.exit(0);
  }
}


process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);


/* =========================================================
   SAFETY
========================================================= */

process.on(
  "uncaughtException",
  error => {
    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );
  }
);


process.on(
  "unhandledRejection",
  error => {
    console.error(
      "UNHANDLED REJECTION:",
      error
    );
  }
);
