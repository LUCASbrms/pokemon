// Informações da espécie (descrição, habilidades, captura...) e cadeia evolutiva.
// Buscadas na PokéAPI na primeira consulta e guardadas no banco.
const { buscarJson, idDaUrl, TIPOS_PT } = require('./pokeapi');

const formatar = (s = '') => s.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

const PERIODOS = { day: 'de dia', night: 'à noite', dusk: 'ao entardecer', 'full-moon': 'na lua cheia' };
const STATS_RELATIVOS = { 1: 'Ataque maior que Defesa', 0: 'Ataque igual à Defesa', '-1': 'Ataque menor que Defesa' };
const GENERO = { 1: 'fêmea', 2: 'macho' };

// Transforma um evolution_details da PokéAPI em texto:
// "Nível 16", "Usar Water Stone", "Troca, segurando Metal Coat", "Subir de nível, com amizade alta, de dia"...
function descreverEvolucao(d) {
  if (!d) return null;
  const extras = [];
  if (d.gender) extras.push(`só ${GENERO[d.gender]}`);
  if (d.held_item) extras.push(`segurando ${formatar(d.held_item.name)}`);
  if (d.known_move) extras.push(`conhecendo ${formatar(d.known_move.name)}`);
  if (d.known_move_type) extras.push(`conhecendo golpe do tipo ${TIPOS_PT[d.known_move_type.name] || formatar(d.known_move_type.name)}`);
  if (d.min_happiness) extras.push('com amizade alta');
  if (d.min_affection) extras.push('com afeição alta');
  if (d.min_beauty) extras.push('com beleza alta');
  if (d.location) extras.push(`em ${formatar(d.location.name)}`);
  if (d.time_of_day && PERIODOS[d.time_of_day]) extras.push(PERIODOS[d.time_of_day]);
  if (d.needs_overworld_rain) extras.push('com chuva');
  if (d.party_species) extras.push(`com ${formatar(d.party_species.name)} no time`);
  if (d.party_type) extras.push(`com Pokémon do tipo ${TIPOS_PT[d.party_type.name] || formatar(d.party_type.name)} no time`);
  if (d.relative_physical_stats !== null && d.relative_physical_stats !== undefined) {
    extras.push(`com ${STATS_RELATIVOS[d.relative_physical_stats]}`);
  }
  if (d.trade_species) extras.push(`trocando por ${formatar(d.trade_species.name)}`);
  if (d.turn_upside_down) extras.push('com o console de cabeça para baixo');

  const gatilho = d.trigger?.name;
  let base;
  if (gatilho === 'level-up') base = d.min_level ? `Nível ${d.min_level}` : 'Subir de nível';
  else if (gatilho === 'use-item') base = `Usar ${formatar(d.item?.name)}`;
  else if (gatilho === 'trade') base = 'Troca';
  else if (gatilho === 'shed') base = 'Nível 20 com espaço livre no time e uma Poké Ball';
  else if (gatilho === 'spin') base = 'Girar segurando um doce';
  else if (gatilho === 'three-critical-hits') base = '3 golpes críticos em uma batalha';
  else if (gatilho === 'take-damage') base = 'Receber dano e passar pelo arco de pedra';
  else if (gatilho === 'agile-style-move' || gatilho === 'strong-style-move') {
    base = `Usar ${formatar(d.used_move?.name)} 20 vezes no estilo ${gatilho.startsWith('agile') ? 'ágil' : 'forte'}`;
  } else if (gatilho === 'recoil-damage') base = 'Receber 294+ de dano de recuo';
  else base = 'Condição especial';

  return [base, ...extras].join(', ');
}

// Uma evolução pode ter várias formas (uma por jogo): remove repetidas e junta as que
// só mudam de local ("Subir de nível, em Eterna Forest ou Twist Mountain")
function condicoesDe(detalhes = []) {
  const textos = [];
  const locaisPor = new Map();
  for (const d of detalhes) {
    if (d.location) {
      const chave = descreverEvolucao({ ...d, location: null });
      if (!locaisPor.has(chave)) {
        locaisPor.set(chave, []);
        textos.push({ chave });
      }
      locaisPor.get(chave).push(formatar(d.location.name));
    } else {
      textos.push({ texto: descreverEvolucao(d) });
    }
  }
  const final = textos.map(({ chave, texto }) => {
    if (texto) return texto;
    const locais = [...new Set(locaisPor.get(chave))];
    const lista = locais.length > 1 ? `${locais.slice(0, -1).join(', ')} ou ${locais.at(-1)}` : locais[0];
    return `${chave}, em ${lista}`;
  });
  return [...new Set(final.filter(Boolean))];
}

function processarCadeia(no) {
  return {
    id: idDaUrl(no.species.url),
    nome: no.species.name,
    condicoes: condicoesDe(no.evolution_details),
    evolui_para: no.evolves_to.map(processarCadeia),
  };
}

// Texto mais recente da Pokédex (português se existir; senão inglês)
function descricaoDe(entradas = []) {
  for (const idioma of ['pt-br', 'pt-BR', 'pt', 'en']) {
    const lista = entradas.filter((f) => f.language.name === idioma);
    if (lista.length) {
      return lista[lista.length - 1].flavor_text.replace(/[\f\n\r­]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

async function garantirCadeia(pool, url) {
  const id = idDaUrl(url);
  const { rowCount } = await pool.query('SELECT 1 FROM cadeias_evolucao WHERE id = $1', [id]);
  if (rowCount) return id;
  const dados = await buscarJson(`/evolution-chain/${id}`);
  if (!dados) return null;
  await pool.query(
    `INSERT INTO cadeias_evolucao (id, dados) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`,
    [id, JSON.stringify(processarCadeia(dados.chain))]
  );
  return id;
}

async function sincronizarEspecie(pool, pokemonId) {
  const [especie, pokemon] = await Promise.all([
    buscarJson(`/pokemon-species/${pokemonId}`),
    buscarJson(`/pokemon/${pokemonId}`),
  ]);
  if (!especie || !pokemon) return false;

  const cadeiaId = especie.evolution_chain ? await garantirCadeia(pool, especie.evolution_chain.url) : null;
  const habilidades = [...pokemon.abilities]
    .sort((a, b) => a.slot - b.slot)
    .map((h) => ({ nome: h.ability.name, oculta: h.is_hidden }));
  const categoria = especie.genera.find((g) => g.language.name === 'en')?.genus ?? null;

  await pool.query(
    `INSERT INTO pokemon_especies (pokemon_id, categoria, descricao, habilidades, taxa_captura, taxa_genero,
       felicidade, passos_ovo, crescimento, habitat, grupos_ovo, lendario, mitico, bebe, cadeia_id, atualizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
     ON CONFLICT (pokemon_id) DO UPDATE SET
       categoria = EXCLUDED.categoria, descricao = EXCLUDED.descricao, habilidades = EXCLUDED.habilidades,
       taxa_captura = EXCLUDED.taxa_captura, taxa_genero = EXCLUDED.taxa_genero, felicidade = EXCLUDED.felicidade,
       passos_ovo = EXCLUDED.passos_ovo, crescimento = EXCLUDED.crescimento, habitat = EXCLUDED.habitat,
       grupos_ovo = EXCLUDED.grupos_ovo, lendario = EXCLUDED.lendario, mitico = EXCLUDED.mitico,
       bebe = EXCLUDED.bebe, cadeia_id = EXCLUDED.cadeia_id, atualizado_em = now()`,
    [
      pokemonId, categoria, descricaoDe(especie.flavor_text_entries), JSON.stringify(habilidades),
      especie.capture_rate, especie.gender_rate, especie.base_happiness,
      especie.hatch_counter != null ? (especie.hatch_counter + 1) * 255 : null,
      especie.growth_rate?.name ?? null, especie.habitat?.name ?? null,
      JSON.stringify(especie.egg_groups.map((e) => e.name)),
      especie.is_legendary, especie.is_mythical, especie.is_baby, cadeiaId,
    ]
  );
  return true;
}

async function garantirEspecie(pool, pokemonId) {
  const { rowCount } = await pool.query('SELECT 1 FROM pokemon_especies WHERE pokemon_id = $1', [pokemonId]);
  if (rowCount) return true;
  return sincronizarEspecie(pool, pokemonId);
}

module.exports = { descreverEvolucao, processarCadeia, descricaoDe, garantirEspecie, sincronizarEspecie };
