import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import NomeEditavel from '../componentes/NomeEditavel';

export default function Times() {
  const [times, setTimes] = useState(null);
  const [novoNome, setNovoNome] = useState('');
  const [erro, setErro] = useState('');

  const carregar = () => api('/times').then(setTimes).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    try {
      await api('/times', { method: 'POST', body: { nome: novoNome } });
      setNovoNome('');
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function renomear(time, nome) {
    const atualizado = await api(`/times/${time.id}`, { method: 'PUT', body: { nome } });
    setTimes((ts) => ts.map((t) => (t.id === time.id ? { ...t, nome: atualizado.nome } : t)));
  }

  async function excluir(time) {
    if (!window.confirm(`Excluir o time "${time.nome}"?`)) return;
    try {
      await api(`/times/${time.id}`, { method: 'DELETE' });
      setTimes((ts) => ts.filter((t) => t.id !== time.id));
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Meus times</h1>
        <form onSubmit={criar} className="flex gap-2">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome do novo time"
            maxLength={50}
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
          />
          <button className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
            <Plus size={16} /> Criar
          </button>
        </form>
      </div>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-red-700">{erro}</p>}
      {times === null && <p className="text-slate-500">Carregando...</p>}
      {times?.length === 0 && (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
          Você ainda não tem times. Crie um acima ou adicione Pokémon pela <Link to="/" className="text-red-600 underline">Pokédex</Link>.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {times?.map((t) => (
          <div key={t.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <NomeEditavel valor={t.nome} aoSalvar={(n) => renomear(t, n)} className="flex-1 text-lg font-bold" />
              <span className="text-sm text-slate-400">{t.membros.length}/6</span>
              <button onClick={() => excluir(t)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir time">
                <Trash2 size={18} />
              </button>
            </div>
            <Link to={`/times/${t.id}`} className="grid grid-cols-6 gap-1 rounded-xl bg-slate-50 p-2 hover:bg-slate-100">
              {Array.from({ length: 6 }, (_, i) => {
                const m = t.membros.find((x) => x.posicao === i + 1);
                return (
                  <div key={i} className="flex aspect-square items-center justify-center rounded-lg bg-white">
                    {m ? (
                      <img src={m.sprite_url} alt={m.nome} title={m.nome} className="pixelado h-full w-full" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border-2 border-slate-200" />
                    )}
                  </div>
                );
              })}
            </Link>
            <Link to={`/times/${t.id}`} className="mt-3 inline-block text-sm font-semibold text-red-600 hover:underline">
              Editar time e ver análise →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
