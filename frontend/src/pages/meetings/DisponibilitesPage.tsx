import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Save, Check, X, CalendarOff, Trash2, Plus } from 'lucide-react';
import { fetchAvailability, updateAvailability, type MeetingSlot } from '../../lib/api/meetingService';
import { fetchLeaves, createLeave, deleteLeave, type AccountantLeave } from '../../lib/api/leaveService';

const DAYS = [
  { id: 1, label: 'Lundi' },
  { id: 2, label: 'Mardi' },
  { id: 3, label: 'Mercredi' },
  { id: 4, label: 'Jeudi' },
  { id: 5, label: 'Vendredi' },
  { id: 6, label: 'Samedi' },
  { id: 0, label: 'Dimanche' },
];

type UISlot = MeetingSlot & { _uiId: number };

export default function DisponibilitesPage({ onBack }: { onBack: () => void }) {
  const [slots, setSlots] = useState<UISlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<'horaires' | 'conges'>('horaires');

  // Leaves state
  const [leaves, setLeaves] = useState<AccountantLeave[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [addingLeave, setAddingLeave] = useState(false);

  async function loadSlots() {
    setLoading(true);
    let data = await fetchAvailability();
    if (data.length === 0) {
      data = DAYS.map(d => ({
        dayOfWeek: d.id,
        startTime: '09:00',
        endTime: '12:00',
        isActive: d.id >= 1 && d.id <= 5,
      }));
    }
    const allSlots = [...data];
    for (const d of DAYS) {
      if (!allSlots.some(s => s.dayOfWeek === d.id)) {
        allSlots.push({ dayOfWeek: d.id, startTime: '09:00', endTime: '12:00', isActive: false });
      }
    }
    setSlots(allSlots.map((s, i) => ({ ...s, _uiId: i })));
    setLoading(false);
  };

  async function loadLeaves() {
    setLeavesLoading(true);
    const data = await fetchLeaves();
    setLeaves(data);
    setLeavesLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSlots();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLeaves();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload = slots.map(({ _uiId, ...s }) => s);
    const res = await updateAvailability(payload);
    setSaving(false);
    if (res.ok) {
      setToast('Vos disponibilités ont été enregistrées.');
      setTimeout(() => setToast(null), 3000);
    } else {
      alert(res.message);
    }
  };

  const handleAddLeave = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate) {
      setToast('Veuillez remplir les dates de début et de fin.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setAddingLeave(true);
    const res = await createLeave({
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      reason: leaveForm.reason || undefined,
    });
    setAddingLeave(false);
    if (res.ok) {
      setLeaveForm({ startDate: '', endDate: '', reason: '' });
      setToast('Congé ajouté avec succès.');
      setTimeout(() => setToast(null), 3000);
      await loadLeaves();
    } else {
      setToast(res.message);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteLeave = async (id: string) => {
    const res = await deleteLeave(id);
    if (res.ok) {
      setToast('Congé supprimé.');
      setTimeout(() => setToast(null), 3000);
      await loadLeaves();
    } else {
      setToast(res.message);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const updateSlot = (uiId: number, field: keyof MeetingSlot, value: any) => {
    setSlots(prev => prev.map(s => s._uiId === uiId ? { ...s, [field]: value } : s));
  };

  const toggleDay = (dayId: number, targetActive: boolean) => {
    setSlots(prev => prev.map(s => s.dayOfWeek === dayId ? { ...s, isActive: targetActive } : s));
  };

  const addSlot = (dayId: number) => {
    setSlots(prev => [
      ...prev,
      { dayOfWeek: dayId, startTime: '13:00', endTime: '17:00', isActive: true, _uiId: Date.now() + Math.random() }
    ]);
  };

  const removeSlot = (uiId: number) => {
    setSlots(prev => prev.filter(s => s._uiId !== uiId));
  };

  const applyToAll = (dayId: number) => {
    const sourceSlots = slots.filter(s => s.dayOfWeek === dayId);
    if (sourceSlots.length === 0) return;

    setSlots(prev => {
      const otherDays = prev.filter(s => s.dayOfWeek === dayId);
      const newSlots = [...otherDays];
      DAYS.forEach(d => {
        if (d.id === dayId) return;
        sourceSlots.forEach(ss => {
          newSlots.push({ ...ss, dayOfWeek: d.id, _uiId: Date.now() + Math.random() });
        });
      });
      return newSlots;
    });
    setToast('Horaires dupliqués sur toute la semaine !');
    setTimeout(() => setToast(null), 3000);
  };

  const setMorningOnly = (dayId: number) => {
    setSlots(prev => {
      const filtered = prev.filter(s => s.dayOfWeek !== dayId);
      return [
        ...filtered,
        { dayOfWeek: dayId, startTime: '08:00', endTime: '12:00', isActive: true, _uiId: Date.now() + Math.random() }
      ];
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="ws-page animate-fade-in" style={{ padding: '0 0.5rem', maxWidth: 1000 }}>
      {toast && (
        <div className="ws-toast ws-toast--success">
          <Check size={18} /> {toast}
        </div>
      )}

      {/* ── Top Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="ws-icon-btn" onClick={onBack} style={{ margin: 0 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Mes disponibilités</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '2px 0 0' }}>Gérez vos horaires de travail et vos congés</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setTab('horaires')}
          style={{
            padding: '12px 28px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
            border: 'none', borderBottom: tab === 'horaires' ? '3px solid #2563eb' : '3px solid transparent',
            background: 'transparent', color: tab === 'horaires' ? '#2563eb' : '#64748b',
            transition: 'all 0.2s',
          }}
        >
          <Clock size={16} style={{ marginRight: 8, verticalAlign: '-3px' }} />
          Horaires de travail
        </button>
        <button
          type="button"
          onClick={() => setTab('conges')}
          style={{
            padding: '12px 28px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
            border: 'none', borderBottom: tab === 'conges' ? '3px solid #2563eb' : '3px solid transparent',
            background: 'transparent', color: tab === 'conges' ? '#2563eb' : '#64748b',
            transition: 'all 0.2s',
          }}
        >
          <CalendarOff size={16} style={{ marginRight: 8, verticalAlign: '-3px' }} />
          Congés & Indisponibilités
        </button>
      </div>

      {/* ═══════════ TAB 1: HORAIRES ═══════════ */}
      {tab === 'horaires' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', padding: '32px 40px', boxShadow: '0 2px 20px rgba(0,0,0,0.02)' }}>
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
              <Clock size={16} color="#2563eb" /> Durée du rendez-vous
            </label>
            <select className="ws-select w-full" defaultValue="30" style={{ padding: '12px 16px' }}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 heure</option>
            </select>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 12 }}>Les clients pourront réserver par créneaux de 30 minutes.</p>
          </div>

          {loading ? (
            <p style={{ color: '#94a3b8' }}>Chargement de vos disponibilités...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {DAYS.map((day) => {
                const daySlots = slots.filter(s => s.dayOfWeek === day.id);
                const isDayActive = daySlots.some(s => s.isActive);

                return (
                  <div key={day.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                          {day.label}
                        </span>
                        {isDayActive && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button 
                              type="button" 
                              onClick={() => setMorningOnly(day.id)}
                              style={{ 
                                padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, 
                                borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
                                color: '#64748b'
                              }}
                            >
                              Matin (8h-12h)
                            </button>
                            <button 
                              type="button" 
                              onClick={() => applyToAll(day.id)}
                              title="Copier ces horaires sur tous les jours"
                              style={{ 
                                padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, 
                                borderRadius: 6, border: '1px solid #e2e8f0', background: '#dbeafe', cursor: 'pointer',
                                color: '#1d4ed8'
                              }}
                            >
                              Appliquer partout
                            </button>
                          </div>
                        )}
                      </div>
                      <label className="ws-switch">
                        <input
                          type="checkbox"
                          checked={isDayActive}
                          onChange={(e) => toggleDay(day.id, e.target.checked)}
                        />
                        <span className="ws-switch-slider"></span>
                      </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: isDayActive ? 1 : 0.5, pointerEvents: isDayActive ? 'auto' : 'none' }}>
                       {daySlots.map((slot) => (
                         <div key={slot._uiId} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                              <input
                                type="time"
                                className="ws-input w-full"
                                value={slot.startTime}
                                onChange={(e) => updateSlot(slot._uiId, 'startTime', e.target.value)}
                                style={{ paddingLeft: 40 }}
                              />
                              <Clock size={16} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)' }} />
                            </div>

                            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>à</span>

                            <div style={{ position: 'relative', flex: 1 }}>
                              <input
                                type="time"
                                className="ws-input w-full"
                                value={slot.endTime}
                                onChange={(e) => updateSlot(slot._uiId, 'endTime', e.target.value)}
                                style={{ paddingLeft: 40 }}
                              />
                              <Clock size={16} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)' }} />
                            </div>

                            {daySlots.length > 1 && (
                              <button type="button" onClick={() => removeSlot(slot._uiId)} style={{
                                 border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8'
                              }}>
                                 <X size={20} />
                              </button>
                            )}
                         </div>
                       ))}

                       <button type="button" onClick={() => addSlot(day.id)} style={{
                         padding: '10px 24px', borderRadius: 8, border: 'none', background: '#2563eb',
                         color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', alignSelf: 'flex-start', marginTop: 4
                       }}>
                         + Ajouter un créneau
                       </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating Save */}
          <button
            className="ws-btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
            style={{ position: 'fixed', bottom: 40, right: 40, borderRadius: 50, padding: '14px 28px', boxShadow: '0 8px 30px rgba(37, 99, 235, 0.4)' }}
          >
            <Save size={18} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      )}

      {/* ═══════════ TAB 2: CONGÉS ═══════════ */}
      {tab === 'conges' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f1f5f9', padding: '32px 40px', boxShadow: '0 2px 20px rgba(0,0,0,0.02)' }}>

          {/* Add leave form */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={18} color="#2563eb" /> Ajouter une période d'absence
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' }}>Date de début</label>
                <input
                  type="date"
                  className="ws-input w-full"
                  value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' }}>Date de fin</label>
                <input
                  type="date"
                  className="ws-input w-full"
                  value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' }}>Motif (facultatif)</label>
              <input
                type="text"
                className="ws-input w-full"
                placeholder="Ex: Vacances, Formation, Personnel..."
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
            <button
              className="ws-btn-primary"
              onClick={handleAddLeave}
              disabled={addingLeave}
              style={{ padding: '12px 28px' }}
            >
              <CalendarOff size={16} style={{ marginRight: 6 }} />
              {addingLeave ? 'Enregistrement...' : 'Ajouter ce congé'}
            </button>
          </div>

          {/* List of existing leaves */}
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginBottom: 16 }}>
              Périodes d'absence planifiées
            </h3>
            {leavesLoading ? (
              <p style={{ color: '#94a3b8' }}>Chargement...</p>
            ) : leaves.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <CalendarOff size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontWeight: 600 }}>Aucune période d'absence enregistrée</p>
                <p style={{ fontSize: '0.85rem' }}>Utilisez le formulaire ci-dessus pour bloquer des dates dans votre calendrier.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {leaves.map(leave => (
                  <div
                    key={leave.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px', borderRadius: 12, border: '1px solid #fecaca',
                      background: '#fef2f2',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.9rem' }}>
                        {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                      </div>
                      {leave.reason && (
                        <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: 4 }}>
                          {leave.reason}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLeave(leave.id)}
                      style={{
                        border: 'none', background: '#fee2e2', color: '#b91c1c',
                        borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem',
                      }}
                    >
                      <Trash2 size={14} /> Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .ws-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }
        .ws-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .ws-switch-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #f1f5f9;
          transition: .3s;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
        }
        .ws-switch-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 2px;
          bottom: 2px;
          background-color: #cbd5e1;
          transition: .3s;
          border-radius: 50%;
        }
        .ws-switch input:checked + .ws-switch-slider {
          background-color: #2563eb;
          border-color: #2563eb;
        }
        .ws-switch input:checked + .ws-switch-slider:before {
          background-color: white;
          transform: translateX(20px);
        }
      `}</style>
    </div>
  );
}
