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
    case "TagNameEmpty":
      return "タグの名前を入力してください";
    case "TagNameTooLong":
      return "タグの名前は 30 文字までです";
    case "TagNameDuplicate":
      return "同じ名前のタグがすでにあります";
    case "TaskTagsTooMany":
      return "タグは 1 つのタスクに 10 個までです";
    case "TagNotFound":
      return "タグが見つかりません";
    case "TaskAlreadyExists":
      return "同じタスクがすでに登録されています";
    default:
      return "エラーが発生しました";
  }
};
