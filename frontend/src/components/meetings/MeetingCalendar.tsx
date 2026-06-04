import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { type AppMeeting } from '../../lib/api/meetingService';
import { type AccountantLeave } from '../../lib/api/leaveService';

interface MeetingCalendarProps {
  meetings: AppMeeting[];
  leaves?: AccountantLeave[];
  onMeetingClick?: (meeting: AppMeeting) => void;
}

export default function MeetingCalendar({ meetings, leaves = [], onMeetingClick }: MeetingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const weekDays = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

  return (
    <div className="meeting-calendar-wrapper">
      <div className="calendar-header">
        <h2 className="calendar-month-title">
          {format(currentDate, 'MMMM yyyy', { locale: fr })}
        </h2>
        <div className="calendar-nav-btns">
          <button type="button" onClick={prevMonth} className="ws-icon-btn"><ChevronLeft size={20} /></button>
          <button type="button" onClick={nextMonth} className="ws-icon-btn"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="calendar-grid">
        {/* En-têtes des jours */}
        {weekDays.map((d, i) => (
          <div key={i} className="calendar-day-header">{d}</div>
        ))}

        {/* Jours du mois */}
        {daysInMonth.map((day, i) => {
          const isCurrMonth = isSameMonth(day, currentDate);
          const dayMeetings = meetings.filter(m => isSameDay(new Date(m.scheduledAt), day) && m.status !== 'INACTIVE');
          const isCurrentDay = isToday(day);
          
          // Check if day is a leave
          const isLeave = leaves.some(l => {
            const lStart = new Date(l.startDate);
            const lEnd = new Date(l.endDate);
            // Ignore time for comparison, just compare the dates
            lStart.setHours(0, 0, 0, 0);
            lEnd.setHours(23, 59, 59, 999);
            return day >= lStart && day <= lEnd;
          });

          return (
            <div
              key={i}
              className={`calendar-cell ${!isCurrMonth ? 'out-of-month' : ''} ${isCurrentDay ? 'is-today' : ''} ${isLeave ? 'is-leave' : ''}`}
            >
              <div className="calendar-cell-date">{format(day, 'd')}</div>
              <div className="calendar-cell-events">
                {isLeave && (
                  <div className="calendar-leave-badge">
                    <span className="event-title">Congé / Indisponible</span>
                  </div>
                )}
                {dayMeetings.slice(0, 3).map((m) => {
                  const mTime = format(new Date(m.scheduledAt), 'HH:mm');
                  const bgColor = m.color || 'var(--primary-100)';
                  const textColor = m.color ? '#fff' : 'var(--primary-700)';

                  return (
                    <div
                      key={m.id}
                      className="calendar-event-badge"
                      style={{ backgroundColor: bgColor, color: textColor }}
                      onClick={() => onMeetingClick?.(m)}
                    >
                      <span className="event-title" title={m.title}>{m.title}</span>
                      <span className="event-time">{mTime}</span>
                    </div>
                  );
                })}
                {dayMeetings.length > 3 && (
                  <div className="calendar-event-more">+{dayMeetings.length - 3} autres</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .meeting-calendar-wrapper {
          background: #fff;
          font-family: 'Inter', sans-serif;
        }
        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 0;
          margin-bottom: 0.5rem;
        }
        .calendar-month-title {
          font-size: 1.1rem;
          font-weight: 800;
          text-transform: capitalize;
          color: #1e293b;
          margin: 0;
        }
        .calendar-nav-btns {
          display: flex;
          gap: 0.5rem;
        }
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          border-top: 1px solid #f1f5f9;
          border-left: 1px solid #f1f5f9;
        }
        .calendar-day-header {
          text-align: left;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          color: #94a3b8;
          padding: 0.75rem;
          border-bottom: 1px solid #f1f5f9;
          border-right: 1px solid #f1f5f9;
          background: #fafafa;
        }
        .calendar-cell {
          min-height: 100px;
          padding: 0.5rem;
          border-bottom: 1px solid #f1f5f9;
          border-right: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background: #fff;
        }
        .calendar-cell.out-of-month {
          background: #f8fafc;
        }
        .calendar-cell-date {
          font-size: 0.85rem;
          font-weight: 700;
          color: #334155;
          text-align: left;
          align-self: flex-start;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .is-today .calendar-cell-date {
          background: var(--primary-600);
          color: #fff;
        }
        .calendar-cell-events {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          overflow-y: auto;
        }
        .calendar-event-badge {
          border-radius: 6px;
          padding: 4px 6px;
          font-size: 0.7rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          line-height: 1.3;
          transition: transform 0.1s ease;
          border-left: 2px solid rgba(0,0,0,0.1);
        }
        .calendar-event-badge:hover {
          transform: translateY(-1px);
          filter: brightness(0.95);
        }
        .event-title {
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .event-time {
          opacity: 0.85;
          font-size: 0.65rem;
        }
        .calendar-event-more {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-weight: 500;
          text-align: center;
          margin-top: 2px;
        }
        .is-leave {
          background: repeating-linear-gradient(
            45deg,
            #fef2f2,
            #fef2f2 10px,
            #fff 10px,
            #fff 20px
          );
        }
        .calendar-leave-badge {
          background-color: #fee2e2;
          color: #b91c1c;
          border-left: 2px solid #ef4444;
          border-radius: 6px;
          padding: 4px 6px;
          font-size: 0.7rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          margin-bottom: 2px;
        }
      `}</style>
    </div>
  );
}
