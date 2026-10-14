#!/usr/bin/env python3
"""Baixa as imagens do catalogo nas pastas existentes, sem dependencias externas.

Python 3.9+. Execute este arquivo depois de extrair o ZIP inteiro.
Exemplos:
    python3 baixar_imagens.py
    python3 baixar_imagens.py --workers 4 --retries 3 --zip
    python3 baixar_imagens.py --verify-only
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
MAX_IMAGE_BYTES = 40 * 1024 * 1024
ALLOWED_HOSTS = {'cdn.dooca.store'}


def image_signature(data: bytes) -> bool:
    """Rejeita paginas de erro HTML ou dados que nao sejam imagens esperadas."""
    if len(data) < 32:
        return False
    return (
        data.startswith(b'\xff\xd8\xff')
        or data.startswith(b'\x89PNG\r\n\x1a\n')
        or data.startswith((b'GIF87a', b'GIF89a'))
        or (data.startswith(b'RIFF') and data[8:12] == b'WEBP')
    )


def valid_file(path: Path) -> bool:
    try:
        if not path.is_file() or path.stat().st_size < 32:
            return False
        with path.open('rb') as f:
            return image_signature(f.read(64))
    except OSError:
        return False


def safe_target(root: Path, folder: str, filename: str) -> Path:
    """Impede que caminhos do manifesto escrevam fora da pasta matriz."""
    path = (root / folder / filename).resolve()
    if path == root.resolve() or root.resolve() not in path.parents:
        raise ValueError('Caminho fora da pasta matriz: ' + str(path))
    return path


def validate_url(url: str) -> None:
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError('URL nao autorizada no manifesto: ' + url)
    if parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError('URL com autenticacao ou porta nao permitida: ' + url)


def tasks_from_catalog(catalog: dict[str, Any], root: Path, only_main: bool = False) -> list[dict[str, Any]]:
    tasks = []
    for model in catalog['produtos']:
        for variant in model['variacoes']:
            for image in variant['imagens']:
                if only_main and image['tipo'] != 'principal':
                    continue
                urls = list(dict.fromkeys([image['url']] + image.get('urls_alternativas', [])))
                for url in urls:
                    validate_url(url)
                target = safe_target(root, model['pasta'], image['arquivo'])
                tasks.append({
                    'nome': model['nome'],
                    'cor': variant.get('cor'),
                    'id_variacao': variant['id_variacao'],
                    'url': image['url'],
                    'urls': urls,
                    'target': target,
                    'caminho': target.relative_to(root).as_posix(),
                })
    if len({t['target'] for t in tasks}) != len(tasks):
        raise ValueError('O manifesto contem caminhos de imagem duplicados.')
    return tasks


def fetch_bytes(url: str, timeout: float, retries: int) -> bytes:
    validate_url(url)
    last_error: Optional[Exception] = None
    for attempt in range(retries):
        try:
            request = Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; CatalogImageDownloader/1.0)',
                'Accept': 'image/jpeg,image/png,image/webp,image/*;q=0.9,*/*;q=0.5',
                'Referer': 'https://www.zafiraatacado.com/',
            })
            with urlopen(request, timeout=timeout) as response:
                raw_size = response.headers.get('Content-Length')
                expected_size = int(raw_size) if raw_size and raw_size.isdigit() else None
                if expected_size is not None and expected_size > MAX_IMAGE_BYTES:
                    raise ValueError('A imagem excede o limite de 40 MB.')
                data = response.read(MAX_IMAGE_BYTES + 1)
                if len(data) > MAX_IMAGE_BYTES:
                    raise ValueError('A imagem excede o limite de 40 MB.')
                if expected_size is not None and len(data) != expected_size:
                    raise ValueError('Download incompleto: tamanho diferente do informado pelo servidor.')
                if not image_signature(data):
                    raise ValueError('A resposta nao e uma imagem valida (possivel erro da loja).')
                return data
        except (OSError, HTTPError, URLError, ValueError) as exc:
            last_error = exc
            if isinstance(exc, HTTPError) and exc.code in {400, 401, 403, 404, 410}:
                break
            if attempt + 1 < retries:
                time.sleep(min(2 ** attempt, 8))
    raise RuntimeError(str(last_error))


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.part')
    try:
        temporary.write_bytes(data)
        temporary.replace(path)
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass


def download_group(group: list[dict[str, Any]], timeout: float, retries: int) -> list[dict[str, Any]]:
    """Uma transferencia por URL, copiando a foto para todas as pastas necessarias."""
    results = []
    pending = []
    existing: Optional[Path] = None
    for task in group:
        if valid_file(task['target']):
            existing = task['target']
            results.append({'caminho': task['caminho'], 'status': 'ja_existia', 'url': task['url']})
        else:
            pending.append(task)
    if not pending:
        return results
    data: Optional[bytes] = None
    used_url: Optional[str] = None
    errors = []
    if existing is not None:
        try:
            data = existing.read_bytes()
        except OSError as exc:
            errors.append('Falha ao ler copia local: ' + str(exc))
    if data is None:
        urls = list(dict.fromkeys(u for task in pending for u in task['urls']))
        for url in urls:
            try:
                data = fetch_bytes(url, timeout, retries)
                used_url = url
                break
            except Exception as exc:
                errors.append(url + ' -> ' + str(exc))
    for task in pending:
        result = {'caminho': task['caminho'], 'url': task['url']}
        if data is None:
            result.update(status='falhou', erro=' | '.join(errors))
        else:
            try:
                write_atomic(task['target'], data)
                result.update(status='salva', url_utilizada=used_url or 'copia_local', bytes=len(data))
            except OSError as exc:
                result.update(status='falhou', erro='Falha ao gravar arquivo: ' + str(exc))
        results.append(result)
    return results


def report(root: Path, all_tasks: list[dict[str, Any]], results: list[dict[str, Any]], interrupted: bool = False) -> dict[str, Any]:
    missing = [t['caminho'] for t in all_tasks if not valid_file(t['target'])]
    data = {
        'data': datetime.now().astimezone().isoformat(timespec='seconds'),
        'interrompido': interrupted,
        'total_de_imagens_do_catalogo': len(all_tasks),
        'imagens_presentes': len(all_tasks) - len(missing),
        'imagens_faltantes': len(missing),
        'faltantes': missing,
        'resultados_desta_execucao': sorted(results, key=lambda r: r['caminho'].casefold()),
    }
    (root / 'RELATORIO_DOWNLOAD.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    lines = [
        'RELATORIO DE DOWNLOAD DAS IMAGENS',
        'Data: ' + data['data'],
        'Total previsto: ' + str(data['total_de_imagens_do_catalogo']),
        'Imagens salvas nas pastas: ' + str(data['imagens_presentes']),
        'Imagens faltantes: ' + str(data['imagens_faltantes']),
        'Execucao interrompida: ' + ('Sim' if interrupted else 'Nao'),
        '',
        'Todas as imagens estao presentes.' if not missing else 'Ainda faltam imagens. Execute o baixador novamente para tentar as pendencias.',
        '',
    ]
    if missing:
        lines += ['ARQUIVOS FALTANTES:'] + missing + ['']
    failed = [r for r in results if r['status'] == 'falhou']
    if failed:
        lines += ['ERROS DESTA EXECUCAO:']
        for r in failed:
            lines += [r['caminho'], r['erro'], '']
    (root / 'RELATORIO_DOWNLOAD.txt').write_text('\n'.join(lines), encoding='utf-8-sig')
    return data


def make_zip(root: Path, complete: bool) -> Path:
    suffix = '_COM_IMAGENS.zip' if complete else '_IMAGENS_PARCIAIS.zip'
    output = root.parent / (root.name + suffix)
    temporary = output.with_suffix('.zip.part')
    with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=5) as z:
        for path in sorted(root.rglob('*')):
            if not path.is_file() or path.suffix == '.part' or '__pycache__' in path.parts:
                continue
            image = path.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
            z.write(path, path.relative_to(root.parent), compress_type=zipfile.ZIP_STORED if image else zipfile.ZIP_DEFLATED)
    temporary.replace(output)
    return output


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--workers', type=int, default=6, help='Downloads simultaneos, de 1 a 12 (padrao: 6).')
    parser.add_argument('--timeout', type=float, default=30, help='Limite de espera por requisicao em segundos (padrao: 30).')
    parser.add_argument('--retries', type=int, default=3, help='Tentativas por URL, de 1 a 5 (padrao: 3).')
    parser.add_argument('--only-main', action='store_true', help='Baixa somente a foto principal de cada variacao.')
    parser.add_argument('--verify-only', action='store_true', help='Somente confere os arquivos locais, sem acessar a internet.')
    parser.add_argument('--zip', action='store_true', help='Cria um ZIP ao final, ao lado da pasta matriz.')
    args = parser.parse_args(argv)
    if not 1 <= args.workers <= 12 or not 1 <= args.retries <= 5 or args.timeout <= 0:
        parser.error('Use workers entre 1 e 12, retries entre 1 e 5 e timeout positivo.')
    try:
        catalog = json.loads((ROOT / 'catalogo.json').read_text(encoding='utf-8-sig'))
        all_tasks = tasks_from_catalog(catalog, ROOT)
        selected = tasks_from_catalog(catalog, ROOT, args.only_main)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print('ERRO ao ler catalogo.json: ' + str(exc), file=sys.stderr)
        print('Extraia todo o ZIP e mantenha o manifesto junto deste script.', file=sys.stderr)
        return 2
    print('Pasta matriz: ' + str(ROOT))
    print('Modelos: ' + str(len(catalog['produtos'])) + ' | Imagens selecionadas: ' + str(len(selected)))
    print('Arquivos validos ja existentes serao preservados.')
    results: list[dict[str, Any]] = []
    interrupted = False
    if not args.verify_only:
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for task in selected:
            groups[task['url']].append(task)
        executor = ThreadPoolExecutor(max_workers=args.workers)
        futures = {executor.submit(download_group, group, args.timeout, args.retries): group for group in groups.values()}
        completed = 0
        try:
            for future in as_completed(futures):
                completed += 1
                try:
                    current = future.result()
                except Exception as exc:
                    current = [{'caminho': t['caminho'], 'url': t['url'], 'status': 'falhou', 'erro': str(exc)} for t in futures[future]]
                results.extend(current)
                failures = [r for r in current if r['status'] == 'falhou']
                if completed % 10 == 0 or completed == len(futures) or failures:
                    saved = sum(r['status'] in {'salva', 'ja_existia'} for r in results)
                    print(f'[{completed}/{len(futures)} URLs] Arquivos prontos: {saved}/{len(selected)}', flush=True)
                for failure in failures:
                    print('  PENDENTE: ' + failure['caminho'], flush=True)
        except KeyboardInterrupt:
            interrupted = True
            print('\nInterrompendo. Downloads ja salvos serao mantidos.', flush=True)
            for future in futures:
                future.cancel()
        finally:
            executor.shutdown(wait=True, cancel_futures=interrupted)
    data = report(ROOT, all_tasks, results, interrupted)
    print('\nImagens locais: ' + str(data['imagens_presentes']) + '/' + str(data['total_de_imagens_do_catalogo']))
    print('Faltantes: ' + str(data['imagens_faltantes']))
    print('Detalhes: RELATORIO_DOWNLOAD.txt')
    if args.zip and not interrupted:
        output = make_zip(ROOT, complete=data['imagens_faltantes'] == 0)
        print('ZIP gerado: ' + str(output))
    return 130 if interrupted else (1 if data['imagens_faltantes'] else 0)


if __name__ == '__main__':
    raise SystemExit(main())
