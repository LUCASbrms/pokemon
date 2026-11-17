// ============================================================
// Análise de time — funções puras (sem banco), fáceis de testar
// ------------------------------------------------------------
// Entrada:
//   tipos:    [{ id, nome, nome_pt }]
//   eficacia: { "<atacanteId>-<defensorId>": multiplicador }
//   membros:  [{ id, nome, tipos: [tipoId], golpes: [{ id, nome, tipo_id, categoria, poder }] }]
// ============================================================

function multiplicador(eficacia, atacanteId, defensorId) {
  const m = eficacia[`${atacanteId}-${defensorId}`];
  return m === undefined ? 1 : Number(m);
}

// Dano que um golpe do tipo `atacanteId` causa num Pokémon com `tiposDefensor`
function multiplicadorContra(eficacia, atacanteId, tiposDefensor) {
  return tiposDefensor.reduce((acc, def) => acc * multiplicador(eficacia, atacanteId, def), 1);
}

function analiseDefensiva(tipos, eficacia, membros) {
  return tipos.map((tipo) => {
    const detalhes = membros.map((m) => ({
      membro_id: m.id,
      nome: m.nome,
      multiplicador: multiplicadorContra(eficacia, tipo.id, m.tipos),
    }));
    const fracos      = detalhes.filter((d) => d.multiplicador > 1).length;
    const muitoFracos = detalhes.filter((d) => d.multiplicador >= 4).length;
    const resistentes = detalhes.filter((d) => d.multiplicador > 0 && d.multiplicador < 1).length;
    const imunes      = detalhes.filter((d) => d.multiplicador === 0).length;
    return {
      tipo,
      fracos,
      muito_fracos: muitoFracos,
      resistentes,
      imunes,
      neutros: detalhes.length - fracos - resistentes - imunes,
      saldo: resistentes + imunes - fracos,
      detalhes,
    };
  });
}

// Só golpes que causam dano entram na cobertura ofensiva
function golpesDeDano(membros) {
  return membros.flatMap((m) =>
    m.golpes
      .filter((g) => g.tipo_id && g.categoria && g.categoria !== 'status')
      .map((g) => ({ ...g, membro: m.nome }))
  );
}

function analiseOfensiva(tipos, eficacia, membros) {
  const golpes = golpesDeDano(membros);
  return tipos.map((tipo) => {
    const efetivos = golpes.filter((g) => multiplicador(eficacia, g.tipo_id, tipo.id) > 1);
    const melhor = golpes.reduce(
      (max, g) => Math.max(max, multiplicador(eficacia, g.tipo_id, tipo.id)),
      golpes.length ? 0 : null
    );
    return {
      tipo,
      melhor_multiplicador: melhor,
      golpes_super_efetivos: efetivos.map((g) => ({ golpe: g.nome, membro: g.membro })),
    };
  });
}

function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

function gerarAlertas(defensiva, ofensiva, membros) {
  const alertas = [];
  const total = membros.length;
  if (!total) return alertas;

  for (const d of defensiva) {
    const protegidos = d.resistentes + d.imunes;
    // Fraco: vários membros sofrem super efetivo e quase ninguém aguenta
    if ((d.fracos >= 3 && d.fracos > protegidos) || (d.fracos >= 2 && protegidos === 0)) {
      alertas.push({
        nivel: d.fracos >= Math.ceil(total / 2) ? 'perigo' : 'aviso',
        categoria: 'defesa',
        tipo: d.tipo.nome,
        mensagem: `Seu time é fraco contra ${d.tipo.nome_pt} (${d.fracos} de ${total} Pokémon) ` +
          (protegidos ? `e só ${plural(protegidos, 'resiste', 'resistem')}.` : 'e ninguém resiste.'),
      });
    }
    for (const det of d.detalhes.filter((x) => x.multiplicador >= 4)) {
      alertas.push({
        nivel: 'aviso',
        categoria: 'defesa',
        tipo: d.tipo.nome,
        mensagem: `${det.nome} recebe dano 4x de golpes do tipo ${d.tipo.nome_pt}.`,
      });
    }
  }

  const temGolpesDeDano = golpesDeDano(membros).length > 0;
  if (!temGolpesDeDano) {
    alertas.push({
      nivel: 'info',
      categoria: 'ataque',
      tipo: null,
      mensagem: 'Escolha golpes de dano para ver a cobertura ofensiva do time.',
    });
  } else {
    const semCobertura = ofensiva.filter((o) => o.melhor_multiplicador <= 1);
    if (semCobertura.length) {
      alertas.push({
        nivel: semCobertura.length >= 6 ? 'aviso' : 'info',
        categoria: 'ataque',
        tipo: null,
        mensagem: `Nenhum golpe do time é super efetivo contra: ${semCobertura.map((o) => o.tipo.nome_pt).join(', ')}.`,
      });
    }
    for (const o of ofensiva.filter((x) => x.melhor_multiplicador === 0 || x.melhor_multiplicador === 0.5)) {
      alertas.push({
        nivel: 'aviso',
        categoria: 'ataque',
        tipo: o.tipo.nome,
        mensagem: `O time não tem nenhum golpe que cause dano normal em ${o.tipo.nome_pt}.`,
      });
    }
  }

  const ordem = { perigo: 0, aviso: 1, info: 2 };
  return alertas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

function analisarTime({ tipos, eficacia, membros }) {
  const defensiva = analiseDefensiva(tipos, eficacia, membros);
  const ofensiva = analiseOfensiva(tipos, eficacia, membros);
  return {
    total_membros: membros.length,
    defensiva,
    ofensiva,
    pontos_fortes: defensiva
      .filter((d) => d.resistentes + d.imunes >= 2 && d.fracos === 0)
      .map((d) => d.tipo.nome_pt),
    alertas: gerarAlertas(defensiva, ofensiva, membros),
  };
}

module.exports = { multiplicadorContra, analiseDefensiva, analiseOfensiva, analisarTime };
