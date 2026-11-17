import { STATS } from '../util';

function corStat(v) {
  if (v >= 120) return 'bg-emerald-500';
  if (v >= 90) return 'bg-lime-500';
  if (v >= 60) return 'bg-amber-400';
  return 'bg-orange-500';
}

export default function BarrasStats({ pokemon }) {
  return (
    <div className="space-y-1.5">
      {STATS.map((s) => (
        <div key={s.chave} className="flex items-center gap-2 text-sm">
          <span className="w-24 shrink-0 text-slate-500">{s.rotulo}</span>
          <span className="w-8 text-right font-semibold">{pokemon[s.chave]}</span>
          <div className="h-2 flex-1 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${corStat(pokemon[s.chave])}`}
              style={{ width: `${Math.min(100, (pokemon[s.chave] / 180) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5 text-sm">
        <span className="w-24 text-slate-500">Total</span>
        <span className="w-8 text-right font-bold">{pokemon.total}</span>
      </div>
    </div>
  );
}
