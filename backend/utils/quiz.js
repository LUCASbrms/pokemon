// Regras puras do quiz (sem banco), testadas em tests/quiz.test.js

// "Mr. Mime" / "mr-mime" / "MR MIME" -> "mrmime"; "Flabébé" -> "flabebe"
function normalizar(texto = '') {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/[^a-z0-9]/g, '');
}

// Aceita o nome da espécie ou o nome completo da forma.
// Nidoran ♀/♂: "nidoran" sozinho também vale.
function confereChute(palpite, { nome, nome_especie }) {
  const p = normalizar(palpite);
  if (!p) return false;
  const aceitos = new Set([normalizar(nome), normalizar(nome_especie || nome)]);
  if (/^nidoran-[fm]$/.test(nome_especie || nome)) aceitos.add('nidoran');
  return aceitos.has(p);
}

// Sequência da nova rodada: continua só se a anterior foi respondida e acertada
function sequenciaInicial(anterior) {
  if (!anterior || !anterior.respondida || !anterior.acertou) return 0;
  return anterior.sequencia + 1;
}

function embaralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// "1,2, 3" -> [1,2,3] (só gerações válidas); vazio -> null (todas)
function lerGeracoes(valor) {
  const lista = Array.isArray(valor) ? valor : String(valor ?? '').split(',');
  const nums = [...new Set(lista.map((g) => parseInt(g)).filter((g) => g >= 1 && g <= 9))];
  return nums.length ? nums.sort((a, b) => a - b) : null;
}

module.exports = { normalizar, confereChute, sequenciaInicial, embaralhar, lerGeracoes };
