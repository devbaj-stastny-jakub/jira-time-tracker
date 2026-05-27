import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/user')({
    component: UserPage,
});

function UserPage() {
    return <h1 className="text-2xl font-semibold">User</h1>;
}
