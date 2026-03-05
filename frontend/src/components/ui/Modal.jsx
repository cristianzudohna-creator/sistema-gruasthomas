// ✅ Archivo: src/components/ui/Modal.jsx
// ✅ Mobile PRO:
// - En celular: modal full-screen (100dvh), sin bordes redondeados
// - Header y Footer sticky (siempre visibles)
// - Body scrollea suave
// - Botones del footer en mobile: 100% ancho
//
// ✅ FIX: NO cerrar al click fuera (backdrop)
// ✅ FIX: NO cerrar con Escape (evita perder formularios)
// - Safe area iOS
// - Lock scroll sin “saltos” (guarda/restaura scrollY)
// - Text fix (mojibake)

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fixText } from "../../utils/fixText";

let lockCount = 0;
let savedScrollY = 0;

function lockBodyScroll() {
  lockCount += 1;
  if (lockCount !== 1) return;

  savedScrollY = window.scrollY || 0;

  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount !== 0) return;

  const top = document.body.style.top;

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.overflow = "";

  const y = top ? Math.abs(parseInt(top, 10)) : savedScrollY;
  window.scrollTo(0, Number.isFinite(y) ? y : savedScrollY);
}

export default function Modal({ open, onClose, title, subtitle, children, footer, width = 600 }) {
  // ✅ detecta mobile (<= 640px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!open) return;

    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(!!mq.matches);

    apply();
    // compat
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, [open]);

  // ✅ TEXT FIX (solo string)
  const safeTitle = useMemo(() => (typeof title === "string" ? fixText(title) : title), [title]);
  const safeSubtitle = useMemo(() => (typeof subtitle === "string" ? fixText(subtitle) : subtitle), [subtitle]);

  const ariaLabel = useMemo(() => {
    if (typeof title === "string") return fixText(title);
    return "Modal";
  }, [title]);

  useEffect(() => {
    if (!open) return;

    lockBodyScroll();

    const onKeyDown = (e) => {
      // ✅ NO cerrar con Escape
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleOverlayClick(e) {
    // ✅ NO CERRAR al click afuera
    e.preventDefault();
    e.stopPropagation();
  }

  // ✅ estilos responsive
  const overlayStyle = {
    ...styles.overlay,
    padding: isMobile
      ? "0"
      : "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
    alignItems: isMobile ? "stretch" : "center",
    justifyContent: isMobile ? "stretch" : "center",
  };

  const modalStyle = {
    ...styles.modal,
    maxWidth: isMobile ? "100vw" : width,
    width: "100%",
    height: isMobile ? "100dvh" : undefined,
    maxHeight: isMobile ? "100dvh" : "calc(100vh - 24px)",
    borderRadius: isMobile ? 0 : 16,
    marginTop: isMobile ? 0 : "clamp(0px, 6vh, 32px)",
  };

  const headerStyle = {
    ...styles.header,
    position: isMobile ? "sticky" : "static",
    top: isMobile ? 0 : undefined,
    zIndex: isMobile ? 2 : undefined,
    background: "#fff",
    paddingTop: isMobile ? "calc(14px + env(safe-area-inset-top))" : "14px",
  };

  const bodyStyle = {
    ...styles.body,
    paddingBottom: isMobile ? 18 : 14,
  };

  const footerStyle = {
    ...styles.footer,
    position: isMobile ? "sticky" : "static",
    bottom: isMobile ? 0 : undefined,
    zIndex: isMobile ? 2 : undefined,
    background: "#fff",
    paddingBottom: isMobile ? "calc(12px + env(safe-area-inset-bottom))" : "12px",
  };

  const node = (
    <div
      className={`gt-modal-overlay ${isMobile ? "is-mobile" : ""}`}
      style={overlayStyle}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className={`gt-modal ${isMobile ? "is-mobile" : ""}`}
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="gt-modal__head" style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <h2 style={styles.title}>{safeTitle}</h2>
            {safeSubtitle ? <p style={styles.subtitle}>{safeSubtitle}</p> : null}
          </div>

          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Cerrar" title="Cerrar">
            ✕
          </button>
        </div>

        <div className="gt-modal__body" style={bodyStyle}>
          {children}
        </div>

        {footer ? (
          <div className="gt-modal__foot" style={footerStyle}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    zIndex: 999999,
    overflowY: "auto",
  },

  modal: {
    background: "#ffffff",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    borderRadius: 16,
  },

  header: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },

  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#111",
    lineHeight: 1.15,
  },

  subtitle: {
    margin: "4px 0 0",
    fontSize: 13,
    color: "rgba(0,0,0,0.6)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  closeBtn: {
    border: "none",
    background: "rgba(0,0,0,0.06)",
    borderRadius: 10,
    width: 38,
    height: 38,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 800,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },

  body: {
    padding: "14px 16px",
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
    WebkitOverflowScrolling: "touch",
  },

  footer: {
    padding: "12px 16px",
    borderTop: "1px solid rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexShrink: 0,
    flexWrap: "wrap",
  },
};