// Networking Page - List and connect with accountants
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Briefcase, MapPin, Search, Loader } from 'lucide-react';
import NetworkingHeader from '../../components/networking/NetworkingHeader';
import ContactAccountantModal from '../../components/networking/ContactAccountantModal';
import ScheduleMeetingModal from '../../components/networking/ScheduleMeetingModal';
import { fetchNetworkingProfiles, fetchMyAccountants, type AccountantProfileData } from '../../lib/api/reviewContactService';
import { useAuthStore } from '../../store/authStore';
import '../../styles/networking.css';

const AVATAR_COLORS = ['#1e3a5f', '#0d9488', '#6366f1', '#f97316', '#8b5cf6', '#ec4899'];
function getAvatarBg(name?: string) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(firstName?: string, lastName?: string) {
  return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase() || '??';
}

export default function NetworkingPage() {
  const { user } = useAuthStore();
  const [profiles, setProfiles] = useState<AccountantProfileData[]>([]);
  const [myAccountants, setMyAccountants] = useState<AccountantProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [domaine, setDomaine] = useState('');
  const [localisation, setLocalisation] = useState('');

  const [contactTarget, setContactTarget] = useState<{
    accountantId: string;
    accountantName: string;
    defaultSubject: string;
  } | null>(null);

  const [scheduleTarget, setScheduleTarget] = useState<{
    accountantId: string;
    accountantName: string;
  } | null>(null);

  useEffect(() => {
    loadProfiles();
  }, [user]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [allProfiles, linked] = await Promise.all([
        fetchNetworkingProfiles(),
        user?.role === 'CLIENT' ? fetchMyAccountants() : Promise.resolve([])
      ]);

      setProfiles(allProfiles);
      setMyAccountants(linked);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return profiles.filter((p) => {
      const name = `${p.accountant?.firstName || ''} ${p.accountant?.lastName || ''} ${p.companyName || ''}`.toLowerCase();
      const loc = (p.location || '').toLowerCase();
      const matchSearch = t === '' || name.includes(t) || loc.includes(t);
      const matchLocation = localisation === '' || loc.includes(localisation.toLowerCase());
      const matchDomain = domaine === '' || p.specialties?.some(s => s.toLowerCase().includes(domaine.toLowerCase()));
      return matchSearch && matchLocation && matchDomain;
    });
  }, [q, domaine, localisation, profiles]);

  const isClient = user?.role === 'CLIENT';

  return (
    <div className="nw-page nw-page--home" data-page="home">
      <ContactAccountantModal
        open={contactTarget !== null}
        onClose={() => setContactTarget(null)}
        accountantName={contactTarget?.accountantName ?? ''}
        accountantId={contactTarget?.accountantId ?? ''}
        defaultSubject={contactTarget?.defaultSubject ?? ''}
      />
      <ScheduleMeetingModal
        open={scheduleTarget !== null}
        onClose={() => setScheduleTarget(null)}
        accountantName={scheduleTarget?.accountantName ?? ''}
        accountantId={scheduleTarget?.accountantId ?? ''}
      />
      <NetworkingHeader />

      <main className="nw-main">
        <div className="nw-hero">
          <span className="nw-home-pill" aria-hidden>
            Accueil
          </span>
          <h1 className="nw-title">Networking</h1>
          <p className="nw-subtitle">
            Trouvez et connectez-vous avec des comptables qualifiés en quelques clics.
          </p>
        </div>

        <div className="nw-search-panel nw-search-panel--lift">
          <div className="nw-search-row">
            <div className="nw-search-input-wrap">
              <input
                className="nw-search-input"
                placeholder="Rechercher un comptable..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Rechercher des comptables"
              />
              <button type="button" className="nw-search-submit">
                <Search size={16} style={{ marginRight: 6 }} />
                Chercher
              </button>
            </div>
          </div>
          <div className="nw-filters-row">
            <select className="nw-filter-select" value={domaine} onChange={(e) => setDomaine(e.target.value)}>
              <option value="">Domaine</option>
              <option>Fiscalité</option>
              <option>Audit</option>
              <option>Conseil</option>
              <option>Finance</option>
            </select>
            <select className="nw-filter-select" value={localisation} onChange={(e) => setLocalisation(e.target.value)}>
              <option value="">Localisation</option>
              <option>Tunis</option>
              <option>Ariana</option>
              <option>La Marsa</option>
              <option>Le Bardo</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#dc2626', marginBottom: 24, fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0' }}>
            <Loader size={32} className="nw-spinner" style={{ animation: 'spin 1s linear infinite' }} color="#6366f1" />
          </div>
        ) : (
          <>
            {isClient && myAccountants.length > 0 && (
              <section style={{ marginBottom: 48 }}>
                <h2 className="nw-section-title" style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Star size={20} fill="#2563eb" /> Mes comptables
                </h2>
                <div className="nw-grid" style={{ marginBottom: 24 }}>
                  {myAccountants.map((p) => (
                    <AccountantCard key={p.id} p={p} isClient={isClient} setContactTarget={setContactTarget} setScheduleTarget={setScheduleTarget} />
                  ))}
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '40px 0' }} />
              </section>
            )}

            <h2 className="nw-section-title">
              {`${filtered.length} comptable${filtered.length > 1 ? 's' : ''} trouvé${filtered.length > 1 ? 's' : ''}`}
            </h2>

            <div className="nw-grid nw-grid--stagger">
              {filtered.map((p) => (
                <AccountantCard key={p.id} p={p} isClient={isClient} setContactTarget={setContactTarget} setScheduleTarget={setScheduleTarget} />
              ))}

              {!loading && filtered.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Aucun comptable trouvé</p>
                  <p style={{ fontSize: '0.9rem' }}>Essayez de modifier vos critères de recherche.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function AccountantCard({ p, isClient, setContactTarget, setScheduleTarget }: { 
  p: AccountantProfileData; 
  isClient: boolean; 
  setContactTarget: any;
  setScheduleTarget: any;
}) {
  const fullName = `${p.accountant?.firstName || ''} ${p.accountant?.lastName || ''}`.trim();
  const displayName = p.companyName || fullName || 'Comptable';
  const initials = getInitials(p.accountant?.firstName, p.accountant?.lastName);
  const bg = getAvatarBg(fullName);

  return (
    <div className="nw-card">
      <Link
        to={`/networking/${p.accountantId}`}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div className="nw-card-head">
          <div className="nw-card-logo" style={{ background: bg }}>
            {initials}
          </div>
          <div>
            <div className="nw-card-name">{displayName}</div>
            <div className="nw-card-title">Expert comptable</div>
          </div>
        </div>
        <p className="nw-card-desc">
          {p.bio || 'Cabinet comptable professionnel proposant ses services sur la plateforme Comptabli.'}
        </p>
        <div className="nw-card-meta">
          {p.yearsExperience && (
            <div className="nw-card-meta-row">
              <Briefcase size={14} />
              <span>{p.yearsExperience} ans d'expérience</span>
            </div>
          )}
          {p.location && (
            <div className="nw-card-meta-row">
              <MapPin size={14} />
              <span>{p.location}</span>
            </div>
          )}
        </div>
        <div className="nw-card-tags">
          {p.specialties?.slice(0, 3).map((t) => (
            <span key={t} className="nw-tag">{t}</span>
          ))}
        </div>
        <div className="nw-card-rating">
          <div className="nw-stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={14}
                fill={s <= Math.round(p.averageRating) ? 'currentColor' : 'none'}
              />
            ))}
          </div>
          <span className="nw-rating-text">
            {p.averageRating.toFixed(1)} ({p.totalReviews} avis)
          </span>
        </div>
      </Link>
      {isClient && (
        <div className="nw-card-actions">
          <button
            type="button"
            className="nw-btn-outline"
            style={{ flex: 1 }}
            onClick={(e) => {
              e.preventDefault();
              setScheduleTarget({
                accountantId: p.accountantId,
                accountantName: displayName,
              });
            }}
          >
            Rendez-vous
          </button>
          <button
            type="button"
            className="nw-btn-outline"
            style={{ flex: 1 }}
            onClick={(e) => {
              e.preventDefault();
              setContactTarget({
                accountantId: p.accountantId,
                accountantName: displayName,
                defaultSubject: '',
              });
            }}
          >
            Contactez-moi
          </button>
        </div>
      )}
    </div>
  );
}
