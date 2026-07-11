/** Shared API envelope types. */

export type Pagination = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  totalHazardous?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: Pagination;
};

export type ApiErrorBody = {
  error: string;
};
