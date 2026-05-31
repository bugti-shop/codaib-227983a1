import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flowist.app',
  appName: 'Flowist',
  webDir: 'dist',
  server: {
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      showSpinner: false,
    },
    GoogleAuth: {
      iosClientId: '425291387152-hg7uajqc20bd8t3qfb760gngbl2pd20i.apps.googleusercontent.com',
      serverClientId: '425291387152-u06impgmsgg286jg7odo4f40fu6pjmb5.apps.googleusercontent.com',
      scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.appdata', 'https://www.googleapis.com/auth/drive.file'],
      forceCodeForRefreshToken: true,
    },
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    zoomEnabled: true,
  },
  ios: {
    scrollEnabled: true,
  },
};

export default config;
