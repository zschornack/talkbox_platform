@echo off
chcp 65001 >nul
title TalkBox - atualizar aulas
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Git nao esta instalado. Instale em https://git-scm.com/download/win
  echo  ^(pode clicar em Next em tudo^) e tente de novo.
  echo.
  pause
  exit /b
)

echo.
echo  Buscando as aulas novas...
git pull
if errorlevel 1 (
  echo.
  echo  Nao deu para atualizar. Tire uma foto desta tela e mande para o Miguel.
) else (
  echo.
  echo  Pronto! Se o TalkBox estiver aberto, feche a janela preta dele
  echo  e clique de novo em ABRIR TALKBOX para as aulas novas aparecerem.
)
echo.
pause
