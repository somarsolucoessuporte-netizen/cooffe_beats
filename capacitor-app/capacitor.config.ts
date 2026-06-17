import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.somar.coffeebeats",
  appName: "Coffee & Beats",
  webDir: "www",
  server: {
    url: "https://coffeebeats.somar.ia.br",
    cleartext: false,
  },
  plugins: {
    SunmiPrinter: {
      bindOnLoad: true,
    },
  },
  android: {
    buildOptions: {
      minSdkVersion: 22,
      targetSdkVersion: 34,
    },
  },
};

export default config;
