import type { ReactNode } from "react";

function Sidebar({ children }: { children: ReactNode }) {
  return <aside className="app-sidebar">{children}</aside>;
}

export default Sidebar;
