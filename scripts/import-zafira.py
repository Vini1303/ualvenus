"""Importa catálogo e fotos do ZIP Zafira sem executar conteúdo do pacote.

Uso: python3 scripts/import-zafira.py /caminho/Produtos_Zafira2.zip
Preserva IDs e estoque dos produtos existentes e não duplica variações.
"""
import collections
from decimal import Decimal, ROUND_HALF_UP
import json
from pathlib import Path
import re
import sys
import unicodedata
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def slugify(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-')


def category_for(name):
    name = slugify(name)
    if name.startswith(('mini-saia-', 'saia-')):
        return 'Saia'
    if name.startswith(('cropped-', 'top-cropped-')):
        return 'Cropped'
    if name.startswith('lip-tube-'):
        return 'Top'
    for prefix, category in [('blusa', 'Blusa'), ('body', 'Body'), ('calca', 'Calça'),
                             ('vestido', 'Vestido'), ('top', 'Top'), ('regata', 'Regata'),
                             ('jaqueta', 'Jaquetas'), ('shorts', 'Shorts'),
                             ('conjunto', 'Conjunto'), ('macacao', 'Macacão')]:
        if name.startswith(prefix + '-'):
            return category
    raise ValueError(f'Categoria não identificada: {name}')


def main(archive):
    target = ROOT / 'data/products.json'
    products = json.loads(target.read_text())
    by_slug = {p['slug']: p for p in products}
    by_variant = {str(p['supplier_variation_id']): p for p in products if p.get('supplier_variation_id')}
    created = updated = 0
    imported = []
    images_to_write = {}
    with zipfile.ZipFile(archive) as package:
        catalog = json.loads(package.read('Produtos_Zafira/catalogo.json'))
        for model in catalog['produtos']:
            category = category_for(model['nome'])
            for variant in model['variacoes']:
                variant_id = str(variant['id_variacao'])
                slug = slugify(variant['nome_completo'])
                existing = by_variant.get(variant_id) or by_slug.get(slug)
                images = []
                for i, image in enumerate(variant['imagens'], 1):
                    member = f"Produtos_Zafira/{model['pasta']}/{image['arquivo']}"
                    extension = Path(image['arquivo']).suffix.lower()
                    if extension not in {'.jpg', '.jpeg', '.png', '.webp'}:
                        raise ValueError(f'Formato não suportado: {member}')
                    url = f'/img/catalogo/zafira/{variant_id}-{i}{extension}'
                    images_to_write[url] = package.read(member)
                    images.append(url)
                if not images:
                    raise ValueError(f'Produto sem fotos: {slug}')
                supplier_price = Decimal(variant['preco'])
                price = float((supplier_price * Decimal('1.20')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
                if price <= 0:
                    raise ValueError(f'Preço inválido: {slug}')
                sold_out = variant['situacao_no_codigo'] == 'Esgotado'
                product = dict(existing or {})
                product.update({
                    'id': existing['id'] if existing else f'zafira-{variant_id}',
                    'slug': existing['slug'] if existing else slug,
                    'name': variant['nome_completo'], 'category': category,
                    'price': price, 'compare_at_price': None, 'discount_pct': 0,
                    'supplier_price': float(supplier_price), 'markup_pct': 20,
                    'colors': [variant['cor']], 'image': images[0], 'images': images,
                    'sizes': existing.get('sizes', []) if existing else [],
                    'stock': existing.get('stock', {}) if existing else {},
                    'source_url': variant['url_produto'],
                    'supplier_variation_id': variant_id,
                    'supplier_model_id': str(variant['id_produto']),
                    'supplier_status': variant['situacao_no_codigo'],
                    'source_catalog': 'Produtos_Zafira2',
                })
                product['url'] = '/produto.html?slug=' + product['slug']
                if sold_out:
                    product['stock'] = {s: 0 for s in product['sizes']}
                confirmed = any(qty > 0 for qty in product['stock'].values())
                product['stock_status'] = 'sold_out' if sold_out else ('available' if confirmed else 'on_request')
                product['available'] = confirmed and not sold_out
                if existing:
                    existing.update(product)
                    updated += 1
                    product = existing
                else:
                    products.append(product)
                    created += 1
                by_slug[product['slug']] = product
                by_variant[variant_id] = product
                imported.append(product)
    assert len({p['id'] for p in products}) == len(products), 'IDs duplicados'
    assert len({p['slug'] for p in products}) == len(products), 'Slugs duplicados'
    for url, data in images_to_write.items():
        destination = ROOT / 'public' / url.lstrip('/')
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    target.write_text(json.dumps(products, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'modelos': len(catalog['produtos']), 'variações': len(imported),
                      'criados': created, 'atualizados': updated, 'total_no_site': len(products),
                      'fotos': len(images_to_write),
                      'categorias': dict(collections.Counter(p['category'] for p in imported))},
                     ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main(sys.argv[1])
