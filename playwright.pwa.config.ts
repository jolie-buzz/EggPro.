import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/pwa",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4176",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium", launchOptions: { channel: "chrome" } },
    },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "npm run preview -- --port 4176 --strictPort",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
  },
});
