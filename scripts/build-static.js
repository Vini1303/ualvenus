// Gera os JSON estáticos usados no Netlify (sem backend):
//   public/data/products.json, categories.json e products/<slug>.json
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "..", "public", "data");
const all = require("../data/products.json").filter((p) => p.published !== false);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "products"), { recursive: true });

fs.writeFileSync(path.join(out, "products.json"), JSON.stringify(all));
fs.writeFileSync(
  path.join(out, "categories.json"),
  JSON.stringify([...new Set(all.map((p) => p.category))].sort())
);
for (const p of all) {
  fs.writeFileSync(path.join(out, "products", `${p.slug}.json`), JSON.stringify(p));
}
console.log(`${all.length} produtos exportados para public/data`);
