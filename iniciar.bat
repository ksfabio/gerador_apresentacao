@echo off
chcp 65001 >nul
title Report Semanal
cd /d "%~dp0"

rem ---- localizar o Python (prefere o launcher "py") ----
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY goto sem_python
%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
if errorlevel 1 goto sem_python

rem ---- openpyxl e opcional: sem ele o historico vai para CSV ----
%PY% -c "import openpyxl" >nul 2>nul
if not errorlevel 1 goto iniciar
if exist "dados\.openpyxl_tentado" goto iniciar
echo.
echo  Instalando a biblioteca openpyxl, usada para gravar o historico em Excel...
echo  Se a rede da empresa bloquear, o aplicativo funciona igual e grava o historico em CSV.
echo.
%PY% -m pip install --user openpyxl
if not exist "dados" mkdir "dados"
echo tentado> "dados\.openpyxl_tentado"

:iniciar
%PY% app.py
if errorlevel 1 (
  echo.
  echo  O aplicativo terminou com erro. Veja a mensagem acima.
  pause
)
exit /b

:sem_python
echo.
echo  Nao encontrei o Python 3.8 ou superior nesta maquina.
echo  Instale pelo Portal da Empresa / Centro de Software, ou peca ao suporte,
echo  e execute este arquivo novamente.
echo.
pause
exit /b 1
