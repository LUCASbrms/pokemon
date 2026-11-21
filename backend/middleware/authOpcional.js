const jwt = require('jsonwebtoken');

// Igual ao autenticar, mas não bloqueia: se vier um token válido preenche req.usuario,
// senão segue como visitante. Usado no quiz, que dá para jogar sem login.
function autenticarOpcional(req, res, next) {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.usuario = { id: payload.id, nome: payload.nome, email: payload.email };
    } catch {
      // token inválido: joga como visitante
    }
  }
  next();
}

module.exports = { autenticarOpcional };
