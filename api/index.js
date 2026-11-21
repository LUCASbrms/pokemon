// Ponto de entrada na Vercel: o mesmo app Express do backend, rodando como função serverless.
// Localmente continua sendo backend/server.js (npm run dev), que chama app.listen().
const app = require('../backend/app');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET não configurado nas variáveis de ambiente da Vercel: login e cadastro vão falhar.');
}

module.exports = app;
