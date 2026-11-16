# Landing do Kimi

Página de apresentação em Vite + TypeScript, sem framework (mesmo padrão de `web/tv`). Estrutura inspirada no site do BJJ Control (faixa de números, passos, grid numerado, depoimentos, planos, perguntas), com o visual escuro do DESIGN-SYSTEM.

## Rodar localmente

```sh
cd web/landing
cp .env.example .env.local   # preencha com a URL e a chave anon/publishable do Supabase
npm install
npm run dev                  # http://localhost:5175
```

## Deploy

Projeto estático com raiz `web/landing`, comando `npm ci && npm run build`, saída `dist`, com as duas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas no hosting. É independente de `web/tv` e `web/admin`.

## Planos

A seção de planos (`src/plans.ts`) chama `public.list_public_plans()`: os mesmos planos à venda do cadastro do app, editados no admin, com alternância mensal/anual. A chave anon é pública por natureza; a landing só tem acesso a essa função, liberada para anônimo pela migration `20261116030000_public_plans_for_landing`. Sem as variáveis, a seção mostra "Os planos estarão disponíveis em breve."

## Antes de publicar

- Trocar os textos `[PREENCHER]`, `[NOME]` e `[ACADEMIA · MODALIDADE]` (faixa de números e depoimentos) no `index.html`. Ficam com contorno amarelo tracejado (classe `placeholder`) para não passarem despercebidos; tire a classe ao preencher.
- Os botões "Em breve nas lojas" não têm link; troque pelos links das lojas quando o app estiver publicado.

`tokens.css` é gerado de `tokens.json` por `npm run tokens` (na raiz do repositório); não edite esse arquivo à mão. As fontes estão sob OFL (licenças em `assets/fonts/`).
