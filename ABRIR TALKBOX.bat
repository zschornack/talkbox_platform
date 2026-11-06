@echo off
chcp 65001 >nul
title TalkBox - NAO FECHE ESTA JANELA DURANTE A AULA
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado.
  echo  Instale em https://nodejs.org ^(botao verde, versao LTS^) e tente de novo.
  echo.
  pause
  exit /b
)

if not exist "data" mkdir "data"

rem O banco que o Miguel mandou (ex.: talkbox-2026-11-06-10h.db) pode estar na pasta data, nesta pasta ou em Downloads:
rem o primeiro que achar vira data\talkbox.db (o original fica onde estava)
if not exist "data\talkbox.db" (
  for %%F in ("data\talkbox*.db" "talkbox*.db" "%USERPROFILE%\Downloads\talkbox*.db") do (
    if not exist "data\talkbox.db" copy "%%~F" "data\talkbox.db" >nul
  )
)

if not exist "data\talkbox.db" (
  echo.
  echo  Falta o arquivo do banco de dados.
  echo  Coloque o arquivo .db que o Miguel mandou dentro desta pasta:
  echo     %~dp0
  echo  Depois clique de novo em ABRIR TALKBOX.
  echo.
  pause
  exit /b
)

echo.
echo  Abrindo o TalkBox... o navegador abre sozinho em alguns segundos.
echo  Para fechar o TalkBox no fim do dia, feche esta janela.
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node server\start.js
echo.
echo  O TalkBox parou. Se apareceu um erro acima, tire uma foto da tela e mande para o Miguel.
pause
