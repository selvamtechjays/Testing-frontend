export interface ApiErrorFields {
  [field: string]: string | undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: ApiErrorFields;

  constructor(status: number, code: string, message: string, fields: ApiErrorFields = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** Registers the single place a 401 UNAUTHENTICATED is handled (clear auth state, go to sign-in). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown; fields?: unknown };
}

function readFields(raw: unknown): ApiErrorFields {
  const fields: ApiErrorFields = {};
  if (typeof raw !== 'object' || raw === null) return fields;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') fields[key] = value;
  }
  return fields;
}

function toError(status: number, body: unknown): ApiError {
  const error = (body as ErrorBody | null)?.error;
  const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
  const message = typeof error?.message === 'string' ? error.message : '';
  return new ApiError(status, code, message, readFields(error?.fields));
}

/** The only code that calls fetch. Returns parsed JSON on 2xx; throws ApiError otherwise. */
export async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', '');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const apiError = toError(response.status, body);
    if (response.status === 401 && apiError.code === 'UNAUTHENTICATED') onUnauthorized?.();
    throw apiError;
  }
  return body as T;
}
