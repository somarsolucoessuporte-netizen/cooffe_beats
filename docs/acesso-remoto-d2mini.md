# Acesso Remoto — Sunmi D2 Mini

> Já existe acesso remoto técnico (ADB via Tailscale) documentado em
> `capacitor-app/README.md` — útil para instalar APKs, ver logs e reiniciar
> o app. O TeamViewer aqui é um acesso complementar: controle visual completo
> da tela, útil para suporte a distância sem depender de linha de comando.

## Instalação (fazer uma vez no device)

1. No D2 Mini, abra o Chrome
2. Acesse https://www.teamviewer.com/pt-br/download/android/
3. Baixe e instale o **TeamViewer Host** (versão para dispositivos não assistidos)
4. Abra o TeamViewer Host
5. Anote o **ID do dispositivo** e defina uma **senha fixa**
6. Em Configurações → marque "Iniciar automaticamente"

> **Atenção:** o Sunmi D2 Mini é um dispositivo Android voltado para POS e pode
> não ter a Play Store completa (GMS) habilitada por padrão. Se o link acima
> não abrir a Play Store corretamente, baixe o APK do TeamViewer Host
> diretamente do site oficial e instale via "Fontes desconhecidas". Verifique
> também se o app de "Permissões de acessibilidade" precisa ser habilitado
> manualmente para o TeamViewer conseguir espelhar/controlar a tela.

## Acesso remoto (do computador)

1. Instale TeamViewer no seu computador (teamviewer.com)
2. Digite o ID do D2 Mini
3. Digite a senha
4. Acesso completo à tela do dispositivo

## Importante

- O D2 Mini precisa estar ligado e conectado ao WiFi da cafeteria
- O TeamViewer Host inicia automaticamente com o Android
- Anote o ID e senha num local seguro
- Uso comercial/recorrente do TeamViewer pode exigir uma licença paga
  (a versão gratuita é voltada para uso pessoal/esporádico)
