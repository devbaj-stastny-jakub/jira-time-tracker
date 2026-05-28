import * as React from 'react';
import { Outlet, createRootRoute } from '@tanstack/react-router';
//import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
//import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

import { useCrossWindowSync } from '@/features/timer/cross-window';
import { useMenuBarTimer } from '@/features/timer/useMenuBarTimer';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRoute({
    component: RootComponent,
});

function RootComponent() {
    useMenuBarTimer();
    useCrossWindowSync();
    return (
        <React.Fragment>
            <Outlet />
            <Toaster />
            {/* <ReactQueryDevtools initialIsOpen={false} /> */}
            {/* <TanStackRouterDevtools position='top-right' /> */}
        </React.Fragment>
    );
}
