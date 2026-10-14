/**
 * Serviço de pagamento.
 *
 * Você ainda não tem conta em gateway nenhum, então por padrão o checkout
 * roda no modo "manual": o pedido é criado no banco com status
 * "aguardando_pagamento" e o cliente recebe instruções de pagamento via Pix
 * (chave que você configurar) ou combinação direta pelo WhatsApp — é assim
 * que muitas lojas de revenda operam até automatizar o pagamento.
 *
 * Quando você criar uma conta no Mercado Pago (é gratuito, é o gateway mais
 * usado no Brasil para esse tipo de loja):
 *   1. Gere um Access Token em https://www.mercadopago.com.br/developers
 *   2. Coloque em backend/.env: MP_ACCESS_TOKEN=seu_token_aqui
 *   3. Reinicie o servidor — a função `createPayment` abaixo detecta a
 *      variável automaticamente e passa a criar uma "preferência" real,
 *      redirecionando o cliente pro checkout do Mercado Pago.
 * Nenhum outro arquivo do projeto precisa mudar.
 */

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const PIX_KEY = process.env.PIX_KEY || null; // opcional, pra modo manual
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

function isGatewayConfigured() {
  return Boolean(MP_ACCESS_TOKEN);
}

/**
 * Cria a cobrança do pedido.
 * Retorna { mode: 'mercadopago', redirectUrl } ou { mode: 'manual', instructions }
 */
async function createPayment(order) {
  if (isGatewayConfigured()) {
    return createMercadoPagoPreference(order);
  }
  return {
    mode: "manual",
    instructions: PIX_KEY
      ? `Pagamento via Pix. Chave: ${PIX_KEY}. Envie o comprovante pelo WhatsApp informando o pedido ${order.id}.`
      : `Pagamento a combinar pelo WhatsApp. Informe o número do pedido ${order.id} para finalizar.`,
  };
}

async function createMercadoPagoPreference(order) {
  const body = {
    items: order.items.map((item) => ({
      title: `${item.name} (tam. ${item.size})`,
      quantity: item.qty,
      unit_price: item.unitPrice,
      currency_id: "BRL",
    })),
    shipments: {
      cost: order.shipping?.cost || 0,
      mode: "not_specified",
    },
    external_reference: order.id,
    back_urls: {
      success: `${SITE_URL}/pedido-confirmado.html?pedido=${order.id}`,
      failure: `${SITE_URL}/checkout.html?erro=pagamento`,
      pending: `${SITE_URL}/pedido-confirmado.html?pedido=${order.id}`,
    },
    auto_return: "approved",
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao criar preferência no Mercado Pago: ${errText}`);
  }

  const data = await res.json();
  return { mode: "mercadopago", redirectUrl: data.init_point };
}

module.exports = { isGatewayConfigured, createPayment };
