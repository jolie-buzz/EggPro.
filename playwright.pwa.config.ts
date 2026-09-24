import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/pwa",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4176",
    launchOptions: { channel: "chrome" },
  },
  webServer: {
    command: "npm run preview -- --port 4176 --strictPort",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
  },
});
