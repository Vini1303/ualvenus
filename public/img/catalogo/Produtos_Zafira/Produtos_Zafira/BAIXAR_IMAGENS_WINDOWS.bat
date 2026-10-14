@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 baixar_imagens.py %*
    goto fim
)
where python >nul 2>nul
if not errorlevel 1 (
    python baixar_imagens.py %*
    goto fim
)
echo Python nao encontrado. Este baixador requer Python 3.9 ou superior.
echo Os links das fotos estao em links_das_imagens.txt dentro de cada pasta.
:fim
echo.
pause
