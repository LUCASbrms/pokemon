const express = require('express');
const pool = require('../db');
const { garantirPokemon, carregarDetalhesGolpes } = require('../services/pokeapi');
const { analisarTime } = require('../utils/analise');

const router = express.Router();
const MAX_MEMBROS = 6;
const MAX_GOLPES = 4;

function validarNome(nome) {
  const limpo = String(nome ?? '').trim();
  if (!limpo) return { erro: 'Informe o nome do time' };
  if (limpo.length > 50) return { erro: 'O nome do time deve ter no máximo 50 caracteres' };
  return { nome: limpo };
}

// Carrega o time garantindo que pertence ao usuário logado
async function buscarTimeDoUsuario(timeId, usuarioId) {
  const { rows } = await pool.query(
    'SELECT id, nome, criado_em, atualizado_em FROM times WHERE id = $1 AND usuario_id = $2',
    [timeId, usuarioId]
  );
  return rows[0] || null;
}

async function tocarTime(timeId) {
  await pool.query('UPDATE times SET atualizado_em = now() WHERE id = $1', [timeId]);
}

// Time completo: membros com tipos, stats e golpes escolhidos
async function carregarTimeCompleto(time) {
  const { rows } = await pool.query(
    `SELECT tp.id, tp.posicao,
            json_build_object(
              'id', p.id, 'nome', p.nome, 'sprite_url', p.sprite_url, 'artwork_url', p.artwork_url,
              'hp', p.hp, 'ataque', p.ataque, 'defesa', p.defesa, 'ataque_especial', p.ataque_especial,
              'defesa_especial', p.defesa_especial, 'velocidade', p.velocidade, 'total', p.total
            ) AS pokemon,
            (SELECT json_agg(json_build_object('id', t.id, 'nome', t.nome, 'nome_pt', t.nome_pt) ORDER BY pt.slot)
               FROM pokemon_tipos pt JOIN tipos t ON t.id = pt.tipo_id WHERE pt.pokemon_id = p.id) AS tipos,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'slot', tg.slot, 'id', g.id, 'nome', g.nome, 'categoria', g.categoria,
                       'poder', g.poder, 'precisao', g.precisao, 'pp', g.pp,
                       'alteracoes', g.alteracoes, 'alvo_alteracao', g.alvo_alteracao,
                       'chance_alteracao', g.chance_alteracao,
                       'tipo', json_build_object('id', gt.id, 'nome', gt.nome, 'nome_pt', gt.nome_pt)
                     ) ORDER BY tg.slot)
                FROM time_pokemon_golpes tg
                JOIN golpes g ON g.id = tg.golpe_id
                LEFT JOIN tipos gt ON gt.id = g.tipo_id
               WHERE tg.time_pokemon_id = tp.id
            ), '[]') AS golpes
       FROM time_pokemon tp
       JOIN pokemon p ON p.id = tp.pokemon_id
      WHERE tp.time_id = $1
      ORDER BY tp.posicao`,
    [time.id]
  );
  return { ...time, membros: rows };
}

// ─── CRUD de times ──────────────────────────────────────────

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.nome, t.criado_em, t.atualizado_em,
            COALESCE(json_agg(json_build_object('posicao', tp.posicao, 'pokemon_id', p.id, 'nome', p.nome, 'sprite_url', p.sprite_url)
                     ORDER BY tp.posicao) FILTER (WHERE tp.id IS NOT NULL), '[]') AS membros
       FROM times t
       LEFT JOIN time_pokemon tp ON tp.time_id = t.id
       LEFT JOIN pokemon p ON p.id = tp.pokemon_id
      WHERE t.usuario_id = $1
      GROUP BY t.id
      ORDER BY t.atualizado_em DESC`,
    [req.usuario.id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const v = validarNome(req.body?.nome);
  if (v.erro) return res.status(400).json({ erro: v.erro });
  const { rows } = await pool.query(
    'INSERT INTO times (usuario_id, nome) VALUES ($1, $2) RETURNING id, nome, criado_em, atualizado_em',
    [req.usuario.id, v.nome]
  );
  res.status(201).json({ ...rows[0], membros: [] });
});

router.get('/:id', async (req, res) => {
  const time = await buscarTimeDoUsuario(parseInt(req.params.id), req.usuario.id);
  if (!time) return res.status(404).json({ erro: 'Time não encontrado' });
  res.json(await carregarTimeCompleto(time));
});

// Renomear time
router.put('/:id', async (req, res) => {
  const time = await buscarTimeDoUsuario(parseInt(req.params.id), req.usuario.id);
  if (!time) return res.status(404).json({ erro: 'Time não encontrado' });
  const v = validarNome(req.body?.nome);
  if (v.erro) return res.status(400).json({ erro: v.erro });
  const { rows } = await pool.query(
    'UPDATE times SET nome = $1, atualizado_em = now() WHERE id = $2 RETURNING id, nome, criado_em, atualizado_em',
    [v.nome, time.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM times WHERE id = $1 AND usuario_id = $2', [
    parseInt(req.params.id), req.usuario.id,
  ]);
  if (!rowCount) return res.status(404).json({ erro: 'Time não encontrado' });
  res.status(204).end();
});

// ─── Membros ────────────────────────────────────────────────

// Adiciona Pokémon ao time (na primeira posição livre)
router.post('/:id/pokemon', async (req, res) => {
  const time = await buscarTimeDoUsuario(parseInt(req.params.id), req.usuario.id);
  if (!time) return res.status(404).json({ erro: 'Time não encontrado' });

  const pokemonId = parseInt(req.body?.pokemon_id);
  if (!pokemonId || !(await garantirPokemon(pool, pokemonId))) {
    return res.status(400).json({ erro: 'Pokémon inválido' });
  }

  const ocupadas = (await pool.query('SELECT posicao FROM time_pokemon WHERE time_id = $1', [time.id]))
    .rows.map((r) => r.posicao);
  if (ocupadas.length >= MAX_MEMBROS) {
    return res.status(400).json({ erro: `O time já tem ${MAX_MEMBROS} Pokémon` });
  }
  const posicao = [1, 2, 3, 4, 5, 6].find((p) => !ocupadas.includes(p));

  try {
    await pool.query('INSERT INTO time_pokemon (time_id, pokemon_id, posicao) VALUES ($1, $2, $3)', [
      time.id, pokemonId, posicao,
    ]);
  } catch (err) {
    // Duas requisições simultâneas disputando a mesma posição
    if (err.code === '23505') return res.status(409).json({ erro: 'Tente novamente' });
    throw err;
  }
  await tocarTime(time.id);
  res.status(201).json(await carregarTimeCompleto(time));
});

router.delete('/:id/pokemon/:membroId', async (req, res) => {
  const time = await buscarTimeDoUsuario(parseInt(req.params.id), req.usuario.id);
  if (!time) return res.status(404).json({ erro: 'Time não encontrado' });
  const { rowCount } = await pool.query('DELETE FROM time_pokemon WHERE id = $1 AND time_id = $2', [
    parseInt(req.params.membroId), time.id,
  ]);
  if (!rowCount) return res.status(404).json({ erro: 'Pokémon não está neste time' });
  await tocarTime(time.id);
  res.json(await carregarTimeCompleto(time));
});

// Define os golpes de um membro (substitui todos): { golpes: [id, id, ...] } — até 4
router.put('/:id/pokemon/:membroId/golpes', async (req, res) => {
  const time = await buscarTimeDoUsuario(parseInt(req.params.id), req.usuario.id);
  if (!time) return res.status(404).json({ erro: 'Time não encontrado' });

  const membro = (await pool.query('SELECT id, pokemon_id FROM time_pokemon WHERE id = $1 AND time_id = $2', [
    parseInt(req.params.membroId), time.id,
  ])).rows[0];
  if (!membro) return res.status(404).json({ erro: 'Pokémon não está neste time' });

  const golpes = req.body?.golpes;
  if (!Array.isArray(golpes)) return res.status(400).json({ erro: 'Envie "golpes" como uma lista de ids' });
  const ids = golpes.map((g) => parseInt(g));
  if (ids.some((g) => !Number.isInteger(g))) return res.status(400).json({ erro: 'Ids de golpe inválidos' });
  if (ids.length > MAX_GOLPES) return res.status(400).json({ erro: `Cada Pokémon pode ter no máximo ${MAX_GOLPES} golpes` });
  if (new Set(ids).size !== ids.length) return res.status(400).json({ erro: 'Golpes repetidos não são permitidos' });

  if (ids.length) {
    const aprende = (await pool.query(
      'SELECT golpe_id FROM pokemon_golpes WHERE pokemon_id = $1 AND golpe_id = ANY($2::int[])',
      [membro.pokemon_id, ids]
    )).rows.map((r) => r.golpe_id);
    const invalidos = ids.filter((g) => !aprende.includes(g));
    if (invalidos.length) return res.status(400).json({ erro: 'Este Pokémon não aprende um ou mais desses golpes' });
    await carregarDetalhesGolpes(pool, ids);
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('DELETE FROM time_pokemon_golpes WHERE time_pokemon_id = $1', [membro.id]);
    for (const [i, golpeId] of ids.entries()) {
      await cliente.query(
        'INSERT INTO time_pokemon_golpes (time_pokemon_id, golpe_id, slot) VALUES ($1, $2, $3)',
        [membro.id, golpeId, i + 1]
      );
    }
    await cliente.query('UPDATE times SET atualizado_em = now() WHERE id = $1', [time.id]);
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
  res.json(await carregarTimeCompleto(time));
});

// ─── Análise de fraquezas / cobertura ───────────────────────

router.get('/:id/analise', async (req, res) => {
  const time = await buscarTimeDoUsuario(parseInt(req.params.id), req.usuario.id);
  if (!time) return res.status(404).json({ erro: 'Time não encontrado' });

  const completo = await carregarTimeCompleto(time);
  const tipos = (await pool.query('SELECT id, nome, nome_pt FROM tipos ORDER BY id')).rows;
  const ef = (await pool.query('SELECT atacante_id, defensor_id, multiplicador FROM tipo_eficacia')).rows;
  const eficacia = Object.fromEntries(ef.map((e) => [`${e.atacante_id}-${e.defensor_id}`, Number(e.multiplicador)]));

  const membros = completo.membros.map((m) => ({
    id: m.id,
    // "mr-mime" -> "Mr Mime" para as mensagens de alerta
    nome: m.pokemon.nome.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
    tipos: m.tipos.map((t) => t.id),
    golpes: m.golpes.map((g) => ({ id: g.id, nome: g.nome, tipo_id: g.tipo?.id, categoria: g.categoria, poder: g.poder })),
  }));

  res.json(analisarTime({ tipos, eficacia, membros }));
});

module.exports = router;
