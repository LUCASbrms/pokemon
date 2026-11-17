-- ============================================================
-- Pokédex com times — schema PostgreSQL
-- Tabelas de cache (tipos, pokemon, golpes) são preenchidas a
-- partir da PokéAPI; usuários e times são dados da aplicação.
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(80)  NOT NULL,
  email       VARCHAR(120) NOT NULL UNIQUE,
  senha_hash  TEXT         NOT NULL,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── Cache da PokéAPI ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS tipos (
  id       INTEGER PRIMARY KEY,          -- mesmo id da PokéAPI (1..18)
  nome     VARCHAR(20) NOT NULL UNIQUE,  -- nome em inglês (fire, water...)
  nome_pt  VARCHAR(20) NOT NULL
);

-- Multiplicador de dano: golpe do tipo atacante contra Pokémon do tipo defensor
CREATE TABLE IF NOT EXISTS tipo_eficacia (
  atacante_id    INTEGER NOT NULL REFERENCES tipos(id),
  defensor_id    INTEGER NOT NULL REFERENCES tipos(id),
  multiplicador  NUMERIC(3,2) NOT NULL,
  PRIMARY KEY (atacante_id, defensor_id)
);

CREATE TABLE IF NOT EXISTS pokemon (
  id               INTEGER PRIMARY KEY,   -- número da Pokédex nacional
  nome             VARCHAR(60) NOT NULL,
  geracao          SMALLINT    NOT NULL,
  altura           INTEGER,               -- decímetros
  peso             INTEGER,               -- hectogramas
  sprite_url       TEXT,
  artwork_url      TEXT,
  hp               SMALLINT NOT NULL,
  ataque           SMALLINT NOT NULL,
  defesa           SMALLINT NOT NULL,
  ataque_especial  SMALLINT NOT NULL,
  defesa_especial  SMALLINT NOT NULL,
  velocidade       SMALLINT NOT NULL,
  total            SMALLINT NOT NULL,
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pokemon_nome    ON pokemon (nome);
CREATE INDEX IF NOT EXISTS idx_pokemon_geracao ON pokemon (geracao);

CREATE TABLE IF NOT EXISTS pokemon_tipos (
  pokemon_id  INTEGER  NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  tipo_id     INTEGER  NOT NULL REFERENCES tipos(id),
  slot        SMALLINT NOT NULL,
  PRIMARY KEY (pokemon_id, slot)
);
CREATE INDEX IF NOT EXISTS idx_pokemon_tipos_tipo ON pokemon_tipos (tipo_id);

-- Golpes: a linha nasce só com id/nome (vindo do learnset) e os
-- detalhes são buscados sob demanda (detalhes_carregados = false).
CREATE TABLE IF NOT EXISTS golpes (
  id                   INTEGER PRIMARY KEY,
  nome                 VARCHAR(60) NOT NULL,
  tipo_id              INTEGER REFERENCES tipos(id),
  categoria            VARCHAR(10) CHECK (categoria IN ('physical', 'special', 'status')),
  poder                SMALLINT,
  precisao             SMALLINT,
  pp                   SMALLINT,
  detalhes_carregados  BOOLEAN NOT NULL DEFAULT false,
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quais golpes cada Pokémon pode aprender
CREATE TABLE IF NOT EXISTS pokemon_golpes (
  pokemon_id  INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  golpe_id    INTEGER NOT NULL REFERENCES golpes(id),
  PRIMARY KEY (pokemon_id, golpe_id)
);

-- ─── Times dos usuários ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS times (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome           VARCHAR(50) NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_times_usuario ON times (usuario_id);

CREATE TABLE IF NOT EXISTS time_pokemon (
  id          SERIAL PRIMARY KEY,
  time_id     INTEGER  NOT NULL REFERENCES times(id) ON DELETE CASCADE,
  pokemon_id  INTEGER  NOT NULL REFERENCES pokemon(id),
  posicao     SMALLINT NOT NULL CHECK (posicao BETWEEN 1 AND 6),
  UNIQUE (time_id, posicao)
);

CREATE TABLE IF NOT EXISTS time_pokemon_golpes (
  time_pokemon_id  INTEGER  NOT NULL REFERENCES time_pokemon(id) ON DELETE CASCADE,
  golpe_id         INTEGER  NOT NULL REFERENCES golpes(id),
  slot             SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 4),
  PRIMARY KEY (time_pokemon_id, slot),
  UNIQUE (time_pokemon_id, golpe_id)
);
