import type { Issue } from './payRule';

/** Input failed validation. `issues[].code` maps to the translated `error.<code>` strings. */
export class ValidationError extends Error {
  readonly issues: Issue[];
  constructor(issues: Issue[]) {
    super(issues.map((i) => `${i.field}:${i.code}`).join(', '));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/** The requested operation conflicts with the current data (e.g. a shift is already running). */
export class ConflictError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'ConflictError';
    this.code = code;
  }
}

export class NotFoundError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'NotFoundError';
    this.code = code;
  }
}
