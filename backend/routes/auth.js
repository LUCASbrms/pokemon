const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/registro', async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');

  if (nome.length < 2 || nome.length > 80) return res.status(400).json({ erro: 'Nome deve ter entre 2 e 80 caracteres' });
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ erro: 'E-mail inválido' });
  if (senha.length < 6) return res.status(400).json({ erro: 'Senha deve ter pelo menos 6 caracteres' });

  const existe = await pool.query('SELECT 1 FROM usuarios WHERE email = $1', [email]);
  if (existe.rowCount) return res.status(409).json({ erro: 'E-mail já cadastrado' });

  const senhaHash = await bcrypt.hash(senha, 10);
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email',
    [nome, email, senhaHash]
  );
  return res.status(201).json({ token: gerarToken(rows[0]), usuario: rows[0] });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha' });

  const { rows } = await pool.query('SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1', [email]);
  const usuario = rows[0];
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
  }
  const { senha_hash, ...publico } = usuario;
  return res.json({ token: gerarToken(publico), usuario: publico });
});

router.get('/me', autenticar, (req, res) => res.json({ usuario: req.usuario }));

module.exports = router;
