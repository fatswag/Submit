const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const axios = require('axios');
const amqp = require('amqplib');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

console.log("RUNNING SUBMIT APP OPTION 2 VERSION -", __filename);

const app = express();
const PORT = process.env.SUBMIT_PORT || 3001;

const JOKE_SERVICE_HOST = process.env.JOKE_SERVICE_HOST;
const JOKE_SERVICE_PORT = process.env.JOKE_SERVICE_PORT || 3000;

const RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'rabbitmq';
const RABBITMQ_PORT = process.env.RABBITMQ_PORT || 5672;
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE || 'submit-jokes';

const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'types.json');

app.use(bodyParser.json()) // json method parse json data into the req.body
app.use(express.static(path.join(__dirname, 'public'))) // Serve static web pages

// make cache folder if it doesn't exist
async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

// save latest types into file cache
async function saveTypesToCache(types) {
  await ensureCacheDir();
  await fs.writeFile(CACHE_FILE, JSON.stringify(types, null, 2), 'utf8');
}

// read cached types if joke service is down
async function readTypesFromCache() {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

// connect to RabbitMQ when submitting jokes
async function sendToQueue(jokeData) {
  const conn = await amqp.connect(`amqp://${RABBITMQ_HOST}:${RABBITMQ_PORT}`);
  const channel = await conn.createChannel();

  await channel.assertQueue(RABBITMQ_QUEUE, { durable: true });

  channel.sendToQueue(
    RABBITMQ_QUEUE,
    Buffer.from(JSON.stringify(jokeData)),
    { persistent: true }
  );

  await channel.close();
  await conn.close();
}

// ROUTES

// GET /types  -> get types from joke service, fallback to file cache
app.get('/types', async (req, res) => {
  try {
    const response = await axios.get(`http://${JOKE_SERVICE_HOST}:${JOKE_SERVICE_PORT}/types`);
    const types = response.data;

    await saveTypesToCache(types);

    res.json(types);
  } catch (err) {
    console.error('Live types failed, trying cache');

    const cachedTypes = await readTypesFromCache();

    if (cachedTypes.length > 0) {
      return res.json(cachedTypes);
    }

    res.status(500).json({ message: 'Could not load joke types' });
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

    // quick check so empty stuff doesn’t go in
    if (!type || !setup || !punchline) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // send the joke to RabbitMQ instead of the DB
    await sendToQueue({ type, setup, punchline });

    res.status(201).json({
      message: 'Joke queued successfully'
    });

  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

async function start() {
  try {
    // quick check that cache folder exists before app starts
    await ensureCacheDir();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err.message);
    process.exit(1);
  }
}

start();