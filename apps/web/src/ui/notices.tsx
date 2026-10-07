import { rejectionLabel } from "../labels.ts";
import type { RejectedChange } from "../local/protocol.ts";

export const StorageWarning = () => (
  <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm">
    このブラウザでは端末内への保存ができないため、再読み込みすると未送信の変更が失われます。
  </p>
);

export const RejectionNotice = ({
  rejections,
  onDismiss,
}: {
  readonly rejections: readonly RejectedChange[];
  readonly onDismiss: () => void;
}) => (
  <div
    role="alert"
    className="flex items-start gap-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm"
  >
    <ul className="min-w-0 flex-1">
      {rejections.map((r) => (
        <li key={r.change.changeId}>{rejectionLabel(r)}</li>
      ))}
    </ul>
    <button type="button" onClick={onDismiss} className="text-xs text-muted hover:text-fg">
      閉じる
    </button>
  </div>
);
