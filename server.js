const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nirlene2026';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Configura email — só funciona se EMAIL_USER e EMAIL_PASS estiverem definidos
const mailer = process.env.EMAIL_USER && process.env.EMAIL_PASS
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false },
    })
  : null;

async function enviarEmailConfirmacao(names, total) {
  if (!mailer) return;
  const lista = names.map(n => `• ${n}`).join('\n');
  try {
    await mailer.sendMail({
      from: `"Convite Nirlene" <${process.env.EMAIL_USER}>`,
      to: 'jamili.rizzo@gmail.com',
      subject: `✅ Nova confirmação — ${names[0]}`,
      text: `Nova confirmação de presença no jantar da Nirlene!\n\n${lista}\n\nTotal confirmado até agora: ${total} pessoa(s).\n\nAcesse o painel completo em: https://nirlene-rsvp.onrender.com/admin`,
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;background:#FBF7F0;border-top:4px solid #A05F2C;">
          <h2 style="color:#65582D;font-style:italic;margin-bottom:8px;">Nova confirmação de presença</h2>
          <p style="color:#6B5535;font-size:16px;">Alguém acabou de confirmar para o jantar da Nirlene:</p>
          <div style="background:#fff;border:1px solid #D1B791;padding:20px 24px;margin:20px 0;border-radius:2px;">
            ${names.map(n => `<p style="margin:6px 0;font-size:18px;color:#3A2E1A;"><strong>${n}</strong></p>`).join('')}
          </div>
          <p style="color:#9B845A;font-size:14px;">Total confirmado até agora: <strong>${total} pessoa(s)</strong></p>
          <a href="https://nirlene-rsvp.onrender.com/admin"
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#A05F2C;color:#fff;text-decoration:none;font-family:sans-serif;font-size:13px;letter-spacing:0.1em;">
            Ver painel completo →
          </a>
        </div>
      `,
    });
    console.log(`📧 Email enviado para jamili.rizzo@gmail.com — ${names.join(', ')}`);
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

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✨ Servidor rodando na porta ${PORT}`);
});
