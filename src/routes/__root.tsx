import * as React from 'react';
import { Outlet, createRootRoute } from '@tanstack/react-router';
//import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

export const Route = createRootRoute({
    component: RootComponent,
});

function RootComponent() {
    return (
        <React.Fragment>
            <Outlet />
            {/* <ReactQueryDevtools initialIsOpen={false} /> */}
            <TanStackRouterDevtools position='top-right' />
        </React.Fragment>
    );
}
