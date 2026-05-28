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
            <div className="animate-in fade-in slide-in-from-top-3 duration-500">
                <TodayHeading />
            </div>

            {/* The console: a single instrument surface that switches between the
                live timer and manual entry. Cobalt wash + faint grid echo the
                sidebar, giving the working surface depth. */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 relative overflow-hidden rounded-3xl bg-card ring-1 ring-border">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/6 via-transparent to-transparent"
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

            <section className="animate-in fade-in slide-in-from-left-4 duration-500 delay-200 space-y-3">
                <h2 className="font-heading text-base font-medium tracking-tight text-foreground">
                    Today&rsquo;s timeline
                </h2>
                <DayTimeline date={today} records={records ?? []} />
            </section>

            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-300">
                <RecordList records={records} isPending={isPending} />
            </div>
        </div>
    );
}
