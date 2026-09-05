const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nirlene2026';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function enviarEmailConfirmacao(names, total) {
  if (!process.env.BREVO_API_KEY) return;
  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Convite Nirlene', email: 'jamili.rizzo@gmail.com' },
        to: [{ email: 'jamili.rizzo@gmail.com', name: 'Jamili' }],
        subject: `✅ Nova confirmação — ${names[0]}`,
        htmlContent: `
          <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;background:#FBF7F0;border-top:4px solid #A05F2C;">
            <h2 style="color:#65582D;font-style:italic;margin-bottom:8px;">Nova confirmação de presença</h2>
            <p style="color:#6B5535;font-size:16px;">Alguém acabou de confirmar para o jantar da Nirlene:</p>
            <div style="background:#fff;border:1px solid #D1B791;padding:20px 24px;margin:20px 0;">
              ${names.map(n => `<p style="margin:6px 0;font-size:18px;color:#3A2E1A;"><strong>${n}</strong></p>`).join('')}
            </div>
            <p style="color:#9B845A;font-size:14px;">Total confirmado até agora: <strong>${total} pessoa(s)</strong></p>
            <a href="https://nirlene-rsvp.onrender.com/admin"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#A05F2C;color:#fff;text-decoration:none;font-family:sans-serif;font-size:13px;">
              Ver painel completo →
            </a>
          </div>
        `,
      }),
    });
    if (resp.ok) {
      console.log(`📧 Email enviado — ${names.join(', ')}`);
    } else {
      const err = await resp.text();
      console.error('⚠️ Email não enviado:', err);
    }
  } catch (err) {
    console.error('⚠️ Email não enviado:', err.message);
  }
}

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
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
    console.log('✅ Banco de dados pronto.');
  } finally {
    client.release();
  }
}

initDB().catch(err => {
  console.error('❌ Erro ao conectar no banco:', err.message);
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

  const deadline = new Date('2026-09-07T23:59:59-03:00');
  if (new Date() > deadline) {
    return res.status(403).json({ error: 'O prazo para confirmações encerrou em 07/09/2026.' });
  }

  const groupToken = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  try {
    for (const name of trimmed) {
      await pool.query(
        'INSERT INTO guests (name, group_token) VALUES ($1, $2)',
        [name, groupToken]
      );
    }

    // Total atualizado para incluir no email
    const { rows } = await pool.query('SELECT COUNT(*) AS count FROM guests');
    const total = parseInt(rows[0].count, 10);

    // Envia email em background — não bloqueia a resposta
    enviarEmailConfirmacao(trimmed, total);

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
    const { rows: guests } = await pool.query('SELECT * FROM guests ORDER BY confirmed_at ASC');
    const { rows: messages } = await pool.query('SELECT * FROM messages ORDER BY created_at ASC');
    res.json({ guests, messages });
  } catch {
    res.status(500).json({ error: 'Erro ao buscar dados.' });
  }
});

app.delete('/api/guest/:id', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  try {
    await pool.query('DELETE FROM guests WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erro ao deletar.' });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✨ Servidor rodando na porta ${PORT}`);
});
