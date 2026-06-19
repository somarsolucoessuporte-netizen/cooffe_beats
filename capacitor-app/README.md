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

## Acesso remoto via Tailscale

**Status:** Tailscale 1.98.4 instalado no D2 Mini (`DM04228F40426`) em 2026-06-18.  
**Login pendente:** Francisco deve fazer login com a conta Somar.IA no D2 Mini.

### Setup inicial (uma vez)

**No D2 Mini:**
1. Abrir o app **Tailscale** (já instalado)
2. Fazer login com a conta Google/e-mail da Somar.IA
3. O dispositivo aparece como "DM04228F40426" na tailnet

**No notebook de suporte:**
1. Instalar Tailscale: `winget install Tailscale.Tailscale`
2. Fazer login com a **mesma conta** da Somar.IA
3. Verificar dispositivos: `tailscale status`

### Conectar remotamente (sem USB)

```powershell
$adb = "C:\Users\einst\AppData\Local\Android\Sdk\platform-tools\adb.exe"

# 1. Ver IP Tailscale do D2 Mini (algo como 100.x.x.x)
tailscale status

# 2. Conectar via ADB sobre Tailscale
& $adb connect 100.x.x.x:5555

# 3. Verificar conexão
& $adb devices

# 4. Usar normalmente (instalar APK, ver logs, etc.)
& $adb -s 100.x.x.x:5555 install -r app-debug.apk
& $adb -s 100.x.x.x:5555 logcat -s PrintServer
```

### Reativar ADB TCP/IP após reinicialização

O ADB TCP/IP não persiste após reboot. Opções:

**Opção A — via USB (necessário estar presencialmente):**
```powershell
& $adb -s DM04228F40426 tcpip 5555
```

**Opção B — via Tailscale já conectado (sem USB):**
```powershell
# Se já está conectado remotamente, reconectar após reboot:
& $adb connect 100.x.x.x:5555   # pode funcionar se o D2 manteve tcpip
```

**Opção C — app ShizukuRunner ou similar com persistência** *(avançado)*:  
Requer root ou modo de depuração permanente — não recomendado para produção.

> **Recomendação prática:** Na primeira visita ao cliente, habilitar ADB TCP/IP via USB  
> (`adb tcpip 5555`) e anotar o IP Tailscale. Basta refazer isso se o device reiniciar.

### IP local atual (rede WiFi do cliente)

```
192.168.15.7:5555
```
*(pode mudar se o roteador reatribuir DHCP — usar IP Tailscale é mais confiável)*

### Referência rápida de comandos remotos

```powershell
$t = "100.x.x.x"  # IP Tailscale do D2 Mini

# Instalar APK
& $adb connect "${t}:5555"
& $adb -s "${t}:5555" install -r path/to/app.apk

# Ver logs do Print Server
& $adb -s "${t}:5555" logcat -s PrintServer:D HttpPrintServer:D

# Reiniciar o app Coffee & Beats
& $adb -s "${t}:5555" shell am force-stop br.com.somar.coffeebeats
& $adb -s "${t}:5555" shell am start -n br.com.somar.coffeebeats/.MainActivity

# Port-forward para debug local
& $adb -s "${t}:5555" forward tcp:9100 tcp:9100
```
