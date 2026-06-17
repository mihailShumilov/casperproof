import { describe, expect, it } from 'vitest';
import { defaultConfig, loadConfig } from './agent.config.js';

describe('loadConfig', () => {
  it('falls back to documented defaults on an empty environment', () => {
    const config = loadConfig({});
    expect(config.llmBackend).toBe('ollama');
    expect(config.ollamaHost).toBe('http://ollama:11434');
    expect(config.ollamaModel).toBe('llama3.1:8b');
    expect(config.pollIntervalMs).toBe(5_000);
    expect(config.riskScorerModelId).toBe('casperproof-riskscorer-v1');
    expect(config.claimOracleModelId).toBe('casperproof-claimoracle-v1');
    expect(config.attestationStake).toBe('2000000000');
    expect(config.thresholds).toEqual({ medium: 34, high: 67, extreme: 85 });
  });

  it('reads each supported backend value', () => {
    for (const backend of ['ollama', 'none', 'openai', 'anthropic'] as const) {
      expect(loadConfig({ LLM_BACKEND: backend }).llmBackend).toBe(backend);
    }
  });

  it('ignores an unknown backend and uses the default', () => {
    expect(loadConfig({ LLM_BACKEND: 'mystery' }).llmBackend).toBe('ollama');
  });

  it('treats empty / whitespace env values as unset', () => {
    const config = loadConfig({ OLLAMA_HOST: '   ', LLM_BACKEND: '' });
    expect(config.ollamaHost).toBe('http://ollama:11434');
    expect(config.llmBackend).toBe('ollama');
  });

  it('overrides hosts, models, ids, stake from the environment', () => {
    const config = loadConfig({
      LLM_BACKEND: 'none',
      OLLAMA_HOST: 'http://localhost:11434',
      OLLAMA_MODEL: 'qwen2.5:7b',
      RISK_SCORER_MODEL_ID: 'rs-v2',
      CLAIM_ORACLE_MODEL_ID: 'co-v2',
      ATTESTATION_STAKE: '5000000000',
    });
    expect(config.ollamaHost).toBe('http://localhost:11434');
    expect(config.ollamaModel).toBe('qwen2.5:7b');
    expect(config.riskScorerModelId).toBe('rs-v2');
    expect(config.claimOracleModelId).toBe('co-v2');
    expect(config.attestationStake).toBe('5000000000');
  });

  it('parses a valid integer poll interval and thresholds', () => {
    const config = loadConfig({
      AGENT_POLL_INTERVAL_MS: '1000',
      RISK_THRESHOLD_MEDIUM: '30',
      RISK_THRESHOLD_HIGH: '60',
      RISK_THRESHOLD_EXTREME: '90',
    });
    expect(config.pollIntervalMs).toBe(1000);
    expect(config.thresholds).toEqual({ medium: 30, high: 60, extreme: 90 });
  });

  it('rejects non-integer / negative numeric env and falls back', () => {
    expect(loadConfig({ AGENT_POLL_INTERVAL_MS: 'abc' }).pollIntervalMs).toBe(5_000);
    expect(loadConfig({ AGENT_POLL_INTERVAL_MS: '-5' }).pollIntervalMs).toBe(5_000);
    expect(loadConfig({ AGENT_POLL_INTERVAL_MS: '1.5' }).pollIntervalMs).toBe(5_000);
  });

  it('exposes a defaultConfig resolved from process.env', () => {
    expect(defaultConfig).toHaveProperty('llmBackend');
    expect(defaultConfig.thresholds.extreme).toBeGreaterThan(defaultConfig.thresholds.high);
  });
});
