import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cz.allround.app',
  appName: 'All-round',
  webDir: 'dist',
  android: {
    // Appka běží celá lokálně, nic se nemá načítat přes nešifrované http.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
