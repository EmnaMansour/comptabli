import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Clock,
  Video,
  Phone,
  MapPin,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Mail,
  
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  fetchMeetings,
  createMeeting,
  updateMeetingStatus,
  updateMeeting,
  type AppMeeting,
} from '../../lib/api/meetingService';
import { fetchMessagingDirectory, type MessagingUser } from '../../lib/api/messagingService';
import { fetchLeaves, type AccountantLeave } from '../../lib/api/leaveService';
import MeetingCalendar from '../../components/meetings/MeetingCalendar';
import DisponibilitesPage from './DisponibilitesPage';

/* ── Helpers ── */
function personLabel(u?: { firstName: string; lastName: string; companyName?: string | null } | null) {
  if (!u) return '—';
  return u.companyName?.trim() || `${u.firstName} ${u.lastName}`;
}

function dateTimeLabelDetail(iso: string) {
  const d = new Date(iso);
  // Example: 07:13 pm
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
}

function locLabel(m: AppMeeting) {
  if (m.locationDetail) return m.locationDetail;
  if (m.type === 'PHYSICAL') return 'Bureau';
  if (m.type === 'PHONE') return 'Téléphone';
  return 'Virtuel';
}

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6'];
const MEETING_SUBJECTS = [
  'Bilan annuel', 'Conseil fiscal', 'Audit de compte', 'Fiscalité',
  'Point mensuel', 'Déclaration', 'Autre',
];
const COLORS = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Pink', value: '#ec4899' },
];

type TabFilter = 'today' | 'upcoming' | 'past';

export default function MesRendezVousPage() {
  const { user, token } = useAuthStore();
  const [searchParams] = useSearchParams();
  const meetingIdFromUrl = searchParams.get('id');
  const role = user?.role ?? null;
  const isClient = role === 'CLIENT';
  const isStaff = role === 'COMPTABLE' || role === 'COLLABORATEUR' || role === 'ADMIN';

  const [meetings, setMeetings] = useState<AppMeeting[]>([]);
  const [leaves, setLeaves] = useState<AccountantLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>('upcoming');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [editMeetingId, setEditMeetingId] = useState<string | null>(null);
  
  const [rejectingMeeting, setRejectingMeeting] = useState<AppMeeting | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [detailMeeting, setDetailMeeting] = useState<AppMeeting | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [isAvailabilityMode, setIsAvailabilityMode] = useState(false);

  const [staffClients, setStaffClients] = useState<MessagingUser[]>([]);
  const [staffAccountants, setStaffAccountants] = useState<MessagingUser[]>([]);

  const [form, setForm] = useState({
    title: '', subject: '', description: '', type: 'VIRTUAL',
    date: '', time: '09:00', duration: '30',
    locationDetail: '', meetingLink: '',
    physicalSubtype: 'OFFICE' as 'OFFICE' | 'CABINET' | 'OTHER',
    clientId: '', accountantId: '', color: '#2563eb',
    guestEmail: '', guests: [] as string[]
  });

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    if (!token || token === 'demo-token') { setMeetings([]); setLeaves([]); setLoading(false); return; }
    setLoading(true);
    try { 
      setMeetings(await fetchMeetings()); 
      setLeaves(await fetchLeaves());
    } finally { setLoading(false); }
  }, [token, role]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (meetingIdFromUrl && meetings.length > 0) {
      const found = meetings.find(m => m.id === meetingIdFromUrl);
      if (found) setDetailMeeting(found);
    }
  }, [meetingIdFromUrl, meetings]);

  useEffect(() => {
    if (token && token !== 'demo-token') {
      void fetchMessagingDirectory().then(dir => {
        if (dir) {
          setStaffClients(dir.clients ?? []);
          setStaffAccountants(dir.accountants ?? []);
        }
      });
    }
  }, [token]);

  /* ── Filtered lists ── */
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const todayMeetings = useMemo(() => meetings.filter(m => {
    const d = new Date(m.scheduledAt);
    return d >= todayStart && d < todayEnd && m.status !== 'INACTIVE';
  }), [meetings]);

  const upcomingMeetings = useMemo(() => meetings.filter(m => {
    const d = new Date(m.scheduledAt);
    return d >= todayEnd && m.status !== 'INACTIVE';
  }), [meetings]);

  const pastMeetings = useMemo(() => meetings.filter(m => {
    const d = new Date(m.scheduledAt);
    return d < todayStart || m.status === 'INACTIVE';
  }), [meetings]);

  const filtered = tab === 'today' ? todayMeetings : tab === 'upcoming' ? upcomingMeetings : pastMeetings;

  /* ── Actions ── */
  const confirmMeeting = async (m: AppMeeting) => {
    if (!token || token === 'demo-token') return;
    const res = await updateMeetingStatus(m.id, 'ACTIVE');
    if (!res.ok) { showToast('err', res.message); return; }
    await load();
    showToast('ok', 'Rendez-vous confirmé.');
  };

  const submitReject = async () => {
    if (!rejectingMeeting || !token || token === 'demo-token') return;
    const res = await updateMeetingStatus(rejectingMeeting.id, 'INACTIVE', rejectionReason);
    if (!res.ok) { showToast('err', res.message); return; }
    setRejectingMeeting(null);
    setRejectionReason('');
    await load();
    showToast('ok', 'Rendez-vous refusé.');
  };

  const openCreate = () => {
    setForm({
      title: '', subject: '', description: '', type: 'VIRTUAL',
      date: '', time: '09:00', duration: '30',
      locationDetail: '', meetingLink: '',
      physicalSubtype: 'OFFICE',
      clientId: '', accountantId: '', color: '#2563eb',
      guestEmail: '', guests: []
    });
    setEditMeetingId(null);
    setCreateStep(1);
    setModalError(null);
    setCreateOpen(true);
  };

  const openEdit = () => {
    if (!detailMeeting) return;
    const d = new Date(detailMeeting.scheduledAt);
    let parsedGuests: string[] = [];
    if (detailMeeting.guests) {
      try { parsedGuests = JSON.parse(detailMeeting.guests); } catch { /* ignore */ }
    }

    let parsedSubtype: 'OFFICE' | 'CABINET' | 'OTHER' = 'OFFICE';
    if (detailMeeting.type === 'PHYSICAL') {
      if (detailMeeting.locationDetail === 'Mon bureau') parsedSubtype = 'OFFICE';
      else if (detailMeeting.locationDetail === 'Chez le cabinet de comptabilité') parsedSubtype = 'CABINET';
      else parsedSubtype = 'OTHER';
    }

    setForm({
      title: detailMeeting.title,
      subject: detailMeeting.subject || '',
      description: detailMeeting.description || '',
      type: detailMeeting.type,
      date: d.toISOString().split('T')[0],
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      duration: String(detailMeeting.duration || 30),
      locationDetail: detailMeeting.locationDetail || '',
      meetingLink: detailMeeting.meetingLink || '',
      physicalSubtype: parsedSubtype,
      clientId: detailMeeting.clientId || '',
      accountantId: detailMeeting.accountantId || '',
      color: detailMeeting.color || '#2563eb',
      guestEmail: '',
      guests: parsedGuests
    });
    setEditMeetingId(detailMeeting.id);
    setDetailMeeting(null); // Close review modal
    setCreateStep(1);
    setModalError(null);
    setCreateOpen(true);
  };

  const addGuest = () => {
    if (form.guestEmail.trim() && form.guestEmail.includes('@')) {
      setForm(f => ({ ...f, guests: [...f.guests, f.guestEmail.trim()], guestEmail: '' }));
    }
  };

  const removeGuest = (idx: number) => {
    setForm(f => ({ ...f, guests: f.guests.filter((_, i) => i !== idx) }));
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createStep < 3) {
      if (createStep === 1) {
        if (!form.title.trim() || !form.subject) return; // Wait for required validation natively or block here
      }
      if (createStep === 2) {
        if (!form.date || !form.time) return;
        if (isStaff && !form.clientId) return;
      }
      setCreateStep(prev => prev + 1);
      return;
    }

    if (!token || token === 'demo-token') { showToast('err', 'Connexion requise.'); return; }
    
    // Auto-add guest if typed but not added
    const finalGuests = [...form.guests];
    if (form.guestEmail.trim() && form.guestEmail.includes('@')) {
      finalGuests.push(form.guestEmail.trim());
    }

    const scheduledAtObj = new Date(`${form.date}T${form.time}`);
    const nowObj = new Date();
    // Allow a small 2min buffer for submission delay
    if (scheduledAtObj.getTime() < nowObj.getTime() - 2 * 60 * 1000) {
      showToast('err', 'La date et l\'heure doivent être dans le futur.');
      return;
    }
    const scheduledAt = scheduledAtObj.toISOString();
    
    let finalLocationDetail = form.locationDetail;
    if (form.type === 'PHYSICAL') {
      if (form.physicalSubtype === 'OFFICE') finalLocationDetail = 'Mon bureau';
      if (form.physicalSubtype === 'CABINET') finalLocationDetail = 'Chez le cabinet de comptabilité';
    }

    const payload = {
      title: form.title.trim(),
      subject: form.subject || undefined,
      description: form.description || undefined,
      type: form.type,
      scheduledAt,
      duration: Number(form.duration) || 30,
      locationDetail: form.type !== 'VIRTUAL' ? finalLocationDetail : undefined,
      meetingLink: form.type === 'VIRTUAL' ? (form.meetingLink || form.locationDetail || undefined) : undefined,
      color: form.color,
      clientId: isClient ? undefined : form.clientId,
      accountantId: isClient ? (form.accountantId || undefined) : undefined,
      guests: finalGuests.length > 0 ? JSON.stringify(finalGuests) : undefined
    };

    let res;
    if (editMeetingId) {
      res = await updateMeeting(editMeetingId, payload);
    } else {
      res = await createMeeting(payload);
    }

    if (!res.ok) { 
      setModalError(res.message); 
      return; 
    }
    
    setModalError(null);
    setCreateOpen(false);
    await load();
    showToast('ok', editMeetingId ? 'Rendez-vous mis à jour !' : 'Rendez-vous planifié avec succès !');
  };

  if (isAvailabilityMode) {
    return <DisponibilitesPage onBack={() => setIsAvailabilityMode(false)} />;
  }

  /* ══════════════════════ RENDER ══════════════════════ */
  return (
    <div className="ws-page animate-fade-in" style={{ padding: '0 0.5rem', maxWidth: 1200 }}>
      {toast && (
        <div className={`ws-toast ws-toast--${toast.kind === 'ok' ? 'success' : 'error'}`}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {toast.kind === 'ok' ? <Check size={18} /> : <X size={18} />}{toast.text}
          </span>
          <button type="button" className="ws-icon-btn" onClick={() => setToast(null)}><X size={16} /></button>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Mes RDV</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0' }}>Suivi de vos rendez-vous</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isStaff && (
            <button type="button" onClick={() => setIsAvailabilityMode(true)} style={{
              padding: '10px 20px', borderRadius: 8, border: 'none', background: '#f97316',
              color: '#fff', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)'
            }}>
              Mes disponibilités
            </button>
          )}
          <button type="button" onClick={openCreate} style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb',
            color: '#fff', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={18} /> Nouveau
          </button>
        </div>
      </div>

      {/* ── Tabs (exact matching) ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        <button type="button" onClick={() => setTab('today')} style={{
          padding: '10px 22px', border: 'none',
          borderRadius: '12px 0 0 0', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
          background: tab === 'today' ? '#4f46e5' : '#e2e8f0', color: tab === 'today' ? '#fff' : '#64748b',
          transition: 'all 0.2s', position: 'relative', zIndex: tab === 'today' ? 2 : 1
        }}>
          Aujourd'hui <span style={{
            marginLeft: 6, background: tab === 'today' ? 'rgba(255,255,255,0.25)' : '#fff',
            color: tab === 'today' ? '#fff' : '#475569',
            borderRadius: 50, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 800,
          }}>{todayMeetings.length}</span>
          {tab === 'today' && <div style={{ position: 'absolute', right: -10, top: 0, bottom: 0, width: 20, background: '#4f46e5', transform: 'skewX(20deg)', zIndex: -1, borderRadius: '0 12px 0 0' }}></div>}
        </button>
        <button type="button" onClick={() => setTab('upcoming')} style={{
          padding: '10px 22px', border: 'none',
          fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
          background: tab === 'upcoming' ? '#fff' : '#f1f5f9', color: tab === 'upcoming' ? '#0f172a' : '#64748b',
          transition: 'all 0.2s', position: 'relative', zIndex: tab === 'upcoming' ? 2 : 1,
          boxShadow: tab === 'upcoming' ? '0 -2px 10px rgba(0,0,0,0.02)' : 'none'
        }}>
          A venir <span style={{
            marginLeft: 6, background: tab === 'upcoming' ? '#f1f5f9' : '#fff',
            color: tab === 'upcoming' ? '#64748b' : '#475569',
            borderRadius: 50, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 800,
          }}>{upcomingMeetings.length}</span>
           {tab === 'upcoming' && <div style={{ position: 'absolute', right: -10, top: 0, bottom: 0, width: 20, background: '#fff', transform: 'skewX(20deg)', zIndex: -1, borderRadius: '0 12px 0 0' }}></div>}
           {tab === 'upcoming' && <div style={{ position: 'absolute', left: -10, top: 0, bottom: 0, width: 20, background: '#fff', transform: 'skewX(20deg)', zIndex: -1, borderRadius: '12px 0 0 0' }}></div>}
        </button>
        <button type="button" onClick={() => setTab('past')} style={{
          padding: '10px 22px', border: 'none',
          borderRadius: '0 12px 0 0', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
          background: tab === 'past' ? '#4f46e5' : '#e2e8f0', color: tab === 'past' ? '#fff' : '#64748b',
          transition: 'all 0.2s', position: 'relative', zIndex: tab === 'past' ? 2 : 1
        }}>
           {tab === 'past' && <div style={{ position: 'absolute', left: -10, top: 0, bottom: 0, width: 20, background: '#4f46e5', transform: 'skewX(20deg)', zIndex: -1, borderRadius: '12px 0 0 0' }}></div>}
          Passé <span style={{
            marginLeft: 6, background: tab === 'past' ? 'rgba(255,255,255,0.25)' : '#fff',
            color: tab === 'past' ? '#fff' : '#475569',
            borderRadius: 50, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 800,
          }}>{pastMeetings.length}</span>
        </button>
      </div>

      <div style={{ background: '#f8fafc', padding: 24, borderRadius: '0 16px 16px 16px', minHeight: 'calc(100vh - 200px)' }}>
        
        {/* ── Meeting Cards ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          {loading ? (
            <p style={{ color: '#94a3b8', padding: '1rem 0' }}>Chargement…</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
              <p>Aucun rendez-vous pour cet onglet.</p>
            </div>
          ) : filtered.map((m, idx) => {
            const Person = isClient ? m.accountant : m.client;
            
            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px',
                background: '#fff', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                border: '1px solid #f1f5f9', cursor: 'pointer'
              }} onClick={() => setDetailMeeting(m)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
                  }}>
                    {(Person?.firstName?.[0] ?? 'U').toUpperCase()}{(Person?.lastName?.[0] ?? '').toUpperCase()}
                  </div>

                  {/* Info */}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginBottom: 2 }}>{m.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.85rem', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isClient ? personLabel(m.accountant) : personLabel(m.client)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={14} /> {dateTimeLabelDetail(m.scheduledAt)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} /> {locLabel(m)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {m.status === 'PENDING' && (
                    <>
                      <button type="button" onClick={() => setRejectingMeeting(m)} style={{
                        padding: '10px 24px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff',
                        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', color: '#0f172a',
                      }}>Annuler</button>
                      <button type="button" onClick={() => void confirmMeeting(m)} style={{
                        padding: '10px 24px', borderRadius: 8, border: 'none', background: '#2563eb',
                        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', color: '#fff',
                      }}>Suivant</button>
                    </>
                  )}
                  {m.status === 'ACTIVE' && (
                    <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem', padding: '0 10px' }}>
                      Pending
                    </span>
                  )}
                  {m.status === 'INACTIVE' && (
                    <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', padding: '0 10px' }}>
                      Rejected
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Calendar View ── */}
        <div style={{ background: '#fff', borderRadius: 4, padding: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}>
           <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 16 }}>{now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h3>
           <MeetingCalendar meetings={meetings} leaves={leaves} onMeetingClick={setDetailMeeting} />
        </div>
      </div>

      {/* ══════ REJECT MODAL ══════ */}
      {rejectingMeeting && (
        <div className="ws-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="ws-modal" style={{ maxWidth: 440, borderRadius: 16, padding: '32px' }}>
             <button type="button" className="ws-icon-btn" style={{ position: 'absolute', top: 16, right: 16 }} onClick={() => setRejectingMeeting(null)}><X size={20} /></button>
             
             <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Êtes-vous sûr de refuser la reunion ?</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Veuillez entrer la raison d'annulation .</p>
             </div>

             <textarea 
               className="ws-input" 
               rows={4} 
               placeholder="Ex : conflit d'horaire, changement de priorité.."
               value={rejectionReason}
               onChange={e => setRejectionReason(e.target.value)}
               style={{ marginBottom: 24, resize: 'none' }}
             />

             <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
               <button type="button" style={{ 
                 padding: '10px 32px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', 
                 fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', color: '#0f172a' 
               }} onClick={() => setRejectingMeeting(null)}>Annuler</button>
               
               <button type="button" style={{ 
                 padding: '10px 32px', borderRadius: 8, border: 'none', background: '#ef4444', 
                 fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', color: '#fff',
                 boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
               }} onClick={submitReject}>Confirmer</button>
             </div>
          </div>
        </div>
      )}

      {/* ══════ MULTI-STEP CREATE MODAL ══════ */}
      {createOpen && (
        <div className="ws-modal-overlay" onClick={() => setCreateOpen(false)} style={{ zIndex: 9000 }}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 16px', position: 'relative', background: '#fff' }}>
              <button type="button" className="ws-icon-btn" onClick={() => setCreateOpen(false)} style={{ position: 'absolute', right: 24, top: 24 }}><X size={20} /></button>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Nouveau rendez-vous</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Planifiez votre prochaine rencontre avec votre comptable.</p>
            </div>

            {/* Step Indicators */}
            <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid #f1f5f9' }}>
               <div 
                 style={{ 
                   flex: 1, padding: '16px 0', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', 
                   color: createStep >= 1 ? '#2563eb' : '#94a3b8', 
                   borderBottom: createStep === 1 ? '2px solid #2563eb' : '2px solid transparent', 
                   transition: 'all 0.3s'
                 }} 
               >
                 Details
               </div>
               <div 
                 style={{ 
                   flex: 1, padding: '16px 0', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', 
                   color: createStep >= 2 ? '#2563eb' : '#94a3b8', 
                   borderBottom: createStep === 2 ? '2px solid #2563eb' : '2px solid transparent',
                   transition: 'all 0.3s'
                 }}
               >
                 Date et localisation
               </div>
               <div 
                 style={{ 
                   flex: 1, padding: '16px 0', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', 
                   color: createStep === 3 ? '#2563eb' : '#94a3b8', 
                   borderBottom: createStep === 3 ? '2px solid #2563eb' : '2px solid transparent',
                   transition: 'all 0.3s'
                 }}
               >
                 Invités
               </div>
            </div>

            <form onSubmit={submitCreate}>
              <div style={{ padding: '24px', minHeight: 400, maxHeight: '60vh', overflowY: 'auto' }}>
                
                {modalError && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                    padding: '16px', borderRadius: '10px', marginBottom: '24px',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.05)',
                    animation: 'fadeIn 0.3s ease-in-out'
                  }}>
                    <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>Réservation impossible</h4>
                      <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: 0, lineHeight: 1.4 }}>{modalError}</p>
                    </div>
                  </div>
                )}

                {/* STEP 1: Details */}
                {createStep === 1 && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <label className="ws-input-label">Titre <span style={{ color: '#dc2626' }}>*</span></label>
                      <input className="ws-input" required placeholder="Titre de la reunion" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <label className="ws-input-label">Sujet <span style={{ color: '#dc2626' }}>*</span></label>
                      <select className="ws-select w-full" required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                        <option value="">Sélectionner un sujet</option>
                        {MEETING_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="ws-input-label">Description <span style={{ color: '#dc2626' }}>*</span></label>
                      <textarea className="ws-input" required rows={4} placeholder="Informer votre comptable sur l'objet de la Reunion..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'none' }} />
                    </div>
                    <div>
                      <label className="ws-input-label" style={{ marginBottom: 12 }}>Meeting color</label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {COLORS.map(c => (
                          <button key={c.name} type="button" onClick={() => setForm(f => ({ ...f, color: c.value }))} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8,
                            border: form.color === c.value ? `1px solid ${c.value}` : '1px solid #e2e8f0',
                            background: form.color === c.value ? `${c.value}15` : '#fff',
                            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#0f172a'
                          }}>
                            <span style={{ width: 12, height: 12, borderRadius: 2, background: c.value }}></span> {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Date & Localization */}
                {createStep === 2 && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <label className="ws-input-label">{isClient ? 'Cabinet de comptabilité' : 'Client'} <span style={{ color: '#dc2626' }}>*</span></label>
                        {isClient ? (
                          <select className="ws-select w-full" required value={form.accountantId} onChange={e => setForm(f => ({ ...f, accountantId: e.target.value }))}>
                            <option value="">Choisir un comptable</option>
                            {staffAccountants.map(a => <option key={a.id} value={a.id}>{personLabel(a)}</option>)}
                          </select>
                        ) : (
                          <select className="ws-select w-full" required value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                            <option value="">Choisir un client</option>
                            {staffClients.map(c => <option key={c.id} value={c.id}>{personLabel(c)}</option>)}
                          </select>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="ws-input-label">Date <span style={{ color: '#dc2626' }}>*</span></label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            className="ws-input w-full" 
                            type="date" 
                            required 
                            min={new Date().toISOString().split('T')[0]}
                            value={form.date} 
                            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} 
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                       <label className="ws-input-label" style={{ marginBottom: 12 }}>Heure <span style={{ color: '#dc2626' }}>*</span></label>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {['09:00', '10:30', '14:00', '16:00'].map(t => (
                            <button key={t} type="button" onClick={() => setForm(f => ({ ...f, time: t }))} style={{
                              flex: '1 1 80px', padding: '10px 0', borderRadius: 12,
                              border: form.time === t ? `2px solid #2563eb` : '1px solid #e2e8f0',
                              background: form.time === t ? '#eff6ff' : '#fff',
                              color: form.time === t ? '#1e40af' : '#475569',
                              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: form.time === t ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none'
                            }}>
                              {t}
                            </button>
                          ))}
                          <div style={{ position: 'relative', flex: '1 1 120px' }}>
                            <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input 
                              type="time" 
                              className="ws-input" 
                              style={{ padding: '8px 12px 8px 36px', borderRadius: 12 }}
                              value={form.time}
                              onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                            />
                          </div>
                        </div>
                    </div>

                    <div>
                      <label className="ws-input-label" style={{ marginBottom: 12 }}>Localisation <span style={{ color: '#dc2626' }}>*</span></label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Réunion physique */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 8,
                            border: form.type === 'PHYSICAL' ? '1px solid #2563eb' : '1px solid #e2e8f0',
                            cursor: 'pointer', marginBottom: form.type === 'PHYSICAL' ? 8 : 0
                          }}>
                            <input type="radio" name="meeting_type" checked={form.type === 'PHYSICAL'} onChange={() => setForm(f => ({ ...f, type: 'PHYSICAL', physicalSubtype: 'OFFICE', locationDetail: '' }))} style={{ display: 'none' }} />
                            <MapPin size={20} color={form.type === 'PHYSICAL' ? '#2563eb' : '#64748b'} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: form.type === 'PHYSICAL' ? '#2563eb' : '#0f172a' }}>Réunion physique</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Réunion face à face</div>
                            </div>
                          </label>
                           {form.type === 'PHYSICAL' && (
                            <div style={{ 
                              marginTop: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
                              padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0',
                              animation: 'slideDown 0.3s ease-out'
                            }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                                  <input type="radio" name="physical_loc_edit" style={{ accentColor: '#2563eb', width: '18px', height: '18px', cursor: 'pointer' }} checked={form.physicalSubtype === 'OFFICE'} onChange={() => setForm(f => ({ ...f, physicalSubtype: 'OFFICE', locationDetail: '' }))} />
                                  Mon bureau
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                                  <input type="radio" name="physical_loc_edit" style={{ accentColor: '#2563eb', width: '18px', height: '18px', cursor: 'pointer' }} checked={form.physicalSubtype === 'CABINET'} onChange={() => setForm(f => ({ ...f, physicalSubtype: 'CABINET', locationDetail: '' }))} />
                                  Chez le cabinet
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                                  <input type="radio" name="physical_loc_edit" style={{ accentColor: '#2563eb', width: '18px', height: '18px', cursor: 'pointer' }} checked={form.physicalSubtype === 'OTHER'} onChange={() => setForm(f => ({ ...f, physicalSubtype: 'OTHER', locationDetail: '' }))} />
                                  Autre
                                </label>
                              </div>
                              {form.physicalSubtype === 'OTHER' && (
                                <div style={{ position: 'relative' }}>
                                  <MapPin size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                  <input className="ws-input w-full" style={{ paddingLeft: 36, borderRadius: 12 }} placeholder="Adresse ou lien Google Maps" value={form.locationDetail} onChange={e => setForm(f => ({ ...f, locationDetail: e.target.value }))} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Réunion virtuelle */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 8,
                            border: form.type === 'VIRTUAL' ? '1px solid #2563eb' : '1px solid #e2e8f0',
                            cursor: 'pointer', marginBottom: form.type === 'VIRTUAL' ? 8 : 0
                          }}>
                            <input type="radio" name="meeting_type" checked={form.type === 'VIRTUAL'} onChange={() => setForm(f => ({ ...f, type: 'VIRTUAL', locationDetail: '' }))} style={{ display: 'none' }} />
                            <Video size={20} color={form.type === 'VIRTUAL' ? '#2563eb' : '#64748b'} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: form.type === 'VIRTUAL' ? '#2563eb' : '#0f172a' }}>Réunion virtuelle</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Réunion en ligne</div>
                            </div>
                          </label>
                          {form.type === 'VIRTUAL' && (
                            <div style={{ 
                              marginTop: '8px', marginBottom: '16px', padding: '16px', background: '#f8fafc', 
                              borderRadius: 12, border: '1px solid #e2e8f0', animation: 'slideDown 0.3s ease-out'
                            }}>
                              <div style={{ position: 'relative' }}>
                                <Video size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input className="ws-input w-full" style={{ paddingLeft: 36, borderRadius: 12 }} placeholder="Lien de la réunion (Zoom, Google Meet...)" value={form.locationDetail} onChange={e => setForm(f => ({ ...f, locationDetail: e.target.value }))} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Appel téléphonique */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 8,
                            border: form.type === 'PHONE' ? '1px solid #2563eb' : '1px solid #e2e8f0',
                            cursor: 'pointer', marginBottom: form.type === 'PHONE' ? 8 : 0
                          }}>
                            <input type="radio" name="meeting_type" checked={form.type === 'PHONE'} onChange={() => setForm(f => ({ ...f, type: 'PHONE', locationDetail: '' }))} style={{ display: 'none' }} />
                            <Phone size={20} color={form.type === 'PHONE' ? '#2563eb' : '#64748b'} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: form.type === 'PHONE' ? '#2563eb' : '#0f172a' }}>Appel téléphonique</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Via WhatsApp ou sur tél</div>
                            </div>
                          </label>
                          {form.type === 'PHONE' && (
                            <div style={{ 
                              marginTop: '8px', marginBottom: '16px', padding: '16px', background: '#f8fafc', 
                              borderRadius: 12, border: '1px solid #e2e8f0', animation: 'slideDown 0.3s ease-out'
                            }}>
                              <div style={{ position: 'relative' }}>
                                <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input className="ws-input w-full" style={{ paddingLeft: 36, borderRadius: 12 }} placeholder="Numéro de téléphone (+33...)" value={form.locationDetail} onChange={e => setForm(f => ({ ...f, locationDetail: e.target.value }))} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: Guests */}
                {createStep === 3 && (
                  <div className="animate-fade-in">
                    <label className="ws-input-label">Ajouter des invités</label>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                       <div style={{ position: 'relative', flex: 1 }}>
                         <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                         <input 
                           className="ws-input w-full" 
                           type="email"
                           style={{ paddingLeft: 36, borderRadius: 12 }}
                           placeholder="email@exemple.com" 
                           value={form.guestEmail} 
                           onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))} 
                           onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuest())}
                         />
                       </div>
                       <button type="button" onClick={addGuest} style={{
                         padding: '0 20px', height: 42, borderRadius: 12, background: '#eff6ff', 
                         color: '#2563eb', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                         fontWeight: 700, gap: 8, transition: 'all 0.2s'
                       }}>
                         <Plus size={18} /> Ajouter
                       </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {form.guests.map((g, i) => {
                        const init = g.substring(0, 2).toUpperCase();
                        return (
                          <div key={i} style={{ position: 'relative' }}>
                             <div style={{
                               width: 40, height: 40, borderRadius: '50%', background: AVATAR_COLORS[i % AVATAR_COLORS.length] + '40',
                               display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: AVATAR_COLORS[i % AVATAR_COLORS.length]
                             }}>
                               {init}
                             </div>
                             <button type="button" onClick={() => removeGuest(i)} style={{
                               position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%',
                               background: '#ef4444', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
                             }}>
                               <X size={10} />
                             </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ 
                padding: '16px 24px', 
                borderTop: '1px solid #f1f5f9', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: '#f8fafc'
              }}>
                <button 
                  type="button" 
                  onClick={() => {
                    if (createStep > 1) setCreateStep(s => s - 1);
                    else setCreateOpen(false);
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#64748b',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  {createStep > 1 ? <><ChevronLeft size={16} /> Revenir</> : 'Annuler'}
                </button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    type="submit" 
                    style={{ 
                      padding: '10px 24px', 
                      borderRadius: '10px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {createStep === 3 ? 'Confirmer' : 'Suivant'}
                    {createStep < 3 && <ChevronRight size={16} />}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════ DETAIL / REVIEW MODAL ══════ */}
      {detailMeeting && (
        <div className="ws-modal-overlay" onClick={() => setDetailMeeting(null)} style={{ zIndex: 9000 }}>
          <div className="ws-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, borderRadius: 16, padding: '32px' }}>
            <button type="button" className="ws-icon-btn" style={{ position: 'absolute', top: 24, right: 24 }} onClick={() => setDetailMeeting(null)}><X size={20} /></button>
            
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>{detailMeeting.title}</h2>
            <div style={{ marginBottom: 24 }}>
               <span style={{ 
                 display: 'inline-block', padding: '4px 12px', borderRadius: 6, 
                 background: detailMeeting.status === 'ACTIVE' ? '#dcfce7' : detailMeeting.status === 'INACTIVE' ? '#fee2e2' : '#fef9c3', 
                 color: detailMeeting.status === 'ACTIVE' ? '#16a34a' : detailMeeting.status === 'INACTIVE' ? '#ef4444' : '#ca8a04', 
                 fontWeight: 800, fontSize: '0.8rem' 
               }}>
                 {detailMeeting.status === 'ACTIVE' ? 'Approved' : detailMeeting.status === 'INACTIVE' ? 'Rejected' : 'Pending'}
               </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', marginBottom: 2 }}>Date and time</p>
                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                  {new Date(detailMeeting.scheduledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ; {dateTimeLabelDetail(detailMeeting.scheduledAt)}
                </p>
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', marginBottom: 2 }}>{isClient ? 'Accountant' : 'Client'}</p>
                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>{isClient ? personLabel(detailMeeting.accountant) : personLabel(detailMeeting.client)}</p>
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', marginBottom: 2 }}>Location</p>
                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>{locLabel(detailMeeting)}</p>
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', marginBottom: 2 }}>Phone number</p>
                <p style={{ fontSize: '0.9rem', color: '#64748b' }}>{detailMeeting.type === 'PHONE' && detailMeeting.locationDetail ? detailMeeting.locationDetail : '—'}</p>
              </div>
            </div>

            {detailMeeting.guests && (
              <div style={{ marginBottom: 24 }}>
                 <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', marginBottom: 8 }}>Shared with</p>
                 <div style={{ display: 'flex', gap: 8 }}>
                   {(() => {
                     try {
                       const arr = JSON.parse(detailMeeting.guests);
                       return arr.map((g: string, i: number) => (
                         <div key={i} title={g} style={{
                           width: 36, height: 36, borderRadius: '50%', background: AVATAR_COLORS[i % AVATAR_COLORS.length] + '30',
                           display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: AVATAR_COLORS[i % AVATAR_COLORS.length]
                         }}>
                           {g.substring(0, 2).toUpperCase()}
                         </div>
                       ))
                     } catch(e) { return null; }
                   })()}
                 </div>
              </div>
            )}

            {detailMeeting.description && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a', marginBottom: 8 }}>Description</p>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, fontSize: '0.9rem', color: '#64748b', minHeight: 80, whiteSpace: 'pre-line' }}>
                  {detailMeeting.description}
                </div>
              </div>
            )}
            
            {detailMeeting.rejectionReason && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ef4444', marginBottom: 8 }}>Raison d'annulation</p>
                <div style={{ background: '#fef2f2', padding: 16, borderRadius: 8, fontSize: '0.9rem', color: '#ef4444', minHeight: 60, whiteSpace: 'pre-line' }}>
                  {detailMeeting.rejectionReason}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <button type="button" style={{ 
                padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', 
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 
              }} onClick={() => setRejectingMeeting(detailMeeting)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                Cancel meeting
              </button>
              
              <button type="button" style={{ 
                padding: '10px 24px', borderRadius: 8, border: 'none', background: '#2563eb', 
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }} onClick={openEdit}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
