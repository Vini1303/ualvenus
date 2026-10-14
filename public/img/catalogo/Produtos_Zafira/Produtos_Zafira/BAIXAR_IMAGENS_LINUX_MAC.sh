#!/usr/bin/env bash
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 nao encontrado. Este baixador requer Python 3.9 ou superior."
    exit 2
fi
exec python3 baixar_imagens.py "$@"
