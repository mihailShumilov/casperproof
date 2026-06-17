import { describe, expect, it, vi } from 'vitest';
import {
  contentKey,
  createStore,
  loadStoreConfig,
  MemoryBackend,
  parseUri,
  PayloadStore,
  S3Backend,
} from './store.js';
import type { StoreBackend } from './store.js';

describe('loadStoreConfig', () => {
  it('falls back to documented defaults on an empty env', () => {
    const config = loadStoreConfig({});
    expect(config.endpoint).toBeUndefined();
    expect(config.region).toBe('us-east-1');
    expect(config.bucket).toBe('casperproof-payloads');
    expect(config.forcePathStyle).toBe(true);
  });

  it('reads S3_* env values and the path-style toggle', () => {
    const config = loadStoreConfig({
      S3_ENDPOINT: 'http://minio:9000',
      S3_REGION: 'eu-west-1',
      S3_BUCKET: 'mybucket',
      S3_ACCESS_KEY: 'ak',
      S3_SECRET_KEY: 'sk',
      S3_FORCE_PATH_STYLE: 'false',
    });
    expect(config.endpoint).toBe('http://minio:9000');
    expect(config.region).toBe('eu-west-1');
    expect(config.bucket).toBe('mybucket');
    expect(config.accessKeyId).toBe('ak');
    expect(config.secretAccessKey).toBe('sk');
    expect(config.forcePathStyle).toBe(false);
  });

  it('treats whitespace endpoint as unset', () => {
    expect(loadStoreConfig({ S3_ENDPOINT: '   ' }).endpoint).toBeUndefined();
  });
});

describe('parseUri', () => {
  it('parses a valid s3 uri', () => {
    expect(parseUri('s3://bucket/abc123')).toEqual({ bucket: 'bucket', key: 'abc123' });
  });

  it('throws on a malformed uri', () => {
    expect(() => parseUri('http://nope')).toThrow(/Invalid store URI/);
    expect(() => parseUri('s3://bucketonly')).toThrow(/Invalid store URI/);
  });
});

describe('contentKey', () => {
  it('is the blake2b hash hex of the bytes (64 chars)', () => {
    const key = contentKey(new TextEncoder().encode('hello'));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(contentKey(new TextEncoder().encode('hello'))).toBe(key);
  });
});

describe('PayloadStore (in-memory, default offline)', () => {
  it('createStore selects the memory backend when no endpoint is configured', () => {
    const store = createStore(loadStoreConfig({}));
    expect(store.backendKind).toBe('memory');
  });

  it('puts JSON and reads it back as bytes and json (content-addressed)', async () => {
    const store = createStore(loadStoreConfig({ S3_BUCKET: 'payloads' }));
    const uri = await store.put({ b: 2, a: 1 });
    expect(uri).toMatch(/^s3:\/\/payloads\/[0-9a-f]{64}$/);
    const json = await store.getJson(uri);
    expect(json).toEqual({ b: 2, a: 1 });
  });

  it('puts raw bytes and reads them back', async () => {
    const store = createStore(loadStoreConfig({}));
    const bytes = new TextEncoder().encode('raw-bytes');
    const uri = await store.put(bytes);
    const back = await store.get(uri);
    expect(new TextDecoder().decode(back)).toBe('raw-bytes');
  });

  it('returns the same URI for identical content (content addressing)', async () => {
    const store = createStore(loadStoreConfig({}));
    const a = await store.put({ x: 1 });
    const b = await store.put({ x: 1 });
    expect(a).toBe(b);
  });

  it('throws when getting a missing payload', async () => {
    const store = createStore(loadStoreConfig({}));
    await expect(store.get('s3://casperproof-payloads/deadbeef')).rejects.toThrow(/not found/);
  });

  it('corrupts a stored payload without changing its key (tamper demo)', async () => {
    const store = createStore(loadStoreConfig({}));
    const uri = await store.put({ score: 42 });
    const returned = await store.corrupt(uri);
    expect(returned).toBe(uri);
    expect(await store.getJson(uri)).toEqual({ tampered: true });
  });

  it('corrupts with explicit replacement bytes', async () => {
    const store = createStore(loadStoreConfig({}));
    const uri = await store.put({ score: 42 });
    await store.corrupt(uri, { score: 999 });
    expect(await store.getJson(uri)).toEqual({ score: 999 });
  });

  it('throws when corrupting a missing payload', async () => {
    const store = createStore(loadStoreConfig({}));
    await expect(store.corrupt('s3://casperproof-payloads/missingkey')).rejects.toThrow(
      /Cannot corrupt missing/,
    );
  });

  it('refuses to corrupt on a non-memory backend', async () => {
    const fakeS3: StoreBackend = {
      kind: 's3',
      async putBytes() {},
      async getBytes() {
        return new Uint8Array();
      },
    };
    const store = new PayloadStore(fakeS3, 'b');
    await expect(store.corrupt('s3://b/x')).rejects.toThrow(/only supported on the in-memory/);
  });
});

describe('MemoryBackend', () => {
  it('tamper() returns false for a missing object', () => {
    const backend = new MemoryBackend();
    expect(backend.tamper('b', 'missing', new Uint8Array())).toBe(false);
  });
});

describe('createStore backend selection + S3Backend', () => {
  it('selects the S3 backend when an endpoint is configured', () => {
    const store = createStore(
      loadStoreConfig({ S3_ENDPOINT: 'http://minio:9000', S3_ACCESS_KEY: 'a', S3_SECRET_KEY: 'b' }),
    );
    expect(store.backendKind).toBe('s3');
  });

  it('constructs an S3Backend without credentials', () => {
    const backend = new S3Backend(loadStoreConfig({ S3_ENDPOINT: 'http://minio:9000' }));
    expect(backend.kind).toBe('s3');
  });

  it('put/get round-trips through an injected S3 client', async () => {
    const sent: unknown[] = [];
    const fakeClient = {
      send: vi.fn(async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        sent.push(command);
        const name = command.constructor.name;
        if (name === 'GetObjectCommand') {
          return {
            Body: { transformToByteArray: async () => new TextEncoder().encode('"stored"') },
          };
        }
        return {};
      }),
    };
    const backend = new S3Backend(
      loadStoreConfig({ S3_ENDPOINT: 'http://minio:9000', S3_BUCKET: 'b' }),
      fakeClient as never,
    );
    const store = new PayloadStore(backend, 'b');
    const uri = await store.put('stored');
    expect(uri).toMatch(/^s3:\/\/b\/[0-9a-f]{64}$/);
    expect(await store.getJson(uri)).toBe('stored');
  });

  it('ensureBucket creates the bucket when HeadBucket fails', async () => {
    const calls: string[] = [];
    const fakeClient = {
      send: vi.fn(async (command: { constructor: { name: string } }) => {
        calls.push(command.constructor.name);
        if (command.constructor.name === 'HeadBucketCommand') throw new Error('404');
        return {};
      }),
    };
    const backend = new S3Backend(loadStoreConfig({ S3_ENDPOINT: 'http://m:9000' }), fakeClient as never);
    await backend.ensureBucket('b');
    expect(calls).toEqual(['HeadBucketCommand', 'CreateBucketCommand']);
  });

  it('ensureBucket is a no-op when the bucket already exists', async () => {
    const calls: string[] = [];
    const fakeClient = {
      send: vi.fn(async (command: { constructor: { name: string } }) => {
        calls.push(command.constructor.name);
        return {};
      }),
    };
    const backend = new S3Backend(loadStoreConfig({ S3_ENDPOINT: 'http://m:9000' }), fakeClient as never);
    await backend.ensureBucket('b');
    expect(calls).toEqual(['HeadBucketCommand']);
  });

  it('throws when GetObject returns an empty body', async () => {
    const fakeClient = { send: vi.fn(async () => ({ Body: undefined })) };
    const backend = new S3Backend(loadStoreConfig({ S3_ENDPOINT: 'http://m:9000' }), fakeClient as never);
    await expect(backend.getBytes('b', 'k')).rejects.toThrow(/Empty payload body/);
  });
});
