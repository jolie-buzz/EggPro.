import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "cloud.spec.ts",
  timeout: 60000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4175",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    launchOptions: { channel: "chrome" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  webServer: {
    command:
      "VITE_SUPABASE_URL=https://eggpro-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_qa_only npm run dev -- --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
  },
});
