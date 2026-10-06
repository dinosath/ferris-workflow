import { afterEach, describe, it, expect, vi } from 'vitest';
import { dataProvider } from './dataProvider';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dataProvider', () => {
describe('workflows', () => {
    const definition_json = JSON.stringify({
      document: { dsl: '1.0.3', namespace: 'default', name: 'test-workflow', version: '1.0.0' },
      do: [{ start: { set: { message: 'hello' } } }],
    });

    it('should fetch list', async () => {
      const result = await dataProvider.getList('workflows', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      });

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('surfaces ConnectRPC error messages', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
        JSON.stringify({ code: 'invalid_argument', message: 'Unknown operation' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      )));

      await expect(dataProvider.getList('workflows', {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      })).rejects.toThrow('Unknown operation');
    });

    it('should fetch one item', async () => {
      const result = await dataProvider.getOne('workflows', { id: 1 });

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(1);
    });

    it('should create item', async () => {
      const result = await dataProvider.create('workflows', {
        data: {
definition_json,
description: 'Test Value',
name: 'Test Value',
},
      });

      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
    });

    it('should update item', async () => {
      const result = await dataProvider.update('workflows', {
        id: 1,
        data: {
          id: 1,
definition_json,
description: 'Updated Value',
name: 'Updated Value',
},
        previousData: { id: 1 },
      });

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(1);
    });

    it('should delete item', async () => {
      const result = await dataProvider.delete('workflows', {
        id: 1,
        previousData: { id: 1 },
      });

      expect(result.data).toBeDefined();
    });
  });
});
