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
  const isKeyDefined = Boolean(process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY.trim().length > 0);
  
  console.log(`[/api/economic-calendar] Temporal Query: from=${from}, to=${to}`);
  console.log(`[/api/economic-calendar] process.env.FINNHUB_API_KEY is defined: ${isKeyDefined}`);

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing required query parameters: from, to' });
  }

  if (!isKeyDefined) {
    console.warn('[/api/economic-calendar] process.env.FINNHUB_API_KEY is missing or undefined.');
    return res.status(500).json({
      error: 'process.env.FINNHUB_API_KEY is not defined',
      economicCalendar: [],
      fallbackActive: true
    });
  }

  try {
    const targetUrl = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`;
    console.log(`[/api/economic-calendar] Dispatching request to Finnhub: https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=***`);
    
    const finnhubRes = await fetch(targetUrl);

    if (!finnhubRes.ok) {
      const errText = await finnhubRes.text();
      console.warn(`[/api/economic-calendar] Finnhub error response HTTP ${finnhubRes.status}:`, errText);
      return res.status(500).json({
        error: `Finnhub returned HTTP ${finnhubRes.status}: ${errText}`,
        status: finnhubRes.status,
        economicCalendar: [],
        fallbackActive: true
      });
    }

    const data = await finnhubRes.json();
    if (data.error) {
      console.warn(`[/api/economic-calendar] Finnhub payload contains error:`, data.error);
      return res.status(500).json({
        error: data.error,
        economicCalendar: [],
        fallbackActive: true
      });
    }

    if (!Array.isArray(data.economicCalendar) || data.economicCalendar.length === 0) {
      console.log(`[/api/economic-calendar] Finnhub returned empty event array for ${from} to ${to}`);
      return res.status(500).json({
        error: 'Finnhub returned an empty economicCalendar array for range',
        economicCalendar: [],
        fallbackActive: true
      });
    }

    console.log(`[/api/economic-calendar] Received ${data.economicCalendar.length} live events from Finnhub.`);
    return res.json(data);
  } catch (error: any) {
    console.error('[/api/economic-calendar] Server exception querying Finnhub:', error);
    return res.status(500).json({
      error: error?.message || 'Server exception querying Finnhub',
      economicCalendar: [],
      fallbackActive: true
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
