// ============================================================
// Integração com a PokéAPI + cache no PostgreSQL
// ------------------------------------------------------------
// Regra geral: o banco é consultado primeiro; só vamos à
// PokéAPI quando o dado ainda não está em cache.
// ============================================================
const BASE_URL = 'https://pokeapi.co/api/v2';
const TOTAL_POKEMON = 1025;

const TIPOS_PT = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico',
  grass: 'Planta', ice: 'Gelo', fighting: 'Lutador', poison: 'Venenoso',
  ground: 'Terrestre', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto',
  rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão', dark: 'Sombrio',
  steel: 'Aço', fairy: 'Fada',
};

// Último número da Pokédex nacional de cada geração
const FIM_GERACOES = [151, 251, 386, 493, 649, 721, 809, 905, 1025];

function geracaoPorId(id) {
  const idx = FIM_GERACOES.findIndex((fim) => id <= fim);
  return idx === -1 ? null : idx + 1;
}

function idDaUrl(url) {
  return Number(url.split('/').filter(Boolean).pop());
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscarJson(caminho, tentativas = 3) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const resp = await fetch(`${BASE_URL}${caminho}`);
      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      if (i === tentativas) throw new Error(`PokéAPI ${caminho}: ${err.message}`);
      await esperar(500 * i);
    }
  }
}

// Executa fn em todos os itens com no máximo `limite` chamadas simultâneas
async function emParalelo(itens, limite, fn) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return resultados;
}

// ─── Tipos e tabela de eficácia ─────────────────────────────

async function sincronizarTipos(pool) {
  const nomes = Object.keys(TIPOS_PT);
  const dados = await emParalelo(nomes, 6, (nome) => buscarJson(`/type/${nome}`));
  const idPorNome = Object.fromEntries(dados.map((t) => [t.name, t.id]));

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const t of dados) {
      await cliente.query(
        `INSERT INTO tipos (id, nome, nome_pt) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, nome_pt = EXCLUDED.nome_pt`,
        [t.id, t.name, TIPOS_PT[t.name]]
      );
    }
    for (const t of dados) {
      const rel = t.damage_relations;
      const mult = {};
      for (const d of rel.double_damage_to) mult[d.name] = 2;
      for (const d of rel.half_damage_to)   mult[d.name] = 0.5;
      for (const d of rel.no_damage_to)     mult[d.name] = 0;
      for (const defensor of nomes) {
        await cliente.query(
          `INSERT INTO tipo_eficacia (atacante_id, defensor_id, multiplicador) VALUES ($1, $2, $3)
           ON CONFLICT (atacante_id, defensor_id) DO UPDATE SET multiplicador = EXCLUDED.multiplicador`,
          [t.id, idPorNome[defensor], mult[defensor] ?? 1]
        );
      }
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
  return dados.length;
}

async function mapaTipos(pool) {
  const { rows } = await pool.query('SELECT id, nome FROM tipos');
  return Object.fromEntries(rows.map((r) => [r.nome, r.id]));
}

// ─── Pokémon ────────────────────────────────────────────────

const STATS = {
  hp: 'hp', attack: 'ataque', defense: 'defesa',
  'special-attack': 'ataque_especial', 'special-defense': 'defesa_especial', speed: 'velocidade',
};

async function sincronizarPokemon(pool, id, tipoIds) {
  const dados = await buscarJson(`/pokemon/${id}`);
  if (!dados) return null;
  tipoIds = tipoIds || (await mapaTipos(pool));

  const s = {};
  for (const st of dados.stats) {
    if (STATS[st.stat.name]) s[STATS[st.stat.name]] = st.base_stat;
  }
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  const golpes = dados.moves.map((m) => ({ id: idDaUrl(m.move.url), nome: m.move.name }));

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(
      `INSERT INTO pokemon (id, nome, geracao, altura, peso, sprite_url, artwork_url,
         hp, ataque, defesa, ataque_especial, defesa_especial, velocidade, total, atualizado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
       ON CONFLICT (id) DO UPDATE SET
         nome = EXCLUDED.nome, geracao = EXCLUDED.geracao, altura = EXCLUDED.altura,
         peso = EXCLUDED.peso, sprite_url = EXCLUDED.sprite_url, artwork_url = EXCLUDED.artwork_url,
         hp = EXCLUDED.hp, ataque = EXCLUDED.ataque, defesa = EXCLUDED.defesa,
         ataque_especial = EXCLUDED.ataque_especial, defesa_especial = EXCLUDED.defesa_especial,
         velocidade = EXCLUDED.velocidade, total = EXCLUDED.total, atualizado_em = now()`,
      [
        dados.id, dados.name, geracaoPorId(dados.id), dados.height, dados.weight,
        dados.sprites.front_default,
        dados.sprites.other?.['official-artwork']?.front_default ?? null,
        s.hp, s.ataque, s.defesa, s.ataque_especial, s.defesa_especial, s.velocidade, total,
      ]
    );

    await cliente.query('DELETE FROM pokemon_tipos WHERE pokemon_id = $1', [dados.id]);
    for (const t of dados.types) {
      await cliente.query(
        'INSERT INTO pokemon_tipos (pokemon_id, tipo_id, slot) VALUES ($1, $2, $3)',
        [dados.id, tipoIds[t.type.name], t.slot]
      );
    }

    if (golpes.length) {
      // Insere em lote: golpes "esqueleto" (só id/nome) + learnset
      await cliente.query(
        `INSERT INTO golpes (id, nome)
         SELECT * FROM unnest($1::int[], $2::text[])
         ON CONFLICT (id) DO NOTHING`,
        [golpes.map((g) => g.id), golpes.map((g) => g.nome)]
      );
      await cliente.query(
        `INSERT INTO pokemon_golpes (pokemon_id, golpe_id)
         SELECT $1, unnest($2::int[])
         ON CONFLICT DO NOTHING`,
        [dados.id, golpes.map((g) => g.id)]
      );
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
  return dados.id;
}

// Garante que o Pokémon está em cache; busca na PokéAPI se não estiver.
async function garantirPokemon(pool, id) {
  const { rowCount } = await pool.query('SELECT 1 FROM pokemon WHERE id = $1', [id]);
  if (rowCount) return true;
  if (!Number.isInteger(id) || id < 1 || id > TOTAL_POKEMON) return false;
  return Boolean(await sincronizarPokemon(pool, id));
}

// Preenche pokemon.nome_especie com uma única chamada (a lista de espécies tem o mesmo id do Pokémon padrão)
async function garantirNomesEspecies(pool) {
  const { rowCount } = await pool.query('SELECT 1 FROM pokemon WHERE nome_especie IS NULL LIMIT 1');
  if (!rowCount) return 0;
  const lista = await buscarJson(`/pokemon-species?limit=${TOTAL_POKEMON}`);
  const ids = lista.results.map((r) => idDaUrl(r.url));
  const nomes = lista.results.map((r) => r.name);
  const r = await pool.query(
    `UPDATE pokemon p SET nome_especie = e.nome
       FROM unnest($1::int[], $2::text[]) AS e(id, nome)
      WHERE p.id = e.id AND p.nome_especie IS DISTINCT FROM e.nome`,
    [ids, nomes]
  );
  // Se sobrou algum sem espécie na lista, usa o próprio nome
  await pool.query('UPDATE pokemon SET nome_especie = nome WHERE nome_especie IS NULL');
  return r.rowCount;
}

// ─── Golpes ─────────────────────────────────────────────────

const STATS_GOLPE = {
  attack: 'ataque', defense: 'defesa', 'special-attack': 'ataque_especial',
  'special-defense': 'defesa_especial', speed: 'velocidade',
  accuracy: 'precisao', evasion: 'evasao',
};
const ALVOS_PROPRIOS = new Set(['user', 'users-field', 'user-and-allies', 'user-or-ally', 'ally', 'all-allies']);

// Extrai do JSON da PokéAPI quem recebe a alteração de status e com que chance.
// meta.category diz o efeito: "damage-raise" altera o próprio usuário (Flame Charge,
// e também Close Combat, que reduz a defesa de quem usa); "damage-lower" afeta o alvo;
// nos golpes de status, quem recebe é definido pelo target (Swords Dance = user, Growl = oponentes).
function extrairAlteracoes(dados) {
  const alteracoes = (dados.stat_changes || [])
    .filter((c) => STATS_GOLPE[c.stat.name])
    .map((c) => ({ stat: STATS_GOLPE[c.stat.name], mudanca: c.change }));
  if (!alteracoes.length) return { alteracoes: [], alvo: null, chance: null };

  const categoriaMeta = dados.meta?.category?.name;
  let alvo;
  if (categoriaMeta === 'damage-raise') alvo = 'proprio';
  else if (categoriaMeta === 'damage-lower' || categoriaMeta === 'swagger') alvo = 'alvo';
  else alvo = ALVOS_PROPRIOS.has(dados.target?.name) ? 'proprio' : 'alvo';

  // stat_chance 0 em golpes de status significa "sempre"
  const chance = dados.meta?.stat_chance ? dados.meta.stat_chance : 100;
  return { alteracoes, alvo, chance };
}

async function sincronizarGolpe(pool, id, tipoIds) {
  const dados = await buscarJson(`/move/${id}`);
  if (!dados) return null;
  const { alteracoes, alvo, chance } = extrairAlteracoes(dados);
  await pool.query(
    `UPDATE golpes SET nome = $2, tipo_id = $3, categoria = $4, poder = $5,
       precisao = $6, pp = $7, alteracoes = $8, alvo_alteracao = $9, chance_alteracao = $10,
       detalhes_carregados = true, atualizado_em = now()
     WHERE id = $1`,
    [
      id, dados.name, tipoIds[dados.type?.name] ?? null, dados.damage_class?.name ?? null,
      dados.power, dados.accuracy, dados.pp, JSON.stringify(alteracoes), alvo, chance,
    ]
  );
  return id;
}

// Busca os detalhes dos golpes ainda não carregados (lista de ids ou todos).
// "alteracoes IS NULL" recarrega golpes salvos antes de existir esse campo.
async function carregarDetalhesGolpes(pool, ids = null, concorrencia = 10) {
  const pendente = '(NOT detalhes_carregados OR alteracoes IS NULL)';
  const { rows } = ids
    ? await pool.query(`SELECT id FROM golpes WHERE id = ANY($1::int[]) AND ${pendente}`, [ids])
    : await pool.query(`SELECT id FROM golpes WHERE ${pendente}`);
  if (!rows.length) return 0;
  const tipoIds = await mapaTipos(pool);
  await emParalelo(rows.map((r) => r.id), concorrencia, (id) => sincronizarGolpe(pool, id, tipoIds));
  return rows.length;
}

module.exports = {
  TOTAL_POKEMON,
  TIPOS_PT,
  geracaoPorId,
  idDaUrl,
  buscarJson,
  emParalelo,
  mapaTipos,
  sincronizarTipos,
  sincronizarPokemon,
  garantirPokemon,
  garantirNomesEspecies,
  carregarDetalhesGolpes,
  extrairAlteracoes,
};
