// ✅ Archivo: src/components/ui/ConfirmModal.jsx (RESPONSIVE PRO + TEXT FIX)
import { useMemo } from "react";
import Modal from "./Modal";
import { fixText } from "../../utils/fixText";

/**
 * ConfirmModal
 *
 * Props:
 * - open: boolean
 * - title: string | JSX
 * - description?: string | JSX
 * - confirmText?: string
 * - cancelText?: string
 * - danger?: boolean
 * - onConfirm: () => void | Promise<void>
 * - onClose: () => void
 * - loading?: boolean
 */
export default function ConfirmModal({
  open,
  title = "Confirmar",
  description,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  danger = true,
  onConfirm,
  onClose,
  loading = false,
}) {
  // ✅ TEXT FIX (solo strings)
  const safeTitle = useMemo(() => (typeof title === "string" ? fixText(title) : title), [title]);

  const subtitle = useMemo(() => {
    if (typeof description === "string") return fixText(description);
    return undefined;
  }, [description]);

  const body = typeof description !== "string" ? description : null;

  const safeCancel = useMemo(() => fixText(cancelText), [cancelText]);
  const safeConfirm = useMemo(() => fixText(confirmText), [confirmText]);

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose?.()}
      title={safeTitle}
      subtitle={subtitle}
      width={560}
      footer={
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
            width: "100%",
          }}
        >
          <button
            className="gt-btn"
            type="button"
            onClick={() => !loading && onClose?.()}
            disabled={loading}
            style={{
              // ✅ móvil: botón full
              width: "min(100%, 220px)",
              flex: "1 1 180px",
              height: 44,
            }}
          >
            {safeCancel}
          </button>

          <button
            className="gt-btn gt-btn-primary"
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              width: "min(100%, 260px)",
              flex: "1 1 220px",
              height: 44,
              ...(danger ? { background: "#dc2626", borderColor: "#dc2626" } : null),
            }}
          >
            {loading ? "Procesando..." : safeConfirm}
          </button>
        </div>
      }
    >
      {body ? (
        <div style={{ fontSize: 14, color: "rgba(0,0,0,.75)", lineHeight: 1.45 }}>{body}</div>
      ) : null}
    </Modal>
  );
}
