import { Outlet, createFileRoute } from '@tanstack/react-router';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export const Route = createFileRoute('/_app')({
    component: AppLayout,
});

function AppLayout() {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="overflow-auto p-6">
                <Outlet />
            </SidebarInset>
        </SidebarProvider>
    );
}
