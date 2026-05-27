import { Link } from '@tanstack/react-router';
import { Calendar, Settings, Timer } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';

const navItems = [
    { to: '/', label: 'Timer', icon: Timer, exact: true },
    { to: '/calendar', label: 'Calendar', icon: Calendar, exact: false },
    { to: '/settings', label: 'Settings', icon: Settings, exact: false },
] as const;

// Drive the active state from TanStack Router's data-status, tinted with primary.
const activeClass =
    'data-[status=active]:bg-primary/10 data-[status=active]:font-medium data-[status=active]:text-primary';

export function AppSidebar() {
    return (
        <Sidebar
            collapsible="none"
            className="m-2 h-[calc(100svh-1rem)] rounded-2xl ring-1 ring-sidebar-border"
        >
            <SidebarHeader className="px-3 py-3 text-sm font-semibold">
                Timetracker
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map(({ to, label, icon: Icon, exact }) => (
                                <SidebarMenuItem key={to}>
                                    <SidebarMenuButton
                                        className={activeClass}
                                        render={
                                            <Link to={to} activeOptions={{ exact }} />
                                        }
                                    >
                                        <Icon />
                                        <span>{label}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            className={activeClass}
                            render={<Link to="/user" />}
                        >
                            <Avatar>
                                <AvatarFallback>U</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col leading-tight">
                                <span className="text-sm font-medium">User</span>
                                <span className="text-xs text-muted-foreground">
                                    Not connected
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
