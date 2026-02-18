import { defineConfig } from "vite";

// Set base path for GitHub Pages deployment
// This ensures assets are loaded from the correct path at /neon-lane/
export default defineConfig({
  base: "/neon-lane/"
});
