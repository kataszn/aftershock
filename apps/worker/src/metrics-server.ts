// Minimal HTTP server exposing Prometheus metrics for the worker. The worker
// has no public ingress, so this is scraped in-cluster (CloudWatch agent /
// ADOT collector via ECS service discovery) rather than through the ALB.
import { createServer } from 'node:http';
import { logger, metrics } from './telemetry';

const port = Number(process.env.METRICS_PORT ?? 9464);

export function startMetricsServer(): void {
  const server = createServer(async (req, res) => {
    if (req.url === '/metrics') {
      try {
        const body = await metrics.render();
        res.writeHead(200, { 'Content-Type': metrics.contentType });
        res.end(body);
      } catch (err) {
        logger.error({ err }, 'failed to render metrics');
        res.writeHead(500);
        res.end();
      }
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    logger.info({ port }, 'worker metrics server listening');
  });
}
