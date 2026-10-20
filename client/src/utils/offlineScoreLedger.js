/**
 * client/src/utils/offlineScoreLedger.js
 * Offline PWA IndexedDB Local Ledger for Umpire Pad
 * Provides persistent storage for match state and an append-only mutation queue.
 * Includes a safe in-memory fallback for jsdom / SSR / test environments.
 */

const DB_NAME = 'GMUBadminton_UmpirePad_v1';
const DB_VERSION = 1;
const STORE_MATCH = 'match_state';
const STORE_MUTATIONS = 'mutation_queue';

class OfflineScoreLedger {
    constructor() {
        this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
        this.dbPromise = null;
        this.memoryStore = {
            match_state: new Map(),
            mutation_queue: new Map()
        };
    }

    async getDB() {
        if (!this.isSupported) return null;
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve) => {
            try {
                const request = window.indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_MATCH)) {
                        db.createObjectStore(STORE_MATCH, { keyPath: 'courtNumber' });
                    }
                    if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
                        const mutStore = db.createObjectStore(STORE_MUTATIONS, { keyPath: 'mutationId' });
                        mutStore.createIndex('status', 'status', { unique: false });
                        mutStore.createIndex('createdAt', 'createdAt', { unique: false });
                    }
                };

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    console.warn('[OfflineScoreLedger] IndexedDB open error, using in-memory store:', request.error);
                    resolve(null);
                };
            } catch (e) {
                console.warn('[OfflineScoreLedger] IndexedDB initialization failed:', e.message);
                resolve(null);
            }
        });

        return this.dbPromise;
    }

    async saveMatchState(matchState) {
        if (!matchState || matchState.courtNumber === undefined) return null;
        const record = { ...matchState, updatedAt: Date.now() };

        try {
            const db = await this.getDB();
            if (!db) {
                this.memoryStore.match_state.set(matchState.courtNumber, record);
                return record;
            }

            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_MATCH, 'readwrite');
                const store = tx.objectStore(STORE_MATCH);
                const req = store.put(record);
                req.onsuccess = () => resolve(record);
                req.onerror = () => reject(req.error);
            });
        } catch {
            this.memoryStore.match_state.set(matchState.courtNumber, record);
            return record;
        }
    }

    async getMatchState(courtNumber) {
        try {
            const db = await this.getDB();
            if (!db) return this.memoryStore.match_state.get(courtNumber) || null;

            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_MATCH, 'readonly');
                const store = tx.objectStore(STORE_MATCH);
                const req = store.get(courtNumber);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        } catch {
            return this.memoryStore.match_state.get(courtNumber) || null;
        }
    }

    async enqueueMutation(mutation) {
        const record = {
            mutationId: mutation.mutationId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            idempotencyKey: mutation.idempotencyKey || `court-${mutation.courtNumber}-pt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            courtNumber: mutation.courtNumber,
            matchId: mutation.matchId,
            actionType: mutation.actionType || 'SCORE_POINT',
            payload: mutation.payload || {},
            status: 'PENDING',
            retryCount: 0,
            createdAt: Date.now()
        };

        try {
            const db = await this.getDB();
            if (!db) {
                this.memoryStore.mutation_queue.set(record.mutationId, record);
                return record;
            }

            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
                const store = tx.objectStore(STORE_MUTATIONS);
                const req = store.put(record);
                req.onsuccess = () => resolve(record);
                req.onerror = () => reject(req.error);
            });
        } catch {
            this.memoryStore.mutation_queue.set(record.mutationId, record);
            return record;
        }
    }

    async getPendingMutations(courtNumber = null) {
        try {
            const db = await this.getDB();
            if (!db) {
                const list = Array.from(this.memoryStore.mutation_queue.values())
                    .filter(m => m.status === 'PENDING' && (!courtNumber || m.courtNumber === courtNumber));
                return list.sort((a, b) => a.createdAt - b.createdAt);
            }

            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_MUTATIONS, 'readonly');
                const store = tx.objectStore(STORE_MUTATIONS);
                const req = store.getAll();

                req.onsuccess = () => {
                    let results = (req.result || []).filter(m => m.status === 'PENDING');
                    if (courtNumber) {
                        results = results.filter(m => m.courtNumber === courtNumber);
                    }
                    results.sort((a, b) => a.createdAt - b.createdAt);
                    resolve(results);
                };
                req.onerror = () => reject(req.error);
            });
        } catch {
            const list = Array.from(this.memoryStore.mutation_queue.values())
                .filter(m => m.status === 'PENDING' && (!courtNumber || m.courtNumber === courtNumber));
            return list.sort((a, b) => a.createdAt - b.createdAt);
        }
    }

    async markMutationSynced(mutationId) {
        try {
            const db = await this.getDB();
            if (!db) {
                this.memoryStore.mutation_queue.delete(mutationId);
                return true;
            }

            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
                const store = tx.objectStore(STORE_MUTATIONS);
                const req = store.delete(mutationId);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });
        } catch {
            this.memoryStore.mutation_queue.delete(mutationId);
            return true;
        }
    }

    async clearMutations(courtNumber = null) {
        try {
            const db = await this.getDB();
            if (!db) {
                if (courtNumber) {
                    for (const [id, m] of this.memoryStore.mutation_queue.entries()) {
                        if (m.courtNumber === courtNumber) this.memoryStore.mutation_queue.delete(id);
                    }
                } else {
                    this.memoryStore.mutation_queue.clear();
                }
                return true;
            }

            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
                const store = tx.objectStore(STORE_MUTATIONS);
                const req = store.clear();
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });
        } catch {
            this.memoryStore.mutation_queue.clear();
            return true;
        }
    }
}

export const offlineScoreLedger = new OfflineScoreLedger();
export default offlineScoreLedger;
