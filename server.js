const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nirlene2026';

// Usa DATABASE_URL no Render, SQLite-style local via variável ou fallback
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guests (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      group_token TEXT,
      confirmed_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      guest_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

initDB().catch(err => {
  console.error('Erro ao iniciar banco:', err.message);
  process.exit(1);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/count', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) AS count FROM guests');
    res.json({ count: parseInt(rows[0].count, 10) });
  } catch {
    res.json({ count: 0 });
  }
});

app.post('/api/rsvp', async (req, res) => {
  const { names } = req.body;

  if (!names || !Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'Informe pelo menos um nome.' });
  }

  const trimmed = names.map(n => n.trim()).filter(n => n.length > 0);
  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'Informe pelo menos um nome.' });
  }

  const deadline = new Date('2026-09-03T23:59:59-03:00');
  if (new Date() > deadline) {
    return res.status(403).json({ error: 'O prazo para confirmações encerrou em 03/09/2026.' });
  }

  const groupToken = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  try {
    for (const name of trimmed) {
      await pool.query(
        'INSERT INTO guests (name, group_token) VALUES ($1, $2)',
        [name, groupToken]
      );
    }
    res.json({ success: true, groupToken, names: trimmed });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar. Tente novamente.' });
  }
});

app.post('/api/message', async (req, res) => {
  const { guestName, message } = req.body;

  if (!guestName || !message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  try {
    await pool.query(
      'INSERT INTO messages (guest_name, message) VALUES ($1, $2)',
      [guestName.trim(), message.trim()]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erro ao salvar recado.' });
  }
});

app.post('/api/admin', async (req, res) => {
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  try {
    const { rows: guests } = await pool.query(
      'SELECT * FROM guests ORDER BY confirmed_at ASC'
    );
    const { rows: messages } = await pool.query(
      'SELECT * FROM messages ORDER BY created_at ASC'
    );
    res.json({ guests, messages });
  } catch {
    res.status(500).json({ error: 'Erro ao buscar dados.' });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✨ Servidor rodando na porta ${PORT}`);
});
