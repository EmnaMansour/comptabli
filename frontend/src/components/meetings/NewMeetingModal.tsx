import { useState } from 'react';
import { X, MapPin, Video, Phone, Calendar as CalendarIcon, User, Plus, AlertCircle } from 'lucide-react';
import { createMeeting } from '../../lib/api/meetingService';
import { useAuthStore } from '../../store/authStore';
import BookingCalendar from './BookingCalendar';

interface NewMeetingModalProps {
  onClose: () => void;
  onSuccess: () => void;
  staffClients?: { id: string; name: string }[];
  clientAccountants?: { id: string; name: string }[];
}

export default function NewMeetingModal({ onClose, onSuccess, staffClients, clientAccountants }: NewMeetingModalProps) {
  const { user } = useAuthStore();
  const isClient = user?.role === 'CLIENT';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563eb');

  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const [locationType, setLocationType] = useState('VIRTUAL');
  const [locationDetail, setLocationDetail] = useState('');
  const [physicalSubtype, setPhysicalSubtype] = useState<'OFFICE' | 'CABINET' | 'OTHER'>('OFFICE');

  const [guests, setGuests] = useState<string[]>([]);
  const [guestEmail, setGuestEmail] = useState('');

  const subjects = ['Bilan annuel', 'Conseil fiscal', 'Audit de compte', 'Point mensuel', 'Autre'];
  const colors = [
    { name: 'Blue', value: '#2563eb' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Purple', value: '#9333ea' },
    { name: 'Orange', value: '#ea580c' },
    { name: 'Yellow', value: '#ca8a04' },
    { name: 'Pink', value: '#db2777' }
  ];

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const addGuest = () => {
    if (guestEmail && !guests.includes(guestEmail)) {
      setGuests([...guests, guestEmail]);
      setGuestEmail('');
    }
  };

  const removeGuest = (email: string) => {
    setGuests(guests.filter(g => g !== email));
  };

  const handleSlotSelect = (d: string, t: string) => {
    setDate(d);
    if (t) setTime(t);
  };

  const handleSubmit = async () => {
    if (!date || !time || !title) {
      setError('Veuillez remplir les champs obligatoires.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const scheduledAtObj = new Date(`${date}T${time}`);
      const nowObj = new Date();
      // Allow a small 2min buffer
      if (scheduledAtObj.getTime() < nowObj.getTime() - 2 * 60 * 1000) {
        setError('La date et l\'heure doivent être dans le futur.');
        setLoading(false);
        return;
      }
      let finalLocationDetail = locationDetail;
      if (locationType === 'PHYSICAL') {
        if (physicalSubtype === 'OFFICE') finalLocationDetail = 'Mon bureau';
        if (physicalSubtype === 'CABINET') finalLocationDetail = 'Chez le cabinet de comptabilité';
      }

      const scheduledAt = scheduledAtObj.toISOString();
      const body = {
        title,
        subject,
        description,
        color,
        type: locationType,
        scheduledAt,
        duration: 30,
        locationDetail: locationType !== 'VIRTUAL' ? finalLocationDetail : undefined,
        meetingLink: locationType === 'VIRTUAL' ? locationDetail : undefined,
        guests: guests.length > 0 ? JSON.stringify(guests) : undefined,
        clientId: isClient ? user?.id : selectedTargetId,
        accountantId: isClient ? selectedTargetId : user?.id,
      };

      const res = await createMeeting(body);
      if (res.ok) {
        onSuccess();
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError('Erreur lors de la création.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ws-modal-overlay animate-fade-in" onClick={loading ? undefined : onClose}>
      <div className="ws-modal meeting-modal" onClick={e => e.stopPropagation()}>
        <div className="ws-modal-header border-b-0 pb-0">
          <div className="flex justify-between items-start w-full">
            <div>
              <h2 className="text-xl font-bold">Nouveau rendez-vous</h2>
              <p className="text-sm text-gray-500 mt-1">Planifiez votre prochaine rencontre.</p>
            </div>
            <button type="button" className="ws-icon-btn" onClick={onClose} disabled={loading}><X size={20} /></button>
          </div>

          <div className="meeting-tabs mt-4">
            <div className={`m-tab ${step >= 1 ? 'active' : ''}`}>Détails</div>
            <div className={`m-tab ${step >= 2 ? 'active' : ''}`}>Date & Heure</div>
            <div className={`m-tab ${step >= 3 ? 'active' : ''}`}>Invités</div>
          </div>
        </div>

        <div className="ws-modal-body bg-gray-50/50">
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
              padding: '16px', borderRadius: '10px', marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.05)',
              animation: 'fadeIn 0.3s ease-in-out'
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
              <div>
                <h4 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>Réservation impossible</h4>
                <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: 0, lineHeight: 1.4 }}>{error}</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="step-content animate-slide-up">
              <label className="ws-input-label">Titre *</label>
              <input className="ws-input mb-4" placeholder="Titre de la réunion" value={title} onChange={e => setTitle(e.target.value)} />

              <label className="ws-input-label">Sujet</label>
              <select className="ws-select mb-4 w-full" value={subject} onChange={e => setSubject(e.target.value)}>
                <option value="">Sélectionner un sujet</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <label className="ws-input-label">Description</label>
              <textarea className="ws-input mb-4" rows={3} placeholder="Informer l'objet de la réunion..." value={description} onChange={e => setDescription(e.target.value)} />

              <label className="ws-input-label">Couleur de la réunion</label>
              <div className="flex gap-3 mt-1">
                {colors.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`color-btn ${color === c.value ? 'selected' : ''}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-content animate-slide-up">
              {/* Select accountant/client first */}
              <div style={{ marginBottom: 16 }}>
                {isClient ? (
                  <div>
                    <label className="ws-input-label flex items-center gap-1"><User size={14}/> Cabinet / Comptable *</label>
                    <select className="ws-select w-full" value={selectedTargetId} onChange={e => { setSelectedTargetId(e.target.value); setDate(''); setTime(''); }}>
                      <option value="">Choisir un comptable</option>
                      {clientAccountants?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="ws-input-label flex items-center gap-1"><User size={14}/> Client *</label>
                    <select className="ws-select w-full" value={selectedTargetId} onChange={e => setSelectedTargetId(e.target.value)}>
                      <option value="">Choisir un client</option>
                      {staffClients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Unified Calendar for Client & Staff: show Calendly-like booking */}
              {selectedTargetId ? (
                <BookingCalendar
                  accountantId={isClient ? selectedTargetId : user!.id}
                  onSelectSlot={handleSlotSelect}
                  selectedDate={date}
                  selectedTime={time}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>
                  <CalendarIcon size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Veuillez d'abord sélectionner un {isClient ? 'comptable' : 'client'}</p>
                  <p style={{ fontSize: '0.8rem' }}>Le calendrier des disponibilités s'affichera ici.</p>
                </div>
              )}

              {/* Location */}
              <label className="ws-input-label" style={{ marginTop: 16 }}>Localisation *</label>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className={`loc-card ${locationType === 'PHYSICAL' ? 'selected' : ''}`}
                  onClick={() => { setLocationType('PHYSICAL'); setPhysicalSubtype('OFFICE'); setLocationDetail(''); }}
                >
                  <MapPin size={18} className="loc-icon" />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Réunion physique</div>
                    <div className="text-xs text-gray-500">Réunion face à face</div>
                  </div>
                </button>
                {locationType === 'PHYSICAL' && (
                  <div style={{ marginTop: '-4px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#334155', cursor: 'pointer' }}>
                        <input type="radio" name="physical_loc" style={{ accentColor: '#ec4899', width: '16px', height: '16px', cursor: 'pointer' }} checked={physicalSubtype === 'OFFICE'} onChange={() => { setPhysicalSubtype('OFFICE'); setLocationDetail(''); }} />
                        Mon bureau
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#334155', cursor: 'pointer' }}>
                        <input type="radio" name="physical_loc" style={{ accentColor: '#ec4899', width: '16px', height: '16px', cursor: 'pointer' }} checked={physicalSubtype === 'CABINET'} onChange={() => { setPhysicalSubtype('CABINET'); setLocationDetail(''); }} />
                        Chez le cabinet de comptabilité
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#334155', cursor: 'pointer' }}>
                        <input type="radio" name="physical_loc" style={{ accentColor: '#ec4899', width: '16px', height: '16px', cursor: 'pointer' }} checked={physicalSubtype === 'OTHER'} onChange={() => { setPhysicalSubtype('OTHER'); setLocationDetail(''); }} />
                        Autre localisation
                      </label>
                    </div>
                    {physicalSubtype === 'OTHER' && (
                      <input className="ws-input text-sm w-full" placeholder="Entrer l'adresse ou lien google maps" value={locationDetail} onChange={e => setLocationDetail(e.target.value)} />
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className={`loc-card ${locationType === 'VIRTUAL' ? 'selected' : ''}`}
                  onClick={() => { setLocationType('VIRTUAL'); setLocationDetail(''); }}
                >
                  <Video size={18} className="loc-icon" />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Réunion virtuelle</div>
                    <div className="text-xs text-gray-500">Réunion en ligne</div>
                  </div>
                </button>
                {locationType === 'VIRTUAL' && (
                  <div style={{ marginTop: '-4px', marginBottom: '12px' }}>
                    <input className="ws-input text-sm w-full" placeholder="Katie@gmail.com" value={locationDetail} onChange={e => setLocationDetail(e.target.value)} />
                  </div>
                )}

                <button
                  type="button"
                  className={`loc-card ${locationType === 'PHONE' ? 'selected' : ''}`}
                  onClick={() => { setLocationType('PHONE'); setLocationDetail(''); }}
                >
                  <Phone size={18} className="loc-icon" />
                  <div className="text-left">
                    <div className="font-semibold text-sm">Appel téléphonique</div>
                    <div className="text-xs text-gray-500">Via WhatsApp ou sur tél</div>
                  </div>
                </button>
                {locationType === 'PHONE' && (
                  <div style={{ marginTop: '-4px', marginBottom: '12px' }}>
                    <input className="ws-input text-sm w-full" placeholder="+216 98 765 432" value={locationDetail} onChange={e => setLocationDetail(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step-content animate-slide-up">
              <label className="ws-input-label">Ajouter des invités (Emails)</label>
              <div className="flex gap-2 mb-4">
                <input
                  type="email"
                  className="ws-input flex-1"
                  placeholder="email@exemple.com"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuest())}
                />
                <button type="button" className="ws-btn-primary" style={{ padding: '0 1rem' }} onClick={addGuest}>
                  <Plus size={18} />
                </button>
              </div>

              {guests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {guests.map(g => (
                    <div key={g} className="bg-white border border-gray-200 rounded-full px-3 py-1 flex items-center gap-2 text-sm shadow-sm">
                      <span className="font-medium">{g}</span>
                      <button type="button" onClick={() => removeGuest(g)} className="text-gray-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ws-modal-footer">
          {step === 1 ? (
             <button type="button" className="ws-btn-outline w-full justify-center" onClick={onClose} disabled={loading}>Annuler</button>
          ) : (
             <button type="button" className="ws-btn-outline w-full justify-center" onClick={handlePrev} disabled={loading}>Retour</button>
          )}

          {step < 3 ? (
            <button type="button" className="ws-btn-primary w-full justify-center" onClick={handleNext}>Suivant</button>
          ) : (
            <button type="button" className="ws-btn-primary w-full justify-center" onClick={handleSubmit} disabled={loading || (!isClient && !selectedTargetId)}>
              {loading ? 'Planification...' : 'Planifier'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .meeting-modal {
          max-width: 580px;
          padding: 0;
          overflow: hidden;
        }
        .meeting-tabs {
          display: flex;
          gap: 1.5rem;
          border-bottom: 2px solid var(--gray-100);
        }
        .m-tab {
          padding-bottom: 0.75rem;
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--gray-400);
          position: relative;
          transition: all 0.2s;
        }
        .m-tab.active {
          color: var(--primary-600);
        }
        .m-tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--primary-600);
          border-radius: 2px 2px 0 0;
        }
        .color-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .color-btn:hover {
          transform: scale(1.1);
        }
        .color-btn.selected {
          border-color: #fff;
          outline: 2px solid var(--primary-600);
        }
        .time-slot-btn {
          padding: 0.4rem 1rem;
          border-radius: 20px;
          border: 1px solid var(--gray-200);
          background: #fff;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary);
          transition: all 0.2s;
        }
        .time-slot-btn:hover {
          border-color: var(--primary-400);
        }
        .time-slot-btn.selected {
          background: var(--primary-600);
          color: #fff;
          border-color: var(--primary-600);
        }
        .loc-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #fff;
          border: 1px solid var(--gray-200);
          border-radius: 8px;
          transition: all 0.2s;
          text-align: left;
        }
        .loc-card.selected {
          border-color: var(--primary-500);
          background: var(--primary-50);
        }
        .loc-card .loc-icon {
          color: var(--gray-400);
        }
        .loc-card.selected .loc-icon {
          color: var(--primary-600);
        }
      `}</style>
    </div>
  );
}
