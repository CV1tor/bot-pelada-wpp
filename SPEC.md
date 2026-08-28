# Bot de Gestão de Pelada de Vôlei — Especificação Técnica

> Este documento é a fonte de verdade do projeto. Deve ser lido integralmente antes de qualquer implementação. Siga as fases na ordem indicada na seção 12 — cada fase deve compilar, passar nos testes e ser commitada antes de avançar para a próxima.

## 1. Visão geral

Bot para um grupo de WhatsApp de pelada de vôlei, integrado via **Evolution API**. O bot escuta mensagens de um grupo específico, interpreta comandos prefixados com `!` e responde com informações sobre a lista de presença, ranking de jogadores, sorteio de times equilibrados e dados administrativos (pix, local, etc).

Não há interface visual — toda a interação acontece por texto dentro do grupo do WhatsApp.

## 2. Objetivo do MVP

Implementar os 8 comandos essenciais com persistência de dados, e deixar a base pronta para expansão dos comandos administrativos extras (fase 2).

## 3. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript |
| Runtime | Node.js 20+ |
| Framework HTTP | Fastify |
| ORM | Prisma |
| Banco de dados | PostgreSQL 16 |
| Integração WhatsApp | Evolution API (self-hosted, via Docker) |
| Testes | Vitest |
| Lint/format | ESLint + Prettier |
| Deploy | Docker Compose |

Não usar frameworks de bot genéricos (ex: whatsapp-web.js) — toda comunicação com o WhatsApp passa exclusivamente pela Evolution API (REST + webhook).

## 4. Arquitetura

```
Grupo WhatsApp
      │  mensagem "!comando"
      ▼
Evolution API  ──── webhook POST ───▶  Backend (Fastify)
      ▲                                     │
      │        resposta via REST            ▼
      └─────────────────────────────  Command Dispatcher
                                             │
                                             ▼
                                     Services (regras de negócio)
                                             │
                                             ▼
                                   PostgreSQL (via Prisma)
```

- A Evolution API envia um evento `MESSAGES_UPSERT` via webhook para `POST /webhook`.
- O backend identifica se a mensagem começa com `!`, extrai comando + argumentos, e roteia para o handler correspondente via **Command Dispatcher** (padrão command pattern).
- O handler executa a lógica de negócio (service), acessa o banco se necessário, e monta a resposta.
- A resposta é enviada de volta ao grupo via chamada REST `POST /message/sendText/{instance}` da Evolution API.

## 5. Estrutura de pastas

```
src/
  server.ts                  # bootstrap do Fastify
  webhook/
    webhook.controller.ts    # recebe eventos da Evolution API
    webhook.schema.ts        # validação do payload recebido
  commands/
    dispatcher.ts            # roteia !comando -> handler
    lista.command.ts
    adicionar.command.ts
    limpar.command.ts
    remover.command.ts
    ranking.command.ts
    votacao.command.ts
    voto.command.ts           # sub-handler usado durante uma votação ativa
    pix.command.ts
    sorteio.command.ts
    ajuda.command.ts
  services/
    lista.service.ts
    ranking.service.ts
    votacao.service.ts
    sorteio.service.ts
  integrations/
    evolution-api.client.ts   # wrapper de chamadas REST à Evolution API
  repositories/
    player.repository.ts
    sessao.repository.ts
    avaliacao.repository.ts
    votacao.repository.ts
  models/
    types.ts                  # tipos compartilhados (CommandContext, etc)
  utils/
    permissions.ts            # checagem de admin do grupo
    logger.ts
prisma/
  schema.prisma
  migrations/
test/
  commands/
  services/
docker-compose.yml
.env.example
```

## 6. Modelo de dados (Prisma)

```prisma
model Player {
  id          String   @id @default(uuid())
  jid         String   @unique   // identificador do WhatsApp (ex: 5511999999999@s.whatsapp.net)
  nome        String
  createdAt   DateTime @default(now())

  participacoes  ListaParticipante[]
  avaliacoesFeitas    Avaliacao[] @relation("avaliador")
  avaliacoesRecebidas Avaliacao[] @relation("avaliado")
}

model Sessao {
  id          String   @id @default(uuid())
  data        DateTime @default(now())
  status      StatusSessao @default(ABERTA)

  participantes ListaParticipante[]
  times         Time[]
}

enum StatusSessao {
  ABERTA
  FECHADA
}

model ListaParticipante {
  id          String   @id @default(uuid())
  sessaoId    String
  playerId    String
  confirmadoEm DateTime @default(now())

  sessao      Sessao   @relation(fields: [sessaoId], references: [id])
  player      Player   @relation(fields: [playerId], references: [id])

  @@unique([sessaoId, playerId])
}

model Avaliacao {
  id           String   @id @default(uuid())
  avaliadorId  String
  avaliadoId   String
  estrelas     Int      // 1 a 5
  createdAt    DateTime @default(now())

  avaliador    Player   @relation("avaliador", fields: [avaliadorId], references: [id])
  avaliado     Player   @relation("avaliado", fields: [avaliadoId], references: [id])

  @@unique([avaliadorId, avaliadoId, createdAt])
}

model VotacaoAtiva {
  id                String   @id @default(uuid())
  playerId          String   // jogador sendo avaliado
  iniciadaEm        DateTime @default(now())
  expiraEm          DateTime
  fechada           Boolean  @default(false)
  pollMessageId     String?  // preenchido somente se a Fase 2 (enquete nativa) estiver ativa
  pollMessageSecret String?  // necessário para decifrar os votos da enquete nativa (ver seção 7)
}

model Time {
  id          String   @id @default(uuid())
  sessaoId    String
  numero      Int
  jogadores   String[] // array de playerIds

  sessao      Sessao   @relation(fields: [sessaoId], references: [id])
}
```

## 7. Especificação dos comandos

Convenção geral: comandos que alteram estado (`!limpar`, `!remover`, `!sorteio`) exigem que o remetente seja **admin do grupo** (ver seção 9). Todo comando deve responder no próprio grupo, mencionando o autor quando fizer sentido.

### `!lista`
- **Descrição**: mostra a listagem atual de participantes confirmados na sessão aberta.
- **Args**: nenhum.
- **Comportamento**: busca a `Sessao` com status `ABERTA` (cria uma nova se não existir nenhuma aberta) e lista os `ListaParticipante` ordenados por `confirmadoEm`.
- **Resposta exemplo**:
  ```
  📋 Lista da pelada (7 confirmados):
  1. João
  2. Maria
  3. Pedro
  ...
  ```

### `!adicionar`
- **Descrição**: adiciona o autor da mensagem, um contato mencionado ou um nome livre à lista atual.
- **Args**: opcional — se vier `!adicionar @contato`, usa o contato mencionado; se vier `!adicionar Nome Livre`, cria um participante avulso; sem argumentos, usa quem enviou a mensagem.
- **Comportamento**: extrai o `jid` e `pushName` via payload da Evolution API para contatos ou gera uma identidade interna estável para nomes livres, faz upsert do `Player` e cria `ListaParticipante` vinculado à sessão aberta. Se já estiver na lista, responde avisando duplicidade em vez de erro.

### `!limpar`
- **Restrito a admin.**
- **Descrição**: limpa todos os participantes da sessão aberta atual (não apaga histórico, apenas remove os `ListaParticipante` da sessão vigente).
- **Confirmação**: pedir confirmação explícita (ex: responder `!limpar confirmar`) para evitar limpeza acidental.

### `!remover [nome]`
- **Restrito a admin.**
- **Args**: nome (texto livre, case-insensitive, aceita match parcial).
- **Comportamento**: busca participante da sessão aberta cujo nome combina com o argumento. Se houver mais de um match, lista as opções e pede para o usuário ser mais específico.

### `!ranking`
- **Descrição**: mostra os jogadores ordenados pela média de estrelas recebidas (mínimo de 3 avaliações para entrar no ranking, para evitar distorção).
- **Resposta exemplo**:
  ```
  🏆 Ranking da pelada:
  1. Pedro ⭐ 4.8 (12 avaliações)
  2. João ⭐ 4.5 (10 avaliações)
  ```

### `!votacao [nome]`
- **Descrição**: abre uma votação de 1 a 5 estrelas para o jogador informado.
- **Implementação em duas fases** — construir a Fase 1 primeiro; só avançar para a Fase 2 depois de validar o pré-requisito descrito nela (ver roadmap, seção 12).

**Fase 1 — MVP via texto (`!voto N`)**
  1. Resolve o `Player` pelo nome (mesmo matching do `!remover`).
  2. Cria um registro em `VotacaoAtiva` com `expiraEm = now + 10min`.
  3. Publica no grupo: `Vote de 1 a 5 estrelas para {nome} respondendo "!voto N" até {hora}`.
  4. Enquanto a votação estiver ativa, o dispatcher intercepta mensagens `!voto N` de qualquer participante e grava uma `Avaliacao` (uma por avaliador por votação — usar chave de idempotência avaliador+avaliado+janela de tempo).
  5. Ao expirar (checado a cada novo evento recebido, ou via job agendado), marca `fechada = true` e publica o resultado consolidado.
- **Validações**: `N` deve ser inteiro entre 1 e 5; um jogador não pode votar em si mesmo.

**Fase 2 — Enquete nativa do WhatsApp (opcional, pós-validação)**
- Substituir o passo 3 por uma chamada `POST /message/sendPoll/{instance}` com as opções `["1 ⭐", "2 ⭐", "3 ⭐", "4 ⭐", "5 ⭐"]` e `selectableCount: 1`.
- **Pré-requisito obrigatório antes de migrar**: confirmar, na versão da Evolution API em uso, que o webhook entrega o evento de atualização da enquete (`messages.update` / `POLLS_UPDATE`) já com os votos decifrados — ou implementar a decriptação manualmente a partir do `messageSecret` retornado na criação da enquete. Enquetes do WhatsApp são E2E-criptografadas; sem esse dado não é possível saber quem votou em quê.
- Persistir `pollMessageId` e `pollMessageSecret` no registro de `VotacaoAtiva` no momento da criação da enquete — são necessários para decifrar as atualizações de voto recebidas depois.
- Manter o fluxo por texto (`!voto N`) como fallback automático caso a decriptação da enquete falhe ou não esteja disponível na versão instalada da Evolution API.

### `!pix`
- **Descrição**: envia a chave pix da pelada (valor fixo, configurável via variável de ambiente `PIX_KEY` e `PIX_NOME`).

### `!sorteio`
- **Restrito a admin.**
- **Descrição**: sorteia times equilibrados com base na média de estrelas de cada participante da sessão aberta.
- **Algoritmo**:
  1. Buscar todos os participantes da sessão aberta com sua média de estrelas (jogadores sem avaliação entram com média neutra, ex: 3.0).
  2. Ordenar decrescente por média.
  3. Definir número de times (`!sorteio [numero_de_times]`, default 2).
  4. Distribuir em **snake draft**: time 1, time 2, time 2, time 1, time 1, time 2... — alternando o sentido a cada volta.
  5. Persistir em `Time` vinculado à sessão.
- **Resposta exemplo**:
  ```
  🏐 Times sorteados:
  Time 1: João, Pedro, Ana
  Time 2: Maria, Lucas, Bia
  ```

### `!ajuda`
- **Descrição**: lista todos os comandos disponíveis com uma linha de descrição cada. Deve ser gerado dinamicamente a partir do registro de comandos no dispatcher (evitar lista hardcoded que desatualiza).

## 8. Comandos de fase 2 (backlog, não bloqueiam o MVP)

| Comando | Função |
|---|---|
| `!confirmar` / `!sair` | jogador se adiciona/remove sozinho da lista |
| `!vagas` | mostra vagas restantes se houver limite configurado |
| `!proximo` | data/local do próximo jogo (config estática) |
| `!local` | endereço fixo da quadra |
| `!estatisticas [nome]` | histórico individual: jogos, presença, média |
| `!historico` | lista sessões anteriores e participantes |
| `!time [numero]` | reenvia composição de um time específico |
| `!trocar [nome1] [nome2]` | troca dois jogadores entre times já sorteados |
| `!pagamento [nome]` | marca jogador como pago na sessão |
| `!inadimplentes` | lista quem não marcou pagamento |
| `!regras` | texto fixo com as regras da pelada |
| `!votacao` (fase 2) | migrar de `!voto N` por texto para enquete nativa do WhatsApp, após validar suporte a decriptação de votos na versão da Evolution API em uso (ver seção 7) |

## 9. Regras de negócio transversais

- **Admin do grupo**: antes de executar comandos restritos, consultar os metadados do grupo via Evolution API (`GET /group/participants/{instance}`) e verificar se o `jid` do remetente tem papel `admin` ou `superadmin`. Se não for admin, responder com mensagem de permissão negada — nunca falhar silenciosamente.
- **Sessão aberta**: deve sempre existir no máximo uma `Sessao` com status `ABERTA`. Comandos como `!lista`, `!adicionar`, `!sorteio` operam sempre sobre ela.
- **Resolução de nome por texto livre**: centralizar em uma função utilitária (`resolvePlayerByName`) usada por `!remover`, `!votacao`, `!time`, `!trocar` — normaliza acentos/maiúsculas e faz match parcial.
- **Idempotência de voto**: um jogador não pode votar duas vezes na mesma votação ativa.

## 10. Variáveis de ambiente (`.env.example`)

```
DATABASE_URL=postgresql://user:password@db:5432/pelada
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE_NAME=pelada-bot
WHATSAPP_GROUP_ID=              # ID do grupo autorizado a usar o bot
PIX_KEY=
PIX_NOME=
PORT=3000
```

## 11. Docker Compose (esqueleto)

```yaml
version: "3.8"
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: pelada
    volumes:
      - db_data:/var/lib/postgresql/data

  evolution-api:
    image: atendai/evolution-api:latest
    ports:
      - "8080:8080"
    environment:
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}

  backend:
    build: .
    depends_on:
      - db
      - evolution-api
    env_file: .env
    ports:
      - "3000:3000"

volumes:
  db_data:
```

## 12. Roadmap de implementação (seguir em ordem)

1. **Setup do projeto**: inicializar Node + TypeScript + Fastify + ESLint/Prettier + Vitest. Configurar `tsconfig.json` estrito.
2. **Banco de dados**: escrever `schema.prisma` (seção 6), rodar a primeira migration, subir Postgres via Docker Compose.
3. **Integração Evolution API**: criar `evolution-api.client.ts` com métodos `sendText`, `getGroupParticipants`. Configurar recebimento do webhook (`POST /webhook`) e validar payload.
4. **Dispatcher de comandos**: implementar o roteamento genérico `!comando arg1 arg2` → handler, com testes unitários cobrindo parsing de comando e argumentos.
5. **Comandos de leitura**: `!lista`, `!ajuda`, `!pix` (sem efeitos colaterais, bons para validar o pipeline ponta a ponta).
6. **Comandos de escrita simples**: `!adicionar`, `!remover`, `!limpar` (com checagem de admin).
7. **Ranking e votação (Fase 1 — texto)**: `!ranking`, `!votacao`, `!voto` — incluindo o mecanismo de sessão de votação com expiração. Usar exclusivamente o fluxo por texto (`!voto N`) nesta etapa.
8. **Sorteio**: `!sorteio` com o algoritmo de snake draft e persistência dos times.
9. **Testes de integração**: simular payloads de webhook reais da Evolution API para cada comando.
10. **Deploy**: finalizar Docker Compose, documentar passo a passo de configuração da instância na Evolution API (criar instância, parear QR code, configurar webhook apontando para o backend).
11. **Fase 2 (backlog)**: implementar comandos da seção 8 conforme prioridade do time.
12. **Votação — Fase 2 (opcional)**: só iniciar após o item 11. Validar em ambiente de teste se a versão da Evolution API entrega votos de enquete decifrados no webhook; em caso positivo, migrar `!votacao` para `sendPoll` conforme especificado na seção 7, mantendo o texto como fallback.

## 13. Critérios de aceite

- Todo comando tem pelo menos um teste unitário do handler e um teste de service quando houver lógica de negócio.
- Nenhum comando restrito a admin deve ser executável por não-admin, mesmo com payload manipulado.
- O bot não deve responder a mensagens fora do `WHATSAPP_GROUP_ID` configurado.
- `!sorteio` deve produzir times com diferença de soma de rating menor ou igual à diferença do maior rating individual (garantindo equilíbrio razoável).
- `docker compose up` sobe o ambiente completo (db + evolution-api + backend) sem passos manuais além de preencher o `.env`.
