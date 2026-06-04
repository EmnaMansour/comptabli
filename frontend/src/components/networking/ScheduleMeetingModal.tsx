import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Video, Phone, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { createMeeting, fetchAvailableSlots } from '../../lib/api/meetingService';

export type ScheduleMeetingModalProps = {
  open: boolean;
  onClose: () => void;
  accountantId: string;
  accountantName: string;
};

export default function ScheduleMeetingModal({
  open,
  onClose,
  accountantId,
  accountantName,
}: ScheduleMeetingModalProps) {
  const { user, token } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [form, setForm] = useState({
    title: '',
    subject: 'Conseil fiscal',
    description: '',
    type: 'VIRTUAL' as 'VIRTUAL' | 'PHYSICAL' | 'PHONE',
    date: '',
    time: '',
    duration: 30,
    locationDetail: '',
  });

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSuccess(false);
      setError(null);
      setForm(f => ({
        ...f,
        title: `RDV avec ${accountantName}`,
        date: '',
        time: '',
      }));
      loadSlots(currentMonth);
    }
  }, [open, accountantId, accountantName, currentMonth]);

  const loadSlots = async (date: Date) => {
    setLoadingSlots(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const slots = await fetchAvailableSlots(accountantId, year, month);
      setAvailableSlots(slots);
    } catch (err) {
      console.error('Failed to fetch slots', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && (!form.title || !form.subject)) return;
    if (step === 2 && (!form.date || !form.time)) return;
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!token) {
      setError('Vous devez être connecté pour prendre rendez-vous.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
      const res = await createMeeting({
        title: form.title,
        subject: form.subject,
        description: form.description,
        type: form.type,
        scheduledAt,
        duration: form.duration,
        accountantId,
        locationDetail: form.locationDetail,
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.message || "Une erreur est survenue lors de la réservation.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (offset: number) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(newMonth);
  };

  if (!open) return null;

  // Helpers for calendar render
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const monthName = currentMonth.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="nw-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="nw-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: step === 2 ? '700px' : '500px', borderRadius: '24px' }}>
        <button type="button" className="nw-modal-close" onClick={onClose}><X size={20} /></button>

        {success ? (
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 16px rgba(34, 197, 94, 0.15)' }}>
              <CheckCircle size={44} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.5px' }}>Demande envoyée !</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: 36 }}>
              Votre demande de rendez-vous avec <strong style={{ color: '#1e293b' }}>{accountantName}</strong> a été transmise avec succès.<br />
              Vous recevrez une notification dès sa validation.
            </p>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)', transition: 'transform 0.2s, boxShadow 0.2s' }}
            >
              Retour à l'annuaire
            </button>
          </div>
        ) : (
          <>
            <div style={{ padding: '32px 32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Prendre rendez-vous</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Avec {accountantName}</p>
                </div>
              </div>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800 }}>
                Étape {step} sur 3
              </div>
            </div>

            {/* Smooth Progress */}
            <div style={{ padding: '0 32px 24px' }}>
              <div style={{ width: '100%', height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(step / 3) * 100}%`, height: '100%', background: '#2563eb', transition: 'width 0.3s ease' }} />
              </div>
            </div>

            <div style={{ padding: '0 32px 32px', maxHeight: '70vh', overflowY: 'auto' }}>
              {error && (
                <div style={{ display: 'flex', gap: 12, background: '#fef2f2', border: '1px solid #fecaca', padding: 16, borderRadius: 12, color: '#991b1b', marginBottom: 24, fontSize: '0.9rem' }}>
                  <AlertCircle size={20} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}

              {step === 1 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Objet du rendez-vous</label>
                    <select 
                      value={form.subject} 
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      style={{ width: '100%', padding: '0.85rem 1rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', outline: 'none' }}
                    >
                      <option value="Conseil fiscal">Conseil fiscal</option>
                      <option value="Bilan annuel">Bilan annuel</option>
                      <option value="Création d'entreprise">Création d'entreprise</option>
                      <option value="Audit">Audit</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Précisions (optionnel)</label>
                    <textarea 
                      rows={4} 
                      placeholder="Décrivez brièvement votre besoin..."
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      style={{ width: '100%', padding: '0.85rem 1rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={() => setForm(f => ({ ...f, type: 'VIRTUAL' }))} style={{ flex: 1, padding: '16px 12px', borderRadius: 12, border: form.type === 'VIRTUAL' ? '2px solid #2563eb' : '1px solid #e2e8f0', background: form.type === 'VIRTUAL' ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: form.type === 'VIRTUAL' ? '0 4px 12px rgba(37, 99, 235, 0.1)' : 'none' }}>
                      <Video size={24} color={form.type === 'VIRTUAL' ? '#2563eb' : '#94a3b8'} style={{ marginBottom: 8, transition: 'all 0.2s' }} />
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: form.type === 'VIRTUAL' ? '#1e40af' : '#475569' }}>Visioconférence</div>
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, type: 'PHYSICAL' }))} style={{ flex: 1, padding: '16px 12px', borderRadius: 12, border: form.type === 'PHYSICAL' ? '2px solid #2563eb' : '1px solid #e2e8f0', background: form.type === 'PHYSICAL' ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: form.type === 'PHYSICAL' ? '0 4px 12px rgba(37, 99, 235, 0.1)' : 'none' }}>
                      <MapPin size={24} color={form.type === 'PHYSICAL' ? '#2563eb' : '#94a3b8'} style={{ marginBottom: 8, transition: 'all 0.2s' }} />
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: form.type === 'PHYSICAL' ? '#1e40af' : '#475569' }}>En personne</div>
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, type: 'PHONE' }))} style={{ flex: 1, padding: '16px 12px', borderRadius: 12, border: form.type === 'PHONE' ? '2px solid #2563eb' : '1px solid #e2e8f0', background: form.type === 'PHONE' ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: form.type === 'PHONE' ? '0 4px 12px rgba(37, 99, 235, 0.1)' : 'none' }}>
                      <Phone size={24} color={form.type === 'PHONE' ? '#2563eb' : '#94a3b8'} style={{ marginBottom: 8, transition: 'all 0.2s' }} />
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: form.type === 'PHONE' ? '#1e40af' : '#475569' }}>Téléphone</div>
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#1e293b', textTransform: 'capitalize' }}>{monthName}</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="nw-icon-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
                      <button type="button" className="nw-icon-btn" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
                    </div>
                  </div>

                  {loadingSlots ? (
                    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Chargement des créneaux...</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 24 }}>
                      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                        <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', padding: '8px 0' }}>{d}</div>
                      ))}
                      {Array.from({ length: (firstDayOfMonth + 6) % 7 }).map((_, i) => <div key={`empty-${i}`} />)}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isAvailable = !!availableSlots[dateStr];
                        const isSelected = form.date === dateStr;
                        const isPast = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day) < new Date(new Date().setHours(0, 0, 0, 0));

                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={!isAvailable || isPast}
                            onClick={() => setForm(f => ({ ...f, date: dateStr, time: '' }))}
                            style={{
                              aspectRatio: '1',
                              borderRadius: 12,
                              border: 'none',
                              background: isSelected ? '#2563eb' : isAvailable ? '#eff6ff' : 'transparent',
                              color: isSelected ? '#fff' : isAvailable ? '#1d4ed8' : '#cbd5e1',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              cursor: isAvailable ? 'pointer' : 'default',
                              transition: 'all 0.2s',
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {form.date && availableSlots[form.date] && (
                    <div className="animate-fade-in">
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569', marginBottom: 12 }}>Horaires disponibles pour le {new Date(form.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {availableSlots[form.date].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, time: t }))}
                            style={{
                              padding: '10px',
                              borderRadius: 8,
                              border: form.time === t ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              background: form.time === t ? '#eff6ff' : '#fff',
                              color: form.time === t ? '#1e40af' : '#475569',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="animate-fade-in" style={{ background: '#f8fafc', borderRadius: 20, padding: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Récapitulatif de votre demande</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <Calendar size={18} color="#2563eb" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>DATE & HEURE</div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                          {new Date(form.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {form.time}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        {form.type === 'VIRTUAL' ? <Video size={18} color="#2563eb" /> : form.type === 'PHONE' ? <Phone size={18} color="#2563eb" /> : <MapPin size={18} color="#2563eb" />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>TYPE DE RÉUNION</div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                          {form.type === 'VIRTUAL' ? 'Visioconférence' : form.type === 'PHONE' ? 'Appel téléphonique' : 'En personne'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <Clock size={18} color="#2563eb" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>DURÉE</div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{form.duration} minutes</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '0 32px 32px', display: 'flex', gap: 12 }}>
              {step > 1 ? (
                <button type="button" onClick={() => setStep(step - 1)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Retour</button>
              ) : (
                <button type="button" onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
              )}
              
              {step < 3 ? (
                <button 
                  type="button" 
                  onClick={handleNext} 
                  disabled={step === 2 && (!form.date || !form.time)}
                  style={{ flex: 2, padding: '14px', borderRadius: '12px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, cursor: (step === 2 && (!form.date || !form.time)) ? 'not-allowed' : 'pointer', opacity: (step === 2 && (!form.date || !form.time)) ? 0.6 : 1, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
                >
                  Suivant
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={handleSubmit} 
                  disabled={loading}
                  style={{ flex: 2, padding: '14px', borderRadius: '12px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
                >
                  {loading ? 'Réservation...' : 'Confirmer la demande'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
