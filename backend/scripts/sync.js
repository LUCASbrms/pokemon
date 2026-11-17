// Popula o cache local com dados da PokéAPI.
// Uso:
//   npm run sync                 -> tipos + Pokémon que ainda não estão no banco + detalhes dos golpes
//   npm run sync -- --forcar     -> rebaixa todos os Pokémon
//   npm run sync -- --sem-golpes -> pula os detalhes dos golpes (ficam sob demanda)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const pool = require('../db');
const api = require('../services/pokeapi');

async function main() {
  const forcar = process.argv.includes('--forcar');
  const semGolpes = process.argv.includes('--sem-golpes');
  const inicio = Date.now();

  console.log('Tipos e tabela de eficácia...');
  await api.sincronizarTipos(pool);
  const tipoIds = await api.mapaTipos(pool);

  const { rows } = await pool.query('SELECT id FROM pokemon');
  const jaTem = new Set(rows.map((r) => r.id));
  const ids = [];
  for (let id = 1; id <= api.TOTAL_POKEMON; id++) {
    if (forcar || !jaTem.has(id)) ids.push(id);
  }

  console.log(`Pokémon a sincronizar: ${ids.length}`);
  let feitos = 0;
  await api.emParalelo(ids, 10, async (id) => {
    await api.sincronizarPokemon(pool, id, tipoIds);
    feitos++;
    if (feitos % 100 === 0 || feitos === ids.length) {
      console.log(`  ${feitos}/${ids.length}`);
    }
  });

  if (!semGolpes) {
    console.log('Detalhes dos golpes...');
    const n = await api.carregarDetalhesGolpes(pool);
    console.log(`  ${n} golpes atualizados`);
  }

  console.log(`Pronto em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('Erro na sincronização:', err.message);
  await pool.end();
  process.exit(1);
});
