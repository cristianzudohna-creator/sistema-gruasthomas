// ✅ Archivo: src/components/ui/Modal.jsx (RESPONSIVE PRO - TABLET/CEL)
// ✅ FIX:
// - Safe area iOS (notch)
// - Mobile bottom-sheet (más cómodo)
// - Lock scroll sin “saltos” (guarda/restaura scrollY)
// - Header/Footer compactos en móvil
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

let lockCount = 0;
let savedScrollY = 0;

function lockBodyScroll() {
  lockCount += 1;
  if (lockCount !== 1) return;

  // ✅ guarda scroll actual y fija body
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

  // ✅ restaura body + scroll
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
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    lockBodyScroll();

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleOverlayMouseDown(e) {
    if (e.target === overlayRef.current) onClose?.();
  }

  const node = (
    <div
      ref={overlayRef}
      style={styles.overlay}
      onMouseDown={handleOverlayMouseDown}
      role="presentation"
    >
      <div
        style={{
          ...styles.modal,
          maxWidth: width,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={styles.header}>
          <div style={{ minWidth: 0 }}>
            <h2 style={styles.title}>{title}</h2>
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          </div>

          <button
            type="button"
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div style={styles.body}>{children}</div>

        {footer && <div style={styles.footer}>{footer}</div>}
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
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999999,

    // ✅ Safe area + padding responsive
    padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",

    overflowY: "auto",
  },

  modal: {
    width: "100%",
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",

    // ✅ en desktop sigue centrado y limitado
    maxHeight: "calc(100vh - 24px)",

    // ✅ en móvil se siente bottom-sheet (sin tocar CSS global)
    //   (usa clamp para verse bien en tablet también)
    marginTop: "clamp(0px, 6vh, 32px)",
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
