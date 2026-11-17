import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../contexto/AuthContext';
import { formatarMultiplicador, formatarNome, numero } from '../util';
import Modal from './Modal';
import TipoBadge from './TipoBadge';
import BarrasStats from './BarrasStats';

const GRUPOS = [
  { m: 4, rotulo: 'Muito fraco (4x)', cor: 'text-red-700' },
  { m: 2, rotulo: 'Fraco (2x)', cor: 'text-orange-600' },
  { m: 0.5, rotulo: 'Resiste (½)', cor: 'text-emerald-600' },
  { m: 0.25, rotulo: 'Resiste muito (¼)', cor: 'text-emerald-800' },
  { m: 0, rotulo: 'Imune (0x)', cor: 'text-slate-600' },
];

function AdicionarAoTime({ pokemonId }) {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const [times, setTimes] = useState(null);
  const [timeId, setTimeId] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!usuario) return;
    api('/times').then((t) => {
      setTimes(t);
      const livre = t.find((x) => x.membros.length < 6);
      if (livre) setTimeId(String(livre.id));
    });
  }, [usuario]);

  if (!usuario) {
    return (
      <p className="text-sm text-slate-500">
        <Link to="/entrar" className="font-semibold text-red-600 hover:underline">Entre</Link> para montar times.
      </p>
    );
  }
  if (!times) return null;

  async function adicionar() {
    setMsg(null);
    try {
      let id = timeId;
      if (id === 'novo') {
        const novo = await api('/times', { method: 'POST', body: { nome: `Time ${times.length + 1}` } });
        id = String(novo.id);
      }
      await api(`/times/${id}/pokemon`, { method: 'POST', body: { pokemon_id: pokemonId } });
      setMsg({ ok: true, texto: 'Adicionado!', timeId: id });
      const t = await api('/times');
      setTimes(t);
      setTimeId(id);
    } catch (e) {
      setMsg({ ok: false, texto: e.message });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={timeId}
          onChange={(e) => setTimeId(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>Escolha um time</option>
          {times.map((t) => (
            <option key={t.id} value={t.id} disabled={t.membros.length >= 6}>
              {t.nome} ({t.membros.length}/6)
            </option>
          ))}
          <option value="novo">+ Criar novo time</option>
        </select>
        <button
          onClick={adicionar}
          disabled={!timeId}
          className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Plus size={16} /> Adicionar
        </button>
      </div>
      {msg && (
        <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {msg.texto}{' '}
          {msg.ok && (
            <button onClick={() => navegar(`/times/${msg.timeId}`)} className="font-semibold underline">
              Ver time
            </button>
          )}
        </p>
      )}
    </div>
  );
}

export default function PokemonModal({ id, aoFechar }) {
  const [p, setP] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api(`/pokemon/${id}`).then(setP).catch((e) => setErro(e.message));
  }, [id]);

  return (
    <Modal titulo={p ? `${formatarNome(p.nome)} ${numero(p.id)}` : 'Carregando...'} aoFechar={aoFechar}>
      {erro && <p className="text-red-600">{erro}</p>}
      {p && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="text-center">
            <img src={p.artwork_url || p.sprite_url} alt={p.nome} className="mx-auto h-48 w-48 object-contain" />
            <div className="mt-2 flex justify-center gap-2">
              {p.tipos.map((t) => <TipoBadge key={t.id} tipo={t} />)}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {p.geracao}ª geração · {(p.altura / 10).toFixed(1)} m · {(p.peso / 10).toFixed(1)} kg
            </p>
          </div>
          <div className="space-y-5">
            <BarrasStats pokemon={p} />
            <div className="space-y-2">
              <h3 className="font-semibold">Dano recebido</h3>
              {GRUPOS.map((g) => {
                const lista = p.defesa_tipos.filter((d) => d.multiplicador === g.m);
                if (!lista.length) return null;
                return (
                  <div key={g.m} className="text-sm">
                    <span className={`mr-2 font-medium ${g.cor}`}>{g.rotulo}</span>
                    <span className="inline-flex flex-wrap gap-1 align-middle">
                      {lista.map((d) => <TipoBadge key={d.tipo.id} tipo={d.tipo} pequeno />)}
                    </span>
                  </div>
                );
              })}
              <p className="text-xs text-slate-400">Os demais tipos causam dano normal ({formatarMultiplicador(1)}).</p>
            </div>
            <AdicionarAoTime pokemonId={p.id} />
          </div>
        </div>
      )}
    </Modal>
  );
}
