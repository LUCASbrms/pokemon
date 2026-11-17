import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';

// Texto que vira input ao clicar no lápis. Enter salva, Esc cancela.
export default function NomeEditavel({ valor, aoSalvar, className = '' }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function abrir() {
    setTexto(valor);
    setErro('');
    setEditando(true);
  }

  async function salvar() {
    const limpo = texto.trim();
    if (!limpo) return setErro('O nome não pode ficar vazio');
    if (limpo === valor) return setEditando(false);
    setSalvando(true);
    try {
      await aoSalvar(limpo);
      setEditando(false);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (!editando) {
    return (
      <div className={`group flex min-w-0 items-center gap-2 ${className}`}>
        <span className="truncate">{valor}</span>
        <button onClick={abrir} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Renomear">
          <Pencil size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={texto}
          maxLength={50}
          disabled={salvando}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar();
            if (e.key === 'Escape') setEditando(false);
          }}
          className="min-w-0 flex-1 rounded-lg border border-red-400 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-200"
        />
        <button onClick={salvar} disabled={salvando} className="rounded p-1 text-emerald-600 hover:bg-emerald-50" title="Salvar">
          <Check size={18} />
        </button>
        <button onClick={() => setEditando(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Cancelar">
          <X size={18} />
        </button>
      </div>
      {erro && <p className="mt-1 text-xs font-normal text-red-600">{erro}</p>}
    </div>
  );
}
