import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const posthogMock = {
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
};
vi.mock('posthog-js', () => ({ default: posthogMock }));

async function loadAnalytics(key) {
  vi.resetModules();
  vi.stubEnv('VITE_POSTHOG_KEY', key);
  return import('./analytics.js');
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('analytics wrapper', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('is a silent no-op without a real key and never initialises PostHog', async () => {
    const { default: analytics, initAnalytics } = await loadAnalytics('');
    expect(analytics.enabled).toBe(false);
    initAnalytics();
    analytics.capture('$pageview');
    analytics.identify('u1');
    analytics.reset();
    await flush();
    expect(posthogMock.init).not.toHaveBeenCalled();
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });

  it('treats the placeholder mock key as disabled', async () => {
    const { default: analytics } = await loadAnalytics('mock-posthog-api-key');
    expect(analytics.enabled).toBe(false);
  });

  it('queues calls made before PostHog loads and replays them in order', async () => {
    const { default: analytics } = await loadAnalytics('phc_real_key');
    expect(analytics.enabled).toBe(true);

    analytics.identify('user-1', { name: 'Alice' });
    analytics.capture('search_executed', { query: 'Alice' });
    await vi.waitFor(() => expect(posthogMock.capture).toHaveBeenCalled());

    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    expect(posthogMock.init).toHaveBeenCalledWith('phc_real_key', expect.objectContaining({ capture_pageview: false }));
    expect(posthogMock.identify).toHaveBeenCalledWith('user-1', { name: 'Alice' });
    expect(posthogMock.capture).toHaveBeenCalledWith('search_executed', { query: 'Alice' });
    expect(posthogMock.identify.mock.invocationCallOrder[0])
      .toBeLessThan(posthogMock.capture.mock.invocationCallOrder[0]);

    // After loading, calls go straight through.
    analytics.reset();
    expect(posthogMock.reset).toHaveBeenCalledTimes(1);
    expect(posthogMock.init).toHaveBeenCalledTimes(1);
  });
});
