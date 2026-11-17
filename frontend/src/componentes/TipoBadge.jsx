export const CORES_TIPOS = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
};

// Tipos com cor clara usam texto escuro para manter contraste
const TEXTO_ESCURO = new Set(['electric', 'ice', 'ground', 'steel', 'normal', 'bug', 'rock', 'grass']);

export default function TipoBadge({ tipo, pequeno = false }) {
  if (!tipo) return null;
  return (
    <span
      className={`inline-block rounded-full font-semibold uppercase tracking-wide ${
        pequeno ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
      } ${TEXTO_ESCURO.has(tipo.nome) ? 'text-slate-900' : 'text-white'}`}
      style={{ backgroundColor: CORES_TIPOS[tipo.nome] || '#999' }}
    >
      {tipo.nome_pt}
    </span>
  );
}
