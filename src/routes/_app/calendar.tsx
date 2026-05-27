import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/calendar')({
    component: CalendarPage,
});

function CalendarPage() {
    return <h1 className="text-2xl font-semibold">Calendar</h1>;
}
