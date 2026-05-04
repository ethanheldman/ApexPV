type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-bg-sunken/30 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="card p-5 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display font-bold text-xl tracking-tight">{title}</h2>
        {message && <p className="text-sm text-text-secondary mt-2">{message}</p>}
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onCancel} className="btn-ghost">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={
              destructive
                ? "btn bg-rose-600 text-white hover:bg-rose-700"
                : "btn-primary"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
