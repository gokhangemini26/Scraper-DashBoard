import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Try loading .env from multiple potential paths (local dev vs Docker)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import discoverRouter from './routes/discover';
import scrapeRouter from './routes/scrape';

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_TOKEN = process.env.SCRAPER_SECRET_TOKEN || 'generate-a-random-string-here';

app.use(cors());
app.use(express.json());

// Health check — no auth required (Render uses this)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'smartscraper-engine', timestamp: new Date().toISOString() });
});

// Token validation middleware (only for /discover and /scrape)
app.use((req, res, next) => {
  // Skip auth in dev mode when no token is configured
  if (!SECRET_TOKEN || SECRET_TOKEN === 'generate-a-random-string-here') {
    return next();
  }

  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (token !== SECRET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized scraper access' });
  }
  next();
});

app.use('/discover', discoverRouter);
app.use('/scrape', scrapeRouter);

app.listen(PORT, () => {
  console.log(`🚀 Scraper service is running on http://localhost:${PORT}`);
});
