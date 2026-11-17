import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexto/AuthContext';

export default function Entrar() {
  const { usuario, entrar, registrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const destino = local.state?.voltar || '/times';
  if (usuario) return <Navigate to={destino} replace />;

  const campo = (k) => ({
    value: form[k],
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
    className: 'w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200',
  });

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      if (modo === 'login') await entrar(form.email, form.senha);
      else await registrar(form.nome, form.email, form.senha);
      navegar(destino, { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-sm rounded-2xl bg-white p-6 shadow">
      <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
        {['login', 'registro'].map((m) => (
          <button
            key={m}
            onClick={() => { setModo(m); setErro(''); }}
            className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${modo === m ? 'bg-white shadow' : 'text-slate-500'}`}
          >
            {m === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} className="space-y-4">
        {modo === 'registro' && (
          <label className="block text-sm font-medium">
            Nome
            <input {...campo('nome')} required minLength={2} autoComplete="name" />
          </label>
        )}
        <label className="block text-sm font-medium">
          E-mail
          <input {...campo('email')} type="email" required autoComplete="email" />
        </label>
        <label className="block text-sm font-medium">
          Senha
          <input
            {...campo('senha')}
            type="password"
            required
            minLength={6}
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <button
          disabled={enviando}
          className="w-full rounded-lg bg-red-600 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {enviando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
    </div>
  );
}
