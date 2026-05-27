import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/settings')({
    component: SettingsPage,
});

function SettingsPage() {
    return <h1 className="text-2xl font-semibold">Settings</h1>;
}
