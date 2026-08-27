// Standalone Vite config — this project no longer depends on Lovable's
// platform wrapper (@lovable.dev/vite-tanstack-config). Each plugin that
// wrapper used to configure automatically is now registered explicitly
// below, using the same underlying packages.
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
  server: {
    port: 5173,
  },
});
