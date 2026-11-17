// Cria o banco (se não existir) e aplica o schema.sql.
// Uso: npm run db:criar
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

async function main() {
  const nomeBanco = process.env.DB_NAME || 'pokedex_db';

  if (!process.env.DATABASE_URL) {
    const admin = new Client({
      host:     process.env.DB_HOST || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      user:     process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: 'postgres',
    });
    await admin.connect();
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco]);
    if (rowCount === 0) {
      // Nome do banco não aceita parâmetro; validamos para evitar injeção
      if (!/^[a-z0-9_]+$/i.test(nomeBanco)) throw new Error('DB_NAME inválido');
      await admin.query(`CREATE DATABASE ${nomeBanco}`);
      console.log(`Banco "${nomeBanco}" criado.`);
    } else {
      console.log(`Banco "${nomeBanco}" já existe.`);
    }
    await admin.end();
  }

  const pool = require('../db');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Schema aplicado.');
  await pool.end();
}

main().catch((err) => {
  console.error('Erro ao criar banco:', err.message);
  process.exit(1);
});
