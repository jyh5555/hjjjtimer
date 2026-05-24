import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.hjjj.timer',
  appName: 'hjjjtimer2',
  webDir: 'dist',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: true,
      }
    : undefined,
};

export default config;
