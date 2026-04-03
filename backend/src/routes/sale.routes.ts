import type { FastifyInstance } from 'fastify';
import { getSaleStatusResponse } from '../services/sale.service.js';

export async function saleRoutes(app: FastifyInstance) {
  app.get('/api/sale/status', async () => {
    return getSaleStatusResponse();
  });
}
