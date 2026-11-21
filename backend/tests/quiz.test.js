// Regras puras do quiz + fluxo completo na API (usa o banco do .env, como api.test.js)
const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const { normalizar, confereChute, sequenciaInicial, lerGeracoes } = require('../utils/quiz');

describe('regras do quiz', () => {
  test('normalizar ignora maiúsculas, acentos, espaços e pontuação', () => {
    expect(normalizar('Mr. Mime')).toBe('mrmime');
    expect(normalizar('Flabébé')).toBe('flabebe');
    expect(normalizar('  HO-OH ')).toBe('hooh');
  });

  test('confereChute aceita espécie ou nome completo', () => {
    const deoxys = { nome: 'deoxys-normal', nome_especie: 'deoxys' };
    expect(confereChute('Deoxys', deoxys)).toBe(true);
    expect(confereChute('deoxys normal', deoxys)).toBe(true);
    expect(confereChute('deo', deoxys)).toBe(false);
    expect(confereChute('', deoxys)).toBe(false);
    expect(confereChute('nidoran', { nome: 'nidoran-f', nome_especie: 'nidoran-f' })).toBe(true);
    expect(confereChute('Nidoran♀', { nome: 'nidoran-f', nome_especie: 'nidoran-f' })).toBe(true);
  });

  test('sequência só continua depois de um acerto', () => {
    expect(sequenciaInicial(null)).toBe(0);
    expect(sequenciaInicial({ respondida: true, acertou: true, sequencia: 4 })).toBe(5);
    expect(sequenciaInicial({ respondida: true, acertou: false, sequencia: 4 })).toBe(0);
    expect(sequenciaInicial({ respondida: false, acertou: null, sequencia: 4 })).toBe(0); // pulou
  });

  test('lerGeracoes', () => {
    expect(lerGeracoes('3,1, 1,12')).toEqual([1, 3]);
    expect(lerGeracoes([])).toBeNull();
    expect(lerGeracoes(undefined)).toBeNull();
  });
});

describe('API do quiz', () => {
  const email = `quiz_${Date.now()}@pokedex.test`;
  let token;

  beforeAll(async () => {
    const r = await request(app).post('/api/auth/registro').send({ nome: 'Brock', email, senha: 'onix1234' });
    token = r.body.token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM usuarios WHERE email = $1', [email]);
    await pool.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const respostaCerta = async (id) => {
    const { rows } = await pool.query(
      'SELECT p.nome_especie FROM quiz_rodadas r JOIN pokemon p ON p.id = r.pokemon_id WHERE r.id = $1', [id]
    );
    return rows[0].nome_especie;
  };

  test('não revela o Pokémon na rodada', async () => {
    const r = await request(app).post('/api/quiz/rodadas').send({ modo: 'dificil', geracoes: [1] });
    expect(r.status).toBe(201);
    // Só id aleatório, imagem via backend e dicas: nada de nome ou número do Pokémon
    expect(Object.keys(r.body).sort()).toEqual(['dica', 'id', 'imagem', 'modo', 'sequencia']);
    expect(r.body.imagem).toBe(`/quiz/rodadas/${r.body.id}/imagem`);
    expect(r.body.dica.geracao).toBe(1);
  });

  test('modo fácil traz 4 opções com a resposta entre elas', async () => {
    const r = await request(app).post('/api/quiz/rodadas').send({ modo: 'facil', geracoes: [1] });
    expect(r.body.opcoes).toHaveLength(4);
    expect(r.body.opcoes).toContain(await respostaCerta(r.body.id));
  });

  test('acertar soma sequência e salva recorde; errar zera', async () => {
    const r1 = await request(app).post('/api/quiz/rodadas').set(auth()).send({ modo: 'dificil' });
    const certo = await respostaCerta(r1.body.id);
    const resp1 = await request(app).post(`/api/quiz/rodadas/${r1.body.id}/resposta`).set(auth()).send({ palpite: certo.toUpperCase() });
    expect(resp1.body).toMatchObject({ acertou: true, sequencia: 1, recorde: true });

    // Responder de novo a mesma rodada não conta
    const repetida = await request(app).post(`/api/quiz/rodadas/${r1.body.id}/resposta`).set(auth()).send({ palpite: certo });
    expect(repetida.status).toBe(409);

    // Próxima rodada continua a sequência
    const r2 = await request(app).post('/api/quiz/rodadas').set(auth()).send({ modo: 'dificil', anterior: r1.body.id });
    expect(r2.body.sequencia).toBe(1);
    const resp2 = await request(app).post(`/api/quiz/rodadas/${r2.body.id}/resposta`).set(auth()).send({ palpite: 'missingno' });
    expect(resp2.body).toMatchObject({ acertou: false, sequencia: 0, sequencia_anterior: 1 });
    expect(resp2.body.pokemon.nome_especie).toBeTruthy();

    const placar = await request(app).get('/api/quiz/placar').set(auth());
    expect(placar.body).toMatchObject({ acertos: 1, erros: 1, melhor_dificil: 1, melhor_facil: 0 });

    const ranking = await request(app).get('/api/quiz/ranking');
    expect(ranking.body.some((u) => u.nome === 'Brock')).toBe(true);
  });

  test('visitante não acessa rodada de outro usuário', async () => {
    const r = await request(app).post('/api/quiz/rodadas').set(auth()).send({});
    const visitante = await request(app).post(`/api/quiz/rodadas/${r.body.id}/resposta`).send({ palpite: 'pikachu' });
    expect(visitante.status).toBe(404);
  });

  test('lista de nomes para o autocompletar', async () => {
    const r = await request(app).get('/api/quiz/nomes');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThanOrEqual(1025);
    expect(r.body).toContain('charizard');
    expect(r.body).toContain('deoxys');       // espécie, não "deoxys-normal"
    expect(r.body).not.toContain('deoxys-normal');
  });

  test('placar exige login', async () => {
    expect((await request(app).get('/api/quiz/placar')).status).toBe(401);
  });
});
