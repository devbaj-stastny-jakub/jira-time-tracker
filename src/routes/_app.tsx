import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { loadCredentials } from '@/shared/credentials/credentials';

export const Route = createFileRoute('/_app')({
    beforeLoad: async () => {
        const credentials = await loadCredentials();
        if (!credentials) {
            throw redirect({ to: '/onboarding' });
        }
    },
    component: AppLayout,
});

function AppLayout() {
    return (
        <SidebarProvider className="h-svh overflow-hidden">
            <AppSidebar />
            <SidebarInset className="min-h-0 overflow-auto p-6">
                <Outlet />
            </SidebarInset>
        </SidebarProvider>
    );
}
