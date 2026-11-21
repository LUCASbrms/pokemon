import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Flame, HelpCircle, Lightbulb, Trophy } from 'lucide-react';
import { api, urlApi } from '../api';
import { useAuth } from '../contexto/AuthContext';
import { formatarNome } from '../util';
import TipoBadge from '../componentes/TipoBadge';
import CampoNome from '../componentes/CampoNome';

const GERACOES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function Placar({ placar }) {
  const total = placar.acertos + placar.erros;
  const itens = [
    ['Recorde (digitando)', placar.melhor_dificil],
    ['Recorde (múltipla escolha)', placar.melhor_facil],
    ['Acertos', placar.acertos],
    ['Aproveitamento', total ? `${Math.round((placar.acertos / total) * 100)}%` : '—'],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="text-[11px] text-slate-500">{rotulo}</dt>
          <dd className="text-lg font-bold">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Ranking({ lista, usuarioId }) {
  if (!lista.length) return <p className="text-sm text-slate-500">Ninguém pontuou ainda. Seja o primeiro!</p>;
  return (
    <ol className="space-y-1">
      {lista.map((u, i) => (
        <li
          key={u.id}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${u.id === usuarioId ? 'bg-amber-50 font-semibold' : ''}`}
        >
          <span className="w-6 text-center font-bold text-slate-400">{['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>
          <span className="min-w-0 flex-1 truncate">{u.nome}</span>
          <span className="font-bold">{u.melhor_dificil}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Quiz() {
  const { usuario } = useAuth();
  const [modo, setModo] = useState('dificil');
  const [geracoes, setGeracoes] = useState([]); // vazio = todas
  const [rodada, setRodada] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [palpite, setPalpite] = useState('');
  const [dica, setDica] = useState(false);
  const [imagemPronta, setImagemPronta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [placar, setPlacar] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [nomes, setNomes] = useState([]);
  const campo = useRef(null);
  const proximo = useRef(null);

  const atualizarPlacar = useCallback(() => {
    api('/quiz/ranking').then(setRanking).catch(() => {});
    if (usuario) api('/quiz/placar').then(setPlacar).catch(() => {});
    else setPlacar(null);
  }, [usuario]);

  const novaRodada = useCallback(async (anterior = null) => {
    setErro('');
    try {
      const r = await api('/quiz/rodadas', { method: 'POST', body: { modo, geracoes, anterior } });
      setImagemPronta(false);
      setRodada(r);
      setResultado(null);
      setPalpite('');
      setDica(false);
    } catch (e) {
      setErro(e.message);
    }
  }, [modo, geracoes]);

  // Mudar modo ou gerações começa do zero
  useEffect(() => { novaRodada(); }, [novaRodada]);
  useEffect(() => { atualizarPlacar(); }, [atualizarPlacar]);
  useEffect(() => { api('/quiz/nomes').then(setNomes).catch(() => {}); }, []);

  // Foco: no campo durante a rodada, no "Próximo" depois da resposta
  useEffect(() => {
    if (resultado) proximo.current?.focus();
    else if (imagemPronta) campo.current?.focus();
  }, [resultado, imagemPronta]);

  async function responder(texto) {
    if (!rodada || resultado || enviando) return;
    setEnviando(true);
    try {
      const r = await api(`/quiz/rodadas/${rodada.id}/resposta`, { method: 'POST', body: { palpite: texto } });
      setResultado(r);
      atualizarPlacar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  function alternarGeracao(g) {
    setGeracoes((atual) => (atual.includes(g) ? atual.filter((x) => x !== g) : [...atual, g].sort((a, b) => a - b)));
  }

  const sequencia = resultado ? resultado.sequencia : rodada?.sequencia ?? 0;
  const revelado = Boolean(resultado);
  const nomeCerto = resultado ? formatarNome(resultado.pokemon.nome_especie) : '';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="space-y-4">
        {/* Configuração */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            {[['dificil', 'Digitar o nome'], ['facil', 'Múltipla escolha']].map(([valor, rotulo]) => (
              <button
                key={valor}
                onClick={() => setModo(valor)}
                className={`rounded-md px-3 py-1.5 ${modo === valor ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-slate-500">Gerações:</span>
            <button
              onClick={() => setGeracoes([])}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${!geracoes.length ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Todas
            </button>
            {GERACOES.map((g) => (
              <button
                key={g}
                onClick={() => alternarGeracao(g)}
                className={`w-8 rounded-md py-1 text-xs font-semibold ${geracoes.includes(g) ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {g}ª
              </button>
            ))}
          </div>
        </div>

        {/* Jogo */}
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-white">
            <h1 className="flex items-center gap-2 text-lg font-extrabold">
              <HelpCircle size={20} /> Quem é esse Pokémon?
            </h1>
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold" title="Acertos seguidos">
              <Flame size={16} className={sequencia ? 'text-amber-300' : ''} /> {sequencia}
            </span>
          </div>

          <div className="relative flex h-72 items-center justify-center overflow-hidden bg-[radial-gradient(circle,#fef9c3_0%,#bae6fd_45%,#38bdf8_100%)] sm:h-80">
            {rodada && (
              <img
                key={rodada.id}
                src={urlApi(rodada.imagem)}
                alt="Pokémon misterioso"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                onLoad={() => setImagemPronta(true)}
                className={`h-64 w-64 select-none object-contain transition duration-700 sm:h-72 sm:w-72 ${
                  imagemPronta ? 'opacity-100' : 'opacity-0'
                } ${revelado ? 'scale-105' : ''}`}
                style={{ filter: revelado ? 'drop-shadow(0 12px 14px rgb(0 0 0 / 0.25))' : 'brightness(0)' }}
              />
            )}
            {!imagemPronta && !erro && <p className="absolute text-sm text-sky-900/70">Carregando...</p>}
          </div>

          <div className="space-y-3 p-5">
            {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

            {resultado ? (
              <div className="space-y-3 text-center">
                <p className={`text-2xl font-extrabold ${resultado.acertou ? 'text-emerald-600' : 'text-red-600'}`}>
                  {resultado.acertou ? `É o ${nomeCerto}!` : `Era o ${nomeCerto}!`}
                </p>
                <div className="flex justify-center gap-1">
                  {resultado.pokemon.tipos.map((t) => <TipoBadge key={t.id} tipo={t} />)}
                </div>
                <p className="text-sm text-slate-600">
                  {resultado.acertou
                    ? resultado.recorde
                      ? `🎉 Novo recorde: ${resultado.sequencia} seguidos!`
                      : `${resultado.sequencia} acerto${resultado.sequencia > 1 ? 's' : ''} seguido${resultado.sequencia > 1 ? 's' : ''}.`
                    : resultado.sequencia_anterior
                      ? `Sua sequência de ${resultado.sequencia_anterior} acabou.`
                      : 'Tente o próximo!'}
                </p>
                <button
                  ref={proximo}
                  onClick={() => novaRodada(rodada.id)}
                  className="rounded-lg bg-red-600 px-6 py-2.5 font-semibold text-white hover:bg-red-700"
                >
                  Próximo Pokémon →
                </button>
              </div>
            ) : modo === 'dificil' ? (
              <form
                onSubmit={(e) => { e.preventDefault(); if (palpite.trim()) responder(palpite); }}
                className="flex flex-wrap gap-2"
              >
                <CampoNome
                  campoRef={campo}
                  valor={palpite}
                  aoMudar={setPalpite}
                  nomes={nomes}
                  desabilitado={!imagemPronta}
                />
                <button
                  type="submit"
                  disabled={!palpite.trim() || enviando}
                  className="rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Chutar
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {rodada?.opcoes?.map((o) => (
                  <button
                    key={o}
                    onClick={() => responder(o)}
                    disabled={!imagemPronta || enviando}
                    className="rounded-lg border-2 border-slate-200 px-3 py-3 font-semibold hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
                  >
                    {formatarNome(o)}
                  </button>
                ))}
              </div>
            )}

            {!resultado && rodada && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                {dica ? (
                  <span className="flex flex-wrap items-center gap-1 text-slate-600">
                    <Lightbulb size={16} className="text-amber-500" /> {rodada.dica.geracao}ª geração ·
                    {rodada.dica.tipos.map((t) => <TipoBadge key={t.id} tipo={t} pequeno />)}
                  </span>
                ) : (
                  <button onClick={() => setDica(true)} className="flex items-center gap-1 text-slate-500 hover:text-amber-600">
                    <Lightbulb size={16} /> Ver dica (tipo e geração)
                  </button>
                )}
                <button onClick={() => responder('')} disabled={enviando} className="text-slate-500 hover:text-red-600">
                  Não sei, revelar
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Vale escrever sem acento, hífen ou espaço (ex.: “mr mime”). Errar ou revelar zera a sequência.
          {modo === 'facil' && ' A múltipla escolha não entra no ranking.'}
        </p>
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Seu placar</h2>
          {usuario ? (
            placar ? <Placar placar={placar} /> : <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <p className="text-sm text-slate-500">
              <Link to="/entrar" className="font-semibold text-red-600 hover:underline">Entre</Link> para salvar seus
              recordes e aparecer no ranking.
            </p>
          )}
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Trophy size={18} className="text-amber-500" /> Ranking
          </h2>
          <p className="mb-2 text-xs text-slate-500">Maior sequência digitando o nome</p>
          <Ranking lista={ranking} usuarioId={usuario?.id} />
        </div>
      </aside>
    </div>
  );
}
