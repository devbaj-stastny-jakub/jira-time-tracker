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
        <SidebarProvider
            className="h-svh overflow-hidden"
            style={{ '--sidebar-width': '13rem' } as React.CSSProperties}
        >
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
                Skip to main content
            </a>
            <AppSidebar />
            <SidebarInset id="main-content" className="min-h-0 overflow-auto px-6 py-4">
                <Outlet />
            </SidebarInset>
        </SidebarProvider>
    );
}
