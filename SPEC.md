# Bot de Gestão de Pelada de Vôlei — Especificação Técnica

> Este documento é a fonte de verdade do projeto. Deve ser lido integralmente antes de qualquer implementação. Siga as fases na ordem indicada na seção 12 — cada fase deve compilar, passar nos testes e ser commitada antes de avançar para a próxima.

## 1. Visão geral

Bot para um grupo de WhatsApp de pelada de vôlei, integrado via **Evolution API**. O bot escuta mensagens de um grupo específico, interpreta comandos prefixados com `!` e responde com informações sobre sessões, presença, pagamentos, ranking, estatísticas e sorteio de times equilibrados.

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
    encerrar-votacao.command.ts
    pix.command.ts
    sorteio.command.ts
    ajuda.command.ts
  services/
    lista.service.ts
    ranking.service.ts
    votacao.service.ts
    publicador-votacoes-expiradas.ts
    agendador-votacoes.ts
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
  id                 String   @id @default(uuid())
  data               DateTime
  valorTotalCentavos Int
  status             StatusSessao @default(ABERTA)
  chaveAberta        String?  @unique @default("ATIVA")
  encerradaEm        DateTime?

  participantes ListaParticipante[]
  times         Time[]
}

enum StatusSessao {
  ABERTA
  FECHADA
}

model ListaParticipante {
  id                String   @id @default(uuid())
  sessaoId          String
  playerId          String
  confirmadoEm      DateTime @default(now())
  canceladoEm       DateTime?
  presente          Boolean  @default(false)
  pagoEm            DateTime?
  valorPagoCentavos Int?

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
  pollMessageId     String?  // identifica a enquete nativa correspondente
  pollMessageSecret String?  // segredo retornado pela Evolution API ao criar a enquete
  sessaoId          String?
}

model ResumoMensalPublicado {
  competencia String   @id
  publicadoEm DateTime @default(now())
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

### `!abrir-pelada DD/MM/AAAA HH:mm VALOR`
- **Restrito a admin.**
- Cria a única sessão aberta, com data, horário e custo total em reais.
- Não há limite de participantes nem lista de espera.
- Recusa a operação quando já existir uma sessão aberta.

### `!encerrar-pelada confirmar`
- **Restrito a admin.**
- Encerra a sessão atual e consolida como presentes todos os jogadores que continuarem confirmados.
- Preserva participantes, pagamentos, times e avaliações para as estatísticas históricas.

### `!confirmar` / `!sair`
- Permitem que o autor confirme ou retire a própria presença.
- Ambos são idempotentes e não exigem permissão administrativa.
- Sair não apaga o cadastro, o histórico nem um pagamento já registrado.

### `!paguei`
- Registra imediatamente o pagamento do próprio jogador confirmado.
- O valor é o saldo restante dividido entre os participantes confirmados ainda pendentes.
- Entradas e saídas posteriores recalculam apenas as parcelas ainda não pagas.
- Repetir o comando não registra nem desconta um segundo pagamento.

### `!estatisticas [nome | @contato]`
- Sem argumento, consulta o autor; com argumento, consulta o jogador resolvido.
- Exibe somente peladas presentes, rating geral e sequência atual de presenças consecutivas.
- Apenas sessões encerradas são contabilizadas como presença.

### `!lista`
- **Descrição**: mostra a listagem atual de participantes confirmados na sessão aberta.
- **Args**: nenhum.
- **Comportamento**: busca a `Sessao` com status `ABERTA` e lista os participantes ativos ordenados por `confirmadoEm`, com data, valor, pagamento, parcela atual e saldo.
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
- **Descrição**: cancela todas as confirmações da sessão aberta atual sem apagar cadastros ou histórico anterior.
- **Confirmação**: pedir confirmação explícita (ex: responder `!limpar confirmar`) para evitar limpeza acidental.

### `!remover [nome]`
- **Restrito a admin.**
- **Args**: nome (texto livre, case-insensitive, aceita match parcial).
- **Comportamento**: busca participante da sessão aberta cujo nome combina com o argumento. Se houver mais de um match, lista as opções e pede para o usuário ser mais específico.

### `!ranking`
- **Descrição**: mostra os jogadores ordenados pela média de estrelas recebidas a partir da primeira avaliação.
- **Resposta exemplo**:
  ```
  🏆 Ranking da pelada:
  1. Pedro ⭐ 4.8 (12 avaliações)
  2. João ⭐ 4.5 (10 avaliações)
  ```

### `!votacao [nome | todos]`
- **Descrição**: abre uma enquete nativa do WhatsApp, de 1 a 5 estrelas, para o jogador informado. Com `todos`, abre uma enquete para cada jogador confirmado na lista da pelada aberta.
- Sem argumentos, tem o mesmo comportamento de `!votacao todos`.
- A abertura para todos preserva votações que já estejam ativas e continua processando os demais jogadores quando uma enquete falha.
- Resolve o `Player` pelo nome e chama `POST /message/sendPoll/{instance}` com as opções `["1 ⭐", "2 ⭐", "3 ⭐", "4 ⭐", "5 ⭐"]` e `selectableCount: 1`.
- A votação expira 24 horas após sua criação. Um agendador verifica expirações a cada minuto, consolida as avaliações e publica o resultado.
- O fluxo é exclusivamente nativo: se a Evolution API não criar a enquete, a votação é cancelada e nenhum comando textual alternativo é disponibilizado.
- Persistir `pollMessageId` e `pollMessageSecret`. Eventos `MESSAGES_UPDATE` são correlacionados pelo ID da enquete e podem trazer opções agregadas no formato `{ name, voters[] }`.
- Várias votações de jogadores diferentes podem permanecer abertas simultaneamente. Não pode existir mais de uma votação aberta para o mesmo jogador na mesma pelada.
- Um jogador não pode se autoavaliar. Uma nova seleção na mesma enquete substitui sua seleção anterior.
- O prazo é controlado pelo backend; caso a enquete continue visualmente aberta no WhatsApp, votos recebidos depois da expiração são ignorados.

### `!encerrar-votacao [nome | todas]`
- **Restrito a admin.**
- Encerra antecipadamente a votação ativa do jogador informado e publica o resultado consolidado.
- Com `todas`, encerra todas as votações ativas do grupo e publica o resultado consolidado de cada jogador.
- Sem argumentos, tem o mesmo comportamento de `!encerrar-votacao todas`.

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

## 8. Funcionalidades complementares

| Comando | Função |
|---|---|
| `!proximo` | data/local do próximo jogo (config estática) |
| `!local` | endereço fixo da quadra |
| `!historico` | lista sessões anteriores e participantes |
| `!time [numero]` | reenvia composição de um time específico |
| `!trocar [nome1] [nome2]` | troca dois jogadores entre times já sorteados |
| `!regras` | texto fixo com as regras da pelada |
| `!encerrar-votacao [nome \| todas]` | encerra uma enquete ou todas as ativas e publica os resultados |

## 9. Regras de negócio transversais

- **Admin do grupo**: antes de executar comandos restritos, consultar os metadados do grupo via Evolution API (`GET /group/participants/{instance}`) e verificar se o `jid` do remetente tem papel `admin` ou `superadmin`. Se não for admin, responder com mensagem de permissão negada — nunca falhar silenciosamente.
- **Sessão aberta**: deve sempre existir no máximo uma `Sessao` com status `ABERTA`. Comandos como `!lista`, `!adicionar`, `!sorteio` operam sempre sobre ela.
- **Presença**: confirmação só se transforma em presença quando a sessão é encerrada.
- **Pagamento**: o custo total é fixado na abertura; os valores já pagos são imutáveis e o saldo é redistribuído apenas entre confirmados pendentes.
- **Resumo mensal**: a cada hora, o processo tenta publicar uma única vez o resumo do mês anterior. Votações ainda válidas adiam a publicação.
- **Resolução de nome por texto livre**: centralizar em uma função utilitária (`resolvePlayerByName`) usada por `!remover`, `!votacao`, `!time`, `!trocar` — normaliza acentos/maiúsculas e faz match parcial.
- **Votações simultâneas**: jogadores diferentes podem ter enquetes abertas ao mesmo tempo; a combinação pelada+jogador deve ser única enquanto a votação estiver aberta.
- **Idempotência de voto**: existe uma avaliação por votante em cada enquete; alterações na seleção atualizam essa avaliação.

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
7. **Ranking e votação nativa**: `!ranking`, `!votacao` e `!encerrar-votacao` — incluindo correlação pelo ID da enquete, votações simultâneas e expiração em 24 horas.
8. **Sorteio**: `!sorteio` com o algoritmo de snake draft e persistência dos times.
9. **Testes de integração**: simular payloads de webhook reais da Evolution API para cada comando.
10. **Deploy**: finalizar Docker Compose, documentar passo a passo de configuração da instância na Evolution API (criar instância, parear QR code, configurar webhook apontando para o backend).
11. **Fase 2 (backlog)**: implementar comandos da seção 8 conforme prioridade do time.
12. **Validação ponta a ponta**: capturar um evento real de resposta de enquete da versão implantada da Evolution API e mantê-lo como fixture de integração.

## 13. Critérios de aceite

- Todo comando tem pelo menos um teste unitário do handler e um teste de service quando houver lógica de negócio.
- Nenhum comando restrito a admin deve ser executável por não-admin, mesmo com payload manipulado.
- O bot não deve responder a mensagens fora do `WHATSAPP_GROUP_ID` configurado.
- `!sorteio` deve produzir times com diferença de soma de rating menor ou igual à diferença do maior rating individual (garantindo equilíbrio razoável).
- A falha ao criar uma enquete não deve deixar votação ativa nem habilitar votação por texto.
- Votações simultâneas devem ser correlacionadas exclusivamente pelo ID da enquete correspondente.
- `docker compose up` sobe o ambiente completo (db + evolution-api + backend) sem passos manuais além de preencher o `.env`.
