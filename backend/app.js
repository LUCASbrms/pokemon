const express = require('express');
const cors = require('cors');
require('dotenv').config({ quiet: true });

const { autenticar } = require('./middleware/auth');
const { autenticarOpcional } = require('./middleware/authOpcional');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/saude', (req, res) => res.json({ ok: true }));

// Rotas públicas
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/tipos',   require('./routes/tipos'));
app.use('/api/pokemon', require('./routes/pokemon'));

// Quiz: funciona sem login; com login salva o placar
app.use('/api/quiz', autenticarOpcional, require('./routes/quiz'));

// Rotas que exigem login
app.use('/api/times', autenticar, require('./routes/times'));

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// Express 5 encaminha erros de handlers async para cá
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
  console.error('[ERRO]', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
