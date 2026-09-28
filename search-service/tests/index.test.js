const request = require('supertest');

const mockSearch = jest.fn();

jest.mock('@elastic/elasticsearch', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      search: mockSearch,
    })),
  };
});

const { app } = require('../index');

describe('Search Service Express Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch.mockResolvedValue({
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
    it('returns 200 with search results for valid query', async () => {
      const res = await request(app).get('/api/search?q=badminton&type=players&page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        query: 'badminton',
        type: 'players',
        page: 1,
        limit: 10,
        total: 0,
        results: [],
      });
      expect(mockSearch).toHaveBeenCalledWith({
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
    });

    it('returns 200 with formatted hits from Elasticsearch', async () => {
      mockSearch.mockResolvedValueOnce({
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
      expect(mockSearch).toHaveBeenCalledWith({
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

    it('handles /search alias route with default type (all)', async () => {
      const res = await request(app).get('/search?q=badminton');
      expect(res.status).toBe(200);
      expect(res.body.query).toBe('badminton');
      expect(res.body.type).toBe('all');
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(mockSearch).toHaveBeenCalledWith(
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
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('returns 400 when search query exceeds 100 characters', async () => {
      const longQuery = 'a'.repeat(101);
      const res = await request(app).get(`/api/search?q=${longQuery}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('must not exceed 100 characters');
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('returns 400 when invalid type is provided', async () => {
      const res = await request(app).get('/api/search?q=test&type=invalid_type');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.message).toContain('Invalid type');
      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('returns 500 when elasticsearch search fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSearch.mockRejectedValueOnce(new Error('Elasticsearch cluster unreachable'));

      const res = await request(app).get('/api/search?q=badminton');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Search failed' });
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
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
