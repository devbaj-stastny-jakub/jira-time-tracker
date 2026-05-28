import { createFileRoute } from '@tanstack/react-router';

import { DayTimeline } from '@/features/timer/DayTimeline';
import { ManualTab } from '@/features/timer/ManualTab';
import { RecordList } from '@/features/timer/RecordList';
import { TimerTab } from '@/features/timer/TimerTab';
import { TodayHeading } from '@/features/timer/TodayHeading';
import { useTodayRecords } from '@/features/timer/useRecords';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const Route = createFileRoute('/_app/')({
    component: TimerPage,
});

function TimerPage() {
    const { data: records, isPending } = useTodayRecords();
    const today = new Date();

    return (
        <div className="mx-auto w-full max-w-3xl space-y-8">
            <TodayHeading />

            {/* The console: a single instrument surface that switches between the
                live timer and manual entry. Cobalt wash + faint grid echo the
                sidebar, giving the working surface depth. */}
            <section className="relative overflow-hidden rounded-3xl bg-card ring-1 ring-border">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/6 via-transparent to-transparent"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-60 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-size-[22px_22px] mask-[radial-gradient(120%_80%_at_50%_0%,black,transparent_70%)]"
                />

                <Tabs defaultValue="timer" className="relative p-5 sm:p-6">
                    <TabsList className="self-center bg-foreground/[0.06] ring-1 ring-border shadow-sm ring-inset">
                        <TabsTrigger value="timer" className="data-active:shadow-sm">
                            Timer
                        </TabsTrigger>
                        <TabsTrigger value="manual" className="data-active:shadow-sm">
                            Manual
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="timer" className="pt-6">
                        <TimerTab />
                    </TabsContent>
                    <TabsContent value="manual" className="pt-6">
                        <ManualTab />
                    </TabsContent>
                </Tabs>
            </section>

            <section className="space-y-3">
                <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
                    Today’s timeline
                </p>
                <DayTimeline date={today} records={records ?? []} />
            </section>

            <RecordList records={records} isPending={isPending} />
        </div>
    );
}
