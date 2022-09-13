export class ActionifyError extends AggregateError {
  static is<Error extends ActionifyError>(value: unknown): value is Error {
    return value instanceof this;
  }

  override name = "ActionifyError";

  constructor(message: string, errors: unknown[] = []) {
    super(errors, message);
  }
}

export class JobError extends Error {
  override name = "JobError";
}
export class WorkflowError extends Error {
  override name = "WorkflowError";
}
export class StepError extends Error {
  override name = "StepError";
}
