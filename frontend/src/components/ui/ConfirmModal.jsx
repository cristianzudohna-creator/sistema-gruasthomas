import { useEffect } from "react";
import Modal from "./Modal";

/**
 * ConfirmModal
 *
 * Props:
 * - open: boolean
 * - title: string
 * - description?: string | JSX
 * - confirmText?: string
 * - cancelText?: string
 * - danger?: boolean (estilo rojo si quieres)
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
  // cerrar con ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose?.()}
      title={title}
      subtitle={typeof description === "string" ? description : undefined}
      width={560}
      footer={
        <>
          <button className="gt-btn" type="button" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>

          <button
            className="gt-btn gt-btn-primary"
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={
              danger
                ? { background: "#dc2626", borderColor: "#dc2626" }
                : undefined
            }
          >
            {loading ? "Procesando..." : confirmText}
          </button>
        </>
      }
    >
      {typeof description !== "string" ? (
        <div style={{ fontSize: 14, color: "rgba(0,0,0,.75)", lineHeight: 1.4 }}>
          {description}
        </div>
      ) : null}
    </Modal>
  );
}
