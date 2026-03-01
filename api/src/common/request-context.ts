import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  requestId: string;
  ip?: string;
  userAgent?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
) {
  return storage.run(context, callback);
}

export function getRequestContext() {
  return storage.getStore();
}
