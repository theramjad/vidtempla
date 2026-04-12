export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** All service functions return this discriminated union. */
export type ServiceResult<T> =
  | { data: T }
  | {
      error: {
        code: string;
        message: string;
        suggestion: string;
        status: number;
        meta?: Record<string, JsonValue>;
      };
    };

/** Pagination options shared across list endpoints. */
export interface PaginationOpts {
  cursor?: string;
  limit?: number;
}

/** Pagination metadata returned with list results. */
export interface PaginationMeta {
  cursor?: string;
  hasMore: boolean;
  total: number | null;
}
