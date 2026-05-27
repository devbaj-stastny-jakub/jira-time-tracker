import { createFileRoute } from '@tanstack/react-router';

import { ManualTab } from '@/features/timer/ManualTab';
import { RecordList } from '@/features/timer/RecordList';
import { TimerTab } from '@/features/timer/TimerTab';
import { TodayTimeline } from '@/features/timer/TodayTimeline';
import { TodayTotalBadge } from '@/features/timer/TodayTotalBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const Route = createFileRoute('/_app/')({
    component: TimerPage,
});

function TimerPage() {
    return (
        <div className="w-full space-y-6">
            <h1 className="text-2xl font-semibold">Timer</h1>

            <Card>
                <CardContent>
                    <Tabs defaultValue="timer">
                        <TabsList className="w-full">
                            <TabsTrigger value="timer">Timer</TabsTrigger>
                            <TabsTrigger value="manual">Manual</TabsTrigger>
                        </TabsList>
                        <TabsContent value="timer" className="pt-4">
                            <TimerTab />
                        </TabsContent>
                        <TabsContent value="manual" className="pt-4">
                            <ManualTab />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-muted-foreground">Today</h2>
                    <TodayTotalBadge />
                </div>
                <TodayTimeline />
                <RecordList />
            </section>
        </div>
    );
}
