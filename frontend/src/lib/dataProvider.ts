import simpleRestProvider from 'ra-data-simple-rest';
import type { DataProvider, CreateParams, UpdateParams, RaRecord } from 'ra-core';
const baseDataProvider = simpleRestProvider('/api');

type ConnectResponse = {
    bodyJson?: string;
    total?: string | number;
    message?: string;
};

const executeWorkflow = async (
    operation: string,
    options: { id?: string | number; page?: number; pageSize?: number; data?: unknown } = {},
): Promise<ConnectResponse> => {
    const response = await fetch('/entities.v1.EntityService/Execute', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'connect-protocol-version': '1',
        },
        body: JSON.stringify({
            entity: 'Workflow',
            operation,
            id: options.id === undefined ? '' : String(options.id),
            page: options.page ?? 1,
            pageSize: options.pageSize ?? 25,
            payloadJson: JSON.stringify(options.data ?? {}),
        }),
    });
    const envelope = (await response.json()) as ConnectResponse;
    if (!response.ok) {
        const message = typeof envelope.message === 'string' && envelope.message.length > 0
            ? envelope.message
            : typeof envelope.bodyJson === 'string'
                ? envelope.bodyJson
                : `ConnectRPC workflow request failed (HTTP ${response.status})`;
        throw new Error(message);
    }
    return envelope;
};


/**
 * Relation fields configuration per resource.
 * Maps resource names to their relation field names.
 * These fields will be transformed from { field: id } to { field: { id: id } }
 * for create/update operations to match backend expectations.
 */
const relationFields: Record<string, string[]> = {

};

/**
 * Transform data for create/update operations.
 * Converts relation fields from { field: id } to { field: { id: id } }
 */
const transformForMutation = <T extends Record<string, unknown>>(resource: string, data: T): T => {
    const fields = relationFields[resource];
    if (!fields || fields.length === 0) {
        return data;
    }

    const transformed = { ...data } as T;
    for (const field of fields) {
        const value = transformed[field];
        // If value is a primitive (number or string), wrap it in { id: value }
        if (value !== null && value !== undefined && typeof value !== 'object') {
            (transformed as Record<string, unknown>)[field] = { id: value };
        }
        // If value is already an object with id, keep it as is
        // If value is null/undefined, keep it as is
    }
    return transformed;
};

/**
 * Transform data from API response.
 * Converts relation fields from { field: { id: id, ... } } to { field: id }
 * for react-admin ReferenceInput/ReferenceField compatibility.
 */
const transformFromResponse = <T extends RaRecord>(resource: string, data: T): T => {
    const fields = relationFields[resource];
    if (!fields || fields.length === 0) {
        return data;
    }

    const transformed = { ...data } as T;
    for (const field of fields) {
        const value = (transformed as Record<string, unknown>)[field];
        // If value is an object with id, extract just the id
        if (value !== null && value !== undefined && typeof value === 'object' && 'id' in (value as object)) {
            (transformed as Record<string, unknown>)[field] = (value as { id: unknown }).id;
        }
    }
    return transformed;
};

/**
 * Data provider wrapper that handles relation field transformations.
 */
export const dataProvider: DataProvider = {
    ...baseDataProvider,

    getList: async (resource, params) => {
        if (resource === 'workflows') {
            const response = await executeWorkflow('list', {
                page: params.pagination?.page ?? 1,
                pageSize: params.pagination?.perPage ?? 25,
            });
            const data = JSON.parse(response.bodyJson ?? '[]') as RaRecord[];
            return {
                data: data.map((item) => transformFromResponse(resource, item)),
                total: Number(response.total ?? data.length),
            };
        }
        const result = await baseDataProvider.getList(resource, params);
        return {
            ...result,
            data: result.data.map((item) => transformFromResponse(resource, item)),
        };
    },

    getOne: async (resource, params) => {
        if (resource === 'workflows') {
            const response = await executeWorkflow('read', { id: params.id });
            const data = JSON.parse(response.bodyJson ?? 'null') as RaRecord;
            return { data: transformFromResponse(resource, data) as never };
        }
        const result = await baseDataProvider.getOne(resource, params);
        return {
            ...result,
            data: transformFromResponse(resource, result.data),
        };
    },

    getMany: async (resource, params) => {
        const result = await baseDataProvider.getMany(resource, params);
        return {
            ...result,
            data: result.data.map((item) => transformFromResponse(resource, item)),
        };
    },

    getManyReference: async (resource, params) => {
        const result = await baseDataProvider.getManyReference(resource, params);
        return {
            ...result,
            data: result.data.map((item) => transformFromResponse(resource, item)),
        };
    },

    create: async (resource, params: CreateParams) => {
        const transformedParams = {
            ...params,
            data: transformForMutation(resource, params.data as Record<string, unknown>),
        };
        if (resource === 'workflows') {
            const response = await executeWorkflow('create', { data: transformedParams.data });
            const data = JSON.parse(response.bodyJson ?? 'null') as RaRecord;
            return { data: transformFromResponse(resource, data) };
        }
        const result = await baseDataProvider.create(resource, transformedParams);
        return {
            ...result,
            data: transformFromResponse(resource, result.data),
        };
    },

    update: async (resource, params: UpdateParams) => {
        const transformedParams = {
            ...params,
            data: transformForMutation(resource, params.data as Record<string, unknown>),
        };
        if (resource === 'workflows') {
            const response = await executeWorkflow('update', { id: params.id, data: transformedParams.data });
            const data = JSON.parse(response.bodyJson ?? 'null') as RaRecord;
            return { data: transformFromResponse(resource, data) };
        }
        const result = await baseDataProvider.update(resource, transformedParams);
        return {
            ...result,
            data: transformFromResponse(resource, result.data),
        };
    },

    delete: async (resource, params) => {
        if (resource === 'workflows') {
            await executeWorkflow('delete', { id: params.id });
            return { data: { ...(params.previousData ?? {}), id: params.id } as never };
        }
        return baseDataProvider.delete(resource, params);
    },
    deleteMany: baseDataProvider.deleteMany,
    updateMany: baseDataProvider.updateMany,
};
