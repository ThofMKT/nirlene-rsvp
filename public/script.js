// Fade-in on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(el => {
    if (el.isIntersecting) {
      el.target.classList.add('visible');
      observer.unobserve(el.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// Animated counter
function animateCount(el, target) {
  if (target === 0) { el.textContent = '0'; return; }
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 35));
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 35);
}

async function loadCount() {
  try {
    const res = await fetch('/api/count');
    const { count } = await res.json();
    animateCount(document.getElementById('guest-count'), count);
  } catch {}
}

loadCount();


// Check deadline
const DEADLINE = new Date('2026-09-07T23:59:59-03:00');
if (new Date() > DEADLINE) {
  document.getElementById('rsvp-form-wrapper').style.display = 'none';
  document.getElementById('rsvp-closed').style.display = 'block';
}

// RSVP form submit
let confirmedName = '';

document.getElementById('rsvp-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const errorEl = document.getElementById('form-error');
  errorEl.style.display = 'none';

  const nameInput = document.getElementById('guest-name');
  const name = nameInput.value.trim();

  if (!name) {
    errorEl.textContent = 'Por favor, informe o seu nome para confirmar.';
    errorEl.style.display = 'block';
    nameInput.focus();
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.querySelector('.btn-text').style.display = 'none';
  btn.querySelector('.btn-loading').style.display = 'inline';
  btn.disabled = true;

  try {
    const res = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: [name] }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Algo deu errado. Tente novamente.';
      errorEl.style.display = 'block';
      btn.querySelector('.btn-text').style.display = 'inline';
      btn.querySelector('.btn-loading').style.display = 'none';
      btn.disabled = false;
      return;
    }

    confirmedName = name;

    document.getElementById('rsvp-form-wrapper').style.display = 'none';
    const confirmed = document.getElementById('rsvp-confirmed');
    confirmed.style.display = 'block';
    document.getElementById('confirmed-name-display').textContent = name;

    confirmed.scrollIntoView({ behavior: 'smooth', block: 'start' });
    loadCount();

  } catch {
    errorEl.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
    errorEl.style.display = 'block';
    btn.querySelector('.btn-text').style.display = 'inline';
    btn.querySelector('.btn-loading').style.display = 'none';
    btn.disabled = false;
  }
});

// Send message
document.getElementById('send-msg-btn').addEventListener('click', async () => {
  const msgEl  = document.getElementById('message-input');
  const errEl  = document.getElementById('msg-error');
  errEl.style.display = 'none';

  const message = msgEl.value.trim();
  if (!message) {
    errEl.textContent = 'Escreva algo no seu recado antes de enviar.';
    errEl.style.display = 'block';
    msgEl.focus();
    return;
  }

  const btn = document.getElementById('send-msg-btn');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    const res = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestName: confirmedName, message }),
    });

    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Erro ao enviar. Tente novamente.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Enviar recado';
      return;
    }

    document.getElementById('guestbook-form').style.display = 'none';
    document.getElementById('guestbook-thanks').style.display = 'block';

  } catch {
    errEl.textContent = 'Erro de conexão. Tente novamente.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Enviar recado';
  }
});
