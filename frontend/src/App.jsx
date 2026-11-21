import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { LogOut } from 'lucide-react';
import { useAuth } from './contexto/AuthContext';
import Pokedex from './paginas/Pokedex';
import Entrar from './paginas/Entrar';
import Times from './paginas/Times';
import TimeEditor from './paginas/TimeEditor';
import Quiz from './paginas/Quiz';

function RotaPrivada({ children }) {
  const { usuario, carregando } = useAuth();
  const local = useLocation();
  if (carregando) return <p className="p-8 text-center text-slate-500">Carregando...</p>;
  if (!usuario) return <Navigate to="/entrar" replace state={{ voltar: local.pathname }} />;
  return children;
}

function Cabecalho() {
  const { usuario, sair } = useAuth();
  const link = ({ isActive }) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`;

  return (
    <header className="sticky top-0 z-40 bg-red-600 text-white shadow">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-4 flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
            alt=""
            className="pixelado h-8 w-8"
          />
          Pokédex
        </Link>
        <nav className="flex gap-1">
          <NavLink to="/" end className={link}>Pokédex</NavLink>
          <NavLink to="/times" className={link}>Meus times</NavLink>
          <NavLink to="/quiz" className={link}>Quiz</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {usuario ? (
            <>
              <span className="hidden sm:inline">Olá, <strong>{usuario.nome}</strong></span>
              <button onClick={sair} className="flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-white/10">
                <LogOut size={16} /> Sair
              </button>
            </>
          ) : (
            <Link to="/entrar" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Cabecalho />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Pokedex />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/times" element={<RotaPrivada><Times /></RotaPrivada>} />
          <Route path="/times/:id" element={<RotaPrivada><TimeEditor /></RotaPrivada>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
