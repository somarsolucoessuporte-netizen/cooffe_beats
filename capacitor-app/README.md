# Coffee & Beats — App Android (Capacitor)

## Pré-requisitos

- Node.js 18+
- Android Studio com SDK Android 34
- Java 17+

## Passos

```bash
cd capacitor-app
npm install
npm run sync    # sincroniza plugins Capacitor → Android
npm run open    # abre Android Studio
```

## No Android Studio

1. Aguardar o Gradle sync finalizar
2. **Build → Generate Signed Bundle / APK → APK**
3. Assinar com keystore (criar um na primeira vez)
4. Instalar no D2 Mini via USB (ADB) ou copiar o `.apk` manualmente

```bash
# Instalar via ADB (com D2 Mini conectado por USB)
adb install app/build/outputs/apk/release/app-release.apk
```

## Comportamento

| Ambiente       | Impressão                                      |
|----------------|------------------------------------------------|
| Browser / dev  | Simulada no console (não trava o sistema)      |
| APK no D2 Mini | Real na impressora interna SN D2P-58 (58mm)    |

## Variáveis de ambiente

O APK aponta para `https://coffeebeats.somar.ia.br`.  
Para apontar para outro servidor, edite `server.url` em `capacitor.config.ts`.

## Plugin utilizado

`@kduma-autoid/capacitor-sunmi-printer`  
- `bindOnLoad: true` → conecta automaticamente na D2P-58 ao abrir o app  
- Suporta buffer de impressão (`enterPrinterBuffer` / `exitPrinterBuffer`)  
- API completa: texto, alinhamento, negrito, tamanho de fonte, avanço de papel

## Auto-start no boot

O `BootReceiver.kt` em `android/app/src/main/java/br/com/somar/coffeebeats/BootReceiver.kt`
lança a `MainActivity` automaticamente após o boot do dispositivo.

Para configurar como app padrão de inicialização no D2 Mini (Francisco):
- **Settings → Sunmi Settings → Default Launch App → Coffee & Beats**
- Isso faz o sistema lançar o app antes mesmo do BootReceiver

## Papel de parede (wallpaper) com logo

Para aplicar o wallpaper com o logo Coffee & Beats no D2 Mini:

1. Gerar/obter a imagem: fundo `#3B1F0E` com logo centralizado (ex. 1920×1080px)
2. Transferir via ADB:
   ```bash
   adb -s DM04228F40426 push logo-wallpaper.png /sdcard/Pictures/
   ```
3. No D2 Mini: **Configurações → Papel de parede → Galeria → selecionar a imagem**

Placeholder salvo em `../public/wallpaper-coffee-beats.svg`.
