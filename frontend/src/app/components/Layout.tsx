import { Outlet } from "react-router";
import { Sidebar } from "./shared/Sidebar";
import { SidebarProvider, useSidebar } from "../../contexts/SidebarContext";

function LayoutContent() {
  const { isCollapsed, toggle } = useSidebar();

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      <Sidebar 
        isCollapsed={isCollapsed}
        onToggle={toggle}
      />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}

export function Layout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
}