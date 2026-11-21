const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

const url = process.env.DATABASE_URL;

// Aceita DATABASE_URL (nuvem: Neon) ou variáveis individuais (dev local)
const pool = url
  ? new Pool({
      connectionString: url,
      // A URL do Neon já vem com "sslmode=require" (certificado válido); sem isso, SSL sem validar
      ...(/sslmode=/.test(url) ? {} : { ssl: { rejectUnauthorized: false } }),
      // Na Vercel cada função tem o próprio pool: poucas conexões, fechando as ociosas rápido
      max: process.env.VERCEL ? 3 : 10,
      idleTimeoutMillis: process.env.VERCEL ? 5000 : 10000,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'pokedex_db',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });

pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool:', err.message);
});

module.exports = pool;
