import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, Search, X } from 'lucide-react';
import { api } from '../api';
import { CATEGORIAS, formatarNome, ROTULO_STAT } from '../util';
import Modal from './Modal';
import TipoBadge from './TipoBadge';
import BarrasStats from './BarrasStats';
import AlteracoesStatus from './AlteracoesStatus';

const MAX = 4;
const STATS_EFEITO = ['ataque', 'defesa', 'ataque_especial', 'defesa_especial', 'velocidade', 'precisao', 'evasao'];

// Filtro de efeito: "aumenta" (qualquer status seu), "aumenta:<stat>" ou "reduz-alvo"
function atendeEfeito(g, efeito) {
  if (!efeito) return true;
  const alteracoes = g.alteracoes || [];
  if (efeito === 'reduz-alvo') {
    return g.alvo_alteracao === 'alvo' && alteracoes.some((a) => a.mudanca < 0);
  }
  if (g.alvo_alteracao !== 'proprio') return false;
  const [, stat] = efeito.split(':');
  return alteracoes.some((a) => a.mudanca > 0 && (!stat || a.stat === stat));
}

// Dica de categoria: compara ataque físico x especial
function dicaCategoria(p) {
  const diff = p.ataque - p.ataque_especial;
  if (Math.abs(diff) < 15) return 'Ataque e Ataque Esp. parecidos: golpes físicos e especiais funcionam bem.';
  return diff > 0
    ? `Ataque (${p.ataque}) maior que Ataque Esp. (${p.ataque_especial}): prefira golpes físicos.`
    : `Ataque Esp. (${p.ataque_especial}) maior que Ataque (${p.ataque}): prefira golpes especiais.`;
}

function PainelStats({ membro }) {
  const [aberto, setAberto] = useState(true);
  const { pokemon, tipos } = membro;
  return (
    <div className="mb-4 rounded-xl border border-slate-200">
      <button
        onClick={() => setAberto(!aberto)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        <BarChart3 size={16} />
        {aberto ? 'Ocultar status' : 'Ver status'} de {formatarNome(pokemon.nome)}
        <ChevronDown size={16} className={`ml-auto transition ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="flex flex-col gap-4 border-t border-slate-100 p-3 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-2 sm:flex-col">
            <img src={pokemon.artwork_url || pokemon.sprite_url} alt={pokemon.nome} className="h-20 w-20 object-contain" />
            <div className="flex flex-wrap justify-center gap-1">
              {tipos.map((t) => <TipoBadge key={t.id} tipo={t} pequeno />)}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <BarrasStats pokemon={pokemon} />
            <p className="mt-2 text-xs text-slate-500">{dicaCategoria(pokemon)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GolpesModal({ membro, aoSalvar, aoFechar }) {
  const [golpes, setGolpes] = useState(null);
  const [escolhidos, setEscolhidos] = useState(membro.golpes.map((g) => g.id));
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [efeito, setEfeito] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api(`/pokemon/${membro.pokemon.id}/golpes`).then(setGolpes).catch((e) => setErro(e.message));
  }, [membro.pokemon.id]);

  const porId = useMemo(() => Object.fromEntries((golpes || []).map((g) => [g.id, g])), [golpes]);
  const tiposDisponiveis = useMemo(() => {
    const m = new Map();
    for (const g of golpes || []) if (g.tipo?.id) m.set(g.tipo.nome, g.tipo);
    return [...m.values()].sort((a, b) => a.nome_pt.localeCompare(b.nome_pt));
  }, [golpes]);

  const filtrados = (golpes || []).filter((g) => {
    const termo = busca.trim().toLowerCase().replace(/\s+/g, '-');
    return (!termo || g.nome.includes(termo)) && (!tipo || g.tipo?.nome === tipo) &&
      (!categoria || g.categoria === categoria) && atendeEfeito(g, efeito);
  });

  function alternar(id) {
    setErro('');
    if (escolhidos.includes(id)) return setEscolhidos(escolhidos.filter((x) => x !== id));
    if (escolhidos.length >= MAX) return setErro(`Máximo de ${MAX} golpes. Remova um para trocar.`);
    setEscolhidos([...escolhidos, id]);
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar(escolhidos);
      aoFechar();
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`Golpes de ${formatarNome(membro.pokemon.nome)}`} aoFechar={aoFechar} largura="max-w-3xl">
      <PainelStats membro={membro} />

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-slate-600">Escolhidos ({escolhidos.length}/{MAX})</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: MAX }, (_, i) => {
            const g = porId[escolhidos[i]] || membro.golpes.find((x) => x.id === escolhidos[i]);
            return g ? (
              <button
                key={i}
                onClick={() => alternar(g.id)}
                className="flex items-center justify-between gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-sm hover:border-red-300"
                title="Remover"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{formatarNome(g.nome)}</span>
                  <TipoBadge tipo={g.tipo} pequeno />
                  <AlteracoesStatus golpe={g} pokemon={membro.pokemon} />
                </span>
                <X size={14} className="shrink-0 text-slate-400" />
              </button>
            ) : (
              <div key={i} className="rounded-lg border-2 border-dashed border-slate-200 px-2 py-3 text-center text-xs text-slate-400">
                Slot {i + 1} vazio
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar golpe"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-red-500 focus:outline-none"
          />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">Todos os tipos</option>
          {tiposDisponiveis.map((t) => <option key={t.id} value={t.nome}>{t.nome_pt}</option>)}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={efeito} onChange={(e) => setEfeito(e.target.value)} className="rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">Qualquer efeito</option>
          <option value="aumenta">Aumenta seus status</option>
          {STATS_EFEITO.map((s) => <option key={s} value={`aumenta:${s}`}>Aumenta {ROTULO_STAT[s]}</option>)}
          <option value="reduz-alvo">Reduz status do alvo</option>
        </select>
      </div>

      {!golpes && !erro && <p className="py-6 text-center text-slate-500">Carregando golpes...</p>}

      {golpes && (
        <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Golpe</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="hidden px-2 py-2 sm:table-cell">Categoria</th>
                <th className="px-2 py-2 text-right">Poder</th>
                <th className="hidden px-2 py-2 text-right sm:table-cell">Precisão</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">PP</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((g) => {
                const ativo = escolhidos.includes(g.id);
                return (
                  <tr
                    key={g.id}
                    onClick={() => alternar(g.id)}
                    className={`cursor-pointer border-t border-slate-100 ${ativo ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-1.5">
                      <input type="checkbox" readOnly checked={ativo} className="mr-2 accent-red-600" />
                      {formatarNome(g.nome)}
                      {g.categoria !== 'status' && membro.tipos.some((t) => t.id === g.tipo?.id) && (
                        <span
                          className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-800"
                          title="Mesmo tipo do Pokémon: +50% de dano"
                        >
                          STAB
                        </span>
                      )}
                      <AlteracoesStatus golpe={g} pokemon={membro.pokemon} />
                    </td>
                    <td className="px-2 py-1.5"><TipoBadge tipo={g.tipo} pequeno /></td>
                    <td className="hidden px-2 py-1.5 text-slate-500 sm:table-cell">{CATEGORIAS[g.categoria] || '—'}</td>
                    <td className="px-2 py-1.5 text-right">{g.poder ?? '—'}</td>
                    <td className="hidden px-2 py-1.5 text-right sm:table-cell">{g.precisao ? `${g.precisao}%` : '—'}</td>
                    <td className="hidden px-3 py-1.5 text-right sm:table-cell">{g.pp ?? '—'}</td>
                  </tr>
                );
              })}
              {!filtrados.length && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">Nenhum golpe encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={aoFechar} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={salvando || !golpes}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar golpes'}
        </button>
      </div>
    </Modal>
  );
}
