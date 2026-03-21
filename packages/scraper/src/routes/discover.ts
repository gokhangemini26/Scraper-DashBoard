import { Router } from 'express';
import { discoverLinks } from '../services/discoverer';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    // Validate URL structure
    new URL(url);

    const links = await discoverLinks(url);
    res.json({ links });
  } catch (error: any) {
    console.error('Discover error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
