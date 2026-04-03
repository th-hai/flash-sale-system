import type { FastifyInstance } from 'fastify';
import { getSaleStatus } from '../services/sale.service.js';
import { attemptPurchase, hasUserPurchased } from '../services/purchase.service.js';
import { publishOrder } from '../queue/order.queue.js';
import { PurchaseResult } from '../types/index.js';
import type { PurchaseResponse, PurchaseCheckResponse } from '../types/index.js';

const purchaseBodySchema = {
  type: 'object',
  required: ['userId'],
  properties: {
    userId: { type: 'string', minLength: 1 },
  },
} as const;

export async function purchaseRoutes(app: FastifyInstance) {
  app.post<{ Body: { userId: string } }>(
    '/api/purchase',
    { schema: { body: purchaseBodySchema } },
    async (request, reply) => {
      const { userId } = request.body;

      // Check sale window
      const status = getSaleStatus();
      if (status !== 'active') {
        const response: PurchaseResponse = {
          success: false,
          message: status === 'upcoming'
            ? 'The sale has not started yet'
            : 'The sale has ended',
          reason: 'SALE_NOT_ACTIVE',
        };
        return reply.status(403).send(response);
      }

      const result = await attemptPurchase(userId);

      switch (result) {
        case PurchaseResult.SUCCESS: {
          // Publish to queue (SQS) for async order processing
          await publishOrder(userId);

          const response: PurchaseResponse = {
            success: true,
            message: 'Purchase confirmed! You have secured your item.',
          };
          return reply.status(201).send(response);
        }
        case PurchaseResult.ALREADY_PURCHASED: {
          const response: PurchaseResponse = {
            success: false,
            message: 'You have already purchased this item.',
            reason: 'ALREADY_PURCHASED',
          };
          return reply.status(409).send(response);
        }
        case PurchaseResult.OUT_OF_STOCK: {
          const response: PurchaseResponse = {
            success: false,
            message: 'Sorry, the item is sold out.',
            reason: 'OUT_OF_STOCK',
          };
          return reply.status(410).send(response);
        }
      }
    }
  );

  app.get<{ Params: { userId: string } }>(
    '/api/purchase/:userId',
    async (request) => {
      const { userId } = request.params;
      const purchased = await hasUserPurchased(userId);
      const response: PurchaseCheckResponse = { purchased };
      return response;
    }
  );
}
