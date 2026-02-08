import express from 'express';
import {
  advancedSearch,
  getSearchSuggestions,
  getFilterOptions,
  getPopularSearches,
} from '../controllers/searchController';

const router = express.Router();

// Public routes
router.get('/', advancedSearch);
router.get('/suggestions', getSearchSuggestions);
router.get('/filters', getFilterOptions);
router.get('/popular', getPopularSearches);

export default router;
