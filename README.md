# Dash Imports — site próprio (sem Nuvemshop)

Recriação do site, feita em código puro (Node.js + Express no back-end,
HTML/CSS/JS sem framework no front-end). Sem mensalidade de plataforma,
sem vendor lock-in.

## O que já funciona de verdade

- **Catálogo**: 68 produtos extraídos do seu site (nome, preço, desconto,
  tamanhos, cores, imagem), servidos por uma API própria.
- **Carrinho**: guardado no servidor (não é só localStorage), com
  validação de estoque real a cada item adicionado.
- **Frete**: estimativa por região de CEP + regra de frete grátis acima de
  R$160 (igual ao site original). Não é a tabela oficial dos Correios —
  veja "Próximos passos" abaixo para conectar uma API de verdade.
- **Checkout**: formulário de endereço/contato, cálculo de frete,
  criação do pedido no banco com baixa de estoque, e tela de confirmação.
- **Pagamento**: como você ainda não tem gateway configurado, o pedido é
  criado com status "aguardando pagamento" e instruções de pagamento via
  Pix/WhatsApp. Está pronto pra virar Mercado Pago automático — veja abaixo.

## Estrutura do projeto

```
backend/
  server.js              servidor Express
  db/store.js             "banco de dados" (arquivos JSON em backend/data)
  services/shipping.js    cálculo de frete (estimativa por CEP)
  services/payment.js     ponto de integração com Mercado Pago
  routes/                 rotas da API (produtos, carrinho, checkout)
  data/products.json      catálogo extraído do seu site
  public/                 todo o front-end (HTML/CSS/JS), servido como
                           arquivos estáticos pelo Express
```

## Rodando localmente

```bash
cd backend
npm install
cp .env.example .env      # opcional por enquanto
npm start
```

Acesse http://localhost:3000

## Banco de dados

Para manter a entrega simples e fácil de rodar em qualquer lugar, os dados
ficam em arquivos JSON (`backend/data/*.json`), sem precisar instalar nem
configurar um banco de dados de verdade. Isso é suficiente pra uma loja
pequena/média, mas tem dois limites importantes:

1. **Não tem trava de concorrência de verdade.** Se dois pedidos chegarem
   no exato mesmo milissegundo, existe uma chance pequena de um sobrescrever
   o outro. Para o volume normal de uma loja não é um problema real, mas
   não é o ideal para alta concorrência.
2. **Não funciona na Vercel.** Funções serverless da Vercel têm sistema de
   arquivos efêmero — os dados seriam perdidos a cada novo deploy/reinício.
   **Railway ou um VPS funcionam bem** (disco persistente normal). Se ainda
   assim quiser usar Vercel, troque `db/store.js` por um banco externo
   (Postgres no Neon/Supabase, por exemplo, ambos têm plano gratuito) —
   as outras partes do código não precisam mudar, só essa camada.

## Como publicar

### Railway / VPS (recomendado, é o que você já escolheu)
1. Suba a pasta `backend/` num repositório Git.
2. Na Railway: "New Project" → "Deploy from GitHub" → selecione o repo.
   Configure a variável `PORT` se necessário (a Railway geralmente define
   sozinha) e as variáveis do `.env.example` que quiser usar.
3. Em VPS: instale Node 18+, copie os arquivos, `npm install`, configure
   um processo permanente (pm2, systemd ou similar) executando `npm start`,
   e um proxy reverso (nginx) com HTTPS na frente.

## Conectando pagamento de verdade (Mercado Pago)

1. Crie uma conta em https://www.mercadopago.com.br/developers
2. Gere um **Access Token** de produção.
3. No servidor, defina a variável de ambiente `MP_ACCESS_TOKEN`.
4. Pronto — `services/payment.js` detecta a variável automaticamente e o
   checkout passa a criar uma cobrança real, redirecionando o cliente pro
   checkout do Mercado Pago. Nenhum outro arquivo precisa mudar.

Sem essa variável, o site continua funcionando normalmente no modo manual
(pedido registrado + combinação de pagamento via Pix/WhatsApp).

## Conectando frete de verdade

Hoje `services/shipping.js` faz uma estimativa simplificada por região do
CEP. Quando você tiver:

- **Melhor Envio** (mais fácil de integrar, tem free tier): crie conta em
  https://melhorenvio.com.br, gere um token, e troque o corpo da função
  `estimateShipping` por uma chamada à API deles (cálculo de frete por
  CEP de origem/destino e dimensões do produto).
- **Correios direto**: exige contrato comercial (cartão de postagem) — mais
  burocrático, mas pode ser mais barato em volume alto.

A assinatura da função (`estimateShipping(cep, subtotal)` devolvendo
`{cost, days, free, ...}`) foi pensada pra você só trocar o conteúdo sem
precisar tocar no resto do site.

## Sobre as imagens dos produtos

As imagens continuam apontando para o CDN da Nuvemshop
(`acdn-us.mitiendanube.com/.../002/561/208/...`), que é o seu próprio
espaço de armazenamento — elas devem continuar funcionando enquanto sua
loja Nuvemshop permanecer ativa nesse plano. Se algum dia cancelar a
Nuvemshop por completo, baixe as imagens antes e troque os links em
`backend/data/products.json` para apontar para seu próprio storage
(ex.: um bucket S3/Cloudflare R2, ou a pasta `public/img` deste projeto).

## Visual / identidade

Não consegui carregar o CSS nem as imagens do tema original neste ambiente
(o arquivo que você enviou trazia só o `<body>`, sem `<head>`/CSS, e eu não
tenho acesso para abrir imagens). Por isso desenhei uma identidade visual
nova — preto/branco com vermelho de impacto, tipografia bem marcada — no
estilo do nicho de tênis/streetwear. As cores estão centralizadas em
variáveis no topo de `public/css/style.css` (`--accent`, `--ink`, etc.),
então é rápido trocar pra bater 100% com sua marca real depois.

## Adicionando/editando produtos

Edite `backend/data/products.json` diretamente (cada produto tem nome,
preço, `compare_at_price`, tamanhos, cores, imagem e estoque por tamanho).
Não tem painel administrativo nesta versão — se isso for importante pro
seu dia a dia, é o próximo passo natural a construir.

## Limitações conhecidas (pra você decidir prioridades)

- Sem painel admin (editar produtos = editar o JSON manualmente).
- Sem e-mail transacional (confirmação de pedido só aparece na tela e
  pode ser reenviada por você via WhatsApp).
- Frete e pagamento em modo "estimativa/manual" até você plugar as APIs
  reais, como descrito acima.
- Banco em arquivo JSON — ok para começar, recomendo migrar para Postgres
  se o volume de pedidos crescer.
