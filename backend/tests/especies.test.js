const { descreverEvolucao, processarCadeia, descricaoDe } = require('../services/especies');

const no = (nome, id, detalhes = [], filhos = []) => ({
  species: { name: nome, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
  evolution_details: detalhes,
  evolves_to: filhos,
});

describe('descreverEvolucao', () => {
  test('nível', () => {
    expect(descreverEvolucao({ trigger: { name: 'level-up' }, min_level: 16 })).toBe('Nível 16');
  });

  test('pedra', () => {
    expect(descreverEvolucao({ trigger: { name: 'use-item' }, item: { name: 'water-stone' } })).toBe('Usar Water Stone');
  });

  test('troca segurando item', () => {
    expect(descreverEvolucao({ trigger: { name: 'trade' }, held_item: { name: 'metal-coat' } }))
      .toBe('Troca, segurando Metal Coat');
  });

  test('amizade e período', () => {
    expect(descreverEvolucao({ trigger: { name: 'level-up' }, min_happiness: 160, time_of_day: 'night' }))
      .toBe('Subir de nível, com amizade alta, à noite');
  });
});

describe('processarCadeia', () => {
  test('monta a árvore e junta locais', () => {
    const local = (nome) => ({ trigger: { name: 'level-up' }, location: { name: nome } });
    const cadeia = processarCadeia(
      no('eevee', 133, [], [
        no('vaporeon', 134, [{ trigger: { name: 'use-item' }, item: { name: 'water-stone' } }]),
        no('leafeon', 470, [local('eterna-forest'), local('pinwheel-forest'),
          { trigger: { name: 'use-item' }, item: { name: 'leaf-stone' } }]),
      ])
    );
    expect(cadeia.id).toBe(133);
    expect(cadeia.condicoes).toEqual([]);
    expect(cadeia.evolui_para.map((e) => e.nome)).toEqual(['vaporeon', 'leafeon']);
    expect(cadeia.evolui_para[1].condicoes).toEqual([
      'Subir de nível, em Eterna Forest ou Pinwheel Forest',
      'Usar Leaf Stone',
    ]);
  });
});

test('descricaoDe pega o texto em inglês mais recente e limpa quebras', () => {
  const entradas = [
    { language: { name: 'en' }, flavor_text: 'Velho' },
    { language: { name: 'fr' }, flavor_text: 'Français' },
    { language: { name: 'en' }, flavor_text: 'Texto\nnovo\fda Pokédex' },
  ];
  expect(descricaoDe(entradas)).toBe('Texto novo da Pokédex');
});
