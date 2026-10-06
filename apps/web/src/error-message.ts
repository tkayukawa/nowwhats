/** ドメインのエラー種別を利用者向けの文言に変換する。 */
export const errorMessage = (type: string | null): string => {
  switch (type) {
    case "TaskTitleEmpty":
      return "タイトルを入力してください";
    case "TaskNotFound":
      return "タスクが見つかりません";
    case "InvalidStatusTransition":
      return "この状態からは変更できません";
    case "StoryPointInvalid":
      return "ポイントの値が正しくありません";
    case "TaskDescriptionTooLong":
      return "説明文が長すぎます（20,000 文字まで）";
    case "TaskAlreadyExists":
      return "同じタスクがすでに登録されています";
    default:
      return "エラーが発生しました";
  }
};
