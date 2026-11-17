const { multiplicadorContra, analisarTime } = require('../utils/analise');

// Mini tabela com 4 tipos para os testes
const tipos = [
  { id: 1, nome: 'fire',   nome_pt: 'Fogo' },
  { id: 2, nome: 'water',  nome_pt: 'Água' },
  { id: 3, nome: 'grass',  nome_pt: 'Planta' },
  { id: 4, nome: 'ground', nome_pt: 'Terrestre' },
];
const eficacia = {
  '1-1': 0.5, '1-2': 0.5, '1-3': 2,
  '2-1': 2,   '2-2': 0.5, '2-3': 0.5, '2-4': 2,
  '3-1': 0.5, '3-2': 2,   '3-3': 0.5, '3-4': 2,
  '4-1': 2,   '4-3': 0.5,
};

const membro = (id, nome, tiposIds, golpes = []) => ({ id, nome, tipos: tiposIds, golpes });

describe('multiplicadorContra', () => {
  test('multiplica os dois tipos do defensor', () => {
    expect(multiplicadorContra(eficacia, 2, [1, 4])).toBe(4);   // Água em Fogo/Terrestre
    expect(multiplicadorContra(eficacia, 3, [2, 3])).toBe(1);   // Planta em Água/Planta
    expect(multiplicadorContra(eficacia, 1, [3])).toBe(2);
  });

  test('par ausente na tabela vale 1', () => {
    expect(multiplicadorContra(eficacia, 4, [2])).toBe(1);
  });
});

describe('analisarTime', () => {
  test('time vazio não gera alertas', () => {
    const r = analisarTime({ tipos, eficacia, membros: [] });
    expect(r.total_membros).toBe(0);
    expect(r.alertas).toEqual([]);
  });

  test('conta fracos/resistentes e avisa fraqueza compartilhada', () => {
    const membros = [
      membro(1, 'charmander', [1]),
      membro(2, 'vulpix', [1]),
      membro(3, 'growlithe', [1]),
    ];
    const r = analisarTime({ tipos, eficacia, membros });
    const agua = r.defensiva.find((d) => d.tipo.nome === 'water');
    expect(agua.fracos).toBe(3);
    expect(agua.resistentes).toBe(0);

    const alerta = r.alertas.find((a) => a.categoria === 'defesa' && a.tipo === 'water');
    expect(alerta.mensagem).toMatch(/fraco contra Água \(3 de 3/);
    expect(alerta.nivel).toBe('perigo');
  });

  test('não avisa fraqueza quando o time resiste o suficiente', () => {
    const membros = [
      membro(1, 'charmander', [1]),
      membro(2, 'vulpix', [1]),
      membro(3, 'squirtle', [2]),
      membro(4, 'psyduck', [2]),
      membro(5, 'bulbasaur', [3]),
    ];
    const r = analisarTime({ tipos, eficacia, membros });
    expect(r.alertas.some((a) => a.categoria === 'defesa' && a.tipo === 'water')).toBe(false);
  });

  test('aponta fraqueza 4x', () => {
    const r = analisarTime({ tipos, eficacia, membros: [membro(1, 'torkoal-terra', [1, 4])] });
    expect(r.alertas.some((a) => /4x de golpes do tipo Água/.test(a.mensagem))).toBe(true);
  });

  test('cobertura ofensiva ignora golpes de status', () => {
    const membros = [
      membro(1, 'squirtle', [2], [
        { id: 10, nome: 'water-gun', tipo_id: 2, categoria: 'special' },
        { id: 11, nome: 'growl', tipo_id: 1, categoria: 'status' },
      ]),
    ];
    const r = analisarTime({ tipos, eficacia, membros });
    const fogo = r.ofensiva.find((o) => o.tipo.nome === 'fire');
    expect(fogo.melhor_multiplicador).toBe(2);
    expect(fogo.golpes_super_efetivos).toEqual([{ golpe: 'water-gun', membro: 'squirtle' }]);

    const planta = r.ofensiva.find((o) => o.tipo.nome === 'grass');
    expect(planta.melhor_multiplicador).toBe(0.5);
    expect(r.alertas.some((a) => /Nenhum golpe do time é super efetivo contra: Água, Planta/.test(a.mensagem))).toBe(true);
  });

  test('sem golpes de dano sugere escolher golpes', () => {
    const r = analisarTime({ tipos, eficacia, membros: [membro(1, 'squirtle', [2])] });
    expect(r.ofensiva[0].melhor_multiplicador).toBeNull();
    expect(r.alertas.some((a) => a.categoria === 'ataque' && /Escolha golpes/.test(a.mensagem))).toBe(true);
  });
});
