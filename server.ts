import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy for Mandi Prices to avoid CORS
  app.get("/api/mandi-prices", async (req, res) => {
    try {
      const { apiKey, resourceId, limit = 100, offset = 0, filters } = req.query;
      
      let url = `https://api.data.gov.in/resource/${resourceId}?api-key=${apiKey}&format=json&limit=${limit}&offset=${offset}&sort[arrival_date]=desc`;
      
      // If filters are provided (e.g. filters[state]=Maharashtra&filters[commodity]=Wheat)
      if (typeof filters === 'object' && filters !== null) {
        Object.entries(filters).forEach(([key, value]) => {
          url += `&filters[${key}]=${encodeURIComponent(value as string)}`;
        });
      }

      console.log(`Fetching from Data.gov.in: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching mandi prices:", error);
      res.status(500).json({ error: "Failed to fetch mandi prices" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Port 3000 is externally accessible via the reverse proxy.`);
  });
}

startServer();
