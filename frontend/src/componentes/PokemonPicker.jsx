import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api';
import { useDebounce, useTipos } from '../hooks';
import { formatarNome, numero } from '../util';
import Modal from './Modal';
import TipoBadge from './TipoBadge';

const GERACOES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const POR_PAGINA = 30;

export default function PokemonPicker({ aoEscolher, aoFechar }) {
  const tipos = useTipos();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [geracao, setGeracao] = useState('');
  const [lista, setLista] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [enviando, setEnviando] = useState(null);
  const termo = useDebounce(busca);

  // Filtro mudou: volta para a primeira página
  useEffect(() => { setPagina(1); }, [termo, tipo, geracao]);

  useEffect(() => {
    const params = new URLSearchParams({ limite: POR_PAGINA, pagina });
    if (termo) params.set('busca', termo);
    if (tipo) params.set('tipo', tipo);
    if (geracao) params.set('geracao', geracao);
    let ativo = true;
    api(`/pokemon?${params}`).then((r) => {
      if (!ativo) return;
      setTotal(r.total);
      setLista((atual) => (pagina === 1 ? r.dados : [...atual, ...r.dados]));
    });
    return () => { ativo = false; };
  }, [termo, tipo, geracao, pagina]);

  async function escolher(p) {
    setEnviando(p.id);
    try {
      await aoEscolher(p);
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Modal titulo="Adicionar Pokémon" aoFechar={aoFechar}>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou número"
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 focus:border-red-500 focus:outline-none"
          />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">Todos os tipos</option>
          {tipos.map((t) => <option key={t.id} value={t.nome}>{t.nome_pt}</option>)}
        </select>
        <select value={geracao} onChange={(e) => setGeracao(e.target.value)} className="rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">Todas as gerações</option>
          {GERACOES.map((g) => <option key={g} value={g}>{g}ª geração</option>)}
        </select>
      </div>
      <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-x-hidden overflow-y-auto min-[420px]:grid-cols-2 sm:grid-cols-3">
        {lista.map((p) => (
          <button
            key={p.id}
            disabled={enviando !== null}
            onClick={() => escolher(p)}
            className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 p-2 text-left hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
          >
            <img src={p.sprite_url} alt="" className="pixelado h-12 w-12" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{formatarNome(p.nome)}</p>
              <p className="text-xs text-slate-400">{numero(p.id)}</p>
              <div className="flex flex-wrap gap-1">{p.tipos.map((t) => <TipoBadge key={t.id} tipo={t} pequeno />)}</div>
            </div>
          </button>
        ))}
        {!lista.length && <p className="col-span-full py-6 text-center text-slate-500">Nada encontrado.</p>}
        {lista.length < total && (
          <button
            onClick={() => setPagina((p) => p + 1)}
            className="col-span-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:border-red-300 hover:text-red-600"
          >
            Carregar mais ({total - lista.length} restantes)
          </button>
        )}
      </div>
    </Modal>
  );
}
