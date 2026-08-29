# Bot da Pelada de Vôlei

[![CI](https://github.com/CV1tor/bot-pelada-wpp/actions/workflows/ci.yml/badge.svg)](https://github.com/CV1tor/bot-pelada-wpp/actions/workflows/ci.yml)

Bot para gerenciar uma pelada de vôlei em um grupo do WhatsApp. O backend recebe os eventos da Evolution API, executa comandos, persiste os dados em PostgreSQL e responde no mesmo grupo.

## Funcionalidades

- Lista de presença com inclusão, remoção e limpeza segura.
- Ranking que exige pelo menos três avaliações por jogador.
- Votação por enquete nativa do WhatsApp, com `!voto N` como fallback automático.
- Sorteio equilibrado por snake draft, considerando a média de cada jogador.
- Verificação de administrador diretamente nos metadados do grupo.
- Bloqueio de mensagens oriundas de outros grupos.

## Pré-requisitos

- Node.js 20 ou superior e pnpm 10 para desenvolvimento local.
- Docker com Docker Compose para executar o ambiente completo.

## Configuração

Crie o arquivo de ambiente e preencha todos os valores vazios:

```bash
cp .env.example .env
```

`WHATSAPP_GROUP_ID` deve conter o JID completo do grupo, por exemplo `120363000000000000@g.us`. `EVOLUTION_API_KEY` deve ser uma chave longa e aleatória. O mesmo arquivo configura o backend e a Evolution API.

### Variáveis do backend

| Variável                  | Obrigatória | Exemplo                                     | Finalidade                              |
| ------------------------- | ----------- | ------------------------------------------- | --------------------------------------- |
| `DATABASE_URL`            | sim         | `postgresql://user:password@db:5432/pelada` | conexão PostgreSQL do bot               |
| `EVOLUTION_API_URL`       | sim         | `http://evolution-api:8080`                 | URL interna ou pública da Evolution API |
| `EVOLUTION_API_KEY`       | sim         | valor aleatório longo                       | autenticação na Evolution API           |
| `EVOLUTION_INSTANCE_NAME` | sim         | `pelada-bot`                                | nome exato da instância pareada         |
| `WHATSAPP_GROUP_ID`       | sim         | `120363...@g.us`                            | único grupo autorizado                  |
| `PIX_KEY`                 | sim         | `pelada@exemplo.com`                        | chave retornada por `!pix`              |
| `PIX_NOME`                | sim         | `Organizador da Pelada`                     | titular retornado por `!pix`            |
| `PORT`                    | não         | `3000`                                      | porta HTTP, padrão 3000                 |

Se a Evolution API for implantada separadamente, configure nela PostgreSQL, Redis, `AUTHENTICATION_API_KEY`, persistência de atualizações de mensagem e um webhook global para `https://SEU_BACKEND/webhook`. Os eventos obrigatórios são `MESSAGES_UPSERT` e `MESSAGES_UPDATE`.

## Execução com Docker

```bash
docker compose up --build -d
docker compose logs -f backend evolution-api
```

O Compose inicia PostgreSQL, Redis, Evolution API e backend. Backend e Evolution usam schemas separados no mesmo PostgreSQL. As migrations do bot são aplicadas durante a inicialização do backend.

### Criar e parear a instância

Com os contêineres ativos, crie a instância cujo nome é o valor de `EVOLUTION_INSTANCE_NAME`:

```bash
curl -X POST http://localhost:8080/instance/create \
  -H 'Content-Type: application/json' \
  -H 'apikey: SUA_CHAVE' \
  -d '{"instanceName":"pelada-bot","integration":"WHATSAPP-BAILEYS","qrcode":true}'
```

Se o QR code não vier na criação, consulte-o:

```bash
curl -H 'apikey: SUA_CHAVE' http://localhost:8080/instance/connect/pelada-bot
```

Leia o QR code no WhatsApp em **Aparelhos conectados**. O Compose já direciona os eventos `MESSAGES_UPSERT` e `MESSAGES_UPDATE` para `http://backend:3000/webhook`; não é preciso configurar outro webhook na instância.

Para localizar o JID do grupo depois do pareamento:

```bash
curl -H 'apikey: SUA_CHAVE' \
  'http://localhost:8080/group/fetchAllGroups/pelada-bot?getParticipants=false'
```

Atualize `WHATSAPP_GROUP_ID` no `.env` e recrie o backend:

```bash
docker compose up -d --force-recreate backend
```

## Enquete nativa

`!votacao Nome` envia uma enquete com as opções de 1 a 5 estrelas, seleção única e duração de 3 dias. O bot persiste o ID e o `messageSecret` retornados. Atualizações que já tragam o nome da opção e atualizações binárias com o hash SHA-256 da opção são aceitas.

Se a criação da enquete falhar ou a versão instalada não entregar uma opção decodificável em `MESSAGES_UPDATE`, os participantes ainda podem votar com `!voto N`. Um jogador não pode se autoavaliar nem manter mais de um voto na mesma votação.

O ranking reflete as avaliações persistidas e passa a exibir o jogador a partir do primeiro voto.

## Comandos

Use `!ajuda` no grupo para obter a relação gerada dinamicamente. O MVP oferece:

- `!lista`
- `!adicionar [@contato | nome livre]`
- `!remover nome`
- `!limpar confirmar`
- `!ranking`
- `!votacao nome`
- `!encerrar-votacao`
- `!voto N`
- `!pix`
- `!sorteio [quantidade]`
- `!ajuda`

`!remover`, `!limpar`, `!sorteio`, `!votacao` e `!encerrar-votacao` exigem administrador do grupo.

Sem argumentos, `!adicionar` inclui quem enviou a mensagem; com um nome livre, como
`!adicionar José da Silva`, inclui um participante avulso.

## Desenvolvimento

```bash
pnpm install
pnpm prisma:generate
pnpm test
pnpm lint
pnpm build
```

Para executar localmente com infraestrutura externa:

```bash
pnpm prisma:migrate
pnpm dev
```

O endpoint `GET /health` retorna o estado básico do processo. O webhook está em `POST /webhook`.

## Integração e entrega contínuas

Pull requests direcionados para `main` executam formatação, lint, testes, build TypeScript, validação do schema Prisma e construção da imagem Docker.

Depois do merge na `main`, o semantic-release analisa os Conventional Commits:

- `fix:` incrementa a versão de correção;
- `feat:` incrementa a versão menor;
- `BREAKING CHANGE:` incrementa a versão maior;
- commits como `docs:`, `test:` e `chore:` não geram versão isoladamente.

Uma release válida cria a tag Git `vX.Y.Z`, publica a GitHub Release e envia a imagem para:

```text
ghcr.io/cv1tor/bot-pelada-wpp:X.Y.Z
ghcr.io/cv1tor/bot-pelada-wpp:X.Y
ghcr.io/cv1tor/bot-pelada-wpp:X
ghcr.io/cv1tor/bot-pelada-wpp:latest
```

Os workflows usam somente o `GITHUB_TOKEN` criado automaticamente pelo GitHub. No repositório, mantenha a permissão de Actions em **Read and write permissions** ou permita explicitamente que workflows criem releases e publiquem pacotes.
