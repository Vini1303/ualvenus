let lastShippingEstimate = null;

function renderSummary() {
  const itemsEl = document.getElementById("orderItems");
  const items = Cart.data.items;

  if (!items.length) {
    itemsEl.innerHTML = `<p style="color:var(--muted);font-size:13.5px;">Seu carrinho está vazio. <a href="/produtos.html">Ver produtos</a></p>`;
    document.getElementById("submitBtn").disabled = true;
  } else {
    itemsEl.innerHTML = items
      .map(
        (i) => `
        <div class="summary-line">
          <span>${i.qty}x ${i.name} (${i.size})</span>
          <span>${formatBRL(i.unitPrice * i.qty)}</span>
        </div>
      `
      )
      .join("");
  }

  document.getElementById("sumSubtotal").textContent = formatBRL(Cart.data.subtotal);
  updateTotals();
}

function updateTotals() {
  const shippingCost = lastShippingEstimate ? lastShippingEstimate.cost : 0;
  const shippingLabel = lastShippingEstimate
    ? lastShippingEstimate.free
      ? "Grátis"
      : formatBRL(lastShippingEstimate.cost)
    : "Calculado no endereço";
  document.getElementById("sumShipping").textContent = shippingLabel;
  document.getElementById("sumTotal").textContent = formatBRL(Cart.data.subtotal + shippingCost);
}

async function tryEstimateShipping(cep) {
  const clean = cep.replace(/\D/g, "");
  const note = document.getElementById("cepNote");
  if (clean.length !== 8) return;
  try {
    const data = await Api.get(`/api/cart/shipping?cep=${clean}`);
    lastShippingEstimate = data;
    updateTotals();
    note.style.display = "none";

    // tenta auto-completar cidade/UF via ViaCEP (não bloqueia se falhar)
    try {
      const viaCep = await fetch(`https://viacep.com.br/ws/${clean}/json/`).then((r) => r.json());
      if (!viaCep.erro) {
        document.getElementById("city").value = viaCep.localidade || "";
        document.getElementById("state").value = viaCep.uf || "";
        document.getElementById("neighborhood").value = viaCep.bairro || "";
        document.getElementById("street").value = document.getElementById("street").value || viaCep.logradouro || "";
      }
    } catch {
      /* sem internet pro ViaCEP, segue o fluxo normalmente */
    }
  } catch (err) {
    note.textContent = err.message;
    note.style.display = "block";
  }
}

function initCepListener() {
  const cepInput = document.getElementById("cep");
  cepInput.addEventListener("blur", () => tryEstimateShipping(cepInput.value));
}

async function handleSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById("formError");
  errorEl.style.display = "none";
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Processando...";

  const form = new FormData(e.target);
  const payload = {
    customer: {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
    },
    address: {
      cep: form.get("cep"),
      street: form.get("street"),
      number: form.get("number"),
      neighborhood: form.get("neighborhood"),
      city: form.get("city"),
      state: form.get("state"),
      complement: form.get("complement"),
    },
    paymentMethod: "pix",
  };

  try {
    const result = await Api.post("/api/checkout", payload);
    window.location.href = `/pedido-confirmado.html?pedido=${encodeURIComponent(result.order.id)}`;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Finalizar pedido";
  }
}

async function initCheckout() {
  await Cart.refresh();
  renderSummary();
  initCepListener();
  document.getElementById("checkoutForm").addEventListener("submit", handleSubmit);
}

document.addEventListener("DOMContentLoaded", initCheckout);
