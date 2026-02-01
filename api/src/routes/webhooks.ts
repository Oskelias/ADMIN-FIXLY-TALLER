import { Hono } from 'hono';
import { Env } from '../types';
import { generateId } from '../utils/helpers';

const app = new Hono<{ Bindings: Env }>();

// MercadoPago webhook
app.post('/mercadopago', async (c) => {
  const body = await c.req.json();

  console.log('MercadoPago webhook received:', JSON.stringify(body));

  // Verify webhook signature (optional but recommended)
  const signature = c.req.header('x-signature');
  if (c.env.MP_WEBHOOK_SECRET && signature) {
    // TODO: Implement signature verification
    // https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
  }

  const { type, data, action } = body;

  if (type === 'payment') {
    const paymentId = data?.id;

    if (!paymentId) {
      return c.json({ error: 'Payment ID required' }, 400);
    }

    try {
      // Fetch payment details from MercadoPago
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${c.env.MP_ACCESS_TOKEN}`,
          },
        }
      );

      if (!mpResponse.ok) {
        console.error('Failed to fetch payment from MP:', await mpResponse.text());
        return c.json({ error: 'Failed to fetch payment details' }, 500);
      }

      const mpPayment = await mpResponse.json() as any;

      // Map MercadoPago status to our status
      const statusMap: Record<string, string> = {
        approved: 'approved',
        pending: 'pending',
        in_process: 'pending',
        rejected: 'rejected',
        cancelled: 'cancelled',
        refunded: 'refunded',
        charged_back: 'refunded',
      };

      const status = statusMap[mpPayment.status] || 'pending';

      // Extract tenant ID from metadata or external_reference
      const tenantId = mpPayment.metadata?.tenant_id ||
        mpPayment.external_reference?.split('-')[0] ||
        'unknown';

      // Check if payment already exists
      const existing = await c.env.DB.prepare(
        'SELECT id FROM payments WHERE external_id = ?'
      )
        .bind(String(paymentId))
        .first();

      if (existing) {
        // Update existing payment
        await c.env.DB.prepare(`
          UPDATE payments
          SET status = ?, processed_at = datetime('now'), updated_at = datetime('now')
          WHERE external_id = ?
        `)
          .bind(status, String(paymentId))
          .run();

        console.log(`Payment ${paymentId} updated to ${status}`);
      } else {
        // Create new payment record
        const id = generateId();

        await c.env.DB.prepare(`
          INSERT INTO payments (
            id, tenant_id, external_id, amount, currency, status,
            payment_method, payer_name, payer_email, payer_document,
            description, metadata, processed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `).bind(
          id,
          tenantId,
          String(paymentId),
          mpPayment.transaction_amount || 0,
          mpPayment.currency_id || 'ARS',
          status,
          mpPayment.payment_method_id || 'unknown',
          mpPayment.payer?.first_name
            ? `${mpPayment.payer.first_name} ${mpPayment.payer.last_name || ''}`
            : null,
          mpPayment.payer?.email || null,
          mpPayment.payer?.identification?.number || null,
          mpPayment.description || 'MercadoPago payment',
          JSON.stringify(mpPayment.metadata || {})
        ).run();

        console.log(`Payment ${paymentId} created with status ${status}`);
      }

      // Create audit log for the webhook
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (
          id, user_id, user_name, user_email, action,
          resource_type, resource_id, new_value, created_at
        ) VALUES (?, 'system', 'MercadoPago Webhook', 'webhook@mercadopago.com', ?, ?, ?, ?, datetime('now'))
      `).bind(
        generateId(),
        'payment.webhook',
        'payment',
        String(paymentId),
        JSON.stringify({ status, action })
      ).run();

      return c.json({ success: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return c.json({ error: 'Internal error' }, 500);
    }
  }

  // Handle other webhook types
  if (type === 'plan' || type === 'subscription') {
    console.log(`Received ${type} webhook:`, data);
    // Handle subscription webhooks
    return c.json({ success: true });
  }

  return c.json({ success: true, message: 'Webhook received' });
});

// Health check for webhooks
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'webhooks' });
});

export { app as webhookRoutes };
