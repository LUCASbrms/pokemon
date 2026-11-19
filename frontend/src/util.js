// "mr-mime" -> "Mr Mime"
export function formatarNome(nome = '') {
  return nome
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export const numero = (id) => `#${String(id).padStart(4, '0')}`;

export const STATS = [
  { chave: 'hp', rotulo: 'HP', curto: 'HP' },
  { chave: 'ataque', rotulo: 'Ataque', curto: 'Atq' },
  { chave: 'defesa', rotulo: 'Defesa', curto: 'Def' },
  { chave: 'ataque_especial', rotulo: 'Ataque Esp.', curto: 'AtE' },
  { chave: 'defesa_especial', rotulo: 'Defesa Esp.', curto: 'DfE' },
  { chave: 'velocidade', rotulo: 'Velocidade', curto: 'Vel' },
];

export const ROTULO_STAT = {
  ...Object.fromEntries(STATS.map((s) => [s.chave, s.rotulo])),
  precisao: 'Precisão',
  evasao: 'Evasão',
};

// Multiplicador de um estágio de status no jogo: +1 = 1,5x, +2 = 2x, -1 = 0,67x...
// (precisão e evasão usam base 3 em vez de 2)
export function multiplicadorEstagio(stat, estagio) {
  const base = stat === 'precisao' || stat === 'evasao' ? 3 : 2;
  return estagio >= 0 ? (base + estagio) / base : base / (base - estagio);
}

export const CATEGORIAS = {
  physical: 'Físico',
  special: 'Especial',
  status: 'Status',
};

export function formatarMultiplicador(m) {
  if (m === null || m === undefined) return '—';
  if (m === 0.25) return '¼';
  if (m === 0.5) return '½';
  return `${m}x`;
}
