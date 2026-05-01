declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string, options?: { readonly?: boolean });
    prepare(sql: string): {
      all(params?: Record<string, unknown>): unknown[];
      get(params?: Record<string, unknown>): unknown;
    };
    close(): void;
  }
}
