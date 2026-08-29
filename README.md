# Aniversário de Nirlene Rizzo · RSVP

## Como rodar localmente

```bash
cd nirlene-rsvp
npm install
npm start
# Acesse: http://localhost:3000
```

## Fotos da galeria

Coloque as fotos em `public/photos/` com os nomes:
`foto1.jpg`, `foto2.jpg`, `foto3.jpg`, `foto4.jpg`, `foto5.jpg`, `foto6.jpg`

A página detecta e carrega as fotos automaticamente.

## Painel de administrador

Acesse `http://seu-dominio.com/admin`
Senha padrão: `nirlene2026`

**Altere a senha antes de publicar:**
```bash
cp .env.example .env
# Edite .env e troque ADMIN_PASSWORD
```

## Deploy (Render.com — grátis)

1. Crie conta em render.com
2. New → Web Service → conecte este repositório
3. Build command: `npm install`
4. Start command: `npm start`
5. Adicione as variáveis de ambiente: `ADMIN_PASSWORD=suasenhaaqui`
6. O banco SQLite fica em disco persistente (adicione um Disk em `/opt/render/project/src`)

## Estrutura

```
nirlene-rsvp/
├── server.js          # Backend Express + SQLite
├── public/
│   ├── index.html     # Página principal (RSVP)
│   ├── style.css      # Estilos
│   ├── script.js      # Lógica frontend
│   ├── admin.html     # Painel privado
│   └── photos/        # Fotos da galeria (adicione aqui)
├── package.json
└── .env.example
```
