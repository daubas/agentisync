export class AgentisyncError extends Error {
  constructor(
    message: string,
    readonly exitCode: number
  ) {
    super(message);
    this.name = "AgentisyncError";
  }
}

export class UsageError extends AgentisyncError {
  constructor(message: string) {
    super(message, 2);
    this.name = "UsageError";
  }
}

export class UnsafeOperationError extends AgentisyncError {
  constructor(message: string) {
    super(message, 3);
    this.name = "UnsafeOperationError";
  }
}
