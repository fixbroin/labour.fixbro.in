"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CalendarDays, CheckCircle2, AlertCircle, Sun, Coffee, Briefcase, CalendarCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { getZonedDate, formatZonedDateToISO, formatDateInTimezone } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getActiveCheckoutEntries } from '@/lib/cartManager';
import { db } from '@/lib/firebase';
import { doc, getDoc } from '@/lib/mysqlDb';

interface ScheduleSelectionProps {
  onSelect: (date: Date, slot: string, endTime: string, interveningBreaks: any[], dailyTimeline?: any[]) => void;
  initialDate?: Date;
  initialSlot?: string;
  latitude?: number;
  longitude?: number;
  providerIds?: string[];
  durationDays?: number;
}

export default function ScheduleSelection({
  onSelect,
  initialDate,
  initialSlot,
  providerIds: propProviderIds,
  durationDays: propDurationDays,
}: ScheduleSelectionProps) {
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();
  const { toast } = useToast();

  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [catWorkingHours, setCatWorkingHours] = useState<{ start: string; end: string }>({ start: "09:30 AM", end: "05:30 PM" });
  const [catLunchBreak, setCatLunchBreak] = useState<{ start: string; end: string }>({ start: "01:00 PM", end: "02:00 PM" });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeCatId = localStorage.getItem('fixbroActiveCheckoutCategory');
      if (activeCatId && activeCatId !== 'daily-labour') {
        getDoc(doc(db, 'adminCategories', activeCatId)).then((snap) => {
          if (snap.exists()) {
            const cd = snap.data();
            if (cd?.workingHours?.start && cd?.workingHours?.end) {
              setCatWorkingHours(cd.workingHours);
            }
            if (cd?.lunchBreak?.start && cd?.lunchBreak?.end) {
              setCatLunchBreak(cd.lunchBreak);
            }
          }
        }).catch(() => {});
      }
    }
  }, []);

  // Compute tomorrow at 00:00:00 (present day is strictly blocked)
  const tomorrow = useMemo(() => {
    const d = getZonedDate(new Date(), appConfig?.timezone || 'Asia/Kolkata');
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [appConfig?.timezone]);

  // Determine provider IDs and booking duration days
  const effectiveProviderIds = useMemo(() => {
    if (propProviderIds && propProviderIds.length > 0) return propProviderIds;
    if (typeof window !== 'undefined') {
      const entries = getActiveCheckoutEntries();
      return entries.map(e => e.serviceId);
    }
    return [];
  }, [propProviderIds]);

  const effectiveDurationDays = useMemo(() => {
    if (propDurationDays && propDurationDays > 0) return propDurationDays;
    if (typeof window !== 'undefined') {
      const entries = getActiveCheckoutEntries();
      const maxQty = Math.max(...entries.map(e => e.quantity || 1), 1);
      return maxQty > 0 ? maxQty : 1;
    }
    return 1;
  }, [propDurationDays]);

  // Helper: check if a date range is unavailable
  const isDateRangeUnavailable = useCallback((startDate: Date, days: number, bookedList: string[]): boolean => {
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const iso = formatZonedDateToISO(d, appConfig?.timezone || 'Asia/Kolkata');
      if (bookedList.includes(iso)) return true;
    }
    return false;
  }, [appConfig?.timezone]);

  // Helper: find first available date starting from a given date
  const findFirstAvailableDate = useCallback((startFrom: Date, days: number, bookedList: string[]): Date => {
    const curr = new Date(startFrom);
    curr.setHours(0, 0, 0, 0);
    for (let i = 0; i < 90; i++) {
      if (!isDateRangeUnavailable(curr, days, bookedList)) {
        return curr;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return startFrom;
  }, [isDateRangeUnavailable]);

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialDate && initialDate >= tomorrow) {
      return initialDate;
    }
    return tomorrow;
  });

  const [displayMonth, setDisplayMonth] = useState<Date>(selectedDate);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Load provider booked dates from active bookings
  useEffect(() => {
    if (effectiveProviderIds.length === 0) return;

    let isMounted = true;
    setIsLoadingAvailability(true);

    fetch(`/api/providers/availability?providerIds=${encodeURIComponent(effectiveProviderIds.join(','))}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data && Array.isArray(data.bookedDates)) {
          setBookedDates(data.bookedDates);

          // If the currently selected date or tomorrow is booked, advance to next available day
          setSelectedDate(current => {
            const dateToEvaluate = current && current >= tomorrow ? current : tomorrow;
            if (isDateRangeUnavailable(dateToEvaluate, effectiveDurationDays, data.bookedDates)) {
              const nextFree = findFirstAvailableDate(tomorrow, effectiveDurationDays, data.bookedDates);
              setDisplayMonth(nextFree);
              return nextFree;
            }
            return dateToEvaluate;
          });
        }
      })
      .catch(err => {
        console.error("Failed to load provider booked dates:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAvailability(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveProviderIds, effectiveDurationDays, tomorrow, isDateRangeUnavailable, findFirstAvailableDate]);

  // Adjust selection when initialDate or tomorrow changes
  useEffect(() => {
    if (initialDate && initialDate >= tomorrow) {
      if (!isDateRangeUnavailable(initialDate, effectiveDurationDays, bookedDates)) {
        setSelectedDate(initialDate);
        return;
      }
    }
    const nextFree = findFirstAvailableDate(tomorrow, effectiveDurationDays, bookedDates);
    setSelectedDate(nextFree);
  }, [tomorrow, initialDate, effectiveDurationDays, bookedDates, isDateRangeUnavailable, findFirstAvailableDate]);

  // Horizontal scroll drag handlers
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      setIsDragging(false);
    };

    const handleMouseLeave = () => {
      isDown = false;
    };

    const handleMouseUp = () => {
      setTimeout(() => setIsDragging(false), 50);
      isDown = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(x - startX) > 5) setIsDragging(true);
      el.scrollLeft = scrollLeft - walk;
    };

    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mousemove', handleMouseMove);

    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // 14-day list starting strictly from tomorrow
  const dateList = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(tomorrow);
      d.setDate(tomorrow.getDate() + i);
      list.push(d);
    }
    return list;
  }, [tomorrow]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    if (date < tomorrow) {
      toast({
        title: "Same Day Booking Not Available",
        description: "Full-day daily labour booking must be scheduled from tomorrow onwards.",
        variant: "destructive",
      });
      return;
    }

    if (isDateRangeUnavailable(date, effectiveDurationDays, bookedDates)) {
      toast({
        title: "Date Unavailable",
        description: "This provider is already booked on this date. Please choose an available open date.",
        variant: "destructive",
      });
      return;
    }

    setSelectedDate(date);
    setDisplayMonth(date);
  };

  const handleConfirm = () => {
    if (!selectedDate) return;

    if (isDateRangeUnavailable(selectedDate, effectiveDurationDays, bookedDates)) {
      toast({
        title: "Date Not Available",
        description: "The selected date is booked. Please select an available date.",
        variant: "destructive",
      });
      return;
    }

    const startTime = catWorkingHours.start || "09:30 AM";
    const endTime = catWorkingHours.end || "05:30 PM";
    const slotLabel = `Full Day (${startTime} - ${endTime})`;
    onSelect(selectedDate, slotLabel, endTime, []);
  };

  const formatDateForDisplay = (date: Date): string => {
    return formatDateInTimezone(date, appConfig?.timezone || 'Asia/Kolkata');
  };

  // Compute end date for multi-day booking
  const endDateForDisplay = useMemo(() => {
    if (effectiveDurationDays <= 1) return null;
    const d = new Date(selectedDate);
    d.setDate(selectedDate.getDate() + (effectiveDurationDays - 1));
    return formatDateForDisplay(d);
  }, [selectedDate, effectiveDurationDays, appConfig?.timezone]);

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Date Picker Header */}
      <div className="space-y-3 w-full min-w-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 bg-primary rounded-full" />
            <h3 className="text-lg font-bold text-foreground">Select Booking Date</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-1">
              Tomorrow Onwards
            </Badge>
            {bookedDates.length > 0 && (
              <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20 text-[11px] px-2 py-0.5">
                Booked dates blocked
              </Badge>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/80 inline-block" />
              Booked / Unavailable
            </span>
          </div>
          {effectiveDurationDays > 1 && (
            <span className="font-semibold text-primary">
              {effectiveDurationDays} Days Duration
            </span>
          )}
        </div>

        {/* Horizontal Dates Scroller */}
        <div className="w-full overflow-hidden">
          <div
            ref={scrollRef}
            className="flex overflow-x-auto gap-2.5 pb-2 pt-1 scrollbar-none select-none w-full cursor-grab active:cursor-grabbing"
          >
            {dateList.map((date) => {
              const dateISO = formatZonedDateToISO(date, appConfig?.timezone);
              const selectedDateISO = formatZonedDateToISO(selectedDate, appConfig?.timezone);
              const isSelected = dateISO === selectedDateISO;
              const isUnavailable = isDateRangeUnavailable(date, effectiveDurationDays, bookedDates);

              return (
                <button
                  key={dateISO}
                  data-date-iso={dateISO}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => {
                    if (isDragging) return;
                    if (isUnavailable) {
                      toast({
                        title: "Date Unavailable",
                        description: "This provider is already booked on this date. Please select an available date.",
                        variant: "destructive",
                      });
                      return;
                    }
                    handleDateSelect(date);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border min-w-[72px] h-[86px] transition-all shrink-0 ${
                    isUnavailable
                      ? 'bg-muted/40 border-muted-foreground/20 text-muted-foreground/40 cursor-not-allowed opacity-60'
                      : isSelected
                      ? 'bg-primary border-primary text-primary-foreground shadow-md font-bold scale-[1.02]'
                      : 'bg-background hover:bg-muted/40 border-muted text-foreground'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-85">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className={`text-2xl font-extrabold leading-none mt-1 ${isUnavailable ? 'line-through opacity-50' : ''}`}>
                    {date.getDate()}
                  </span>
                  {isUnavailable ? (
                    <span className="text-[9px] font-bold text-destructive mt-1 uppercase tracking-wider">
                      Booked
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold mt-1 opacity-75">
                      {date.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  )}
                </button>
              );
            })}

            {/* More Dates Button */}
            <button
              type="button"
              onClick={() => setIsCalendarOpen(true)}
              className="flex flex-col items-center justify-center p-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 min-w-[72px] h-[86px] text-primary transition-all shrink-0"
            >
              <CalendarDays className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-bold">More</span>
              <span className="text-[8px] font-semibold opacity-85">Dates</span>
            </button>
          </div>
        </div>

        {/* Calendar Dialog for any future date */}
        <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md bg-background border rounded-2xl shadow-lg p-0">
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                Select Full-Day Booking Date
              </DialogTitle>
            </DialogHeader>
            <div className="p-4 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-xs text-muted-foreground mb-3 px-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
                  Red dates are already booked
                </span>
                {effectiveDurationDays > 1 && (
                  <span className="font-semibold text-primary">
                    {effectiveDurationDays} Days Booking
                  </span>
                )}
              </div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    if (isDateRangeUnavailable(date, effectiveDurationDays, bookedDates)) {
                      toast({
                        title: "Date Unavailable",
                        description: "This provider is booked on this date. Please pick an open date.",
                        variant: "destructive",
                      });
                      return;
                    }
                    handleDateSelect(date);
                    setIsCalendarOpen(false);
                  }
                }}
                month={displayMonth}
                onMonthChange={setDisplayMonth}
                disabled={(date) => {
                  if (date < tomorrow) return true;
                  return isDateRangeUnavailable(date, effectiveDurationDays, bookedDates);
                }}
                className="rounded-md border"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Full Day Service Working Details */}
      <Card className="border border-primary/20 bg-primary/[0.03] overflow-hidden rounded-2xl">
        <CardHeader className="bg-primary/10 py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
              <Briefcase className="h-4 w-4 text-primary" />
              Full Day Labour Schedule Details
            </CardTitle>
            <Badge className="bg-green-600 text-white text-xs font-semibold px-2.5 py-0.5">
              {effectiveDurationDays > 1 ? `${effectiveDurationDays} Days Service` : 'Full Day'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm py-1 gap-1">
            <span className="text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              {effectiveDurationDays > 1 ? 'Booking Period:' : 'Selected Date:'}
            </span>
            <div className="text-left sm:text-right">
              <span className="font-bold text-foreground text-base block">
                {formatDateForDisplay(selectedDate)}
              </span>
              {endDateForDisplay && (
                <span className="text-xs text-primary font-medium">
                  until {endDateForDisplay} ({effectiveDurationDays} continuous days)
                </span>
              )}
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-background border border-border/60">
              <Sun className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">Daily Working Hours</p>
                <p className="text-sm font-bold text-foreground">{catWorkingHours.start} – {catWorkingHours.end}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-background border border-border/60">
              <Coffee className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">Lunch Break</p>
                <p className="text-sm font-bold text-foreground">{catLunchBreak.start} – {catLunchBreak.end}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border/60 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span>Worker will report directly to your specified address by <strong>{catWorkingHours.start}</strong> for full-day service (until <strong>{catWorkingHours.end}</strong>).</span>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Button */}
      <div className="pt-2 flex justify-end">
        <Button
          onClick={handleConfirm}
          className="w-full py-6 text-lg font-bold shadow-lg transition-all"
        >
          Confirm Date & Proceed
        </Button>
      </div>
    </div>
  );
}
