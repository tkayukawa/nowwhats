import type {
  ChangeTaskStatusError,
  CreateTaskError,
  EditTaskError,
} from "@nowwhats/task-management";

type DomainError = CreateTaskError | ChangeTaskStatusError | EditTaskError;

export interface HttpError {
  readonly status: 400 | 404 | 409;
  readonly body: { readonly error: DomainError };
}

/** ユースケースのエラーを HTTP ステータスに対応づける。 */
export const toHttpError = (error: DomainError): HttpError => {
  switch (error.type) {
    case "TaskIdInvalid":
    case "TaskTitleEmpty":
    case "StoryPointInvalid":
    case "TaskDescriptionTooLong":
      return { status: 400, body: { error } };
    case "TaskNotFound":
      return { status: 404, body: { error } };
    case "TaskAlreadyExists":
    case "InvalidStatusTransition":
      return { status: 409, body: { error } };
  }
};
