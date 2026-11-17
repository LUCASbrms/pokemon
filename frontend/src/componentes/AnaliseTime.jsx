import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { formatarMultiplicador, formatarNome } from '../util';
import TipoBadge from './TipoBadge';

const ESTILO_ALERTA = {
  perigo: { cls: 'border-red-200 bg-red-50 text-red-800', Icone: ShieldAlert },
  aviso: { cls: 'border-amber-200 bg-amber-50 text-amber-800', Icone: AlertTriangle },
  info: { cls: 'border-sky-200 bg-sky-50 text-sky-800', Icone: Info },
};

function corCelula(m) {
  if (m >= 4) return 'bg-red-600 text-white font-bold';
  if (m >= 2) return 'bg-orange-200 text-orange-900 font-semibold';
  if (m === 0) return 'bg-slate-700 text-white';
  if (m <= 0.25) return 'bg-emerald-600 text-white';
  if (m < 1) return 'bg-emerald-100 text-emerald-800';
  return 'text-slate-300';
}

function corCobertura(m) {
  if (m === null) return 'border-slate-200 text-slate-400';
  if (m >= 2) return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (m === 1) return 'border-slate-200 bg-white text-slate-500';
  return 'border-red-300 bg-red-50 text-red-700';
}

export default function AnaliseTime({ analise, membros }) {
  if (!analise) return null;
  if (!analise.total_membros) {
    return <p className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">Adicione Pokémon para ver a análise do time.</p>;
  }

  return (
    <div className="space-y-6">
      {analise.alertas.length > 0 && (
        <section className="space-y-2">
          {analise.alertas.map((a, i) => {
            const { cls, Icone } = ESTILO_ALERTA[a.nivel];
            return (
              <div key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${cls}`}>
                <Icone size={18} className="mt-0.5 shrink-0" />
                <span>{a.mensagem}</span>
              </div>
            );
          })}
        </section>
      )}

      {analise.pontos_fortes.length > 0 && (
        <p className="text-sm text-emerald-700">
          <strong>Pontos fortes na defesa:</strong> {analise.pontos_fortes.join(', ')}.
        </p>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">Defesa: dano recebido por tipo de golpe</h2>
        <p className="mb-3 text-xs text-slate-500">Cada célula mostra quanto dano o Pokémon recebe de um golpe daquele tipo.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-center text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="py-1 text-left">Golpe</th>
                {membros.map((m) => (
                  <th key={m.id} className="px-1">
                    <img src={m.pokemon.sprite_url} alt={m.pokemon.nome} title={formatarNome(m.pokemon.nome)} className="pixelado mx-auto h-10 w-10" />
                  </th>
                ))}
                <th className="px-2">Fracos</th>
                <th className="px-2">Resistem</th>
              </tr>
            </thead>
            <tbody>
              {analise.defensiva.map((d) => (
                <tr key={d.tipo.id} className="border-t border-slate-100">
                  <td className="py-1 text-left"><TipoBadge tipo={d.tipo} pequeno /></td>
                  {d.detalhes.map((x) => (
                    <td key={x.membro_id} className="p-0.5">
                      <span className={`block rounded px-1 py-0.5 text-xs ${corCelula(x.multiplicador)}`}>
                        {x.multiplicador === 1 ? '·' : formatarMultiplicador(x.multiplicador)}
                      </span>
                    </td>
                  ))}
                  <td className={`font-semibold ${d.fracos >= 3 ? 'text-red-600' : d.fracos ? 'text-orange-600' : 'text-slate-300'}`}>
                    {d.fracos}
                  </td>
                  <td className={`font-semibold ${d.resistentes + d.imunes ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {d.resistentes + d.imunes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">Ataque: cobertura dos golpes</h2>
        <p className="mb-3 text-xs text-slate-500">
          Melhor multiplicador que os golpes de dano do time conseguem contra cada tipo.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {analise.ofensiva.map((o) => (
            <div
              key={o.tipo.id}
              className={`rounded-lg border p-2 text-center ${corCobertura(o.melhor_multiplicador)}`}
              title={o.golpes_super_efetivos.map((g) => `${formatarNome(g.golpe)} (${formatarNome(g.membro)})`).join('\n')}
            >
              <TipoBadge tipo={o.tipo} pequeno />
              <p className="mt-1 text-sm font-bold">{formatarMultiplicador(o.melhor_multiplicador)}</p>
              {o.golpes_super_efetivos.length > 0 && (
                <p className="text-[10px]">{o.golpes_super_efetivos.length} golpe(s)</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
