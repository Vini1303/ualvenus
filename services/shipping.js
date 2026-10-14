/**
 * Serviço de frete.
 *
 * Hoje: estimativa por região de CEP (sem contrato com transportadora).
 * Replica a regra do site original: frete grátis a partir de um valor mínimo.
 *
 * Quando você tiver uma conta no Melhor Envio ou contrato com os Correios,
 * troque o corpo da função `estimateShipping` por uma chamada real à API
 * deles. A assinatura (recebe cep + subtotal, devolve {cost, days, ...})
 * pode continuar igual, então o resto do app não precisa mudar.
 */

const FREE_SHIPPING_THRESHOLD = 160; // igual ao site original

// Tabela de estimativa por região (1º dígito do CEP).
// Valores aproximados — ajuste para a realidade da sua transportadora.
const REGIONS = {
  0: { uf: "SP (capital/Grande SP)", cost: 14.9, days: "2 a 4" },
  1: { uf: "SP (interior/litoral)", cost: 16.9, days: "3 a 5" },
  2: { uf: "RJ / ES", cost: 19.9, days: "3 a 6" },
  3: { uf: "MG", cost: 18.9, days: "3 a 6" },
  4: { uf: "BA / SE", cost: 24.9, days: "5 a 9" },
  5: { uf: "PE / AL / PB / RN", cost: 26.9, days: "5 a 9" },
  6: { uf: "CE / PI / MA / Norte", cost: 29.9, days: "6 a 10" },
  7: { uf: "DF / GO / TO / MT / MS", cost: 22.9, days: "4 a 8" },
  8: { uf: "PR / SC", cost: 17.9, days: "3 a 6" },
  9: { uf: "RS", cost: 21.9, days: "4 a 7" },
};

function sanitizeCep(cep) {
  return String(cep || "").replace(/\D/g, "");
}

function isValidCep(cep) {
  return /^\d{8}$/.test(sanitizeCep(cep));
}

/**
 * Busca cidade/UF na API pública do ViaCEP. Não cobra nada e não exige
 * cadastro. Se a chamada falhar (ex.: sem internet, CEP inexistente),
 * devolve null e o restante do fluxo continua funcionando.
 */
async function lookupAddressByCep(cep) {
  const clean = sanitizeCep(cep);
  if (!isValidCep(clean)) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      cep: clean,
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    };
  } catch (err) {
    console.error("Falha ao consultar ViaCEP:", err.message);
    return null;
  }
}

function estimateShipping(cep, subtotal) {
  const clean = sanitizeCep(cep);
  if (!isValidCep(clean)) {
    throw new Error("CEP inválido. Use o formato 00000000.");
  }

  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return {
      cep: clean,
      cost: 0,
      free: true,
      days: "3 a 7",
      label: "Frete grátis",
    };
  }

  const firstDigit = clean[0];
  const region = REGIONS[firstDigit] || REGIONS["1"];

  return {
    cep: clean,
    cost: region.cost,
    free: false,
    days: region.days,
    label: `Frete estimado (${region.uf})`,
    missingForFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
  };
}

module.exports = {
  FREE_SHIPPING_THRESHOLD,
  isValidCep,
  sanitizeCep,
  lookupAddressByCep,
  estimateShipping,
};
