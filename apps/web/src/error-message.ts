/** API が返すエラーの type を利用者向けの文言に変換する。 */
export const errorMessage = (body: unknown): string => {
  const type =
    typeof body === "object" && body !== null && "error" in body
      ? (body.error as { type?: unknown }).type
      : undefined;
  switch (type) {
    case "TaskTitleEmpty":
      return "タイトルを入力してください";
    case "TaskNotFound":
      return "タスクが見つかりません。一覧を更新してください";
    case "InvalidStatusTransition":
      return "この状態からは変更できません";
    case "TaskAlreadyExists":
      return "同じタスクがすでに登録されています";
    default:
      return "エラーが発生しました。時間をおいて再度お試しください";
  }
};
