import { useEffect, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api } from '../api';
import { useDebounce, useTipos } from '../hooks';
import { formatarNome, numero, STATS } from '../util';
import TipoBadge from '../componentes/TipoBadge';
import PokemonModal from '../componentes/PokemonModal';

const GERACOES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ORDENACOES = [
  { valor: 'id', rotulo: 'Número' },
  { valor: 'nome', rotulo: 'Nome' },
  ...STATS.map((s) => ({ valor: s.chave, rotulo: s.rotulo })),
  { valor: 'total', rotulo: 'Total' },
];
const FILTRO_INICIAL = { busca: '', tipo: '', tipo2: '', geracao: '', ordenar: 'id', ordem: 'asc', stat: 'total', min: '' };
const POR_PAGINA = 24;

const seletor = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none';

export default function Pokedex() {
  const tipos = useTipos();
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ dados: [], total: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [selecionado, setSelecionado] = useState(null);

  const busca = useDebounce(filtro.busca);
  const min = useDebounce(filtro.min);

  const alterar = (k, v) => {
    setFiltro((f) => ({ ...f, [k]: v }));
    setPagina(1);
  };

  useEffect(() => {
    const params = new URLSearchParams({ pagina, limite: POR_PAGINA, ordenar: filtro.ordenar, ordem: filtro.ordem });
    if (busca) params.set('busca', busca);
    if (filtro.tipo) params.set('tipo', filtro.tipo);
    if (filtro.tipo2) params.set('tipo2', filtro.tipo2);
    if (filtro.geracao) params.set('geracao', filtro.geracao);
    if (min) { params.set('stat', filtro.stat); params.set('min', min); }

    let ativo = true;
    setCarregando(true);
    api(`/pokemon?${params}`)
      .then((r) => ativo && (setResultado(r), setErro('')))
      .catch((e) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [busca, min, filtro.tipo, filtro.tipo2, filtro.geracao, filtro.ordenar, filtro.ordem, filtro.stat, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));
  const statOrdenado = STATS.find((s) => s.chave === filtro.ordenar) || (filtro.ordenar === 'total' && { chave: 'total', curto: 'Total' });

  return (
    <div>
      <section className="mb-6 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            value={filtro.busca}
            onChange={(e) => alterar('busca', e.target.value)}
            placeholder="Buscar por nome ou número..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filtro.tipo} onChange={(e) => alterar('tipo', e.target.value)} className={seletor}>
            <option value="">Todos os tipos</option>
            {tipos.map((t) => <option key={t.id} value={t.nome}>{t.nome_pt}</option>)}
          </select>
          {filtro.tipo && (
            <select value={filtro.tipo2} onChange={(e) => alterar('tipo2', e.target.value)} className={seletor}>
              <option value="">+ segundo tipo</option>
              {tipos.filter((t) => t.nome !== filtro.tipo).map((t) => <option key={t.id} value={t.nome}>{t.nome_pt}</option>)}
            </select>
          )}
          <select value={filtro.geracao} onChange={(e) => alterar('geracao', e.target.value)} className={seletor}>
            <option value="">Todas as gerações</option>
            {GERACOES.map((g) => <option key={g} value={g}>{g}ª geração</option>)}
          </select>

          <div className="flex items-center gap-1">
            <select value={filtro.ordenar} onChange={(e) => alterar('ordenar', e.target.value)} className={seletor}>
              {ORDENACOES.map((o) => <option key={o.valor} value={o.valor}>Ordenar: {o.rotulo}</option>)}
            </select>
            <button
              onClick={() => alterar('ordem', filtro.ordem === 'asc' ? 'desc' : 'asc')}
              className="rounded-lg border border-slate-300 bg-white p-2 hover:bg-slate-50"
              title={filtro.ordem === 'asc' ? 'Crescente' : 'Decrescente'}
            >
              {filtro.ordem === 'asc' ? <ArrowUpNarrowWide size={18} /> : <ArrowDownWideNarrow size={18} />}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <select value={filtro.stat} onChange={(e) => alterar('stat', e.target.value)} className={seletor}>
              {[...STATS, { chave: 'total', rotulo: 'Total' }].map((s) => (
                <option key={s.chave} value={s.chave}>{s.rotulo} mín.</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={filtro.min}
              onChange={(e) => alterar('min', e.target.value)}
              placeholder="0"
              className={`${seletor} w-20`}
            />
          </div>

          <button onClick={() => { setFiltro(FILTRO_INICIAL); setPagina(1); }} className="ml-auto text-sm text-slate-500 hover:text-red-600">
            Limpar filtros
          </button>
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <span>{resultado.total} Pokémon encontrados</span>
        {carregando && <span>Carregando...</span>}
      </div>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-red-700">{erro}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {resultado.dados.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelecionado(p.id)}
            className="group rounded-2xl bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex justify-between text-xs text-slate-400">
              <span>{numero(p.id)}</span>
              {statOrdenado && <span className="font-semibold text-slate-600">{statOrdenado.curto} {p[statOrdenado.chave]}</span>}
            </div>
            <img
              src={p.sprite_url || p.artwork_url}
              alt={p.nome}
              loading="lazy"
              className="pixelado mx-auto h-24 w-24 transition group-hover:scale-110"
            />
            <p className="truncate font-semibold">{formatarNome(p.nome)}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.tipos.map((t) => <TipoBadge key={t.id} tipo={t} pequeno />)}
            </div>
          </button>
        ))}
      </div>

      {!carregando && resultado.total === 0 && (
        <p className="py-12 text-center text-slate-500">Nenhum Pokémon com esses filtros.</p>
      )}

      {resultado.total > POR_PAGINA && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled={pagina === 1}
            onClick={() => setPagina(pagina - 1)}
            className="rounded-lg bg-white p-2 shadow-sm disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </button>
          <span className="text-sm">Página {pagina} de {totalPaginas}</span>
          <button
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina(pagina + 1)}
            className="rounded-lg bg-white p-2 shadow-sm disabled:opacity-40"
            aria-label="Próxima página"
          >
            <ChevronRight />
          </button>
        </div>
      )}

      {selecionado && <PokemonModal id={selecionado} aoFechar={() => setSelecionado(null)} />}
    </div>
  );
}
