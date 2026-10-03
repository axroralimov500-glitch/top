import { Router } from 'express';
import { asInt, oneOf, asString } from '../lib/validate.js';
import { listCategories, listProducts, getProductBySlugOrId } from './catalog.service.js';

export function catalogRoutes(db) {
  const router = Router();

  router.get('/categories', (req, res) => {
    res.json({ data: listCategories(db) });
  });

  router.get('/products', (req, res) => {
    const category = req.query.category ? asString(req.query.category, 'category', { max: 80 }) : undefined;
    const q = req.query.q ? asString(req.query.q, 'q', { max: 60 }) : undefined;
    const page = asInt(req.query.page, 'page', { min: 1, max: 100000, optional: true, def: 1 });
    const limit = asInt(req.query.limit, 'limit', { min: 1, max: 50, optional: true, def: 10 });
    const sort = oneOf(req.query.sort, 'sort', ['price_asc', 'price_desc', 'newest'], { optional: true, def: 'newest' });
    const { items, meta } = listProducts(db, { category, q, page, limit, sort });
    res.json({ data: items, meta });
  });

  router.get('/products/:idOrSlug', (req, res) => {
    res.json({ data: getProductBySlugOrId(db, req.params.idOrSlug) });
  });

  return router;
}
