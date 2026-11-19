import { Fragment } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { formatarNome, numero } from '../util';
import TipoBadge from './TipoBadge';

const CRESCIMENTO = {
  fast: 'Rápido',
  medium: 'Médio',
  'medium-slow': 'Médio-lento',
  slow: 'Lento',
  'slow-then-very-fast': 'Irregular (erratic)',
  'fast-then-very-slow': 'Oscilante (fluctuating)',
};

const HABITAT = {
  cave: 'Cavernas',
  forest: 'Florestas',
  grassland: 'Campos',
  mountain: 'Montanhas',
  rare: 'Raro',
  'rough-terrain': 'Terreno acidentado',
  sea: 'Mar',
  urban: 'Cidades',
  'waters-edge': 'Beira d’água',
};

const GRUPOS_OVO = {
  monster: 'Monstro',
  water1: 'Água 1',
  water2: 'Água 2',
  water3: 'Água 3',
  bug: 'Inseto',
  flying: 'Voador',
  ground: 'Campo',
  fairy: 'Fada',
  plant: 'Planta',
  humanshape: 'Humanoide',
  mineral: 'Mineral',
  indeterminate: 'Amorfo',
  ditto: 'Ditto',
  dragon: 'Dragão',
  'no-eggs': 'Não se reproduz',
};

function textoCaptura(taxa) {
  if (taxa == null) return '—';
  // Aproximação: Poké Ball, HP cheio, sem status
  const chance = ((taxa / 3 / 255) * 100).toFixed(1).replace('.', ',');
  const nivel = taxa <= 3 ? 'muito difícil' : taxa <= 45 ? 'difícil' : taxa <= 120 ? 'médio' : 'fácil';
  return `${taxa} (${nivel}, ≈${chance}% com Poké Ball)`;
}

function textoGenero(taxa) {
  if (taxa == null) return '—';
  if (taxa === -1) return 'Sem gênero';
  const femea = (taxa / 8) * 100;
  const pct = (n) => `${String(n).replace('.', ',')}%`;
  return `♂ ${pct(100 - femea)} · ♀ ${pct(femea)}`;
}

function Linha({ rotulo, children }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-slate-500">{rotulo}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function Estagio({ no, atualId, aoSelecionar }) {
  const atual = no.id === atualId;
  return (
    <button
      onClick={() => !atual && aoSelecionar(no.id)}
      className={`flex w-24 shrink-0 flex-col items-center rounded-xl border p-2 text-center transition ${
        atual ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
      }`}
      title={atual ? 'Pokémon atual' : `Ver ${formatarNome(no.nome)}`}
    >
      <img src={no.sprite_url} alt={no.nome} className="h-16 w-16 object-contain" />
      <span className="text-[10px] text-slate-400">{numero(no.id)}</span>
      <span className="w-full truncate text-xs font-semibold">{formatarNome(no.nome)}</span>
      <span className="mt-1 flex flex-wrap justify-center gap-0.5">
        {no.tipos.map((t) => <TipoBadge key={t.id} tipo={t} pequeno />)}
      </span>
    </button>
  );
}

function Condicoes({ lista }) {
  return (
    <div className="w-32 text-center text-[11px] leading-tight text-slate-600">
      {lista.length
        ? lista.map((c, i) => (
          <Fragment key={c}>
            {i > 0 && <p className="my-0.5 text-[10px] uppercase text-slate-400">ou</p>}
            <p className="font-medium">{c}</p>
          </Fragment>
        ))
        : <p>—</p>}
    </div>
  );
}

// Muitas evoluções finais a partir do mesmo Pokémon (ex.: Eevee): grade com a condição embaixo de cada uma
function Grade({ no, atualId, aoSelecionar }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Estagio no={no} atualId={atualId} aoSelecionar={aoSelecionar} />
      <ArrowDown size={18} className="text-slate-400" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 self-stretch">
        {no.evolui_para.map((filho) => (
          <div key={filho.id} className="flex flex-col items-center gap-1">
            <Estagio no={filho} atualId={atualId} aoSelecionar={aoSelecionar} />
            <Condicoes lista={filho.condicoes} />
          </div>
        ))}
      </div>
    </div>
  );
}

const ehGrade = (no) => no.evolui_para.length > 3 && no.evolui_para.every((f) => !f.evolui_para.length);

// Desenha a árvore da esquerda para a direita; ramificações viram uma coluna
function Arvore({ no, atualId, aoSelecionar }) {
  return (
    <div className="flex items-center gap-2">
      <Estagio no={no} atualId={atualId} aoSelecionar={aoSelecionar} />
      {no.evolui_para.length > 0 && (
        <div className="flex flex-col gap-2">
          {no.evolui_para.map((filho) => (
            <div key={filho.id} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <ArrowRight size={18} className="text-slate-400" />
                <Condicoes lista={filho.condicoes} />
              </div>
              <Arvore no={filho} atualId={atualId} aoSelecionar={aoSelecionar} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Em telas estreitas: lista vertical "A → B (Nível 16)"
function ListaEvolucoes({ no, atualId, aoSelecionar, nivel = 0 }) {
  return (
    <>
      {no.evolui_para.map((filho) => (
        <Fragment key={filho.id}>
          <div className="flex items-center gap-2" style={{ paddingLeft: nivel * 16 }}>
            <ArrowDown size={16} className="shrink-0 text-slate-400" />
            <Condicoes lista={filho.condicoes} />
          </div>
          <div style={{ paddingLeft: nivel * 16 }}>
            <Estagio no={filho} atualId={atualId} aoSelecionar={aoSelecionar} />
          </div>
          <ListaEvolucoes no={filho} atualId={atualId} aoSelecionar={aoSelecionar} nivel={nivel + 1} />
        </Fragment>
      ))}
    </>
  );
}

export function CadeiaEvolutiva({ evolucoes, atualId, aoSelecionar }) {
  if (!evolucoes) return null;
  if (!evolucoes.evolui_para.length) {
    return <p className="text-sm text-slate-500">Este Pokémon não evolui.</p>;
  }
  if (ehGrade(evolucoes)) return <Grade no={evolucoes} atualId={atualId} aoSelecionar={aoSelecionar} />;
  return (
    <>
      <div className="hidden overflow-x-auto pb-2 sm:block">
        <Arvore no={evolucoes} atualId={atualId} aoSelecionar={aoSelecionar} />
      </div>
      <div className="flex flex-col items-start gap-2 sm:hidden">
        <Estagio no={evolucoes} atualId={atualId} aoSelecionar={aoSelecionar} />
        <ListaEvolucoes no={evolucoes} atualId={atualId} aoSelecionar={aoSelecionar} />
      </div>
    </>
  );
}

export default function InfoPokemon({ info }) {
  const especiais = [
    info.lendario && 'Lendário',
    info.mitico && 'Mítico',
    info.bebe && 'Bebê',
  ].filter(Boolean);

  return (
    <div className="sm:grid sm:grid-cols-2 sm:gap-x-8">
      <Linha rotulo="Categoria">{info.categoria || '—'}</Linha>
      <Linha rotulo="Habilidades">
        <span className="flex flex-wrap justify-end gap-1">
          {info.habilidades.map((h) => (
            <span
              key={h.nome}
              className={`rounded px-1.5 py-0.5 text-xs ${h.oculta ? 'bg-violet-100 text-violet-800' : 'bg-slate-100'}`}
              title={h.oculta ? 'Habilidade oculta' : undefined}
            >
              {formatarNome(h.nome)}{h.oculta && ' (oculta)'}
            </span>
          ))}
        </span>
      </Linha>
      <Linha rotulo="Taxa de captura">{textoCaptura(info.taxa_captura)}</Linha>
      <Linha rotulo="Gênero">{textoGenero(info.taxa_genero)}</Linha>
      <Linha rotulo="Crescimento">{CRESCIMENTO[info.crescimento] || formatarNome(info.crescimento || '—')}</Linha>
      <Linha rotulo="Grupos de ovo">
        {info.grupos_ovo.map((g) => GRUPOS_OVO[g] || formatarNome(g)).join(', ') || '—'}
      </Linha>
      {info.passos_ovo && <Linha rotulo="Passos para chocar">≈ {info.passos_ovo.toLocaleString('pt-BR')}</Linha>}
      <Linha rotulo="Amizade inicial">{info.felicidade ?? '—'}</Linha>
      {info.habitat && <Linha rotulo="Habitat">{HABITAT[info.habitat] || formatarNome(info.habitat)}</Linha>}
      {especiais.length > 0 && <Linha rotulo="Raridade">{especiais.join(', ')}</Linha>}
    </div>
  );
}
