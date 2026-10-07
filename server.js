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

if (!BOT_TOKEN) console.warn('WARNING: BOT_TOKEN is not set. Telegram authentication will fail.');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS players (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  balance INTEGER NOT NULL DEFAULT 10000000,
  spent INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  garage_json TEXT NOT NULL DEFAULT '[]',
  history_json TEXT NOT NULL DEFAULT '[]',
  pending_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_balance ON players(balance);
`);

const CASES = {
  starter: { price: 300000, items: [
    ['VAZ 2114',14],['VAZ 2109',12],['VAZ 2110',11],['VAZ 2115',10],['PRIORA',12],['GRANTA',10],['VESTA',9],['Kia Rio',7],['Hyundai Solaris',6],['Volkswagen Polo',4],['Renault Logan',3],['Toyota Corolla',2]
  ]},
  city: { price: 1200000, items: [
    ['PRIORA',5],['VESTA',6],['Kia Rio',5],['Hyundai Solaris',5],['Volkswagen Polo',5],['Toyota Corolla',7],['BMW E39',10],['BMW E46',9],['BMW E60',8],['Mercedes W204',8],['Mercedes W211',7],['Audi A4 B8',7],['Audi A6 C6',6],['Toyota Camry 70',6],['Volkswagen Passat B8',5],['Honda Civic Type R',1]
  ]},
  premium: { price: 5000000, items: [
    ['BMW E60',5],['Mercedes W204',5],['Audi A6 C6',5],['Toyota Camry 70',7],['Honda Civic Type R',7],['BMW M3 E92',9],['BMW M4 F82',10],['BMW M5 F90',8],['Mercedes C63 AMG',8],['Mercedes E63 AMG',7],['Audi RS4',7],['Audi RS6 C7',6],['Nissan 370Z',6],['Toyota Supra A90',6],['Ford Mustang GT',7],['BMW M5 E60',3]
  ]},
  elite: { price: 15000000, items: [
    ['BMW M5 F90',8],['Mercedes E63 AMG',8],['Audi RS6 C7',7],['Toyota Supra A90',7],['BMW M5 E60',7],['BMW M5 CS',9],['Mercedes-AMG GT',8],['Audi RS6 C8',8],['Nissan GT-R R35',8],['Toyota GR Supra',6],['Chevrolet Corvette C8',6],['Lexus LC500',6],['Porsche 911 Turbo S',4],['Porsche 911 GT3 RS',2]
  ]},
  legend: { price: 40000000, items: [
    ['BMW M5 CS',9],['Mercedes-AMG GT',8],['Audi RS6 C8',8],['Nissan GT-R R35',8],['Porsche 911 Turbo S',9],['Porsche 911 GT3 RS',7],['Chevrolet Corvette C8',7],['Lexus LC500',6],['Lamborghini Huracán',7],['Ferrari 488 GTB',6],['McLaren 720S',5],['Aston Martin DBS',5],['Bentley Continental GT',4],['Lamborghini Aventador',3],['Ferrari SF90',2],['Porsche 918 Spyder',1]
  ]},
  imperial: { price: 100000000, items: [
    ['Porsche 911 GT3 RS',8],['Porsche 911 Turbo S',8],['Lamborghini Huracán',9],['Ferrari 488 GTB',8],['McLaren 720S',8],['Aston Martin DBS',7],['Bentley Continental GT',7],['Lamborghini Aventador',8],['Ferrari SF90',7],['Porsche 918 Spyder',5],['BMW M5 CS',5],['Nissan GT-R R35',4],['Audi RS6 C8',4],['Mercedes-AMG GT',3]
  ]}
};

const MARKET = {
  'Lada Vesta': 1000000,
  'BMW E60': 2200000,
  'Toyota Camry 70': 3000000,
  'BMW M4 F82': 5000000,
  'BMW M5 F90': 7500000,
  'Nissan GT-R R35': 9500000,
  'BMW M5 CS': 10000000,
  'Porsche 911 Turbo S': 14000000,
  'Lamborghini Huracán': 18000000,
  'Ferrari SF90': 30000000
};

const CAR_PRICES = {
  'VAZ 2114':350000,'VAZ 2109':300000,'VAZ 2110':320000,'VAZ 2115':380000,'PRIORA':450000,'GRANTA':650000,'VESTA':1000000,
  'Kia Rio':900000,'Hyundai Solaris':850000,'Volkswagen Polo':900000,'Renault Logan':700000,'Toyota Corolla':1500000,
  'BMW E39':1800000,'BMW E46':2000000,'BMW E60':2200000,'Mercedes W204':2500000,'Mercedes W211':1900000,'Audi A4 B8':2000000,'Audi A6 C6':2200000,'Toyota Camry 70':3000000,'Volkswagen Passat B8':2300000,'Honda Civic Type R':3500000,
  'BMW M3 E92':4500000,'BMW M4 F82':5000000,'BMW M5 F90':7500000,'Mercedes C63 AMG':6000000,'Mercedes E63 AMG':7000000,'Audi RS4':5000000,'Audi RS6 C7':6500000,'Nissan 370Z':4000000,'Toyota Supra A90':6000000,'Ford Mustang GT':4500000,
  'BMW M5 CS':10000000,'BMW M5 E60':5500000,'Mercedes-AMG GT':9000000,'Audi RS6 C8':10000000,'Nissan GT-R R35':9500000,'Porsche 911 Turbo S':14000000,'Porsche 911 GT3 RS':18000000,'Toyota GR Supra':6500000,'Chevrolet Corvette C8':8000000,'Lexus LC500':7000000,
  'Lamborghini Huracán':18000000,'Lamborghini Aventador':25000000,'Ferrari 488 GTB':20000000,'Ferrari SF90':30000000,'McLaren 720S':22000000,'Aston Martin DBS':20000000,'Bentley Continental GT':15000000,'Porsche 918 Spyder':45000000
};

const RARITY_BY_CASE = {starter:'common',city:'rare',premium:'epic',elite:'legendary',legend:'legendary',imperial:'mythic'};

function now(){ return Math.floor(Date.now()/1000); }
function json(res,status,payload){
  const body=JSON.stringify(payload);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Telegram-Init-Data','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
  res.end(body);
}
function parseBody(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{raw+=chunk;if(raw.length>1024*1024) req.destroy();});
    req.on('end',()=>{if(!raw)return resolve({});try{resolve(JSON.parse(raw))}catch(e){reject(new Error('Некорректный JSON'))}});
    req.on('error',reject);
  });
}
function validateInitData(initData){
  if(!BOT_TOKEN || !initData) throw new Error('Telegram авторизация не получена');
  const params=new URLSearchParams(initData);
  const hash=params.get('hash');
  const authDate=Number(params.get('auth_date'));
  const userRaw=params.get('user');
  if(!hash || !authDate || !userRaw) throw new Error('Неполные данные Telegram');
  if(Math.abs(now()-authDate)>AUTH_MAX_AGE) throw new Error('Сессия Telegram устарела');
  const pairs=[];
  for(const [key,value] of params.entries()) if(key!=='hash') pairs.push(`${key}=${value}`);
  pairs.sort();
  const checkString=pairs.join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(BOT_TOKEN).digest();
  const calculated=crypto.createHmac('sha256',secret).update(checkString).digest('hex');
  const a=Buffer.from(calculated,'hex'), b=Buffer.from(hash,'hex');
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) throw new Error('Недействительная Telegram подпись');
  let user;try{user=JSON.parse(userRaw)}catch(e){throw new Error('Некорректный Telegram user')}
  if(!user.id) throw new Error('Telegram user отсутствует');
  return user;
}
function upsertUser(tgUser){
  const id=String(tgUser.id), t=now();
  const existing=db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);
  if(existing){
    db.prepare('UPDATE players SET username=?,first_name=?,last_name=?,photo_url=?,updated_at=? WHERE telegram_id=?').run(tgUser.username||null,tgUser.first_name||'',tgUser.last_name||'',tgUser.photo_url||null,t,id);
  }else{
    db.prepare('INSERT INTO players (telegram_id,username,first_name,last_name,photo_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id,tgUser.username||null,tgUser.first_name||'',tgUser.last_name||'',tgUser.photo_url||null,t,t);
  }
  return db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);
}
function playerData(row){
  return {balance:row.balance,spent:row.spent,opened:row.opened,sold:row.sold,garage:JSON.parse(row.garage_json||'[]'),history:JSON.parse(row.history_json||'[]')};
}
function publicUser(row){return {id:row.telegram_id,username:row.username,firstName:row.first_name,lastName:row.last_name,photoUrl:row.photo_url};}
function auth(req){
  const raw=req.headers['x-telegram-init-data'];
  if(!raw) throw new Error('Нет Telegram initData');
  const tgUser=validateInitData(raw);
  return upsertUser(tgUser);
}
function pick(items){
  const total=items.reduce((s,x)=>s+x[1],0);let r=crypto.randomInt(0,total*1000000)/1000000;
  for(const [name,w] of items){r-=w;if(r<=0)return name;}
  return items[items.length-1][0];
}
function updatePlayer(id,fields){
  const keys=Object.keys(fields);if(!keys.length)return;
  const sql=`UPDATE players SET ${keys.map(k=>`${k}=?`).join(',')}, updated_at=? WHERE telegram_id=?`;
  db.prepare(sql).run(...keys.map(k=>fields[k]),now(),id);
}
function addHistory(row,item){
  const history=JSON.parse(row.history_json||'[]');history.push(item);return history.slice(-200);
}
function route(req,res){
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.url==='/health' && req.method==='GET') return json(res,200,{ok:true});
  if(req.url==='/api/auth' && req.method==='POST') return parseBody(req).then(()=>{const row=auth(req);return json(res,200,{ok:true,user:publicUser(row),data:playerData(row)})}).catch(e=>json(res,401,{error:e.message}));

  let row;
  try{row=auth(req)}catch(e){return json(res,401,{error:e.message})}
  const id=row.telegram_id;

  if(req.url==='/api/me' && req.method==='GET') return json(res,200,{ok:true,user:publicUser(row),data:playerData(row)});

  if(req.url==='/api/cases/open' && req.method==='POST') return parseBody(req).then(body=>{
    const c=CASES[body.caseId];if(!c)throw new Error('Кейс не найден');
    if(row.pending_json)throw new Error('Сначала заверши текущий кейс');
    if(row.balance<c.price)throw new Error('Недостаточно средств');
    const winner=pick(c.items), value=CAR_PRICES[winner]||0;
    const pending={caseId:body.caseId,name:winner,value,casePrice:c.price,createdAt:now()};
    updatePlayer(id,{balance:row.balance-c.price,spent:row.spent+c.price,opened:row.opened+1,pending_json:JSON.stringify(pending)});
    row=db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);
    return json(res,200,{ok:true,result:{name:winner,value,rarity:RARITY_BY_CASE[body.caseId],casePrice:c.price},data:playerData(row)});
  }).catch(e=>json(res,400,{error:e.message}));

  if(req.url==='/api/cases/keep' && req.method==='POST') return parseBody(req).then(body=>{
    if(!row.pending_json)throw new Error('Нет незавершённого кейса');
    const p=JSON.parse(row.pending_json);if(body.name!==p.name)throw new Error('Результат не совпадает');
    const garage=JSON.parse(row.garage_json||'[]');garage.push({name:p.name,value:p.value,time:Date.now()});
    const history=addHistory(row,{case:body.caseId||p.caseId,car:p.name,casePrice:p.casePrice,carPrice:p.value,time:Date.now()});
    updatePlayer(id,{garage_json:JSON.stringify(garage),history_json:JSON.stringify(history),pending_json:null});
    row=db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);
    return json(res,200,{ok:true,data:playerData(row)});
  }).catch(e=>json(res,400,{error:e.message}));

  if(req.url==='/api/cases/sell' && req.method==='POST') return parseBody(req).then(body=>{
    if(!row.pending_json)throw new Error('Нет незавершённого кейса');
    const p=JSON.parse(row.pending_json);if(body.name!==p.name)throw new Error('Результат не совпадает');
    const sell=Math.floor(p.value*.85), history=addHistory(row,{case:body.caseId||p.caseId,car:p.name,casePrice:p.casePrice,carPrice:p.value,sold:true,sellPrice:sell,time:Date.now()});
    updatePlayer(id,{balance:row.balance+sell,sold:row.sold+1,history_json:JSON.stringify(history),pending_json:null});
    row=db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);
    return json(res,200,{ok:true,sellPrice:sell,data:playerData(row)});
  }).catch(e=>json(res,400,{error:e.message}));

  if(req.url==='/api/garage/sell' && req.method==='POST') return parseBody(req).then(body=>{
    const garage=JSON.parse(row.garage_json||'[]'), index=Number(body.index);
    if(!Number.isInteger(index)||index<0||index>=garage.length)throw new Error('Автомобиль не найден');
    const car=garage[index], sell=Math.floor(Number(car.value)*.85);garage.splice(index,1);
    updatePlayer(id,{balance:row.balance+sell,sold:row.sold+1,garage_json:JSON.stringify(garage)});
    row=db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);
    return json(res,200,{ok:true,sellPrice:sell,data:playerData(row)});
  }).catch(e=>json(res,400,{error:e.message}));

  if(req.url==='/api/market/buy' && req.method==='POST') return parseBody(req).then(body=>{
    const price=MARKET[body.name];if(!price)throw new Error('Автомобиль не найден на рынке');
    if(row.balance<price)throw new Error('Недостаточно средств');
    const garage=JSON.parse(row.garage_json||'[]');garage.push({name:body.name,value:price,time:Date.now()});
    updatePlayer(id,{balance:row.balance-price,garage_json:JSON.stringify(garage)});
    row=db.prepare('SELECT * FROM players WHERE telegram_id=?').get(id);
    return json(res,200,{ok:true,data:playerData(row)});
  }).catch(e=>json(res,400,{error:e.message}));

  return json(res,404,{error:'Not found'});
}

function serveStatic(req,res){
  let pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/')pathname='/index.html';
  const file=path.normalize(path.join(PUBLIC,pathname));
  if(!file.startsWith(PUBLIC))return json(res,403,{error:'Forbidden'});
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);return res.end('Not found')}
    const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  });
}

http.createServer((req,res)=>{
  if(req.url.startsWith('/api/')||req.url==='/health'||req.method==='OPTIONS') route(req,res);
  else serveStatic(req,res);
}).listen(PORT,()=>console.log(`Автоимперия server listening on :${PORT}`));
