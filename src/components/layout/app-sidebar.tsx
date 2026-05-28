import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Calendar, ChevronRight, Settings, Timer } from 'lucide-react';

import { useActiveTimer } from '@/features/timer/useActiveTimer';
import { formatElapsed } from '@/features/timer/format';
import { useCurrentUser } from '@/features/onboarding/useOnboarding';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const navItems = [
    { to: '/', label: 'Timer', icon: Timer, exact: true },
    { to: '/calendar', label: 'Calendar', icon: Calendar, exact: false },
    { to: '/settings', label: 'Settings', icon: Settings, exact: false },
] as const;

const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar';

export function AppSidebar() {
    return (
        <Sidebar
            collapsible="none"
            className="relative m-2 h-[calc(100svh-1rem)] overflow-hidden rounded-2xl ring-1 ring-sidebar-border"
        >
            {/* Cobalt wash + faint grid for depth, echoing the settings cards. */}
            <div
                aria-hidden
                className="absolute inset-0 bg-linear-to-b from-primary/8 via-transparent to-transparent"
            />
            <div
                aria-hidden
                className="absolute inset-0 opacity-50 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-size-[22px_22px] mask-[radial-gradient(120%_90%_at_50%_0%,black,transparent_70%)]"
            />

            {/* Native macOS traffic-light area: drag the window from the top of
                the sidebar without grabbing any interactive element. */}
            <SidebarHeader
                className="relative gap-0 p-3 pt-6"
                data-tauri-drag-region
            >
                <div className="flex items-center gap-2.5" data-tauri-drag-region>
                    <div className="bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-primary/30 ring-primary/20 flex size-9 items-center justify-center rounded-xl shadow-sm ring-1">
                        <Timer className="size-5" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="font-heading text-sm font-semibold tracking-tight">
                            Timely
                        </span>
                        <span className="eyebrow mt-1">Jira time tracker</span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="relative">
                <div className="px-3 pb-1">
                    <TimerStatus />
                </div>

                <SidebarGroup className="pt-1">
                    <p className="eyebrow px-3 pb-1.5">Navigate</p>
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-0.5">
                            {navItems.map(({ to, label, icon: Icon, exact }) => (
                                <SidebarMenuItem key={to}>
                                    <Link
                                        to={to}
                                        activeOptions={{ exact }}
                                        activeProps={{ 'aria-current': 'page' }}
                                        className={cn(
                                            'group/nav text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:text-primary relative flex items-center gap-3 rounded-xl py-2 pr-3 pl-4 text-sm transition-colors data-[status=active]:font-medium',
                                            focusRing,
                                        )}
                                    >
                                        {/* Indicator bar grows from nothing on the active route. */}
                                        <span className="bg-primary absolute top-1/2 left-0 h-0 w-1 -translate-y-1/2 rounded-r-full transition-all duration-300 group-data-[status=active]/nav:h-5" />
                                        <span className="text-muted-foreground group-hover/nav:text-sidebar-foreground group-data-[status=active]/nav:bg-primary/10 group-data-[status=active]/nav:text-primary flex size-7 items-center justify-center rounded-lg transition-colors">
                                            <Icon className="size-4" />
                                        </span>
                                        <span>{label}</span>
                                    </Link>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="relative p-2">
                <UserFooter />
            </SidebarFooter>
        </Sidebar>
    );
}

/**
 * Live mirror of the running timer, ticking once a second so the elapsed clock
 * is visible from any page. Falls back to a quiet "no timer" affordance that
 * still routes to the Timer page. Both states link to `/`.
 */
function TimerStatus() {
    const { data: active } = useActiveTimer();
    const [elapsed, setElapsed] = useState('0:00:00');

    useEffect(() => {
        if (!active) return;
        const startMs = new Date(active.startAt).getTime();
        const tick = () => setElapsed(formatElapsed(Date.now() - startMs));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [active]);

    if (!active) {
        return (
            <Link
                to="/"
                className={cn(
                    'text-muted-foreground hover:border-border hover:text-foreground group flex items-center gap-2.5 rounded-xl border border-dashed px-3 py-2.5 text-sm transition-colors',
                    focusRing,
                )}
            >
                <span className="bg-muted-foreground/40 size-2 shrink-0 rounded-full" />
                <span className="flex-1">No active timer</span>
                <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
        );
    }

    return (
        <Link
            to="/"
            aria-label={`Recording — ${elapsed}`}
            className={cn(
                'bg-primary/8 ring-primary/15 hover:bg-primary/12 group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1 transition-colors',
                focusRing,
            )}
        >
            <span className="relative flex size-2.5 shrink-0 items-center justify-center" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-running opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-running" />
            </span>
            <span className="text-primary font-mono text-sm font-semibold tabular-nums">
                {elapsed}
            </span>
        </Link>
    );
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function UserFooter() {
    const { data: user, isPending, isError } = useCurrentUser();

    const name = user?.displayName ?? (isError ? 'Connection error' : 'User');
    const detail = user
        ? (user.emailAddress ?? 'Connected')
        : isPending
          ? 'Connecting…'
          : 'Not connected';

    // Status dot: green connected, amber (pulsing) connecting, red on failure.
    const statusClass = user
        ? 'bg-success'
        : isError
          ? 'bg-destructive'
          : 'bg-warning animate-pulse';

    const statusLabel = user
        ? 'Connected to Jira'
        : isError
          ? 'Connection failed'
          : 'Connecting…';

    return (
        <TooltipProvider delay={150}>
            <Link
                to="/user"
                className={cn(
                    'group/user hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent flex items-center gap-3 rounded-xl p-2 transition-colors',
                    focusRing,
                )}
            >
                <div className="relative shrink-0">
                    <Avatar className="ring-sidebar-border size-9 ring-1">
                        {user?.avatarUrls?.['48x48'] ? (
                            <AvatarImage src={user.avatarUrls['48x48']} alt={user.displayName} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {user ? initials(user.displayName) : 'U'}
                        </AvatarFallback>
                    </Avatar>
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <span
                                    role="status"
                                    aria-label={statusLabel}
                                    className={cn(
                                        'ring-sidebar absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2',
                                        statusClass,
                                    )}
                                />
                            }
                        />
                        <TooltipContent side="right">{statusLabel}</TooltipContent>
                    </Tooltip>
                </div>
                <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="text-muted-foreground truncate text-xs">{detail}</span>
                </div>
                <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover/user:opacity-100" />
            </Link>
        </TooltipProvider>
    );
}
