import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

type DrawerProps = {
  actions?: ReactNode;
  children: ReactNode;
  title: string;
  onClose: () => void;
};

function Drawer({ actions, children, title, onClose }: DrawerProps) {
  const headingId = useId();
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    drawerRef.current?.focus();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="drawer-layer">
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Close file details"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <div className="drawer-header">
          <h2 id={headingId}>{title}</h2>
          <div className="drawer-header-actions">
            {actions}
            <button
              type="button"
              className="drawer-close"
              aria-label="Close file details"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="drawer-content">{children}</div>
      </aside>
    </div>
  );
}

export default Drawer;
