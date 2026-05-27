import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/')({
    component: TimerPage,
});

function TimerPage() {
    return <h1 className="text-2xl font-semibold">Timer</h1>;
}
