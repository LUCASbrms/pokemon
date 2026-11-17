import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenSalvo } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(tokenSalvo.ler()));

  const sair = useCallback(() => {
    tokenSalvo.limpar();
    setUsuario(null);
  }, []);

  useEffect(() => {
    if (!tokenSalvo.ler()) return;
    api('/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch(() => tokenSalvo.limpar())
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    window.addEventListener('sessao-expirada', sair);
    return () => window.removeEventListener('sessao-expirada', sair);
  }, [sair]);

  async function entrar(email, senha) {
    const r = await api('/auth/login', { method: 'POST', body: { email, senha } });
    tokenSalvo.salvar(r.token);
    setUsuario(r.usuario);
  }

  async function registrar(nome, email, senha) {
    const r = await api('/auth/registro', { method: 'POST', body: { nome, email, senha } });
    tokenSalvo.salvar(r.token);
    setUsuario(r.usuario);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, entrar, registrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
