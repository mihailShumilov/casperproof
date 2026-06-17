/**
 * Content-addressed payload store for off-chain attestation payloads.
 *
 * The object key is the blake2b-256 hash of the bytes (via the locked `@casperproof/commitment`
 * hash — never reimplemented), so storage is content-addressed and tamper-evident: changing a
 * byte changes the key. `put` returns an `s3://bucket/key` URI; `get` fetches the bytes back.
 *
 * Two backends, selected automatically:
 * - **in-memory** (default) — used when `S3_ENDPOINT` is unset, so unit tests and offline runs
 *   work with no MinIO/R2 and no secrets.
 * - **S3** — `@aws-sdk/client-s3` against MinIO locally / Cloudflare R2 or AWS S3 in prod.
 *
 * A dev-only {@link PayloadStore.corrupt} mutates a stored payload **without** changing its key,
 * which powers the tamper demo: the verifier then recomputes a hash that no longer matches the
 * on-chain commitment and reports FAIL.
 */
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { blake2b256, canonicalBytes, toHex } from '@casperproof/commitment';
import type { JsonValue } from '@casperproof/commitment';

/** Resolved S3 connection configuration. */
export interface StoreConfig {
  /** S3 / MinIO endpoint. When unset, the in-memory backend is used. */
  endpoint?: string;
  /** AWS region. Defaults to `us-east-1`. */
  region: string;
  /** Bucket holding payloads. */
  bucket: string;
  /** Access key id. */
  accessKeyId?: string;
  /** Secret access key. */
  secretAccessKey?: string;
  /** Force path-style addressing (required by MinIO). */
  forcePathStyle: boolean;
}

/** Treat empty / whitespace-only env values as unset. */
function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve {@link StoreConfig} from an environment record.
 *
 * @param env Environment source. Defaults to `process.env`. Injectable for tests.
 */
export function loadStoreConfig(
  env: Record<string, string | undefined> = process.env,
): StoreConfig {
  return {
    endpoint: clean(env['S3_ENDPOINT']),
    region: clean(env['S3_REGION']) ?? 'us-east-1',
    bucket: clean(env['S3_BUCKET']) ?? 'casperproof-payloads',
    accessKeyId: clean(env['S3_ACCESS_KEY']),
    secretAccessKey: clean(env['S3_SECRET_KEY']),
    forcePathStyle: clean(env['S3_FORCE_PATH_STYLE']) !== 'false',
  };
}

/** Encode arbitrary input to canonical bytes (JSON via the commitment canonicalizer). */
function toBytes(input: Uint8Array | JsonValue): Uint8Array {
  return input instanceof Uint8Array ? input : canonicalBytes(input);
}

/** The content-addressed key (blake2b-256 hash hex) for a byte payload. */
export function contentKey(bytes: Uint8Array): string {
  return toHex(blake2b256(bytes));
}

/** Parse a `s3://bucket/key` URI into its parts. */
export function parseUri(uri: string): { bucket: string; key: string } {
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid store URI: ${uri}`);
  }
  return { bucket: match[1], key: match[2] };
}

/** The pluggable byte backend behind a {@link PayloadStore}. */
export interface StoreBackend {
  /** Backend kind, for diagnostics. */
  readonly kind: 'memory' | 's3';
  /** Persist bytes under `key` in `bucket`. */
  putBytes(bucket: string, key: string, bytes: Uint8Array): Promise<void>;
  /** Fetch bytes for `key` in `bucket`. Throws when absent. */
  getBytes(bucket: string, key: string): Promise<Uint8Array>;
}

/** In-memory backend: a `Map` keyed by `bucket/key`. Used offline and in tests. */
export class MemoryBackend implements StoreBackend {
  readonly kind = 'memory' as const;
  private readonly objects = new Map<string, Uint8Array>();

  private ref(bucket: string, key: string): string {
    return `${bucket}/${key}`;
  }

  async putBytes(bucket: string, key: string, bytes: Uint8Array): Promise<void> {
    this.objects.set(this.ref(bucket, key), bytes);
  }

  async getBytes(bucket: string, key: string): Promise<Uint8Array> {
    const found = this.objects.get(this.ref(bucket, key));
    if (!found) throw new Error(`Payload not found: ${bucket}/${key}`);
    return found;
  }

  /**
   * Dev-only: overwrite the bytes at `bucket/key` **without** changing the key. Powers the
   * tamper demo. Returns `false` when no such object exists.
   */
  tamper(bucket: string, key: string, bytes: Uint8Array): boolean {
    const ref = this.ref(bucket, key);
    if (!this.objects.has(ref)) return false;
    this.objects.set(ref, bytes);
    return true;
  }
}

/** S3 backend over `@aws-sdk/client-s3` (MinIO / R2 / AWS S3). */
export class S3Backend implements StoreBackend {
  readonly kind = 's3' as const;
  private readonly client: S3Client;

  constructor(config: StoreConfig, client?: S3Client) {
    this.client =
      client ??
      new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials:
          config.accessKeyId && config.secretAccessKey
            ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
            : undefined,
      });
  }

  /** Ensure the bucket exists (idempotent); best-effort for local MinIO bring-up. */
  async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  }

  async putBytes(bucket: string, key: string, bytes: Uint8Array): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes }));
  }

  async getBytes(bucket: string, key: string): Promise<Uint8Array> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!out.Body) throw new Error(`Empty payload body: ${bucket}/${key}`);
    const bytes = await out.Body.transformToByteArray();
    return bytes;
  }
}

/**
 * The content-addressed payload store. Prefer {@link createStore} to construct one with the
 * right backend selected from the environment.
 */
export class PayloadStore {
  constructor(
    private readonly backend: StoreBackend,
    private readonly bucket: string,
  ) {}

  /** Which backend is in use (`memory` offline, `s3` when an endpoint is configured). */
  get backendKind(): 'memory' | 's3' {
    return this.backend.kind;
  }

  /**
   * Store a payload and return its content-addressed `s3://bucket/key` URI.
   *
   * @param input Raw bytes, or a JSON value (canonicalized via the commitment canonicalizer).
   */
  async put(input: Uint8Array | JsonValue): Promise<string> {
    const bytes = toBytes(input);
    const key = contentKey(bytes);
    await this.backend.putBytes(this.bucket, key, bytes);
    return `s3://${this.bucket}/${key}`;
  }

  /** Fetch the raw bytes for a previously stored URI. */
  async get(uri: string): Promise<Uint8Array> {
    const { bucket, key } = parseUri(uri);
    return this.backend.getBytes(bucket, key);
  }

  /** Fetch a stored payload and decode it as UTF-8 JSON. */
  async getJson(uri: string): Promise<JsonValue> {
    const bytes = await this.get(uri);
    return JSON.parse(new TextDecoder().decode(bytes)) as JsonValue;
  }

  /**
   * Dev-only: corrupt the payload at `uri` **without** changing its key, so the on-chain
   * commitment no longer matches and the verifier reports FAIL. Powers the tamper demo.
   *
   * Only supported on the in-memory backend; throws otherwise (never tamper real storage).
   *
   * @param uri The URI to corrupt.
   * @param replacement Optional replacement bytes. Defaults to a fixed tampered marker.
   * @returns The (unchanged) URI.
   */
  async corrupt(uri: string, replacement?: Uint8Array | JsonValue): Promise<string> {
    if (!(this.backend instanceof MemoryBackend)) {
      throw new Error('corrupt() is only supported on the in-memory backend (dev-only).');
    }
    const { bucket, key } = parseUri(uri);
    const bytes = toBytes(replacement ?? { tampered: true });
    const ok = this.backend.tamper(bucket, key, bytes);
    if (!ok) throw new Error(`Cannot corrupt missing payload: ${uri}`);
    return uri;
  }
}

/**
 * Create a {@link PayloadStore}, selecting the S3 backend when `S3_ENDPOINT` is configured and
 * the in-memory backend otherwise (offline / test default).
 *
 * @param config Resolved store config. Defaults to {@link loadStoreConfig}.
 * @param backend Explicit backend override (mostly for tests).
 */
export function createStore(
  config: StoreConfig = loadStoreConfig(),
  backend?: StoreBackend,
): PayloadStore {
  const chosen = backend ?? (config.endpoint ? new S3Backend(config) : new MemoryBackend());
  return new PayloadStore(chosen, config.bucket);
}
