const mysql = require('mysql2/promise'); // promise-based mysql client

// DB connection
let pool;

const connectionStr = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,

  // pool settings
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

function createConnectionPool() {
  pool = mysql.createPool(connectionStr);
}

// Used to check the app is alive (and DB is reachable)
async function isConnected() {
  const [rows] = await pool.execute('SELECT DATABASE() AS db');
  return rows[0].db;
}

// GET /types  -> from types table
async function getTypes() {
  const [result] = await pool.execute('SELECT type_name FROM types');
  // result is array of rows like [{type_name:'general'}, ...]
  const types = result.map(r => r.type_name);
  return types;
}

//jokes to return all jokes from DB
async function getAllJokes() {
  const [result] = await pool.execute(`
    SELECT j.id, t.type_name AS type, j.setup, j.punchline
    FROM jokes j
    JOIN types t ON j.type_id = t.type_id
  `);
  return result;
}

// GET /jokes/:type?count=n  -> from jokes table
async function getJokesByType(type) {
  const [result] = await pool.execute(
    `
    SELECT j.id, t.type_name AS type, j.setup, j.punchline
    FROM jokes j
    JOIN types t ON j.type_id = t.type_id
    WHERE LOWER(t.type_name) = ?
    `, // uses placeholder to prevent SQL injection
    [type]
  );
  return result;
}

// ETL helper functions

async function truncateJokes() {
  await pool.execute('TRUNCATE TABLE jokes');
}

// Insert type if missing (needs UNIQUE on type_name to be clean)
async function upsertType(typeName) {
  await pool.execute('INSERT IGNORE INTO types (type_name) VALUES (?)', [typeName]);
}

async function getTypeMap() {
  const [rows] = await pool.execute('SELECT type_id, type_name FROM types');
  const map = {};
  rows.forEach(r => { map[r.type_name.toLowerCase()] = r.type_id; });
  return map;
}

async function insertJokesBulk(jokesChunk) {
  // jokesChunk items: { type_id, setup, punchline }
  const values = [];
  const placeholders = jokesChunk.map(j => {
    values.push(j.type_id, j.setup, j.punchline);
    return '(?, ?, ?)';
  });

  const sql = `INSERT INTO jokes (type_id, setup, punchline) VALUES ${placeholders.join(',')}`;
  const [result] = await pool.execute(sql, values);
  return result.affectedRows;
}

// get type_id from name (used when submitting a joke)
async function getTypeIdByName(typeName) {
  const [rows] = await pool.execute(
    'SELECT type_id FROM types WHERE LOWER(type_name) = ?',
    [typeName.toLowerCase()]
  );
  return rows.length ? rows[0].type_id : null;
}

// insert a single joke into DB
async function insertJoke(type_id, setup, punchline) {
  const [result] = await pool.execute(
    'INSERT INTO jokes (type_id, setup, punchline) VALUES (?, ?, ?)',
    [type_id, setup, punchline]
  );
  return result.insertId;
}

module.exports = {
  createConnectionPool,
  isConnected,
  getTypes,
  getAllJokes,
  getJokesByType,

  // ETL
  truncateJokes,
  upsertType,
  getTypeMap,
  insertJokesBulk,

  // for submit
  getTypeIdByName,
  insertJoke
};