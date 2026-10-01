const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSet = jest.fn().mockResolvedValue('OK');
const mockRedisQuit = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    quit: mockRedisQuit,
    disconnect: jest.fn(),
    on: jest.fn(),
  }));
});

const mockElasticSearch = jest.fn().mockResolvedValue({
  hits: {
    total: { value: 0 },
    hits: [],
  },
});

jest.mock('@elastic/elasticsearch', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      search: mockElasticSearch,
    })),
  };
});

const request = require('supertest');
const { app } = require('../index');

describe('Search Service Express Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    mockElasticSearch.mockResolvedValue({
      hits: {
        total: { value: 0 },
        hits: [],
      },
    });
  });

  it('GET /health returns 200 with service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      service: 'search-service',
    });
  });

  describe('GET /api/search validation and indexing', () => {
    it('returns 200 with search results for valid query (cache miss)', async () => {
      const res = await request(app).get('/api/search?q=badminton&type=players&page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.headers['x-cache']).toBe('MISS');
      expect(res.body).toEqual({
        query: 'badminton',
        type: 'players',
        page: 1,
        limit: 10,
        total: 0,
        results: [],
      });
      expect(mockElasticSearch).toHaveBeenCalledWith({
        index: 'users',
        from: 0,
        size: 10,
        body: {
          query: {
            multi_match: {
              query: 'badminton',
              fields: ['name', 'bio', 'title', 'content', 'authorName', 'tags'],
              fuzziness: 'AUTO',
            },
          },
        },
      });
      expect(mockRedisSet).toHaveBeenCalledWith(
        'search:query:badminton:type:players:page:1:limit:10:uni:none',
        expect.any(String),
        'EX',
        60
      );
    });

    it('returns cached results when cache hit occurs', async () => {
      const cachedData = {
        query: 'badminton',
        type: 'players',
        page: 1,
        limit: 10,
        total: 1,
        results: [{ _id: '1', name: 'Cached User' }],
      };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedData));

      const res = await request(app).get('/api/search?q=badminton&type=players&page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.headers['x-cache']).toBe('HIT');
      expect(res.body).toEqual(cachedData);
      expect(mockElasticSearch).not.toHaveBeenCalled();
    });

    it('gracefully degrades and searches Elasticsearch if Redis throws an error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockRedisGet.mockRejectedValueOnce(new Error('Redis connection timed out'));

      const res = await request(app).get('/api/search?q=badminton&type=players&page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.headers['x-cache']).toBe('MISS');
      expect(mockElasticSearch).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('returns 200 with formatted hits from Elasticsearch', async () => {
      mockElasticSearch.mockResolvedValueOnce({
        hits: {
          total: { value: 2 },
          hits: [
            {
              _id: '101',
              _index: 'posts',
              _source: { title: 'Tournament Post', authorName: 'Player One' },
            },
            {
              _id: '102',
              _index: 'posts',
              _source: { title: 'Racket Guide', authorName: 'Player Two' },
            },
          ],
        },
      });

      const res = await request(app).get('/api/search?q=tournament&type=posts&page=2&limit=5');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        query: 'tournament',
        type: 'posts',
        page: 2,
        limit: 5,
        total: 2,
        results: [
          { _id: '101', _index: 'posts', title: 'Tournament Post', authorName: 'Player One' },
          { _id: '102', _index: 'posts', title: 'Racket Guide', authorName: 'Player Two' },
        ],
      });
      expect(mockElasticSearch).toHaveBeenCalledWith({
        index: 'posts',
        from: 5,
        size: 5,
        body: {
          query: {
            multi_match: {
              query: 'tournament',
              fields: ['name', 'bio', 'title', 'content', 'authorName', 'tags'],
              fuzziness: 'AUTO',
            },
          },
        },
      });
    });

    it('applies boost when searcherHomeUniversity is provided', async () => {
      await request(app).get('/api/search?q=John&type=players&searcherHomeUniversity=GMU');
      expect(mockElasticSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            query: {
              bool: {
                must: {
                  multi_match: {
                    query: 'John',
                    fields: ['name', 'bio', 'title', 'content', 'authorName', 'tags'],
                    fuzziness: 'AUTO',
                  },
                },
                should: [
                  {
                    match: {
                      homeUniversity: {
                        query: 'GMU',
                        boost: 2.0,
                      },
                    },
                  },
                  {
                    match: {
                      university: {
                        query: 'GMU',
                        boost: 2.0,
                      },
                    },
                  },
                ],
              },
            },
          },
        })
      );
    });

    it('strips sensitive fields (email, password, pushSubscriptions, token, secret, jwt) from search hits', async () => {
      mockElasticSearch.mockResolvedValueOnce({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: 'user_secure_1',
              _index: 'users',
              _source: {
                name: 'Secure Player',
                email: 'secret_leak@gmu.edu',
                password: 'hashed-password-never-leak',
                pushSubscriptions: [{ endpoint: 'https://push.example.com' }],
                token: 'jwt-token',
                secret: 'sensitive',
                jwt: 'token-val',
                skillLevel: 'A Level',
                bio: 'Love badminton',
              },
            },
          ],
        },
      });

      const res = await request(app).get('/api/search?q=Secure&type=players');
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.body.results).toHaveLength(1);
      const hit = res.body.results[0];
      expect(hit._id).toBe('user_secure_1');
      expect(hit.name).toBe('Secure Player');
      expect(hit.skillLevel).toBe('A Level');
      expect(hit.bio).toBe('Love badminton');
      expect(hit.email).toBeUndefined();
      expect(hit.password).toBeUndefined();
      expect(hit.pushSubscriptions).toBeUndefined();
      expect(hit.token).toBeUndefined();
      expect(hit.secret).toBeUndefined();
      expect(hit.jwt).toBeUndefined();
    });

    it('handles /search alias route with default type (all)', async () => {
      const res = await request(app).get('/search?q=badminton');
      expect(res.status).toBe(200);
      expect(res.body.query).toBe('badminton');
      expect(res.body.type).toBe('all');
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(mockElasticSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'users,posts',
          from: 0,
          size: 20,
        })
      );
    });

    it('returns 400 when search query "q" is missing or empty', async () => {
      const res = await request(app).get('/api/search?q=   ');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('required and cannot be empty');
      expect(mockElasticSearch).not.toHaveBeenCalled();
    });

    it('returns 400 when search query exceeds 100 characters', async () => {
      const longQuery = 'a'.repeat(101);
      const res = await request(app).get(`/api/search?q=${longQuery}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('must not exceed 100 characters');
      expect(mockElasticSearch).not.toHaveBeenCalled();
    });

    it('returns 400 when invalid type is provided', async () => {
      const res = await request(app).get('/api/search?q=test&type=invalid_type');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('Invalid type');
      expect(mockElasticSearch).not.toHaveBeenCalled();
    });

    it('returns 500 when Elasticsearch search fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockElasticSearch.mockRejectedValueOnce(new Error('Elasticsearch cluster unreachable'));

      const res = await request(app).get('/api/search?q=badminton');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Search failed' });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('CORS and Security Headers', () => {
    it('returns security headers on responses', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('blocks requests from unauthorized origins with 403', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-website.com');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CORS Error');
    });

    it('allows requests from localhost origins', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('allows requests from gmu-frontend-staging onrender origin', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://gmu-frontend-staging.onrender.com');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://gmu-frontend-staging.onrender.com');
    });
  });

  describe('404 Not Found Handler', () => {
    it('returns 404 for unknown endpoints', async () => {
      const res = await request(app).get('/unknown-route');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
});
