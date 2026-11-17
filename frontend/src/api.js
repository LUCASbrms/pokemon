const BASE = import.meta.env.VITE_API_URL || '/api';
const CHAVE_TOKEN = 'pokedex_token';

export const tokenSalvo = {
  ler: () => localStorage.getItem(CHAVE_TOKEN),
  salvar: (t) => localStorage.setItem(CHAVE_TOKEN, t),
  limpar: () => localStorage.removeItem(CHAVE_TOKEN),
};

export async function api(caminho, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenSalvo.ler();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(`${BASE}${caminho}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (resp.status === 204) return null;
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const erro = new Error(dados.erro || `Erro ${resp.status}`);
    erro.status = resp.status;
    if (resp.status === 401 && token) window.dispatchEvent(new Event('sessao-expirada'));
    throw erro;
  }
  return dados;
}
