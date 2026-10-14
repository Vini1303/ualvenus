import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O build vai para backend/public/admin e é servido pelo Express em /admin/.
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  build: { outDir: "../public/admin", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:3000", "/img": "http://localhost:3000" } },
});
