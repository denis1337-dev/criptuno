import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
 
 export default defineConfig({
   plugins: [react()],
   server: {
      proxy: {
        "/auth": "http://localhost:4002",
        "/courses": "http://localhost:4002",
        "/games": "http://localhost:4002",
        "/quiz-tests": "http://localhost:4002",
        "/puzzle-levels": "http://localhost:4002",
        "/puzzle-collected": "http://localhost:4002",
        "/profile": "http://localhost:4002"
      }
   }
 });
