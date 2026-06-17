/**
 * x402-gated CasperProof resource server (Fastify).
 *
 * - `GET /attestation/:id` — on-chain metadata + the off-chain payload (S3), x402-gated.
 * - `POST /verify` — recompute + compare hashes → PASS/FAIL, x402-gated.
 *
 * Unpaid/invalid requests get a `402` with an RFC 7807 body; valid payments are verified with
 * the Casper facilitator (or the local mock) before the resource is served.
 */
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { CasperProofSdk, CasperProofSdkError, createClient } from '@casperproof/casper-sdk';
import { createStore, verify, type PayloadStore } from '@casperproof/agent';
import { loadConfig, type X402Config } from './config.js';
import {
  APPLICATION_PROBLEM_JSON,
  attestationNotFound,
  badRequest,
  internalError,
  paymentRequired,
  payloadUnavailable,
  type Problem,
} from './problem.js';
import { createPaymentVerifier, type PaymentVerifier } from './payment.js';

export interface ServerDeps {
  sdk: CasperProofSdk;
  store: PayloadStore;
  paymentVerifier: PaymentVerifier;
  config: X402Config;
}

function sendProblem(reply: FastifyReply, problem: Problem): FastifyReply {
  return reply.code(problem.status).type(APPLICATION_PROBLEM_JSON).send(problem);
}

function parseId(raw: string): number | undefined {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 0 ? id : undefined;
}

/** Build a Fastify server from injected deps (so tests can seed the SDK + store). */
export function buildServer(deps: ServerDeps): FastifyInstance {
  const { sdk, store, paymentVerifier, config } = deps;
  const app = Fastify({ logger: false });

  // x402 gate: require a verified payment before the handler runs.
  const requirePayment = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const header = req.headers['x-payment'];
    const value = Array.isArray(header) ? header[0] : header;
    const result = await paymentVerifier.verify(value, {
      resource: `${req.method} ${req.url}`,
      priceUsd: config.priceUsd,
    });
    if (!result.ok) {
      sendProblem(reply, paymentRequired(config.priceUsd, config.payTo, req.url));
      return;
    }
    if (result.settlement) {
      reply.header('x-payment-settlement', result.settlement);
    }
  };

  app.get('/healthz', async () => ({ status: 'ok', mode: sdk.mode }));
  app.get('/health', async () => ({ status: 'ok', mode: sdk.mode }));

  app.get('/attestation/:id', { preHandler: requirePayment }, async (req, reply) => {
    const { id: rawId } = req.params as { id: string };
    const id = parseId(rawId);
    if (id === undefined) {
      return sendProblem(reply, badRequest(`Invalid attestation id: ${rawId}`));
    }
    try {
      const attestation = await sdk.getAttestation(id);
      let payload: unknown = null;
      try {
        payload = await store.getJson(attestation.uri);
      } catch {
        // Payload missing from the store — surface metadata but flag the gap.
        return sendProblem(reply, payloadUnavailable(attestation.uri));
      }
      return reply.send({ attestation, payload });
    } catch (err) {
      return handleError(reply, err, id);
    }
  });

  app.post('/verify', { preHandler: requirePayment }, async (req, reply) => {
    const body = (req.body ?? {}) as { id?: unknown };
    const id = typeof body.id === 'number' ? body.id : parseId(String(body.id));
    if (id === undefined) {
      return sendProblem(reply, badRequest('Body must include a numeric `id`.'));
    }
    try {
      const result = await verify(sdk, store, id);
      // PASS → 200; FAIL (tampered) → 200 with valid:false (a successful verification that
      // returns a negative verdict), per the verification algorithm (§8).
      return reply.send(result);
    } catch (err) {
      return handleError(reply, err, id);
    }
  });

  return app;
}

function handleError(reply: FastifyReply, err: unknown, id: number): FastifyReply {
  if (err instanceof CasperProofSdkError && err.code === 'ATTESTATION_NOT_FOUND') {
    return sendProblem(reply, attestationNotFound(id));
  }
  return sendProblem(reply, internalError());
}

/** Build a server from environment config with real (non-test) dependencies. */
export function createServer(env: Record<string, string | undefined> = process.env): FastifyInstance {
  const config = loadConfig(env);
  const sdk = createClient();
  const store = createStore();
  const paymentVerifier = createPaymentVerifier({
    mock: config.mock,
    facilitatorUrl: config.facilitatorUrl,
  });
  return buildServer({ sdk, store, paymentVerifier, config });
}

/* v8 ignore start -- process entry point (listen) exercised at runtime, not in unit tests */
/** Entry point. */
export async function main(): Promise<void> {
  const config = loadConfig();
  const app = createServer();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`x402-server listening on :${config.port} (facilitator: ${config.mock ? 'mock' : config.facilitatorUrl})`);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
/* v8 ignore stop */
