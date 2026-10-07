const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = String(process.env.BOT_TOKEN || "").trim();

const ROOT = __dirname;
const INDEX_FILE = path.join(ROOT, "index.html");
const DB_FILE = path.join(ROOT, "autoempire.db");

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  telegram_id TEXT PRIMARY KEY,
  username TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  balance INTEGER NOT NULL DEFAULT 5000000,
  garage_json TEXT NOT NULL DEFAULT '[]',
  pending_json TEXT DEFAULT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const CASES = {
  starter: {
    id: "starter",
    name: "Стартовый",
    price: 300000,
    rarity: "common",
    items: [
      ["Lada VAZ 2114", 42],
      ["Lada VAZ 2109", 30],
      ["Lada Priora", 20],
      ["Lada Granta", 15],
      ["Daewoo Matiz", 10],
      ["Daewoo Nexia", 10],
      ["УАЗ Patriot", 8],
      ["Lada Vesta", 5]
    ]
  },

  street: {
    id: "street",
    name: "Уличный",
    price: 900000,
    rarity: "rare",
    items: [
      ["Hyundai Solaris", 20],
      ["Kia Rio", 18],
      ["Renault Logan", 15],
      ["Ford Focus", 13],
      ["Skoda Octavia", 12],
      ["Toyota Corolla", 10],
      ["Volkswagen Passat", 8],
      ["Haval F7", 5],
      ["Subaru WRX", 2],
      ["Toyota Camry 70", 1]
    ]
  },

  premium: {
    id: "premium",
    name: "Премиум",
    price: 5000000,
    rarity: "epic",
    items: [
      ["BMW E60", 15],
      ["BMW E90", 12],
      ["Mercedes W212", 12],
      ["Audi A6 C7", 10],
      ["BMW M4 F82", 10],
      ["BMW M5 F10", 9],
      ["BMW M6", 7],
      ["BMW M3 Competition", 6],
      ["BMW M4 Competition", 5],
      ["Mercedes-AMG GT", 4],
      ["Nissan GT-R R35", 2]
    ]
  },

  elite: {
    id: "elite",
    name: "Элитный",
    price: 15000000,
    rarity: "legendary",
    items: [
      ["BMW M5 CS", 20],
      ["BMW M8 Competition", 16],
      ["Mercedes-AMG GT 63", 14],
      ["Porsche 911 Turbo S", 13],
      ["Lamborghini Huracan", 12],
      ["Lamborghini Urus", 10],
      ["McLaren 720S", 8]
    ]
  },

  imperial: {
    id: "imperial",
    name: "Императорский",
    price: 100000000,
    rarity: "mythic",
    items: [
      ["Lamborghini Aventador", 20],
      ["Ferrari 488", 18],
      ["Ferrari F8 Tributo", 15],
      ["McLaren 765LT", 13],
      ["Bentley Continental GT", 10],
      ["Porsche 918 Spyder", 7],
      ["Rolls-Royce Phantom", 5],
      ["Bugatti Chiron", 2]
    ]
  }
};

const CAR_PRICES = {
  "Lada VAZ 2114": 250000,
  "Lada VAZ 2109": 220000,
  "Lada Priora": 300000,
  "Lada Granta": 400000,
  "Daewoo Matiz": 180000,
  "Daewoo Nexia": 220000,
  "УАЗ Patriot": 700000,
  "Lada Vesta": 1000000,

  "Hyundai Solaris": 750000,
  "Kia Rio": 800000,
  "Renault Logan": 650000,
  "Ford Focus": 850000,
  "Skoda Octavia": 1100000,
  "Toyota Corolla": 1300000,
  "Volkswagen Passat": 1500000,
  "Haval F7": 1700000,
  "Subaru WRX": 3000000,
  "Toyota Camry 70": 3000000,

  "BMW E60": 2200000,
  "BMW E90": 2500000,
  "Mercedes W212": 2800000,
  "Audi A6 C7": 3000000,
  "BMW M4 F82": 5000000,
  "BMW M5 F10": 6000000,
  "BMW M6": 6500000,
  "BMW M3 Competition": 7000000,
  "BMW M4 Competition": 7500000,
  "Mercedes-AMG GT": 8000000,
  "Nissan GT-R R35": 9500000,

  "BMW M5 CS": 10000000,
  "BMW M8 Competition": 12000000,
  "Mercedes-AMG GT 63": 14000000,
  "Porsche 911 Turbo S": 16000000,
  "Lamborghini Huracan": 20000000,
  "Lamborghini Urus": 22000000,
  "McLaren 720S": 23000000,

  "Lamborghini Aventador": 25000000,
  "Ferrari 488": 28000000,
  "Ferrari F8 Tributo": 32000000,
  "McLaren 765LT": 35000000,
  "Bentley Continental GT": 40000000,
  "Porsche 918 Spyder": 45000000,
  "Rolls-Royce Phantom": 50000000,
  "Bugatti Chiron": 100000000
};

const MARKET = {
  "Lada Vesta": 1000000,
  "BMW E60": 2200000,
  "Toyota Camry 70": 3000000,
  "BMW M4 F82": 5000000,
  "BMW M5 F10": 6000000,
  "Nissan GT-R R35": 9500000,
  "BMW M5 CS": 10000000,
  "Mercedes-AMG GT 63": 14000000,
  "Porsche 911 Turbo S": 16000000,
  "Lamborghini Huracan": 20000000,
  "Lamborghini Aventador": 25000000,
  "Ferrari 488": 28000000,
  "Rolls-Royce Phantom": 50000000,
  "Bugatti Chiron": 100000000
};

const RARITY = {
  starter: "common",
  street: "rare",
  premium: "epic",
  elite: "legendary",
  imperial: "mythic"
};

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Telegram-Init-Data"
  });

  res.end(
    type.includes("application/json")
      ? JSON.stringify(data)
      : data
  );
}

function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 2_000_000) {
        reject(new Error("Слишком большой запрос"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Некорректный JSON"));
      }
    });

    req.on("error", reject);
  });
}

/*
 * Telegram WebApp initData verification
 *
 * Возвращает:
 * {
 *   ok: true,
 *   user: TelegramUser
 * }
 *
 * либо:
 * {
 *   ok: false,
 *   error: "..."
 * }
 */
function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN) {
    return {
      ok: false,
      error: "BOT_TOKEN не настроен в Render Environment"
    };
  }

  if (!initData) {
    return {
      ok: false,
      error: "Telegram initData не получен"
    };
  }

  try {
    const params = new URLSearchParams(String(initData));

    const hash = params.get("hash");

    if (!hash) {
      return {
        ok: false,
        error: "В Telegram initData отсутствует hash"
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

    const receivedHash = String(hash).toLowerCase();

    if (!/^[a-f0-9]{64}$/.test(receivedHash)) {
      return {
        ok: false,
        error: "Некорректный формат Telegram hash"
      };
    }

    const a = Buffer.from(calculatedHash, "hex");
    const b = Buffer.from(receivedHash, "hex");

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      console.error("Telegram initData: invalid signature");

      return {
        ok: false,
        error: "Неверная подпись Telegram initData. Проверь BOT_TOKEN."
      };
    }

    const userRaw = params.get("user");

    if (!userRaw) {
      return {
        ok: false,
        error: "Telegram user отсутствует в initData"
      };
    }

    let user;

    try {
      user = JSON.parse(userRaw);
    } catch {
      return {
        ok: false,
        error: "Не удалось прочитать Telegram user"
      };
    }

    if (!user || !user.id) {
      return {
        ok: false,
        error: "Telegram user не содержит ID"
      };
    }

    return {
      ok: true,
      user
    };

  } catch (error) {
    console.error(
      "Telegram initData error:",
      error.message
    );

    return {
      ok: false,
      error: "Ошибка проверки Telegram initData"
    };
  }
}

/*
 * Получаем initData сразу из нескольких мест.
 *
 * 1. X-Telegram-Init-Data
 * 2. Authorization: tma ...
 * 3. JSON body: { initData: "..." }
 */
async function getInitData(req) {
  const headerInitData =
    req.headers["x-telegram-init-data"];

  if (headerInitData) {
    return String(headerInitData);
  }

  const authorization =
    req.headers["authorization"];

  if (
    authorization &&
    authorization.toLowerCase().startsWith("tma ")
  ) {
    return authorization.slice(4).trim();
  }

  return "";
}

async function getUserFromRequest(req, body = null) {
  let initData = await getInitData(req);

  /*
   * Важный fallback:
   * frontend также отправляет initData внутри JSON.
   */
  if (!initData && body && body.initData) {
    initData = String(body.initData);
  }

  return verifyTelegramInitData(initData);
}

function getPlayer(telegramId) {
  return db
    .prepare(
      "SELECT * FROM players WHERE telegram_id = ?"
    )
    .get(String(telegramId));
}

function createPlayer(user) {
  const telegramId = String(user.id);

  let player = getPlayer(telegramId);

  if (player) {
    /*
     * Обновляем имя/username,
     * если пользователь изменил их в Telegram.
     */
    db.prepare(`
      UPDATE players
      SET
        username = ?,
        first_name = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `).run(
      user.username || "",
      user.first_name || "",
      telegramId
    );

    return getPlayer(telegramId);
  }

  db.prepare(`
    INSERT INTO players
      (
        telegram_id,
        username,
        first_name,
        balance,
        garage_json
      )
    VALUES
      (?, ?, ?, ?, ?)
  `).run(
    telegramId,
    user.username || "",
    user.first_name || "",
    5000000,
    "[]"
  );

  return getPlayer(telegramId);
}

function savePlayer(player) {
  db.prepare(`
    UPDATE players
    SET
      username = ?,
      first_name = ?,
      balance = ?,
      garage_json = ?,
      pending_json = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE telegram_id = ?
  `).run(
    player.username || "",
    player.first_name || "",
    Number(player.balance),
    player.garage_json || "[]",
    player.pending_json || null,
    player.telegram_id
  );
}

function playerData(player) {
  let garage = [];

  try {
    garage = JSON.parse(
      player.garage_json || "[]"
    );
  } catch {
    garage = [];
  }

  return {
    balance: Number(player.balance),
    garage,
    username: player.username || "",
    firstName: player.first_name || ""
  };
}

function weightedRandom(items) {
  const total = items.reduce(
    (sum, item) =>
      sum + Number(item[1] || 0),
    0
  );

  let random = Math.random() * total;

  for (const item of items) {
    random -= Number(item[1] || 0);

    if (random <= 0) {
      return item[0];
    }
  }

  return items[items.length - 1][0];
}

function priceOf(carName) {
  return Number(
    CAR_PRICES[carName] || 0
  );
}

function jsonError(
  res,
  message,
  status = 400
) {
  return send(res, status, {
    ok: false,
    error: message
  });
}

async function handleAPI(req, res, pathname) {

  /*
   * /api/auth может получить initData
   * только из JSON, поэтому сначала читаем body.
   */
  let body = null;

  if (
    pathname === "/api/auth" &&
    req.method === "POST"
  ) {
    try {
      body = await parseJSON(req);
    } catch {
      return jsonError(
        res,
        "Некорректный JSON",
        400
      );
    }
  }

  const verification =
    await getUserFromRequest(
      req,
      body
    );

  if (!verification.ok) {
    console.error(
      "Telegram auth failed:",
      verification.error
    );

    return jsonError(
      res,
      verification.error,
      401
    );
  }

  const user = verification.user;

  let player = createPlayer(user);

  if (!player) {
    return jsonError(
      res,
      "Игрок не найден",
      500
    );
  }

  /*
   * AUTH
   */
  if (pathname === "/api/auth") {
    if (req.method !== "POST") {
      return jsonError(
        res,
        "Метод не поддерживается",
        405
      );
    }

    return send(res, 200, {
      ok: true,

      user: {
        id: user.id,
        username: user.username || "",
        firstName: user.first_name || "",
        photoUrl: user.photo_url || ""
      },

      data: playerData(player)
    });
  }

  /*
   * OPEN CASE
   */
  if (pathname === "/api/cases/open") {

    if (req.method !== "POST") {
      return jsonError(
        res,
        "Метод не поддерживается",
        405
      );
    }

    if (!body) {
      try {
        body = await parseJSON(req);
      } catch {
        return jsonError(
          res,
          "Некорректный запрос"
        );
      }
    }

    const caseId = String(
      body.caseId || ""
    );

    const currentCase =
      CASES[caseId];

    if (!currentCase) {
      return jsonError(
        res,
        "Такого кейса нет"
      );
    }

    if (player.pending_json) {
      return jsonError(
        res,
        "Сначала заберите или продайте предыдущий выигрыш."
      );
    }

    if (
      Number(player.balance) <
      currentCase.price
    ) {
      return jsonError(
        res,
        "Недостаточно денег"
      );
    }

    const carName =
      weightedRandom(
        currentCase.items
      );

    const value =
      priceOf(carName);

    player.balance -=
      currentCase.price;

    const pending = {
      caseId,
      name: carName,
      value,
      rarity:
        RARITY[caseId] ||
        currentCase.rarity,
      casePrice:
        currentCase.price,
      createdAt: Date.now()
    };

    player.pending_json =
      JSON.stringify(pending);

    savePlayer(player);

    return send(res, 200, {
      ok: true,
      result: pending,
      data: playerData(player)
    });
  }

  /*
   * KEEP CASE RESULT
   */
  if (pathname === "/api/cases/keep") {

    if (req.method !== "POST") {
      return jsonError(
        res,
        "Метод не поддерживается",
        405
      );
    }

    if (!player.pending_json) {
      return jsonError(
        res,
        "Нет ожидающего выигрыша"
      );
    }

    let pending;

    try {
      pending = JSON.parse(
        player.pending_json
      );
    } catch {
      player.pending_json = null;
      savePlayer(player);

      return jsonError(
        res,
        "Ошибка данных выигрыша",
        500
      );
    }

    let garage = [];

    try {
      garage = JSON.parse(
        player.garage_json || "[]"
      );
    } catch {
      garage = [];
    }

    garage.push({
      id: crypto.randomUUID(),
      name: pending.name,
      value: pending.value,
      rarity: pending.rarity,
      obtainedAt: Date.now()
    });

    player.garage_json =
      JSON.stringify(garage);

    player.pending_json = null;

    savePlayer(player);

    return send(res, 200, {
      ok: true,
      data: playerData(player)
    });
  }

  /*
   * SELL CASE RESULT
   */
  if (pathname === "/api/cases/sell") {

    if (req.method !== "POST") {
      return jsonError(
        res,
        "Метод не поддерживается",
        405
      );
    }

    if (!player.pending_json) {
      return jsonError(
        res,
        "Нет ожидающего выигрыша"
      );
    }

    let pending;

    try {
      pending = JSON.parse(
        player.pending_json
      );
    } catch {
      return jsonError(
        res,
        "Ошибка данных выигрыша",
        500
      );
    }

    const sellPrice =
      Math.floor(
        Number(pending.value) * 0.85
      );

    player.balance +=
      sellPrice;

    player.pending_json = null;

    savePlayer(player);

    return send(res, 200, {
      ok: true,
      soldFor: sellPrice,
      data: playerData(player)
    });
  }

  /*
   * SELL GARAGE CAR
   */
  if (pathname === "/api/garage/sell") {

    if (req.method !== "POST") {
      return jsonError(
        res,
        "Метод не поддерживается",
        405
      );
    }

    if (!body) {
      try {
        body = await parseJSON(req);
      } catch {
        return jsonError(
          res,
          "Некорректный запрос"
        );
      }
    }

    const index =
      Number(body.index);

    let garage;

    try {
      garage = JSON.parse(
        player.garage_json || "[]"
      );
    } catch {
      garage = [];
    }

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= garage.length
    ) {
      return jsonError(
        res,
        "Автомобиль не найден"
      );
    }

    const car =
      garage[index];

    const value =
      Number(car.value) ||
      priceOf(car.name);

    const sellPrice =
      Math.floor(value * 0.85);

    garage.splice(index, 1);

    player.balance +=
      sellPrice;

    player.garage_json =
      JSON.stringify(garage);

    savePlayer(player);

    return send(res, 200, {
      ok: true,
      soldFor: sellPrice,
      data: playerData(player)
    });
  }

  /*
   * MARKET BUY
   */
  if (pathname === "/api/market/buy") {

    if (req.method !== "POST") {
      return jsonError(
        res,
        "Метод не поддерживается",
        405
      );
    }

    if (!body) {
      try {
        body = await parseJSON(req);
      } catch {
        return jsonError(
          res,
          "Некорректный запрос"
        );
      }
    }

    const carName =
      String(body.name || "");

    const marketPrice =
      MARKET[carName];

    if (!marketPrice) {
      return jsonError(
        res,
        "Автомобиль отсутствует на рынке"
      );
    }

    if (
      Number(player.balance) <
      marketPrice
    ) {
      return jsonError(
        res,
        "Недостаточно денег"
      );
    }

    let garage;

    try {
      garage = JSON.parse(
        player.garage_json || "[]"
      );
    } catch {
      garage = [];
    }

    player.balance -=
      marketPrice;

    garage.push({
      id: crypto.randomUUID(),
      name: carName,
      value: marketPrice,
      rarity: "market",
      obtainedAt: Date.now()
    });

    player.garage_json =
      JSON.stringify(garage);

    savePlayer(player);

    return send(res, 200, {
      ok: true,
      data: playerData(player)
    });
  }

  return jsonError(
    res,
    "API endpoint не найден",
    404
  );
}

/*
 * SERVER
 */
const server = http.createServer(
  async (req, res) => {

    try {

      const url = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
      );

      const pathname =
        url.pathname;

      /*
       * CORS PREFLIGHT
       */
      if (req.method === "OPTIONS") {

        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type,X-Telegram-Init-Data,Authorization"
        });

        return res.end();
      }

      /*
       * HEALTH
       */
      if (pathname === "/health") {

        return send(res, 200, {
          ok: true,
          service: "autoempire",
          time: new Date().toISOString(),
          botTokenConfigured:
            Boolean(BOT_TOKEN)
        });
      }

      /*
       * API
       */
      if (
        pathname.startsWith("/api/")
      ) {
        return await handleAPI(
          req,
          res,
          pathname
        );
      }

      /*
       * INDEX
       */
      if (
        pathname === "/" ||
        pathname === "/index.html"
      ) {

        if (
          !fs.existsSync(INDEX_FILE)
        ) {
          return send(
            res,
            500,
            "index.html не найден",
            "text/plain; charset=utf-8"
          );
        }

        const html =
          fs.readFileSync(
            INDEX_FILE
          );

        res.writeHead(200, {
          "Content-Type":
            "text/html; charset=utf-8",
          "Cache-Control":
            "no-store"
        });

        return res.end(html);
      }

      return send(
        res,
        404,
        "Not found",
        "text/plain; charset=utf-8"
      );

    } catch (error) {

      console.error(
        "SERVER ERROR:",
        error
      );

      return send(
        res,
        500,
        {
          ok: false,
          error:
            "Внутренняя ошибка сервера"
        }
      );
    }
  }
);

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `AutoEmpire server started on port ${PORT}`
    );

    console.log(
      `BOT_TOKEN: ${
        BOT_TOKEN
          ? "configured"
          : "NOT CONFIGURED"
      }`
    );
  }
);
