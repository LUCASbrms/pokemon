const { extrairAlteracoes } = require('../services/pokeapi');

// Recortes reais da PokéAPI (só os campos usados)
const golpe = (target, categoria, chance, mudancas) => ({
  target: { name: target },
  meta: { category: { name: categoria }, stat_chance: chance },
  stat_changes: mudancas.map(([stat, change]) => ({ stat: { name: stat }, change })),
});

describe('extrairAlteracoes', () => {
  test('golpe de status no próprio usuário (Swords Dance)', () => {
    expect(extrairAlteracoes(golpe('user', 'net-good-stats', 0, [['attack', 2]]))).toEqual({
      alteracoes: [{ stat: 'ataque', mudanca: 2 }], alvo: 'proprio', chance: 100,
    });
  });

  test('golpe de status no oponente (Growl)', () => {
    const r = extrairAlteracoes(golpe('all-opponents', 'net-good-stats', 0, [['attack', -1]]));
    expect(r.alvo).toBe('alvo');
    expect(r.alteracoes).toEqual([{ stat: 'ataque', mudanca: -1 }]);
  });

  test('dano que reduz o próprio usuário (Close Combat)', () => {
    const r = extrairAlteracoes(golpe('selected-pokemon', 'damage-raise', 100, [['defense', -1], ['special-defense', -1]]));
    expect(r.alvo).toBe('proprio');
    expect(r.alteracoes.map((a) => a.stat)).toEqual(['defesa', 'defesa_especial']);
  });

  test('dano com chance de reduzir o alvo (Crunch)', () => {
    expect(extrairAlteracoes(golpe('selected-pokemon', 'damage-lower', 20, [['defense', -1]]))).toEqual({
      alteracoes: [{ stat: 'defesa', mudanca: -1 }], alvo: 'alvo', chance: 20,
    });
  });

  test('golpe sem alteração de status', () => {
    expect(extrairAlteracoes(golpe('selected-pokemon', 'damage', 0, []))).toEqual({
      alteracoes: [], alvo: null, chance: null,
    });
  });
});
