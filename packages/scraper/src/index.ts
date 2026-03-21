import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import discoverRouter from './routes/discover';
import scrapeRouter from './routes/scrape';

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_TOKEN = process.env.SCRAPER_SECRET_TOKEN || 'generate-a-random-string-here';

app.use(cors());
app.use(express.json());

// Token validation middleware
app.use((req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!process.env.SCRAPER_SECRET_TOKEN && token !== SECRET_TOKEN) {
      // If dev without tokens skip or log
  } else if (token !== SECRET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized scraper access' });
  }
  next();
});

app.use('/discover', discoverRouter);
app.use('/scrape', scrapeRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'smartscraper-engine', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Scraper service is running on http://localhost:${PORT}`);
});
