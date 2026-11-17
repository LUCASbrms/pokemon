const app = require('./app');

const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET não definido no .env');
  process.exit(1);
}

app.listen(PORT, () => console.log(`API da Pokédex em http://localhost:${PORT}`));
