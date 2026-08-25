import type { ReactNode } from "react";

type AppLayoutProps = { header: ReactNode; children: ReactNode; footer?: ReactNode; sidebar?: ReactNode };

function AppLayout({ header, children, footer, sidebar }: AppLayoutProps) {
  return <main className="app-layout">
    {header}
    <div className={sidebar ? "app-content with-sidebar" : "app-content"}>
      {sidebar}
      <div className="app-page">{children}</div>
    </div>
    {footer}
  </main>;
}

export default AppLayout;
