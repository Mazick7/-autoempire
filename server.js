// ============================================================
// АВТОИМПЕРИЯ — SERVER.JS
// Backend для Telegram Mini App
// ============================================================

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const NODE_ENV = process.env.NODE_ENV || "production";

const dbPath =
  process.env.DB_PATH ||
  path.join(__dirname, "autoempire.db");

const db = new Database(dbPath);

// ============================================================
// DATABASE
// ============================================================

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    balance INTEGER NOT NULL DEFAULT 5000000,
    spent INTEGER NOT NULL DEFAULT 0,
    opened INTEGER NOT NULL DEFAULT 0,
    sold INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    referral_id INTEGER,
    referral_bonus_received INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS garage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    car_name TEXT NOT NULL,
    car_price INTEGER NOT NULL,
    rarity TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    car_name TEXT,
    car_price INTEGER DEFAULT 0,
    amount INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS openings (
    user_id INTEGER PRIMARY KEY,
    case_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_garage_user
ON garage(user_id);

CREATE INDEX IF NOT EXISTS idx_history_user
ON history(user_id);

CREATE INDEX IF NOT EXISTS idx_users_referral
ON users(referral_id);
`);

// ============================================================
// EXPRESS
// ============================================================

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Telegram-Init-Data, Authorization"
    );
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    next();
});

// ============================================================
// CONFIG
// ============================================================

const START_BALANCE = 5000000;

const REFERRAL_BONUS = 500000;

const CASES = {
    starter: {
        id: "starter",
        name: "Стартовый кейс",
        price: 300000,
        rarity: "common"
    },

    street: {
        id: "street",
        name: "Уличный кейс",
        price: 900000,
        rarity: "rare"
    },

    premium: {
        id: "premium",
        name: "Премиум кейс",
        price: 5000000,
        rarity: "epic"
    },

    elite: {
        id: "elite",
        name: "Элитный кейс",
        price: 15000000,
        rarity: "legendary"
    },

    imperial: {
        id: "imperial",
        name: "Имперский кейс",
        price: 100000000,
        rarity: "mythic"
    }
};

// ============================================================
// CARS
// ============================================================

const CARS = [
    // COMMON
    {
        name: "Lada VAZ 2114",
        price: 180000,
        rarity: "common"
    },
    {
        name: "Lada VAZ 2109",
        price: 160000,
        rarity: "common"
    },
    {
        name: "Lada Priora",
        price: 350000,
        rarity: "common"
    },
    {
        name: "Lada Granta",
        price: 550000,
        rarity: "common"
    },
    {
        name: "Daewoo Matiz",
        price: 280000,
        rarity: "common"
    },
    {
        name: "Daewoo Nexia",
        price: 420000,
        rarity: "common"
    },
    {
        name: "УАЗ Patriot",
        price: 750000,
        rarity: "common"
    },
    {
        name: "Lada Vesta",
        price: 1000000,
        rarity: "common"
    },
    {
        name: "Hyundai Solaris",
        price: 1100000,
        rarity: "common"
    },
    {
        name: "Kia Rio",
        price: 1150000,
        rarity: "common"
    },
    {
        name: "Renault Logan",
        price: 850000,
        rarity: "common"
    },
    {
        name: "Ford Focus",
        price: 1300000,
        rarity: "common"
    },
    {
        name: "Skoda Octavia",
        price: 1700000,
        rarity: "common"
    },
    {
        name: "Toyota Corolla",
        price: 1800000,
        rarity: "common"
    },

    // RARE
    {
        name: "Volkswagen Passat",
        price: 1900000,
        rarity: "rare"
    },
    {
        name: "Haval F7",
        price: 2200000,
        rarity: "rare"
    },
    {
        name: "Toyota Camry 70",
        price: 3000000,
        rarity: "rare"
    },
    {
        name: "BMW E60",
        price: 2200000,
        rarity: "rare"
    },
    {
        name: "BMW E90",
        price: 2400000,
        rarity: "rare"
    },
    {
        name: "Mercedes W212",
        price: 3000000,
        rarity: "rare"
    },
    {
        name: "Audi A6 C7",
        price: 3000000,
        rarity: "rare"
    },
    {
        name: "Subaru WRX",
        price: 1900000,
        rarity: "rare"
    },

    // EPIC
    {
        name: "BMW M4 F82",
        price: 5000000,
        rarity: "epic"
    },
    {
        name: "BMW M5 F10",
        price: 6000000,
        rarity: "epic"
    },
    {
        name: "BMW M6",
        price: 7000000,
        rarity: "epic"
    },
    {
        name: "BMW M3 Competition",
        price: 7500000,
        rarity: "epic"
    },
    {
        name: "BMW M4 Competition",
        price: 8500000,
        rarity: "epic"
    },
    {
        name: "Mercedes-AMG GT",
        price: 9000000,
        rarity: "epic"
    },
    {
        name: "Nissan GT-R R35",
        price: 9500000,
        rarity: "epic"
    },

    // LEGENDARY
    {
        name: "Audi RS6 C8",
        price: 10000000,
        rarity: "legendary"
    },
    {
        name: "BMW M5 CS",
        price: 10000000,
        rarity: "legendary"
    },
    {
        name: "BMW M8 Competition",
        price: 12000000,
        rarity: "legendary"
    },
    {
        name: "Mercedes-AMG GT 63",
        price: 14000000,
        rarity: "legendary"
    },
    {
        name: "Porsche 911 Turbo S",
        price: 16000000,
        rarity: "legendary"
    },

    // MYTHIC
    {
        name: "Lamborghini Huracan",
        price: 20000000,
        rarity: "mythic"
    },
    {
        name: "Lamborghini Urus",
        price: 22000000,
        rarity: "mythic"
    },
    {
        name: "McLaren 720S",
        price: 25000000,
        rarity: "mythic"
    },
    {
        name: "Lamborghini Aventador",
        price: 25000000,
        rarity: "mythic"
    },
    {
        name: "Ferrari 488",
        price: 28000000,
        rarity: "mythic"
    },
    {
        name: "Ferrari F8 Tributo",
        price: 32000000,
        rarity: "mythic"
    },
    {
        name: "McLaren 765LT",
        price: 35000000,
        rarity: "mythic"
    },
    {
        name: "Bentley Continental GT",
        price: 15000000,
        rarity: "mythic"
    },
    {
        name: "Porsche 918 Spyder",
        price: 45000000,
        rarity: "mythic"
    },
    {
        name: "Rolls-Royce Phantom",
        price: 50000000,
        rarity: "mythic"
    },
    {
        name: "Bugatti Chiron",
        price: 100000000,
        rarity: "mythic"
    }
];

// ============================================================
// CASE WEIGHTS
// ============================================================

const CASE_WEIGHTS = {
    starter: {
        common: 92,
        rare: 7,
        epic: 0.9,
        legendary: 0.09,
        mythic: 0.01
    },

    street: {
        common: 65,
        rare: 29,
        epic: 5,
        legendary: 0.9,
        mythic: 0.1
    },

    premium: {
        common: 25,
        rare: 45,
        epic: 25,
        legendary: 4.5,
        mythic: 0.5
    },

    elite: {
        common: 5,
        rare: 25,
        epic: 45,
        legendary: 23,
        mythic: 2
    },

    imperial: {
        common: 0,
        rare: 5,
        epic: 20,
        legendary: 45,
        mythic: 30
    }
};

// ============================================================
// HELPERS
// ============================================================

function now() {
    return Date.now();
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateLevel(spent) {
    // Уровень зависит именно от потраченных денег.
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

function safeNumber(value, fallback = 0) {
    const n = Number(value);

    if (!Number.isFinite(n)) {
        return fallback;
    }

    return Math.floor(n);
}

function normalizeInitData(value) {
    if (!value) return "";

    if (typeof value !== "string") {
        return "";
    }

    return value.trim();
}

// ============================================================
// TELEGRAM AUTH
// ============================================================

function validateTelegramInitData(initData) {
    initData = normalizeInitData(initData);

    if (!initData) {
        return {
            ok: false,
            error: "Telegram initData отсутствует"
        };
    }

    if (!BOT_TOKEN) {
        console.warn(
            "[AUTH] BOT_TOKEN не установлен. Telegram auth отключена."
        );

        return {
            ok: false,
            error: "BOT_TOKEN не настроен на сервере"
        };
    }

    try {
        const params = new URLSearchParams(initData);

        const hash = params.get("hash");

        if (!hash) {
            return {
                ok: false,
                error: "В initData отсутствует hash"
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
                error: "Неверная Telegram подпись"
            };
        }

        const userRaw = params.get("user");

        if (!userRaw) {
            return {
                ok: false,
                error: "Пользователь Telegram не найден"
            };
        }

        const user = JSON.parse(userRaw);

        if (!user || !user.id) {
            return {
                ok: false,
                error: "Некорректный Telegram user"
            };
        }

        return {
            ok: true,
            user
        };

    } catch (error) {
        console.error("[AUTH ERROR]", error);

        return {
            ok: false,
            error: "Не удалось проверить Telegram авторизацию"
        };
    }
}

// ============================================================
// AUTH EXTRACTION
// ============================================================

function getInitDataFromRequest(req) {
    return (
        req.headers["x-telegram-init-data"] ||
        req.body?.initData ||
        req.body?.init_data ||
        ""
    );
}

function authenticateRequest(req, res, next) {
    const initData = getInitDataFromRequest(req);

    const auth = validateTelegramInitData(initData);

    if (!auth.ok) {
        return res.status(401).json({
            ok: false,
            error: auth.error
        });
    }

    req.telegramUser = auth.user;

    next();
}

// ============================================================
// USER
// ============================================================

function getUserById(id) {
    return db
        .prepare(
            `SELECT * FROM users WHERE id = ?`
        )
        .get(id);
}

function createUser(telegramUser, referralId = null) {
    const timestamp = now();

    const insert = db.prepare(`
        INSERT INTO users (
            id,
            username,
            first_name,
            last_name,
            balance,
            spent,
            opened,
            sold,
            level,
            referral_id,
            referral_bonus_received,
            created_at,
            updated_at
        )
        VALUES (
            @id,
            @username,
            @first_name,
            @last_name,
            @balance,
            0,
            0,
            0,
            1,
            @referral_id,
            0,
            @created_at,
            @updated_at
        )
    `);

    insert.run({
        id: telegramUser.id,
        username: telegramUser.username || "",
        first_name: telegramUser.first_name || "",
        last_name: telegramUser.last_name || "",
        balance: START_BALANCE,
        referral_id: referralId,
        created_at: timestamp,
        updated_at: timestamp
    });

    return getUserById(telegramUser.id);
}

function updateTelegramUser(user) {
    db.prepare(`
        UPDATE users
        SET
            username = ?,
            first_name = ?,
            last_name = ?,
            updated_at = ?
        WHERE id = ?
    `).run(
        user.username || "",
        user.first_name || "",
        user.last_name || "",
        now(),
        user.id
    );
}

function ensureUser(telegramUser) {
    let user = getUserById(telegramUser.id);

    if (!user) {
        user = createUser(telegramUser);
    } else {
        updateTelegramUser(telegramUser);
        user = getUserById(telegramUser.id);
    }

    return user;
}

// ============================================================
// GARAGE
// ============================================================

function getGarage(userId) {
    return db
        .prepare(`
            SELECT
                id,
                car_name AS name,
                car_price AS price,
                rarity,
                created_at AS createdAt
            FROM garage
            WHERE user_id = ?
            ORDER BY id DESC
        `)
        .all(userId);
}

// ============================================================
// HISTORY
// ============================================================

function getHistory(userId) {
    return db
        .prepare(`
            SELECT
                id,
                type,
                car_name AS name,
                car_price AS price,
                amount,
                created_at AS createdAt
            FROM history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 100
        `)
        .all(userId);
}

function addHistory(
    userId,
    type,
    carName = null,
    carPrice = 0,
    amount = 0
) {
    db.prepare(`
        INSERT INTO history (
            user_id,
            type,
            car_name,
            car_price,
            amount,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        userId,
        type,
        carName,
        carPrice,
        amount,
        now()
    );
}

// ============================================================
// RESPONSE DATA
// ============================================================

function buildUserData(userId) {
    const user = getUserById(userId);

    if (!user) {
        return null;
    }

    const level = calculateLevel(user.spent);

    if (level !== user.level) {
        db.prepare(`
            UPDATE users
            SET level = ?, updated_at = ?
            WHERE id = ?
        `).run(
            level,
            now(),
            userId
        );
    }

    const freshUser = getUserById(userId);

    return {
        id: freshUser.id,

        username: freshUser.username,
        first_name: freshUser.first_name,
        last_name: freshUser.last_name,

        balance: freshUser.balance,
        spent: freshUser.spent,
        opened: freshUser.opened,
        sold: freshUser.sold,
        level: level,

        garage: getGarage(userId),
        history: getHistory(userId),

        referralId: freshUser.referral_id,
        referralBonusReceived:
            Boolean(freshUser.referral_bonus_received)
    };
}

// ============================================================
// CASE HELPERS
// ============================================================

function getCase(caseId) {
    return CASES[caseId] || null;
}

function pickRarity(caseId) {
    const weights = CASE_WEIGHTS[caseId];

    if (!weights) {
        return "common";
    }

    const entries = Object.entries(weights);

    let total = 0;

    for (const [, weight] of entries) {
        total += weight;
    }

    let random = Math.random() * total;

    for (const [rarity, weight] of entries) {
        random -= weight;

        if (random <= 0) {
            return rarity;
        }
    }

    return entries[entries.length - 1][0];
}

function pickCar(caseId) {
    const rarity = pickRarity(caseId);

    let available = CARS.filter(
        car => car.rarity === rarity
    );

    if (!available.length) {
        available = CARS.filter(
            car => car.rarity === "common"
        );
    }

    const car =
        available[
            randomInt(0, available.length - 1)
        ];

    return {
        name: car.name,
        price: car.price,
        rarity: car.rarity
    };
}

// ============================================================
// OPENING LOCK
// ============================================================

function isOpening(userId) {
    return Boolean(
        db
            .prepare(
                `SELECT user_id FROM openings WHERE user_id = ?`
            )
            .get(userId)
    );
}

function createOpeningLock(userId, caseId) {
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
}

function removeOpeningLock(userId) {
    db.prepare(`
        DELETE FROM openings
        WHERE user_id = ?
    `).run(userId);
}

// ============================================================
// ROUTES
// ============================================================

// ------------------------------------------------------------
// ROOT
// ------------------------------------------------------------

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});

// ------------------------------------------------------------
// HEALTH
// ------------------------------------------------------------

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        service: "autoempire",
        time: new Date().toISOString()
    });
});

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------

app.get("/api/config", (req, res) => {
    res.json({
        ok: true,

        service: "autoempire",

        telegramAuth: Boolean(BOT_TOKEN),

        cases: Object.values(CASES).map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            rarity: item.rarity
        })),

        referralBonus: REFERRAL_BONUS,

        startBalance: START_BALANCE
    });
});

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------

app.post("/api/auth", (req, res) => {
    try {
        const initData = getInitDataFromRequest(req);

        const auth = validateTelegramInitData(initData);

        if (!auth.ok) {
            console.error(
                "[AUTH FAILED]",
                auth.error
            );

            return res.status(401).json({
                ok: false,
                error: auth.error
            });
        }

        const telegramUser = auth.user;

        const user = ensureUser(
            telegramUser
        );

        const data = buildUserData(
            user.id
        );

        return res.json({
            ok: true,
            data
        });

    } catch (error) {
        console.error(
            "[POST /api/auth]",
            error
        );

        return res.status(500).json({
            ok: false,
            error: "Ошибка авторизации"
        });
    }
});

// ------------------------------------------------------------
// USER
// ------------------------------------------------------------

app.get(
    "/api/me",
    authenticateRequest,
    (req, res) => {
        try {
            const user = ensureUser(
                req.telegramUser
            );

            return res.json({
                ok: true,
                data: buildUserData(user.id)
            });

        } catch (error) {
            console.error(
                "[GET /api/me]",
                error
            );

            return res.status(500).json({
                ok: false,
                error: "Не удалось загрузить профиль"
            });
        }
    }
);

// ============================================================
// CASE OPEN
// ============================================================

app.post(
    "/api/cases/open",
    authenticateRequest,
    (req, res) => {
        const userId =
            req.telegramUser.id;

        const caseId =
            String(req.body?.caseId || "");

        const selectedCase =
            getCase(caseId);

        if (!selectedCase) {
            return res.status(400).json({
                ok: false,
                error: "Кейс не найден"
            });
        }

        // Защита от двух одновременных открытий.
        if (isOpening(userId)) {
            return res.status(409).json({
                ok: false,
                error: "Кейс уже открывается"
            });
        }

        const user =
            getUserById(userId);

        if (!user) {
            return res.status(401).json({
                ok: false,
                error: "Пользователь не найден"
            });
        }

        if (
            user.balance <
            selectedCase.price
        ) {
            return res.status(400).json({
                ok: false,
                error: "Недостаточно денег"
            });
        }

        try {
            // Создаём lock.
            createOpeningLock(
                userId,
                caseId
            );

            // Списываем стоимость кейса.
            db.prepare(`
                UPDATE users
                SET
                    balance = balance - ?,
                    spent = spent + ?,
                    opened = opened + 1,
                    level = ?,
                    updated_at = ?
                WHERE id = ?
            `).run(
                selectedCase.price,
                selectedCase.price,
                calculateLevel(
                    user.spent +
                    selectedCase.price
                ),
                now(),
                userId
            );

            const car =
                pickCar(caseId);

            addHistory(
                userId,
                "open",
                car.name,
                car.price,
                -selectedCase.price
            );

            // Возвращаем машину как pending.
            return res.json({
                ok: true,

                result: {
                    name: car.name,
                    price: car.price,
                    rarity: car.rarity,
                    caseId: selectedCase.id,
                    caseName: selectedCase.name
                },

                data: buildUserData(userId)
            });

        } catch (error) {
            console.error(
                "[POST /api/cases/open]",
                error
            );

            return res.status(500).json({
                ok: false,
                error: "Ошибка открытия кейса"
            });
        }
    }
);

// ============================================================
// KEEP
// ============================================================

app.post(
    "/api/cases/keep",
    authenticateRequest,
    (req, res) => {
        const userId =
            req.telegramUser.id;

        const name =
            String(req.body?.name || "");

        const car =
            CARS.find(
                item => item.name === name
            );

        if (!car) {
            removeOpeningLock(userId);

            return res.status(400).json({
                ok: false,
                error: "Автомобиль не найден"
            });
        }

        try {
            db.prepare(`
                INSERT INTO garage (
                    user_id,
                    car_name,
                    car_price,
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

            removeOpeningLock(userId);

            addHistory(
                userId,
                "keep",
                car.name,
                car.price,
                0
            );

            return res.json({
                ok: true,
                data: buildUserData(userId)
            });

        } catch (error) {
            console.error(
                "[POST /api/cases/keep]",
                error
            );

            removeOpeningLock(userId);

            return res.status(500).json({
                ok: false,
                error: "Не удалось сохранить автомобиль"
            });
        }
    }
);

// ============================================================
// SELL RESULT
// ============================================================

app.post(
    "/api/cases/sell",
    authenticateRequest,
    (req, res) => {
        const userId =
            req.telegramUser.id;

        const name =
            String(req.body?.name || "");

        const car =
            CARS.find(
                item => item.name === name
            );

        if (!car) {
            removeOpeningLock(userId);

            return res.status(400).json({
                ok: false,
                error: "Автомобиль не найден"
            });
        }

        try {
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

            removeOpeningLock(userId);

            addHistory(
                userId,
                "sell",
                car.name,
                car.price,
                car.price
            );

            return res.json({
                ok: true,
                data: buildUserData(userId)
            });

        } catch (error) {
            console.error(
                "[POST /api/cases/sell]",
                error
            );

            removeOpeningLock(userId);

            return res.status(500).json({
                ok: false,
                error: "Не удалось продать автомобиль"
            });
        }
    }
);

// ============================================================
// GARAGE SELL
// ============================================================

app.post(
    "/api/garage/sell",
    authenticateRequest,
    (req, res) => {
        const userId =
            req.telegramUser.id;

        const index =
            safeNumber(
                req.body?.index,
                -1
            );

        if (index < 0) {
            return res.status(400).json({
                ok: false,
                error: "Некорректный индекс"
            });
        }

        const garage =
            getGarage(userId);

        if (
            index >= garage.length
        ) {
            return res.status(400).json({
                ok: false,
                error: "Автомобиль не найден в гараже"
            });
        }

        const car =
            garage[index];

        if (!car) {
            return res.status(400).json({
                ok: false,
                error: "Автомобиль не найден"
            });
        }

        const transaction =
            db.transaction(() => {
                const deleted =
                    db.prepare(`
                        DELETE FROM garage
                        WHERE id = ?
                        AND user_id = ?
                    `).run(
                        car.id,
                        userId
                    );

                if (
                    deleted.changes !== 1
                ) {
                    throw new Error(
                        "Автомобиль уже продан"
                    );
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

                addHistory(
                    userId,
                    "garage_sell",
                    car.name,
                    car.price,
                    car.price
                );
            });

        try {
            transaction();

            return res.json({
                ok: true,
                data: buildUserData(userId)
            });

        } catch (error) {
            console.error(
                "[POST /api/garage/sell]",
                error
            );

            return res.status(500).json({
                ok: false,
                error: error.message ||
                    "Не удалось продать автомобиль"
            });
        }
    }
);

// ============================================================
// MARKET
// ============================================================

app.post(
    "/api/market/buy",
    authenticateRequest,
    (req, res) => {
        const userId =
            req.telegramUser.id;

        const name =
            String(req.body?.name || "");

        const car =
            CARS.find(
                item => item.name === name
            );

        if (!car) {
            return res.status(404).json({
                ok: false,
                error: "Автомобиль не найден"
            });
        }

        const user =
            getUserById(userId);

        if (!user) {
            return res.status(401).json({
                ok: false,
                error: "Пользователь не найден"
            });
        }

        if (
            user.balance <
            car.price
        ) {
            return res.status(400).json({
                ok: false,
                error: "Недостаточно денег"
            });
        }

        const transaction =
            db.transaction(() => {
                db.prepare(`
                    UPDATE users
                    SET
                        balance = balance - ?,
                        spent = spent + ?,
                        level = ?,
                        updated_at = ?
                    WHERE id = ?
                `).run(
                    car.price,
                    car.price,
                    calculateLevel(
                        user.spent +
                        car.price
                    ),
                    now(),
                    userId
                );

                db.prepare(`
                    INSERT INTO garage (
                        user_id,
                        car_name,
                        car_price,
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

                addHistory(
                    userId,
                    "market_buy",
                    car.name,
                    car.price,
                    -car.price
                );
            });

        try {
            transaction();

            return res.json({
                ok: true,
                data: buildUserData(userId)
            });

        } catch (error) {
            console.error(
                "[POST /api/market/buy]",
                error
            );

            return res.status(500).json({
                ok: false,
                error: "Не удалось купить автомобиль"
            });
        }
    }
);

// ============================================================
// REFERRAL
// ============================================================

app.post(
    "/api/referral",
    authenticateRequest,
    (req, res) => {
        const userId =
            req.telegramUser.id;

        const referralId =
            safeNumber(
                req.body?.referralId,
                0
            );

        if (
            !referralId ||
            referralId === userId
        ) {
            return res.status(400).json({
                ok: false,
                error: "Некорректный реферал"
            });
        }

        const user =
            getUserById(userId);

        if (!user) {
            return res.status(404).json({
                ok: false,
                error: "Пользователь не найден"
            });
        }

        if (user.referral_id) {
            return res.status(400).json({
                ok: false,
                error: "Реферал уже установлен"
            });
        }

        const inviter =
            getUserById(referralId);

        if (!inviter) {
            return res.status(404).json({
                ok: false,
                error: "Рефер не найден"
            });
        }

        try {
            const transaction =
                db.transaction(() => {

                    db.prepare(`
                        UPDATE users
                        SET
                            referral_id = ?,
                            referral_bonus_received = 1,
                            balance = balance + ?,
                            updated_at = ?
                        WHERE id = ?
                    `).run(
                        referralId,
                        REFERRAL_BONUS,
                        now(),
                        userId
                    );

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

                    addHistory(
                        userId,
                        "referral_bonus",
                        null,
                        0,
                        REFERRAL_BONUS
                    );

                    addHistory(
                        referralId,
                        "referral_invite",
                        null,
                        0,
                        REFERRAL_BONUS
                    );
                });

            transaction();

            return res.json({
                ok: true,
                data: buildUserData(userId)
            });

        } catch (error) {
            console.error(
                "[POST /api/referral]",
                error
            );

            return res.status(500).json({
                ok: false,
                error: "Ошибка реферальной системы"
            });
        }
    }
);

// ============================================================
// DAILY REWARD
// ============================================================

app.post(
    "/api/daily",
    authenticateRequest,
    (req, res) => {
        const userId =
            req.telegramUser.id;

        const user =
            getUserById(userId);

        if (!user) {
            return res.status(404).json({
                ok: false,
                error: "Пользователь не найден"
            });
        }

        // Серверный дневной бонус.
        // 24 часа между получениями.
        const last =
            db.prepare(`
                SELECT created_at
                FROM history
                WHERE user_id = ?
                AND type = 'daily'
                ORDER BY id DESC
                LIMIT 1
            `).get(userId);

        const DAY =
            24 * 60 * 60 * 1000;

        if (
            last &&
            now() - last.created_at < DAY
        ) {
            const remaining =
                DAY -
                (now() - last.created_at);

            return res.status(400).json({
                ok: false,
                error: "Ежедневная награда уже получена",
                remaining
            });
        }

        const reward =
            100000;

        try {
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

            addHistory(
                userId,
                "daily",
                null,
                0,
                reward
            );

            return res.json({
                ok: true,
                reward,
                data: buildUserData(userId)
            });

        } catch (error) {
            console.error(
                "[POST /api/daily]",
                error
            );

            return res.status(500).json({
                ok: false,
                error: "Не удалось получить награду"
            });
        }
    }
);

// ============================================================
// ADMIN / DEBUG INFO
// ============================================================

app.get("/api/stats", (req, res) => {
    try {
        const users =
            db.prepare(
                `SELECT COUNT(*) AS count FROM users`
            ).get();

        const garage =
            db.prepare(
                `SELECT COUNT(*) AS count FROM garage`
            ).get();

        const history =
            db.prepare(
                `SELECT COUNT(*) AS count FROM history`
            ).get();

        return res.json({
            ok: true,

            users: users.count,
            garageCars: garage.count,
            historyRecords: history.count,

            botTokenConfigured:
                Boolean(BOT_TOKEN),

            database: "sqlite",
            journalMode: "WAL"
        });

    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: "Ошибка статистики"
        });
    }
});

// ============================================================
// 404 API
// ============================================================

app.use("/api", (req, res) => {
    res.status(404).json({
        ok: false,
        error: "API endpoint не найден",
        method: req.method,
        path: req.path
    });
});

// ============================================================
// STATIC FILES
// ============================================================

app.use(
    express.static(__dirname, {
        index: "index.html"
    })
);

// ============================================================
// GLOBAL ERROR
// ============================================================

app.use(
    (err, req, res, next) => {
        console.error(
            "[GLOBAL ERROR]",
            err
        );

        if (res.headersSent) {
            return next(err);
        }

        res.status(500).json({
            ok: false,
            error: "Внутренняя ошибка сервера"
        });
    }
);

// ============================================================
// START
// ============================================================

const server = app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            "========================================"
        );

        console.log(
            "       AUTOEMPIRE SERVER STARTED"
        );

        console.log(
            "========================================"
        );

        console.log(
            `PORT: ${PORT}`
        );

        console.log(
            `ENV: ${NODE_ENV}`
        );

        console.log(
            `DB: ${dbPath}`
        );

        console.log(
            `BOT_TOKEN: ${
                BOT_TOKEN
                    ? "configured"
                    : "NOT CONFIGURED"
            }`
        );

        console.log(
            "POST /api/auth: ENABLED"
        );

        console.log(
            "POST /api/cases/open: ENABLED"
        );

        console.log(
            "POST /api/cases/keep: ENABLED"
        );

        console.log(
            "POST /api/cases/sell: ENABLED"
        );

        console.log(
            "POST /api/garage/sell: ENABLED"
        );

        console.log(
            "POST /api/market/buy: ENABLED"
        );

        console.log(
            "========================================"
        );
    }
);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(signal) {
    console.log(
        `[SERVER] ${signal} received`
    );

    server.close(() => {
        try {
            db.close();
        } catch (e) {}

        process.exit(0);
    });
}

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);
