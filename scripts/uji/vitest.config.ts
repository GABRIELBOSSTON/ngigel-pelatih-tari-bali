// Konfigurasi Vitest khusus alat kalibrasi (scripts/uji/kalibrasi.test.ts), terpisah dari `npm run test`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/uji/kalibrasi.test.ts"],
    environment: "node",
  },
});
