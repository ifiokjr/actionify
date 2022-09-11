export class ActionifyError extends AggregateError {
  static is<Error extends ActionifyError>(value: unknown): value is Error {
    return value instanceof this;
  }
  constructor(message: string, errors: unknown[] = []) {
    super(errors, message);
  }
}
