import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("./src/admin", import.meta.url));
const outDir = fileURLToPath(new URL("./admin-dist", import.meta.url));

export default defineConfig({
  root,
  base: "/_serenojs/admin/",
  plugins: [tailwindcss(), react()],
  build: {
    outDir,
    emptyOutDir: true,
    target: "es2022",
  },
});
