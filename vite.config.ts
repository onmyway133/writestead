import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
    plugins: [react(), tailwindcss(), cloudflare()],
    // The admin app's files live under /admin/assets so they never collide with a blog's paths.
    build: { assetsDir: "admin/assets" },
});
