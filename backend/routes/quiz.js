// Quiz "Quem é esse Pokémon?"
// O Pokémon sorteado fica só no banco; o navegador recebe o id da rodada e a imagem
// passa pelo backend, então não dá para descobrir a resposta pela URL.
const express = require('express');
const pool = require('../db');
const { garantirNomesEspecies } = require('../services/pokeapi');
const { confereChute, sequenciaInicial, embaralhar, lerGeracoes } = require('../utils/quiz');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cache simples das imagens em memória (as artes oficiais não mudam)
const cacheImagens = new Map();
const MAX_CACHE = 300;

const SQL_TIPOS = `
  (SELECT json_agg(json_build_object('id', t.id, 'nome', t.nome, 'nome_pt', t.nome_pt) ORDER BY pt.slot)
     FROM pokemon_tipos pt JOIN tipos t ON t.id = pt.tipo_id
    WHERE pt.pokemon_id = p.id) AS tipos`;

const usuarioId = (req) => req.usuario?.id ?? null;

// Rodada do próprio jogador (visitante só acessa rodadas de visitante)
async function buscarRodada(req, id) {
  if (!UUID.test(id)) return null;
  const { rows } = await pool.query(
    'SELECT * FROM quiz_rodadas WHERE id = $1 AND usuario_id IS NOT DISTINCT FROM $2',
    [id, usuarioId(req)]
  );
  return rows[0] || null;
}

// POST /api/quiz/rodadas { modo: 'facil'|'dificil', geracoes: [1,2], anterior: <id da rodada anterior> }
router.post('/rodadas', async (req, res) => {
  const modo = req.body?.modo === 'facil' ? 'facil' : 'dificil';
  const geracoes = lerGeracoes(req.body?.geracoes);
  await garantirNomesEspecies(pool);

  // Limpa rodadas velhas (só servem enquanto o jogo está aberto)
  await pool.query("DELETE FROM quiz_rodadas WHERE criado_em < now() - interval '1 day'");

  let anterior = null;
  if (req.body?.anterior) {
    anterior = await buscarRodada(req, String(req.body.anterior));
    if (anterior && anterior.modo !== modo) anterior = null; // trocar de modo zera a sequência
  }
  const sequencia = sequenciaInicial(anterior);

  const filtroGeracao = 'p.geracao = ANY($1::int[]) OR $1::int[] IS NULL';
  const sorteio = await pool.query(
    `SELECT p.id, p.nome_especie FROM pokemon p
      WHERE (${filtroGeracao}) AND p.id <> $2 AND p.artwork_url IS NOT NULL
      ORDER BY random() LIMIT 1`,
    [geracoes, anterior?.pokemon_id ?? 0]
  );
  const escolhido = sorteio.rows[0];
  if (!escolhido) return res.status(400).json({ erro: 'Nenhum Pokémon encontrado com esses filtros' });

  const { rows } = await pool.query(
    `INSERT INTO quiz_rodadas (pokemon_id, usuario_id, modo, sequencia)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [escolhido.id, usuarioId(req), modo, sequencia]
  );
  const id = rows[0].id;

  // Dicas: tipos e geração (vários Pokémon compartilham, então não entregam a resposta)
  const dica = (await pool.query(`SELECT p.geracao, ${SQL_TIPOS} FROM pokemon p WHERE p.id = $1`, [escolhido.id])).rows[0];

  let opcoes;
  if (modo === 'facil') {
    const outros = await pool.query(
      `SELECT DISTINCT ON (p.nome_especie) p.nome_especie FROM pokemon p
        WHERE (${filtroGeracao}) AND p.id <> $2
        ORDER BY p.nome_especie, random()`,
      [geracoes, escolhido.id]
    );
    const errados = embaralhar(outros.rows.map((r) => r.nome_especie)).slice(0, 3);
    opcoes = embaralhar([escolhido.nome_especie, ...errados]);
  }

  res.status(201).json({
    id,
    modo,
    sequencia,
    imagem: `/quiz/rodadas/${id}/imagem`, // relativo à base da API
    dica: { geracao: dica.geracao, tipos: dica.tipos },
    opcoes,
  });
});

// GET /api/quiz/rodadas/:id/imagem — arte oficial servida pelo backend
// (sem checar usuário: <img> não manda o token, e o id da rodada já é aleatório)
router.get('/rodadas/:id/imagem', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).end();
  const { rows } = await pool.query(
    `SELECT p.id, p.artwork_url FROM quiz_rodadas r JOIN pokemon p ON p.id = r.pokemon_id WHERE r.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).end();

  const { id, artwork_url: url } = rows[0];
  let imagem = cacheImagens.get(id);
  if (!imagem) {
    const resp = await fetch(url);
    if (!resp.ok) return res.status(502).end();
    imagem = Buffer.from(await resp.arrayBuffer());
    if (cacheImagens.size >= MAX_CACHE) cacheImagens.delete(cacheImagens.keys().next().value);
    cacheImagens.set(id, imagem);
  }
  res.set('Cache-Control', 'private, max-age=3600').type('png').send(imagem);
});

// POST /api/quiz/rodadas/:id/resposta { palpite } — palpite vazio = desistir/pular
router.post('/rodadas/:id/resposta', async (req, res) => {
  const rodada = await buscarRodada(req, req.params.id);
  if (!rodada) return res.status(404).json({ erro: 'Rodada não encontrada' });

  const { rows } = await pool.query(
    `SELECT p.id, p.nome, p.nome_especie, p.artwork_url, p.sprite_url, p.geracao, ${SQL_TIPOS}
       FROM pokemon p WHERE p.id = $1`,
    [rodada.pokemon_id]
  );
  const pokemon = rows[0];
  const acertou = confereChute(req.body?.palpite, pokemon);

  // "AND NOT respondida" impede responder a mesma rodada duas vezes
  const atualizada = await pool.query(
    'UPDATE quiz_rodadas SET respondida = true, acertou = $2 WHERE id = $1 AND NOT respondida',
    [rodada.id, acertou]
  );
  if (!atualizada.rowCount) return res.status(409).json({ erro: 'Essa rodada já foi respondida' });

  const sequencia = acertou ? rodada.sequencia + 1 : 0;
  let recorde = false;

  if (req.usuario) {
    const coluna = rodada.modo === 'facil' ? 'melhor_facil' : 'melhor_dificil';
    const antes = await pool.query(`SELECT ${coluna} AS melhor FROM quiz_placar WHERE usuario_id = $1`, [req.usuario.id]);
    recorde = acertou && sequencia > (antes.rows[0]?.melhor ?? 0);
    await pool.query(
      `INSERT INTO quiz_placar (usuario_id, acertos, erros, ${coluna})
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id) DO UPDATE SET
         acertos = quiz_placar.acertos + EXCLUDED.acertos,
         erros = quiz_placar.erros + EXCLUDED.erros,
         ${coluna} = GREATEST(quiz_placar.${coluna}, EXCLUDED.${coluna}),
         atualizado_em = now()`,
      [req.usuario.id, acertou ? 1 : 0, acertou ? 0 : 1, sequencia]
    );
  }

  res.json({ acertou, sequencia, sequencia_anterior: rodada.sequencia, recorde, pokemon });
});

// GET /api/quiz/nomes — todos os nomes de espécie, para o autocompletar do campo.
// Sempre a lista inteira (ignora o filtro de geração), senão as sugestões virariam dica.
router.get('/nomes', async (req, res) => {
  await garantirNomesEspecies(pool);
  const { rows } = await pool.query('SELECT DISTINCT nome_especie FROM pokemon ORDER BY nome_especie');
  res.set('Cache-Control', 'public, max-age=86400').json(rows.map((r) => r.nome_especie));
});

// GET /api/quiz/placar — estatísticas do usuário logado
router.get('/placar', async (req, res) => {
  if (!req.usuario) return res.status(401).json({ erro: 'Entre para ver seu placar' });
  const { rows } = await pool.query('SELECT acertos, erros, melhor_dificil, melhor_facil FROM quiz_placar WHERE usuario_id = $1', [req.usuario.id]);
  res.json(rows[0] || { acertos: 0, erros: 0, melhor_dificil: 0, melhor_facil: 0 });
});

// GET /api/quiz/ranking — top 10 pela maior sequência no modo difícil
router.get('/ranking', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.nome, q.melhor_dificil, q.acertos
       FROM quiz_placar q JOIN usuarios u ON u.id = q.usuario_id
      WHERE q.melhor_dificil > 0
      ORDER BY q.melhor_dificil DESC, q.acertos DESC, q.atualizado_em ASC
      LIMIT 10`
  );
  res.json(rows);
});

module.exports = router;
