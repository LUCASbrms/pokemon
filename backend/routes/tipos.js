const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/tipos — lista dos 18 tipos + matriz de eficácia
router.get('/', async (req, res) => {
  const tipos = (await pool.query('SELECT id, nome, nome_pt FROM tipos ORDER BY id')).rows;
  const eficacia = (await pool.query(
    'SELECT atacante_id, defensor_id, multiplicador::float AS multiplicador FROM tipo_eficacia'
  )).rows;
  res.json({ tipos, eficacia });
});

module.exports = router;
