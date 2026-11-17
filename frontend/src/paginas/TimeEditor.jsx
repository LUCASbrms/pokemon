import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Plus, Swords, Trash2 } from 'lucide-react';
import { api } from '../api';
import { formatarNome, numero } from '../util';
import TipoBadge from '../componentes/TipoBadge';
import NomeEditavel from '../componentes/NomeEditavel';
import PokemonPicker from '../componentes/PokemonPicker';
import GolpesModal from '../componentes/GolpesModal';
import AnaliseTime from '../componentes/AnaliseTime';

function CartaoMembro({ membro, aoEditarGolpes, aoRemover }) {
  const { pokemon, tipos, golpes } = membro;
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <img src={pokemon.sprite_url} alt={pokemon.nome} className="pixelado h-16 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">{numero(pokemon.id)}</p>
          <p className="truncate font-bold">{formatarNome(pokemon.nome)}</p>
          <div className="flex gap-1">{tipos.map((t) => <TipoBadge key={t.id} tipo={t} pequeno />)}</div>
        </div>
        <button onClick={aoRemover} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remover do time">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1">
        {Array.from({ length: 4 }, (_, i) => {
          const g = golpes[i];
          return g ? (
            <div key={i} className="flex min-w-0 items-center gap-1 rounded-md bg-slate-50 px-1.5 py-1 text-xs">
              <TipoBadge tipo={g.tipo} pequeno />
              <span className="truncate">{formatarNome(g.nome)}</span>
            </div>
          ) : (
            <div key={i} className="rounded-md border border-dashed border-slate-200 px-1.5 py-1 text-xs text-slate-300">—</div>
          );
        })}
      </div>
      <button
        onClick={aoEditarGolpes}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-sm font-semibold text-slate-600 hover:border-red-300 hover:text-red-600"
      >
        <Swords size={15} /> {golpes.length ? 'Trocar golpes' : 'Escolher golpes'}
      </button>
    </div>
  );
}

export default function TimeEditor() {
  const { id } = useParams();
  const [time, setTime] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [erro, setErro] = useState('');
  const [escolhendo, setEscolhendo] = useState(false);
  const [editandoGolpes, setEditandoGolpes] = useState(null);

  const atualizarAnalise = useCallback(() => {
    api(`/times/${id}/analise`).then(setAnalise).catch(() => {});
  }, [id]);

  useEffect(() => {
    api(`/times/${id}`).then(setTime).catch((e) => setErro(e.message));
    atualizarAnalise();
  }, [id, atualizarAnalise]);

  // Toda mutação devolve o time completo; depois recalcula a análise
  async function mutar(promessa) {
    setErro('');
    try {
      const novo = await promessa;
      setTime((t) => ({ ...t, ...novo }));
      atualizarAnalise();
    } catch (e) {
      setErro(e.message);
      throw e;
    }
  }

  const renomear = (nome) => mutar(api(`/times/${id}`, { method: 'PUT', body: { nome } }));
  const adicionar = async (p) => {
    await mutar(api(`/times/${id}/pokemon`, { method: 'POST', body: { pokemon_id: p.id } })).catch(() => {});
    setEscolhendo(false);
  };
  const remover = (m) => mutar(api(`/times/${id}/pokemon/${m.id}`, { method: 'DELETE' })).catch(() => {});
  const salvarGolpes = (m, golpes) =>
    mutar(api(`/times/${id}/pokemon/${m.id}/golpes`, { method: 'PUT', body: { golpes } }));

  if (erro && !time) return <p className="rounded-lg bg-red-50 p-4 text-red-700">{erro}</p>;
  if (!time) return <p className="text-slate-500">Carregando...</p>;

  const vagas = 6 - time.membros.length;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/times" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600">
          <ArrowLeft size={16} /> Meus times
        </Link>
        <NomeEditavel valor={time.nome} aoSalvar={renomear} className="text-2xl font-bold" />
        <p className="text-sm text-slate-500">{time.membros.length}/6 Pokémon</p>
      </div>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {time.membros.map((m) => (
          <CartaoMembro
            key={m.id}
            membro={m}
            aoEditarGolpes={() => setEditandoGolpes(m)}
            aoRemover={() => remover(m)}
          />
        ))}
        {Array.from({ length: vagas }, (_, i) => (
          <button
            key={`vaga-${i}`}
            onClick={() => setEscolhendo(true)}
            className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-red-400 hover:text-red-600"
          >
            <Plus /> Adicionar Pokémon
          </button>
        ))}
      </div>

      <AnaliseTime analise={analise} membros={time.membros} />

      {escolhendo && <PokemonPicker aoEscolher={adicionar} aoFechar={() => setEscolhendo(false)} />}
      {editandoGolpes && (
        <GolpesModal
          membro={editandoGolpes}
          aoSalvar={(golpes) => salvarGolpes(editandoGolpes, golpes)}
          aoFechar={() => setEditandoGolpes(null)}
        />
      )}
    </div>
  );
}
