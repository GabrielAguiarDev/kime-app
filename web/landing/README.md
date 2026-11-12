# Landing do Kimi

Página estática, sem dependências ou variáveis de ambiente. Usa apenas recursos já presentes no app. Os links de download serão adicionados quando as páginas nas lojas estiverem disponíveis.

Para ver localmente, a partir da raiz do repositório:

```sh
cd web/landing
python3 -m http.server 4173
```

Abra `http://localhost:4173`. Para publicar, configure `web/landing` como raiz do hosting estático. Não há comando de build nem artefato `dist`. O deploy é independente de `web/tv`.

`tokens.css` é gerado de `tokens.json` por `npm run tokens`; não edite esse arquivo à mão. As fontes estão sob OFL (licenças em `assets/fonts/`).
