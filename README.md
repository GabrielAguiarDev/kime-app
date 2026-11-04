# Kimi

App mobile para academias de artes marciais: horários e check-in, progressão de faixa, hidratação com widget interativo e área de competidores. Também é um estudo de widgets nativos (iOS WidgetKit e Android Glance).

- **App:** Expo SDK 58 (dev client / prebuild), Expo Router, TypeScript strict, restyle e react-query
- **Backend:** Supabase (Auth, Postgres, RLS), rodando localmente com o CLI e Docker
- **Contexto de desenvolvimento, decisões e fases:** [`DEVELOPMENT.md`](./DEVELOPMENT.md)

## Requisitos

- Node 22+ e npm
- Docker em execução (para o Supabase local)
- Supabase CLI: `brew install supabase/tap/supabase`
  - Não fica no `package.json`, porque o pacote npm entra em conflito de peer deps com o `expo-router`.
- iOS: Xcode 26+ e simulador
- Android: Android Studio, SDK e emulador

## Rodando

```bash
npm install

# 1. Backend local (aplica as migrations de supabase/migrations)
npm run db:start            # = supabase start; anote a PUBLISHABLE_KEY

# 2. Variáveis do app
cp .env.example .env  # preencha URL e publishable key do projeto
                            # (veja `supabase status`)

# 3. App (o projeto usa módulos nativos, então não roda no Expo Go)
npm run ios                 # = expo run:ios     (prebuild + build + instala)
npm run android             # = expo run:android
npm start                   # só o Metro, para um dev client já instalado
```

> No emulador Android, `127.0.0.1` é o próprio emulador. Use `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321`.

As pastas `ios/` e `android/` são geradas pelo `expo prebuild` e não são versionadas. Toda configuração nativa fica no `app.json` e em config plugins.

## Banco de dados e migrations

| Comando | O que faz |
| --- | --- |
| `npm run db:start` | Sobe o stack local (Postgres, Auth, Studio em http://127.0.0.1:54323, Mailpit em http://127.0.0.1:54324) |
| `supabase migration new <nome>` | Cria uma migration em `supabase/migrations/` |
| `npm run db:reset` | Recria o banco do zero aplicando todas as migrations |
| `npm run db:test` | Roda os testes pgTAP de RLS/RPC (`supabase/tests/database/`) |
| `npm run db:types` | Regenera `types/database.ts` a partir do projeto hospedado |

Regras de segurança do schema (detalhes em `DEVELOPMENT.md`):

- **RLS em todas as tabelas.** Ninguém lê dados de uma academia à qual não está vinculado.
- **Negar por padrão.** A migration de fundação revoga os grants automáticos do Supabase, então toda tabela ou função nova precisa de `grant` explícito.
- **Vínculos só por RPC.** Escritas em vínculos acontecem pelas RPCs `create_gym`, `request_membership`, `decide_membership`, `remove_membership` e `rotate_invite`, nunca por acesso direto à tabela.

## Contas de teste (só desenvolvimento)

Só no banco **local**: o `supabase/seed.sql` roda a cada `npm run db:reset` e cria duas contas ativas na academia **Kimi Jiu-Jitsu (Teste)**. Elas não existem no projeto hospedado; lá, use o cadastro real.

| Papel | E-mail | Senha |
| --- | --- | --- |
| Proprietário (owner) | `dono@kimi.dev` | `kimi12345` |
| Professor | `professor@kimi.dev` | `kimi12345` |
| Aluno | `aluno@kimi.dev` | `kimi12345` |

Códigos do seed: aluno `KMJJ2526`, professor `PRF2526K` (uso único, vale 7 dias a partir do `db reset`).

## Testes

```bash
npm test           # unit (jest-expo): regras de domínio
npm run db:test    # pgTAP: RLS e RPCs
npm run typecheck
npm run lint
```

## Códigos de entrada (deep link)

- **Código de aluno:** fixo por academia, com 8 caracteres e sem 0/O/1/I/L. Só o owner gera um novo, e os pedidos já enviados continuam valendo.
- **Código de professor:** uso único, vale 7 dias. Só o owner gera, vê e revoga.
- **Entrada:** quem digita o código vê o card da academia (logo + nome) antes do login (`lookup_invite_code`, a única função liberada para `anon`). Depois cria a conta ou entra, e o pedido fica pendente até a aprovação. Pedido de professor só o owner aprova.
- **Compartilhar:** a mensagem leva o nome da academia, o código escrito e o link `kimi://entrar?codigo=XXXXXXXX`, que abre direto na confirmação.

Para testar no simulador:

```bash
xcrun simctl openurl booted "kimi://entrar?codigo=KMJJ2526"
adb shell am start -a android.intent.action.VIEW -d "kimi://entrar?codigo=KMJJ2526"
```

## Login social

E-mail e senha funcionam direto no Supabase local. Os provedores sociais precisam de credenciais:

- **Apple:** o código já existe (`expo-apple-authentication` + `signInWithIdToken`). Falta:
  - habilitar `[auth.external.apple]` em `supabase/config.toml` com o bundle id `br.com.kimi.app` em `client_id`;
  - assinar o app com um time que tenha o capability *Sign in with Apple*.
- **Google:** pendente. Depende do client ID iOS/Android/Web do Google Cloud.

## Widgets

Chegam nas fases 3 (água) e 4 (contagem regressiva). Esta seção vai documentar o target iOS (WidgetKit + App Group) e o Android (Glance).
