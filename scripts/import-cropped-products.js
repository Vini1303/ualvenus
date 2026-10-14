const fs = require("fs");
const path = require("path");

const sourceDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "..", "..", ".import-cropped", "cropped_somente_estas", "cropped_somente_estas");

const productsFile = path.resolve(__dirname, "..", "data", "products.json");
const outputImageDir = path.resolve(__dirname, "..", "public", "img", "catalogo", "importados");

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePrice(value) {
  const numeric = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const price = Number.parseFloat(numeric);
  return Number.isFinite(price) ? price : 0;
}

function titleWithColor(item) {
  return `${item.nome} ${item.cor}`.replace(/\s+/g, " ").trim();
}

function categoryFor(name) {
  const lower = name.toLowerCase();
  if (lower.startsWith("regata")) return "Regata";
  if (lower.startsWith("blusa")) return "Blusa";
  if (lower.startsWith("top") && !lower.includes("cropped")) return "Top";
  return "Cropped";
}

function colorsFor(color) {
  const normalized = String(color || "").trim();
  return normalized ? [normalized] : [];
}

function imageFilesFor(folderPath) {
  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^imagem_\d+\.(jpe?g|png|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

function findFolderByIndex(index) {
  const prefix = `${String(index + 1).padStart(2, "0")} - `;
  const folder = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith(prefix));
  return folder ? path.join(sourceDir, folder.name) : null;
}

function nextProductNumber(products) {
  return products.reduce((max, product) => {
    const match = /^venus-(\d+)$/.exec(product.id || "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Pasta de origem nao encontrada: ${sourceDir}`);
}

const catalogFile = path.join(sourceDir, "catalogo.json");
if (!fs.existsSync(catalogFile)) {
  throw new Error(`catalogo.json nao encontrado em: ${sourceDir}`);
}

fs.mkdirSync(outputImageDir, { recursive: true });

const catalog = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
const products = JSON.parse(fs.readFileSync(productsFile, "utf8"));
const bySlug = new Map(products.map((product, index) => [product.slug, { product, index }]));
let nextId = nextProductNumber(products) + 1;

let created = 0;
let updated = 0;
let skipped = 0;

catalog.forEach((item, index) => {
  const folderPath = findFolderByIndex(index);
  if (!folderPath) {
    skipped += 1;
    return;
  }

  const title = titleWithColor(item);
  const slug = slugify(title);
  const available = String(item.status || "").toLowerCase().includes("dispon");
  const imageFiles = imageFilesFor(folderPath);
  const images = imageFiles.map((fileName) => {
    const extension = path.extname(fileName).toLowerCase();
    const outputName = `${slug}-${path.basename(fileName, extension).replace("imagem_", "")}${extension}`;
    const outputPath = path.join(outputImageDir, outputName);
    fs.copyFileSync(path.join(folderPath, fileName), outputPath);
    return `/img/catalogo/importados/${outputName}`;
  });

  if (!images.length) {
    skipped += 1;
    return;
  }

  const stock = available ? { P: 12, M: 12, G: 12 } : { P: 0, M: 0, G: 0 };
  const importedProduct = {
    id: `venus-${String(nextId).padStart(3, "0")}`,
    slug,
    name: title,
    url: `/produto.html?slug=${slug}`,
    category: categoryFor(item.nome),
    price: parsePrice(item.valor),
    compare_at_price: null,
    discount_pct: 0,
    sizes: ["P", "M", "G"],
    colors: colorsFor(item.cor),
    image: images[0],
    images,
    available,
    stock,
    source_url: item.url_produto || null,
    supplier_variation_id: item.variacao_id || null,
  };

  const existing = bySlug.get(slug);
  if (existing) {
    products[existing.index] = {
      ...existing.product,
      ...importedProduct,
      id: existing.product.id,
    };
    updated += 1;
    return;
  }

  products.push(importedProduct);
  bySlug.set(slug, { product: importedProduct, index: products.length - 1 });
  nextId += 1;
  created += 1;
});

fs.writeFileSync(productsFile, `${JSON.stringify(products, null, 2)}\n`, "utf8");

console.log(`Produtos criados: ${created}`);
console.log(`Produtos atualizados: ${updated}`);
console.log(`Pastas ignoradas: ${skipped}`);
console.log(`Total no catalogo do site: ${products.length}`);
