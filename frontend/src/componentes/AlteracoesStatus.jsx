import { ArrowDown, ArrowUp } from 'lucide-react';
import { multiplicadorEstagio, ROTULO_STAT } from '../util';

// Mostra o que o golpe faz com os status: "↑ Ataque +2 (você)" / "↓ Defesa −1 (alvo, 20%)".
// Se receber o Pokémon, o title mostra o valor do status depois da alteração.
export default function AlteracoesStatus({ golpe, pokemon }) {
  const alteracoes = golpe.alteracoes || [];
  if (!alteracoes.length) return null;

  const proprio = golpe.alvo_alteracao === 'proprio';
  const chance = golpe.chance_alteracao && golpe.chance_alteracao < 100 ? golpe.chance_alteracao : null;

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1">
      {alteracoes.map((a) => {
        const sobe = a.mudanca > 0;
        // Bom para você: subir o seu status ou baixar o do alvo
        const bom = proprio ? sobe : !sobe;
        const Icone = sobe ? ArrowUp : ArrowDown;
        const base = proprio && pokemon ? pokemon[a.stat] : null;
        const fator = multiplicadorEstagio(a.stat, a.mudanca);
        const titulo = [
          `${proprio ? 'Seu' : 'Do alvo:'} ${ROTULO_STAT[a.stat]} ${sobe ? '+' : ''}${a.mudanca} estágio(s) (${fator.toFixed(2).replace('.', ',')}x)`,
          base ? `${base} → ${Math.floor(base * fator)}` : null,
          chance ? `${chance}% de chance` : null,
        ].filter(Boolean).join(' · ');

        return (
          <span
            key={a.stat}
            title={titulo}
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              bom ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
            }`}
          >
            <Icone size={10} strokeWidth={3} />
            {ROTULO_STAT[a.stat]} {sobe ? '+' : '−'}{Math.abs(a.mudanca)}
          </span>
        );
      })}
      <span className="text-[10px] text-slate-400">
        {proprio ? 'em você' : 'no alvo'}{chance ? `, ${chance}%` : ''}
      </span>
    </span>
  );
}
