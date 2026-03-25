/** All service functions return this discriminated union. */
export type ServiceResult<T> =
  | { data: T }
  | { error: { code: string; message: string; suggestion: string; status: number } };

/** Pagination options shared across list endpoints. */
export interface PaginationOpts {
  cursor?: string;
  limit?: number;
}

/** Pagination metadata returned with list results. */
export interface PaginationMeta {
  cursor?: string;
  hasMore: boolean;
  total: number;
}
