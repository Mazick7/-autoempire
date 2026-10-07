const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const AUTH_MAX_AGE = 24 * 60 * 60;

const ROOT = __dirname;
const PUBLIC = ROOT;
const DB_FILE = path.join(ROOT, 'autoimperiya.db');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  balance INTEGER NOT NULL DEFAULT 5000000,
  spent INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  garage_json TEXT NOT NULL DEFAULT '[]',
  history_json TEXT NOT NULL DEFAULT '[]',
  pending_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

const CASES = {
  starter: {
    price: 300000,
    items: [
      ['Lada VAZ 2114',42],
      ['Lada VAZ 2109',30],
      ['Lada Priora',20],
      ['Lada Granta',15],
      ['Daewoo Matiz',10],
      ['Daewoo Nexia',10],
      ['УАЗ Patriot',8],
      ['Lada Vesta',5]
    ]
  },

  street: {
    price: 900000,
    items: [
      ['Hyundai Solaris',20],
      ['Kia Rio',18],
      ['Renault Logan',15],
      ['Ford Focus',13],
      ['Skoda Octavia',12],
      ['Toyota Corolla',10],
      ['Volkswagen Passat',8],
      ['Haval F7',5],
      ['Subaru WRX',2],
      ['Toyota Camry 70',1]
    ]
  },

  premium: {
    price: 5000000,
    items: [
      ['BMW E60',15],
      ['BMW E90',12],
      ['Mercedes W212',12],
      ['Audi A6 C7',10],
      ['BMW M4 F82',10],
      ['BMW M5 F10',9],
      ['BMW M6',7],
      ['BMW M3 Competition',6],
      ['BMW M4 Competition',5],
      ['Mercedes-AMG GT',4],
      ['Nissan GT-R R35',2]
    ]
  },

  elite: {
    price: 15000000,
    items: [
      ['BMW M5 CS',20],
      ['BMW M8 Competition',16],
      ['Mercedes-AMG GT 63',14],
      ['Porsche 911 Turbo S',13],
      ['Lamborghini Huracan',12],
      ['Lamborghini Urus',10],
      ['McLaren 720S',8]
    ]
  },

  imperial: {
    price: 100000000,
    items: [
      ['Lamborghini Aventador',20],
      ['Ferrari 488',18],
      ['Ferrari F8 Tributo',15],
      ['McLaren 765LT',13],
      ['Bentley Continental GT',10],
      ['Porsche 918 Spyder',7],
      ['Rolls-Royce Phantom',5],
      ['Bugatti Chiron',2]
    ]
  }
};

const CAR_PRICES = {
  'Lada VAZ 2114':180000,
  'Lada VAZ 2109':160000,
  'Lada Priora':350000,
  'Lada Granta':550000,
  'Daewoo Matiz':280000,
  'Daewoo Nexia':420000,
  'УАЗ Patriot':750000,
  'Lada Vesta':1000000,

  'Hyundai Solaris':1100000,
  'Kia Rio':1150000,
  'Renault Logan':850000,
  'Ford Focus':1300000,
  'Skoda Octavia':1700000,
  'Toyota Corolla':1800000,
  'Volkswagen Passat':1900000,
  'Subaru WRX':3000000,
  'Haval F7':2200000,
  'Toyota Camry 70':3000000,

  'BMW E60':2200000,
  'BMW E90':2400000,
  'Mercedes W212':3000000,
  'Audi A6 C7':3000000,
  'Mercedes W222':6000000,
  'BMW X5 F15':4500000,
  'Range Rover Sport':5000000,

  'BMW M4 F82':5000000,
  'Audi RS4':5000000,
  'BMW M5 F10':6000000,
  'BMW M6':7000000,
  'BMW M3 Competition':7500000,
  'BMW M4 Competition':8500000,
  'Mercedes-AMG GT':9000000,
  'Nissan GT-R R35':9500000,
  'Porsche 911':8500000,

  'Audi RS6 C8':10000000,
  'BMW M5 CS':10000000,
  'BMW M8 Competition':12000000,
  'Mercedes-AMG GT 63':14000000,
  'Porsche 911 Turbo S':16000000,
  'Lamborghini Huracan':20000000,
  'Lamborghini Urus':22000000,
  'McLaren 720S':25000000,

  'Lamborghini Aventador':25000000,
  'Ferrari 488':28000000,
  'Ferrari F8 Tributo':32000000,
  'McLaren 765LT':35000000,
  'Bentley Continental GT':15000000,
  'Porsche 918 Spyder':45000000,
  'Rolls-Royce Phantom':50000000,
  'Bugatti Chiron':100000000
};

const MARKET = {
  'Lada Vesta':1000000,
  'BMW E60':2200000,
  'Toyota Camry 70':3000000,
  'BMW M4 F82':5000000,
  'BMW M5 F10':6000000,
  'Nissan GT-R R35':9500000,
  'BMW M5 CS':10000000,
  'Mercedes-AMG GT 63':14000000,
  'Porsche 911 Turbo S':16000000,
  'Lamborghini Huracan':20000000,
  'Lamborghini Aventador':25000000,
  'Ferrari 488':28000000,
  'Rolls-Royce Phantom':50000000,
  'Bugatti Chiron':100000000
};

const RARITY = {
  starter:'common',
  street:'uncommon',
  premium:'epic',
  elite:'legendary',
  imperial:'mythic'
};

function now() {
  return Math.floor(Date.now() / 1000);
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type, X-Telegram-Init-Data',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
  });

  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve,reject)=>{
    let raw='';

    req.on('data',chunk=>{
      raw+=chunk;

      if(raw.length>1024*1024) {
        req.destroy();
      }
    });

    req.on('end',()=>{
      if(!raw) return resolve({});

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Некорректный JSON'));
      }
    });

    req.on('error',reject);
  });
}

function verifyTelegram(initData) {
  if(!BOT_TOKEN) {
    throw new Error('BOT_TOKEN не настроен');
  }

  if(!initData) {
    throw new Error('Telegram initData отсутствует');
  }

  const params = new URLSearchParams(initData);

  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const userRaw = params.get('user');

  if(!hash || !authDate || !userRaw) {
    throw new Error('Неполные данные Telegram');
  }

  if(Math.abs(now()-authDate)>AUTH_MAX_AGE) {
    throw new Error('Сессия Telegram устарела');
  }

  const pairs=[];

  for(const [key,value] of params.entries()) {
    if(key!=='hash') {
      pairs.push(`${key}=${value}`);
    }
  }

  pairs.sort();

  const checkString=pairs.join('\n');

  const secret=crypto
    .createHmac('sha256','WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const calculated=crypto
    .createHmac('sha256',secret)
    .update(checkString)
    .digest('hex');

  const a=Buffer.from(calculated,'hex');
  const b=Buffer.from(hash,'hex');

  if(
    a.length!==b.length ||
    !crypto.timingSafeEqual(a,b)
  ) {
    throw new Error('Недействительная Telegram подпись');
  }

  return JSON.parse(userRaw);
}

function getUser(req) {
  const initData=req.headers['x-telegram-init-data'];

  if(!initData) {
    throw new Error('Нет Telegram initData');
  }

  const telegramUser=verifyTelegram(initData);
  const id=String(telegramUser.id);

  let player=db
    .prepare('SELECT * FROM players WHERE telegram_id=?')
    .get(id);

  if(!player) {

    const t=now();

    db.prepare(`
      INSERT INTO players
      (
        telegram_id,
        username,
        first_name,
        last_name,
        photo_url,
        created_at,
        updated_at
      )
      VALUES(?,?,?,?,?,?,?)
    `).run(
      id,
      telegramUser.username||null,
      telegramUser.first_name||'',
      telegramUser.last_name||'',
      telegramUser.photo_url||null,
      t,
      t
    );

  } else {

    db.prepare(`
      UPDATE players
      SET
        username=?,
        first_name=?,
        last_name=?,
        photo_url=?,
        updated_at=?
      WHERE telegram_id=?
    `).run(
      telegramUser.username||null,
      telegramUser.first_name||'',
      telegramUser.last_name||'',
      telegramUser.photo_url||null,
      now(),
      id
    );
  }

  return db
    .prepare('SELECT * FROM players WHERE telegram_id=?')
    .get(id);
}

function data(player) {
  return {
    balance:player.balance,
    spent:player.spent,
    opened:player.opened,
    sold:player.sold,
    garage:JSON.parse(player.garage_json||'[]'),
    history:JSON.parse(player.history_json||'[]')
  };
}

function choose(items) {

  const total=items.reduce(
    (sum,item)=>sum+item[1],
    0
  );

  let random=Math.random()*total;

  for(const [name,weight] of items) {

    random-=weight;

    if(random<=0) {
      return name;
    }
  }

  return items[items.length-1][0];
}

function update(id,fields) {

  const keys=Object.keys(fields);

  if(!keys.length) return;

  const values=keys.map(key=>fields[key]);

  const sql=`
    UPDATE players
    SET
      ${keys.map(key=>`${key}=?`).join(',')},
      updated_at=?
    WHERE telegram_id=?
  `;

  db.prepare(sql).run(
    ...values,
    now(),
    id
  );
}

async function api(req,res) {

  if(req.method==='OPTIONS') {
    return sendJSON(res,204,{});
  }

  if(req.url==='/health') {
    return sendJSON(res,200,{
      ok:true,
      service:'autoimperiya'
    });
  }

  if(req.url==='/api/auth' && req.method==='POST') {

    try {

      const player=getUser(req);

      return sendJSON(res,200,{
        ok:true,
        user:{
          id:player.telegram_id,
          username:player.username,
          firstName:player.first_name,
          lastName:player.last_name,
          photoUrl:player.photo_url
        },
        data:data(player)
      });

    } catch(error) {

      return sendJSON(res,401,{
        ok:false,
        error:error.message
      });
    }
  }

  let player;

  try {
    player=getUser(req);
  } catch(error) {

    return sendJSON(res,401,{
      ok:false,
      error:error.message
    });
  }

  const id=player.telegram_id;

  if(req.url==='/api/me' && req.method==='GET') {

    return sendJSON(res,200,{
      ok:true,
      data:data(player)
    });
  }

  if(req.url==='/api/cases/open' && req.method==='POST') {

    try {

      const input=await body(req);
      const caseId=input.caseId;
      const current=CASES[caseId];

      if(!current) {
        throw new Error('Кейс не найден');
      }

      if(player.pending_json) {
        throw new Error('Сначала заверши текущий кейс');
      }

      if(player.balance<current.price) {
        throw new Error('Недостаточно средств');
      }

      const winner=choose(current.items);
      const value=CAR_PRICES[winner]||0;

      const pending={
        caseId,
        name:winner,
        value,
        casePrice:current.price,
        createdAt:Date.now()
      };

      update(id,{
        balance:player.balance-current.price,
        spent:player.spent+current.price,
        opened:player.opened+1,
        pending_json:JSON.stringify(pending)
      });

      player=db
        .prepare('SELECT * FROM players WHERE telegram_id=?')
        .get(id);

      return sendJSON(res,200,{
        ok:true,
        result:{
          name:winner,
          value,
          rarity:RARITY[caseId],
          casePrice:current.price
        },
        data:data(player)
      });

    } catch(error) {

      return sendJSON(res,400,{
        ok:false,
        error:error.message
      });
    }
  }

  if(req.url==='/api/cases/keep' && req.method==='POST') {

    try {

      const input=await body(req);

      if(!player.pending_json) {
        throw new Error('Нет незавершённого кейса');
      }

      const pending=JSON.parse(player.pending_json);

      if(input.name!==pending.name) {
        throw new Error('Результат не совпадает');
      }

      const garage=JSON.parse(
        player.garage_json||'[]'
      );

      garage.push({
        name:pending.name,
        value:pending.value,
        time:Date.now()
      });

      const history=JSON.parse(
        player.history_json||'[]'
      );

      history.push({
        case:pending.caseId,
        car:pending.name,
        casePrice:pending.casePrice,
        carPrice:pending.value,
        time:Date.now()
      });

      update(id,{
        garage_json:JSON.stringify(garage),
        history_json:JSON.stringify(history.slice(-200)),
        pending_json:null
      });

      player=db
        .prepare('SELECT * FROM players WHERE telegram_id=?')
        .get(id);

      return sendJSON(res,200,{
        ok:true,
        data:data(player)
      });

    } catch(error) {

      return sendJSON(res,400,{
        ok:false,
        error:error.message
      });
    }
  }

  if(req.url==='/api/cases/sell' && req.method==='POST') {

    try {

      const input=await body(req);

      if(!player.pending_json) {
        throw new Error('Нет незавершённого кейса');
      }

      const pending=JSON.parse(player.pending_json);

      if(input.name!==pending.name) {
        throw new Error('Результат не совпадает');
      }

      const sell=Math.floor(
        pending.value*0.85
      );

      const history=JSON.parse(
        player.history_json||'[]'
      );

      history.push({
        case:pending.caseId,
        car:pending.name,
        casePrice:pending.casePrice,
        carPrice:pending.value,
        sold:true,
        sellPrice:sell,
        time:Date.now()
      });

      update(id,{
        balance:player.balance+sell,
        sold:player.sold+1,
        history_json:JSON.stringify(history.slice(-200)),
        pending_json:null
      });

      player=db
        .prepare('SELECT * FROM players WHERE telegram_id=?')
        .get(id);

      return sendJSON(res,200,{
        ok:true,
        sellPrice:sell,
        data:data(player)
      });

    } catch(error) {

      return sendJSON(res,400,{
        ok:false,
        error:error.message
      });
    }
  }

  if(req.url==='/api/garage/sell' && req.method==='POST') {

    try {

      const input=await body(req);
      const index=Number(input.index);

      const garage=JSON.parse(
        player.garage_json||'[]'
      );

      if(
        !Number.isInteger(index) ||
        index<0 ||
        index>=garage.length
      ) {
        throw new Error('Автомобиль не найден');
      }

      const car=garage[index];

      const sell=Math.floor(
        Number(car.value)*0.85
      );

      garage.splice(index,1);

      update(id,{
        balance:player.balance+sell,
        sold:player.sold+1,
        garage_json:JSON.stringify(garage)
      });

      player=db
        .prepare('SELECT * FROM players WHERE telegram_id=?')
        .get(id);

      return sendJSON(res,200,{
        ok:true,
        sellPrice:sell,
        data:data(player)
      });

    } catch(error) {

      return sendJSON(res,400,{
        ok:false,
        error:error.message
      });
    }
  }

  if(req.url==='/api/market/buy' && req.method==='POST') {

    try {

      const input=await body(req);
      const price=MARKET[input.name];

      if(!price) {
        throw new Error('Автомобиль не найден');
      }

      if(player.balance<price) {
        throw new Error('Недостаточно средств');
      }

      const garage=JSON.parse(
        player.garage_json||'[]'
      );

      garage.push({
        name:input.name,
        value:price,
        time:Date.now()
      });

      update(id,{
        balance:player.balance-price,
        garage_json:JSON.stringify(garage)
      });

      player=db
        .prepare('SELECT * FROM players WHERE telegram_id=?')
        .get(id);

      return sendJSON(res,200,{
        ok:true,
        data:data(player)
      });

    } catch(error) {

      return sendJSON(res,400,{
        ok:false,
        error:error.message
      });
    }
  }

  return sendJSON(res,404,{
    ok:false,
    error:'Not found'
  });
}

function staticFile(req,res) {

  let pathname=new URL(
    req.url,
    'http://localhost'
  ).pathname;

  if(pathname==='/') {
    pathname='/index.html';
  }

  const filename=path.normalize(
    path.join(PUBLIC,pathname)
  );

  if(!filename.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filename,(error,file)=>{

    if(error) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const extension=path.extname(filename);

    const types={
      '.html':'text/html; charset=utf-8',
      '.js':'text/javascript; charset=utf-8',
      '.css':'text/css; charset=utf-8',
      '.json':'application/json'
    };

    res.writeHead(200,{
      'Content-Type':
        types[extension] ||
        'application/octet-stream',
      'Cache-Control':'no-store'
    });

    res.end(file);
  });
}

const server=http.createServer(
  (req,res)=>{

    if(
      req.url.startsWith('/api/') ||
      req.url==='/health' ||
      req.method==='OPTIONS'
    ) {
      return api(req,res);
    }

    return staticFile(req,res);
  }
);

server.listen(
  PORT,
  ()=>console.log(
    `Autoimperiya server started on port ${PORT}`
  )
);
