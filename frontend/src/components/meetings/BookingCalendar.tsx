import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, CalendarCheck, AlertCircle } from 'lucide-react';
import { fetchAvailableSlots } from '../../lib/api/meetingService';

interface BookingCalendarProps {
  accountantId: string;
  onSelectSlot: (date: string, time: string) => void;
  selectedDate: string;
  selectedTime: string;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function BookingCalendar({ accountantId, onSelectSlot, selectedDate, selectedTime }: BookingCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountantId) return;
    setLoading(true);
    fetchAvailableSlots(accountantId, year, month)
      .then(setSlots)
      .finally(() => setLoading(false));
  }, [accountantId, year, month]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Can't go before current month
  const canGoPrev = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);

  // Build calendar grid (Monday-start)
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay(): 0=Sun, 1=Mon... We want Mon=0
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  // fill trailing
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const getDateStr = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isAvailable = (day: number) => {
    const key = getDateStr(day);
    return slots[key] && slots[key].length > 0;
  };

  const timeSlotsForSelected = selectedDate ? (slots[selectedDate] || []) : [];

  return (
    <div style={{ display: 'flex', gap: 20, minHeight: 350 }}>
      {/* ── Calendar Grid ── */}
      <div style={{ flex: 1 }}>
        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            style={{
              border: 'none', background: 'none', cursor: canGoPrev ? 'pointer' : 'default',
              opacity: canGoPrev ? 1 : 0.3, padding: 4,
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 8px' }}></div>
            Chargement...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {calendarCells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const dateStr = getDateStr(day);
              const available = isAvailable(day);
              const isSelected = dateStr === selectedDate;
              const isPast = new Date(year, month - 1, day) < new Date(now.getFullYear(), now.getMonth(), now.getDate());

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={!available || isPast}
                  onClick={() => onSelectSlot(dateStr, '')}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: '50%',
                    border: isSelected ? '2px solid #2563eb' : '2px solid transparent',
                    background: isSelected ? '#2563eb' : available ? '#eff6ff' : 'transparent',
                    color: isSelected ? '#fff' : available ? '#1e40af' : isPast ? '#e2e8f0' : '#cbd5e1',
                    fontWeight: available ? 700 : 400,
                    fontSize: '0.85rem',
                    cursor: available && !isPast ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        )}

        {!loading && Object.keys(slots).length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            <AlertCircle size={20} style={{ margin: '0 auto 6px', display: 'block' }} />
            Aucune disponibilité ce mois-ci
          </div>
        )}
      </div>

      {/* ── Time Slots Panel ── */}
      <div style={{
        width: 160, borderLeft: '1px solid #f1f5f9', paddingLeft: 20,
        display: 'flex', flexDirection: 'column',
      }}>
        {selectedDate ? (
          <>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} color="#2563eb" />
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            {timeSlotsForSelected.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Aucun créneau disponible.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 260 }}>
                {timeSlotsForSelected.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onSelectSlot(selectedDate, t)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: selectedTime === t ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: selectedTime === t ? '#2563eb' : '#fff',
                      color: selectedTime === t ? '#fff' : '#0f172a',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'center',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94a3b8', textAlign: 'center' }}>
            <CalendarCheck size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
            <p style={{ fontSize: '0.8rem', fontWeight: 500 }}>Sélectionnez une date pour voir les créneaux disponibles</p>
          </div>
        )}
      </div>
    </div>
  );
}
