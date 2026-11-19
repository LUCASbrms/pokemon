const express = require('express');
const pool = require('../db');
const { garantirPokemon, carregarDetalhesGolpes } = require('../services/pokeapi');
const { multiplicadorContra } = require('../utils/analise');
const { garantirEspecie } = require('../services/especies');

const router = express.Router();

const STATS = ['hp', 'ataque', 'defesa', 'ataque_especial', 'defesa_especial', 'velocidade', 'total'];
const ORDENACOES = ['id', 'nome', ...STATS];

// Tipos do Pokémon como array JSON ordenado por slot
const SQL_TIPOS = `
  (SELECT json_agg(json_build_object('id', t.id, 'nome', t.nome, 'nome_pt', t.nome_pt) ORDER BY pt.slot)
     FROM pokemon_tipos pt JOIN tipos t ON t.id = pt.tipo_id
    WHERE pt.pokemon_id = p.id) AS tipos`;

// GET /api/pokemon?busca=&tipo=&geracao=&stat=&min=&ordenar=&ordem=&pagina=&limite=
router.get('/', async (req, res) => {
  const { busca, tipo, tipo2, geracao, stat, min, ordenar = 'id', ordem = 'asc' } = req.query;
  const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 24));

  const filtros = [];
  const params = [];
  const add = (sql, valor) => {
    params.push(valor);
    filtros.push(sql.replace('$?', `$${params.length}`));
  };

  if (busca && String(busca).trim()) {
    const termo = String(busca).trim().toLowerCase();
    if (/^\d+$/.test(termo)) add('p.id = $?', Number(termo));
    else add('p.nome ILIKE $?', `%${termo.replace(/\s+/g, '-')}%`);
  }
  for (const t of [tipo, tipo2]) {
    if (t) add('EXISTS (SELECT 1 FROM pokemon_tipos pt JOIN tipos ty ON ty.id = pt.tipo_id WHERE pt.pokemon_id = p.id AND ty.nome = $?)', String(t));
  }
  if (geracao) add('p.geracao = $?', parseInt(geracao));
  if (stat && STATS.includes(stat) && min !== undefined && min !== '') {
    add(`p.${stat} >= $?`, parseInt(min) || 0);
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const colunaOrdem = ORDENACOES.includes(ordenar) ? ordenar : 'id';
  const direcao = String(ordem).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const total = await pool.query(`SELECT count(*)::int AS n FROM pokemon p ${where}`, params);
  const { rows } = await pool.query(
    `SELECT p.id, p.nome, p.geracao, p.sprite_url, p.artwork_url,
            p.hp, p.ataque, p.defesa, p.ataque_especial, p.defesa_especial, p.velocidade, p.total,
            ${SQL_TIPOS}
       FROM pokemon p ${where}
      ORDER BY p.${colunaOrdem} ${direcao}, p.id ASC
      LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
    params
  );

  res.json({ dados: rows, total: total.rows[0].n, pagina, limite });
});

// GET /api/pokemon/:id — detalhes + fraquezas individuais
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!(await garantirPokemon(pool, id))) return res.status(404).json({ erro: 'Pokémon não encontrado' });

  const { rows } = await pool.query(`SELECT p.*, ${SQL_TIPOS} FROM pokemon p WHERE p.id = $1`, [id]);
  const pokemon = rows[0];

  const tipos = (await pool.query('SELECT id, nome, nome_pt FROM tipos ORDER BY id')).rows;
  const ef = (await pool.query('SELECT atacante_id, defensor_id, multiplicador FROM tipo_eficacia')).rows;
  const eficacia = Object.fromEntries(ef.map((e) => [`${e.atacante_id}-${e.defensor_id}`, Number(e.multiplicador)]));
  const tiposPokemon = pokemon.tipos.map((t) => t.id);

  pokemon.defesa_tipos = tipos
    .map((t) => ({ tipo: t, multiplicador: multiplicadorContra(eficacia, t.id, tiposPokemon) }))
    .filter((x) => x.multiplicador !== 1);

  res.json(pokemon);
});

// GET /api/pokemon/:id/info — dados da espécie + cadeia evolutiva com sprite/tipos de cada estágio
router.get('/:id/info', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!(await garantirPokemon(pool, id))) return res.status(404).json({ erro: 'Pokémon não encontrado' });
  if (!(await garantirEspecie(pool, id))) return res.status(404).json({ erro: 'Espécie não encontrada' });

  const { rows } = await pool.query(
    `SELECT e.*, c.dados AS cadeia
       FROM pokemon_especies e LEFT JOIN cadeias_evolucao c ON c.id = e.cadeia_id
      WHERE e.pokemon_id = $1`,
    [id]
  );
  const { cadeia, ...info } = rows[0];

  let evolucoes = null;
  if (cadeia) {
    const ids = [];
    (function coletar(no) { ids.push(no.id); no.evolui_para.forEach(coletar); })(cadeia);
    for (const pid of ids) await garantirPokemon(pool, pid);
    const dados = await pool.query(
      `SELECT p.id, p.sprite_url, p.artwork_url, ${SQL_TIPOS} FROM pokemon p WHERE p.id = ANY($1::int[])`,
      [ids]
    );
    const porId = Object.fromEntries(dados.rows.map((r) => [r.id, r]));
    const enriquecer = (no) => ({
      ...no,
      sprite_url: porId[no.id]?.sprite_url ?? null,
      artwork_url: porId[no.id]?.artwork_url ?? null,
      tipos: porId[no.id]?.tipos ?? [],
      evolui_para: no.evolui_para.map(enriquecer),
    });
    evolucoes = enriquecer(cadeia);
  }

  res.json({ ...info, evolucoes });
});

// GET /api/pokemon/:id/golpes — golpes que o Pokémon pode aprender (detalhes sob demanda)
router.get('/:id/golpes', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!(await garantirPokemon(pool, id))) return res.status(404).json({ erro: 'Pokémon não encontrado' });

  const ids = (await pool.query('SELECT golpe_id FROM pokemon_golpes WHERE pokemon_id = $1', [id])).rows.map((r) => r.golpe_id);
  await carregarDetalhesGolpes(pool, ids);

  const { rows } = await pool.query(
    `SELECT g.id, g.nome, g.categoria, g.poder, g.precisao, g.pp,
            g.alteracoes, g.alvo_alteracao, g.chance_alteracao,
            json_build_object('id', t.id, 'nome', t.nome, 'nome_pt', t.nome_pt) AS tipo
       FROM pokemon_golpes pg
       JOIN golpes g ON g.id = pg.golpe_id
       LEFT JOIN tipos t ON t.id = g.tipo_id
      WHERE pg.pokemon_id = $1
      ORDER BY g.nome`,
    [id]
  );
  res.json(rows);
});

module.exports = router;
