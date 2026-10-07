import { Router, Request, Response } from 'express';
import { aggregatorService } from '../providers/aggregatorService';
import { rankingEngine } from '../ranking/rankingEngine';
import { SearchFilters, SearchResponse, StoreName } from '../types/product';

const router = Router();

// GET /api/search?q=earbuds&budget=2000&preference=cheapest&brand=boat
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required.' });
    }

    const filters: SearchFilters = {
      maxBudget: req.query.budget ? parseFloat(req.query.budget as string) : undefined,
      minBudget: req.query.minBudget ? parseFloat(req.query.minBudget as string) : undefined,
      brand: req.query.brand as string | undefined,
      preference: (req.query.preference as any) || 'balanced',
      stores: req.query.stores ? ((req.query.stores as string).split(',') as StoreName[]) : undefined,
      inStockOnly: req.query.inStockOnly !== 'false'
    };

    // Parallel fetch from Amazon, Flipkart, Meesho
    const { products, storeStatuses } = await aggregatorService.searchAllStores(query, filters);

    // Apply ranking algorithm
    const { rankedProducts, topRecommendations, comparisonMatrix } = rankingEngine.rank(
      products,
      filters,
      storeStatuses
    );

    const response: SearchResponse = {
      query,
      filters,
      totalResults: rankedProducts.length,
      products: rankedProducts,
      topRecommendations,
      comparisonMatrix,
      storeStatuses,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error: any) {
    console.error('Search route error:', error);
    return res.status(500).json({ error: 'Search processing failed', details: error.message });
  }
});

// GET /api/search/status - Provider connection statuses
router.get('/status', async (req: Request, res: Response) => {
  try {
    const statuses = await aggregatorService.getStoreStatuses();
    return res.json({ storeStatuses: statuses });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve store statuses' });
  }
});

export default router;
