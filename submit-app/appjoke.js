const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

console.log("RUNNING SUBMIT APP DB VERSION -", __filename);

const app = express();
const PORT = process.env.SUBMIT_PORT || process.env.PORT || 3001;

app.use(bodyParser.json()) // json method parse json data into the req.body
app.use(express.static(path.join(__dirname, 'public'))) // Serve static web pages

// DB connection
// moved into lib/joke-db.js for separation of concerns
const db = require('./lib/joke-db.js');

// ROUTES

// GET /types  -> from types table
app.get('/types', async (req, res) => {
  try {
    const types = await db.getTypes();
    res.json(types);
  } catch (err) {
    res.status(500).send(err);
  }
});

// POST route to submit a new joke
app.post('/submit', async (req, res) => {
  try {
    let { type, setup, punchline } = req.body;

    // basic cleanup
    type = (type || '').trim().toLowerCase();
    setup = (setup || '').trim();
    punchline = (punchline || '').trim();

    // quick check so empty stuff doesn’t go in DB
    if (!type || !setup || !punchline) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // make sure type exists (insert if not)
    await db.upsertType(type);

    // get id for that type
    const type_id = await db.getTypeIdByName(type);

    if (!type_id) {
      return res.status(500).json({ message: 'Type lookup failed' });
    }

    // insert the joke
    const jokeId = await db.insertJoke(type_id, setup, punchline);

    res.status(201).json({
      message: 'Joke added',
      id: jokeId
    });

  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

db.createConnectionPool();

async function start() {
  try {
    const dbName = await db.isConnected();
    console.log(`Connected to MySQL database "${dbName}"`);

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
}

start();