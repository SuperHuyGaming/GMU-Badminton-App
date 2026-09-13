import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiFetch from './api';

// Mock the global fetch
const originalFetch = global.fetch;
const originalLocalStorage = global.localStorage;

describe('apiFetch', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
        
        // Mock localStorage
        const storage = {};
        global.localStorage = {
            getItem: vi.fn(key => storage[key] || null),
            setItem: vi.fn((key, value) => { storage[key] = value; }),
            removeItem: vi.fn(key => { delete storage[key]; })
        };
    });

    afterEach(() => {
        global.fetch = originalFetch;
        global.localStorage = originalLocalStorage;
        vi.clearAllMocks();
    });

    it('attaches Content-Type: application/json by default', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true })
        });

        await apiFetch('/test-endpoint');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/test-endpoint'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Content-Type': 'application/json'
                })
            })
        );
    });

    it('removes Content-Type when body is FormData (for file uploads)', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true })
        });

        const formData = new FormData();
        formData.append('file', 'test');

        await apiFetch('/upload', {
            method: 'POST',
            body: formData
        });

        const callArgs = global.fetch.mock.calls[0][1];
        // Content-Type should be explicitly deleted so the browser can calculate the boundary
        expect(callArgs.headers['Content-Type']).toBeUndefined();
    });

    it('gracefully catches network disconnections and returns a fallback object', async () => {
        // Simulate a network failure (ERR_INTERNET_DISCONNECTED) which throws a TypeError
        global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        const response = await apiFetch('/test-offline');

        expect(response.ok).toBe(false);
        expect(response.status).toBe(0);
        
        const data = await response.json();
        expect(data.message).toBe('Network offline');
    });

    it('attaches the Authorization token if it exists in localStorage', async () => {
        global.localStorage.getItem.mockReturnValueOnce('mock_token_123');
        
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true })
        });

        await apiFetch('/protected');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer mock_token_123'
                })
            })
        );
    });
});
