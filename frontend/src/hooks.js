import { useEffect, useState } from 'react';
import { api } from './api';

export function useDebounce(valor, atraso = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), atraso);
    return () => clearTimeout(t);
  }, [valor, atraso]);
  return v;
}

// Lista de tipos é estática: busca uma vez e guarda em memória
let cacheTipos = null;
export function useTipos() {
  const [tipos, setTipos] = useState(cacheTipos || []);
  useEffect(() => {
    if (cacheTipos) return;
    api('/tipos').then((r) => {
      cacheTipos = r.tipos;
      setTipos(r.tipos);
    });
  }, []);
  return tipos;
}
