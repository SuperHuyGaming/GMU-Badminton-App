/**
 * Everything Jest's modern fake timers can fake, except Date.
 *
 * Pass as `doNotFake` to pin "now" for tests whose fixtures use real calendar dates,
 * while leaving timers, microtasks and nextTick real so awaited mocks still resolve:
 *
 *   jest.useFakeTimers({ now: new Date('2026-11-01T12:00:00.000Z'), doNotFake: NON_DATE_FAKEABLES });
 *   try { ... } finally { jest.useRealTimers(); }
 */
const NON_DATE_FAKEABLES = [
    'hrtime',
    'nextTick',
    'performance',
    'queueMicrotask',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
    'setImmediate',
    'clearImmediate',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
];

module.exports = { NON_DATE_FAKEABLES };
