import { useMemo, useState } from 'react';
import { formatarNome } from '../util';

const MAX_SUGESTOES = 8;

// Mesma normalização do backend: "Mr. Mime" -> "mrmime"
export const normalizar = (texto = '') =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Campo do quiz com autocompletar: mostra nomes que começam com o que foi digitado.
// Enter/clique numa sugestão só PREENCHE o campo; o chute é enviado no próximo Enter
// (assim um clique sem querer não zera a sequência).
export default function CampoNome({ campoRef, valor, aoMudar, nomes, desabilitado }) {
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);

  const sugestoes = useMemo(() => {
    const termo = normalizar(valor);
    if (!termo) return [];
    const lista = nomes.filter((n) => normalizar(n).startsWith(termo));
    // Se já digitou o nome exato, não precisa sugerir
    if (lista.length === 1 && normalizar(lista[0]) === termo) return [];
    return lista.slice(0, MAX_SUGESTOES);
  }, [valor, nomes]);

  const mostrar = aberto && sugestoes.length > 0;

  function escolher(nome) {
    aoMudar(formatarNome(nome));
    setAberto(false);
    campoRef.current?.focus();
  }

  function teclas(e) {
    if (!mostrar) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDestaque((d) => (d + 1) % sugestoes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestaque((d) => (d - 1 + sugestoes.length) % sugestoes.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault(); // não envia o formulário: só preenche
      escolher(sugestoes[destaque]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={campoRef}
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
          setAberto(true);
          setDestaque(0);
        }}
        onKeyDown={teclas}
        onBlur={() => setAberto(false)}
        placeholder="Digite o nome do Pokémon"
        autoComplete="off"
        spellCheck={false}
        disabled={desabilitado}
        role="combobox"
        aria-expanded={mostrar}
        aria-autocomplete="list"
        aria-controls="sugestoes-nome"
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-red-500 focus:outline-none"
      />
      {mostrar && (
        <ul
          id="sugestoes-nome"
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {sugestoes.map((nome, i) => {
            const texto = formatarNome(nome);
            const n = valor.trim().length;
            return (
              <li
                key={nome}
                role="option"
                aria-selected={i === destaque}
                // onMouseDown em vez de onClick: acontece antes do blur do campo fechar a lista
                onMouseDown={(e) => { e.preventDefault(); escolher(nome); }}
                onMouseEnter={() => setDestaque(i)}
                className={`cursor-pointer px-3 py-1.5 text-sm ${i === destaque ? 'bg-red-50 text-red-700' : 'text-slate-700'}`}
              >
                <strong>{texto.slice(0, n)}</strong>{texto.slice(n)}
              </li>
            );
          })}
          <li className="border-t border-slate-100 px-3 pt-1 text-[10px] text-slate-400">
            ↑ ↓ para navegar · Enter preenche · Enter de novo chuta
          </li>
        </ul>
      )}
    </div>
  );
}
