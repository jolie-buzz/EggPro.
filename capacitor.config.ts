import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = { appId: 'com.farmtrack.app', appName: 'FarmTrack', webDir: 'dist',
  plugins: { CapacitorSQLite: { iosDatabaseLocation: 'Library/CapacitorDatabase', iosIsEncryption: false, androidIsEncryption: false } } };
export default config;
