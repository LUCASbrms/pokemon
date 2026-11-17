// Teste de integração: usa o banco configurado no .env (precisa do `npm run sync` antes).
// Cria um usuário temporário e apaga tudo no final.
const request = require('supertest');
const app = require('../app');
const pool = require('../db');

const email = `teste_${Date.now()}@pokedex.test`;
let token;
let timeId;

afterAll(async () => {
  await pool.query('DELETE FROM usuarios WHERE email = $1', [email]);
  await pool.end();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('auth', () => {
  test('registra e faz login', async () => {
    const reg = await request(app).post('/api/auth/registro').send({ nome: 'Ash', email, senha: 'pikachu123' });
    expect(reg.status).toBe(201);

    const dup = await request(app).post('/api/auth/registro').send({ nome: 'Ash', email, senha: 'pikachu123' });
    expect(dup.status).toBe(409);

    const errado = await request(app).post('/api/auth/login').send({ email, senha: 'errada' });
    expect(errado.status).toBe(401);

    const login = await request(app).post('/api/auth/login').send({ email, senha: 'pikachu123' });
    expect(login.status).toBe(200);
    token = login.body.token;
  });

  test('times exigem token', async () => {
    expect((await request(app).get('/api/times')).status).toBe(401);
  });
});

describe('pokédex', () => {
  test('filtra por tipo e geração e ordena por stat', async () => {
    const r = await request(app).get('/api/pokemon?tipo=fire&geracao=1&ordenar=ataque&ordem=desc&limite=5');
    expect(r.status).toBe(200);
    expect(r.body.dados.length).toBe(5);
    for (const p of r.body.dados) {
      expect(p.geracao).toBe(1);
      expect(p.tipos.map((t) => t.nome)).toContain('fire');
    }
    const ataques = r.body.dados.map((p) => p.ataque);
    expect(ataques).toEqual([...ataques].sort((a, b) => b - a));
  });

  test('detalhe mostra fraquezas', async () => {
    const r = await request(app).get('/api/pokemon/6'); // Charizard
    expect(r.body.nome).toBe('charizard');
    const pedra = r.body.defesa_tipos.find((d) => d.tipo.nome === 'rock');
    expect(pedra.multiplicador).toBe(4);
  });
});

describe('times', () => {
  test('cria, renomeia, adiciona membros e golpes', async () => {
    const criado = await request(app).post('/api/times').set(auth()).send({ nome: 'Time Kanto' });
    expect(criado.status).toBe(201);
    timeId = criado.body.id;

    const renomeado = await request(app).put(`/api/times/${timeId}`).set(auth()).send({ nome: 'Time Fogo' });
    expect(renomeado.body.nome).toBe('Time Fogo');
    expect((await request(app).put(`/api/times/${timeId}`).set(auth()).send({ nome: '  ' })).status).toBe(400);

    // 6 Pokémon de fogo
    let time;
    for (const id of [4, 37, 58, 77, 126, 136]) {
      const r = await request(app).post(`/api/times/${timeId}/pokemon`).set(auth()).send({ pokemon_id: id });
      expect(r.status).toBe(201);
      time = r.body;
    }
    expect(time.membros.map((m) => m.posicao)).toEqual([1, 2, 3, 4, 5, 6]);

    const setimo = await request(app).post(`/api/times/${timeId}/pokemon`).set(auth()).send({ pokemon_id: 25 });
    expect(setimo.status).toBe(400);

    // Golpes do Charmander
    const membro = time.membros[0];
    const golpes = (await request(app).get('/api/pokemon/4/golpes')).body;
    const pegar = (nome) => golpes.find((g) => g.nome === nome).id;
    const quatro = ['flamethrower', 'dragon-claw', 'slash', 'scratch'].map(pegar);

    const ok = await request(app).put(`/api/times/${timeId}/pokemon/${membro.id}/golpes`).set(auth()).send({ golpes: quatro });
    expect(ok.status).toBe(200);
    expect(ok.body.membros[0].golpes.map((g) => g.nome)).toEqual(['flamethrower', 'dragon-claw', 'slash', 'scratch']);

    const cinco = await request(app).put(`/api/times/${timeId}/pokemon/${membro.id}/golpes`).set(auth())
      .send({ golpes: [...quatro, pegar('ember')] });
    expect(cinco.status).toBe(400);

    const repetido = await request(app).put(`/api/times/${timeId}/pokemon/${membro.id}/golpes`).set(auth())
      .send({ golpes: [quatro[0], quatro[0]] });
    expect(repetido.status).toBe(400);

    // Surf (57): Charmander não aprende
    const naoAprende = await request(app).put(`/api/times/${timeId}/pokemon/${membro.id}/golpes`).set(auth())
      .send({ golpes: [57] });
    expect(naoAprende.status).toBe(400);
  });

  test('análise aponta fraqueza a Água', async () => {
    const r = await request(app).get(`/api/times/${timeId}/analise`).set(auth());
    expect(r.status).toBe(200);
    const agua = r.body.defensiva.find((d) => d.tipo.nome === 'water');
    expect(agua.fracos).toBe(6);
    expect(r.body.alertas[0].mensagem).toMatch(/fraco contra (Água|Pedra|Terrestre)/);
  });

  test('outro usuário não vê o time', async () => {
    const outroEmail = `outro_${Date.now()}@pokedex.test`;
    const reg = await request(app).post('/api/auth/registro').send({ nome: 'Gary', email: outroEmail, senha: 'eevee123' });
    const r = await request(app).get(`/api/times/${timeId}`).set({ Authorization: `Bearer ${reg.body.token}` });
    expect(r.status).toBe(404);
    await pool.query('DELETE FROM usuarios WHERE email = $1', [outroEmail]);
  });

  test('exclui o time', async () => {
    expect((await request(app).delete(`/api/times/${timeId}`).set(auth())).status).toBe(204);
    expect((await request(app).get(`/api/times/${timeId}`).set(auth())).status).toBe(404);
  });
});
