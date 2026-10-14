/**
 * BentoTrade AI - Full-Stack Express Server with Vite Dev Middlewares
 * Serves secure backend API routes (/api/*) and mounts Vite dev/prod middlewares.
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

/**
 * GET /api/economic-calendar
 * Securely proxies economic calendar requests to Finnhub keeping FINNHUB_API_KEY hidden on the server.
 * Query parameters:
 *   - from: YYYY-MM-DD
 *   - to: YYYY-MM-DD
 */
app.get('/api/economic-calendar', async (req, res) => {
  const { from, to } = req.query;
  const apiKey = process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || '';

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing required query parameters: from, to' });
  }

  // If no API key configured, return clean notice with empty array so client can activate fallback
  if (!apiKey || apiKey.trim().length === 0) {
    return res.status(200).json({
      economicCalendar: [],
      warning: 'FINNHUB_API_KEY not configured on server. Client will utilize institutional feed.'
    });
  }

  try {
    const finnhubUrl = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${apiKey.trim()}`;
    const finnhubRes = await fetch(finnhubUrl);

    if (!finnhubRes.ok) {
      const errText = await finnhubRes.text();
      console.warn(`[Finnhub API Error] HTTP ${finnhubRes.status}:`, errText);
      return res.status(finnhubRes.status).json({
        error: `Finnhub returned HTTP ${finnhubRes.status}`,
        details: errText,
        economicCalendar: []
      });
    }

    const data = await finnhubRes.json();
    return res.json(data);
  } catch (error: any) {
    console.error('Server error fetching Finnhub economic calendar:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error while querying Finnhub',
      economicCalendar: []
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BentoTrade AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
