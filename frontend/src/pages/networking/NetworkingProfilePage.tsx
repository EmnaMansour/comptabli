import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageCircle,
  Star,
  Send,
  Loader,
  Lock,
  CheckCircle,
  Briefcase,
  Globe,
} from 'lucide-react';
import NetworkingHeader from '../../components/networking/NetworkingHeader';
import ContactAccountantModal from '../../components/networking/ContactAccountantModal';
import ScheduleMeetingModal from '../../components/networking/ScheduleMeetingModal';
import AppLogo from '../../components/branding/AppLogo';
import {
  fetchAccountantPublicProfile,
  fetchAccountantPublicReviews,
  checkRelationship,
  submitReview,
  type AccountantProfileData,
  type ReviewData,
} from '../../lib/api/reviewContactService';
import { useAuthStore } from '../../store/authStore';
import '../../styles/networking.css';

const SPEC_CLASS: Record<number, string> = {
  0: 'nw-spec-blue',
  1: 'nw-spec-red',
  2: 'nw-spec-purple',
  3: 'nw-spec-orange',
  4: 'nw-spec-yellow',
  5: 'nw-spec-green',
};

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

export default function NetworkingProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  const [profile, setProfile] = useState<AccountantProfileData | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Relationship state
  const [hasRelationship, setHasRelationship] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);

  // UI state
  const [tab, setTab] = useState<'about' | 'reviews'>('about');
  const [contactOpen, setContactOpen] = useState(false);
  const [contactDefaultSubject, setContactDefaultSubject] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Review compose state
  const [composeRating, setComposeRating] = useState(0);
  const [composeText, setComposeText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const isClient = user?.role === 'CLIENT';
  const isLoggedIn = !!token && token !== 'demo-token';

  useEffect(() => {
    if (id) {
      loadProfile(id);
    }
  }, [id]);

  const loadProfile = async (accountantId: string) => {
    try {
      setLoading(true);
      setError('');

      const [profileData, reviewsData] = await Promise.all([
        fetchAccountantPublicProfile(accountantId),
        fetchAccountantPublicReviews(accountantId),
      ]);

      setProfile(profileData);
      setReviews(reviewsData);

      // Check relationship if logged in as client
      if (isLoggedIn && isClient) {
        try {
          const rel = await checkRelationship(accountantId);
          setHasRelationship(rel.hasRelationship);
          setHasExistingReview(rel.hasExistingReview);
        } catch {
          // Ignore - means not authenticated or no relationship
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Profil introuvable');
    } finally {
      setLoading(false);
    }
  };

  const openContact = (defaultSubject: string) => {
    setContactDefaultSubject(defaultSubject);
    setContactOpen(true);
  };

  const handleSubmitReview = async () => {
    if (composeRating < 1 || !composeText.trim() || !id) return;

    setSubmittingReview(true);
    setReviewError('');

    try {
      await submitReview({
        accountantId: id,
        rating: composeRating,
        comment: composeText.slice(0, 500),
      });
      setReviewSuccess(true);
      setHasExistingReview(true);
      setComposeRating(0);
      setComposeText('');
      
      // Rafraîchir les données pour afficher l'avis immédiatement
      loadProfile(id);
    } catch (err: any) {
      setReviewError(err?.message || "Erreur lors de la soumission de l'avis");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="nw-page">
        <NetworkingHeader />
        <main className="nw-main nw-main--center">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
            <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} color="#6366f1" />
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Chargement du profil...</p>
          </div>
        </main>
      </div>
    );
  }

  // Error / not found
  if (error || !profile) {
    return (
      <div className="nw-page">
        <NetworkingHeader />
        <main className="nw-main nw-main--center">
          <div className="nw-empty-state nw-empty-state--animate">
            <Link to="/" className="nw-empty-logo" aria-label="Comptabli — Accueil">
              <AppLogo variant="networking" />
            </Link>
            <p className="nw-empty-title">Profil introuvable</p>
            <p className="nw-empty-desc">{error || "Ce comptable n'existe pas ou a été retiré de l'annuaire."}</p>
            <Link to="/" className="nw-btn nw-btn-primary nw-btn--pulse-hover">
              Retour à l&apos;accueil
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const fullName = `${profile.accountant?.firstName || ''} ${profile.accountant?.lastName || ''}`.trim();
  const displayName = profile.companyName || fullName || 'Comptable';
  const initials = getInitials(profile.accountant?.firstName, profile.accountant?.lastName);
  const bg = getAvatarBg(fullName);

  // Compute review bars
  const reviewCounts = [0, 0, 0, 0, 0]; // index 0 = 5 stars, index 4 = 1 star
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      reviewCounts[5 - r.rating]++;
    }
  });
  const maxCount = Math.max(1, ...reviewCounts);

  return (
    <div className="nw-page">
      <ContactAccountantModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        accountantName={displayName}
        accountantId={profile.accountantId}
        defaultSubject={contactDefaultSubject}
      />
      <NetworkingHeader />

      <main className="nw-main nw-profile-main">
        <div className="nw-profile-top nw-profile-top--animate">
          <div className="nw-profile-top-row">
            <button
              type="button"
              className="nw-profile-back"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={18} />
              <span>Retour</span>
            </button>
          </div>
          <h2 className="nw-profile-page-title">Détails profil</h2>
          <p className="nw-profile-hero-sub">Fiche networking du comptable</p>
        </div>

        <div 
          className="nw-profile-banner nw-profile-banner--animate" 
          style={profile.coverImageUrl ? { background: `url(${profile.coverImageUrl}) center/cover no-repeat` } : {}}
        />

        <div className="nw-profile-card nw-profile-card--animate">
          <div className="nw-profile-identity">
            <div
              className="nw-profile-avatar-lg nw-profile-avatar-lg--animate"
              style={{ 
                background: profile.profileImageUrl ? `url(${profile.profileImageUrl}) center/cover no-repeat` : bg,
              }}
            >
              {!profile.profileImageUrl && initials}
            </div>
            <div>
              <div className="nw-profile-name">{displayName}</div>
              <div className="nw-profile-role">Expert comptable</div>
            </div>
          </div>
          <div className="nw-profile-actions">
            {(!user || user.role === 'CLIENT') && (
              <>
                {user?.role === 'CLIENT' && (
                  <button
                    type="button"
                    className="nw-btn-schedule"
                    onClick={() => setScheduleOpen(true)}
                  >
                    <Calendar size={18} />
                    Rendez-vous
                  </button>
                )}
                <button type="button" className="nw-btn-contact" onClick={() => openContact('')}>
                  <MessageCircle size={18} />
                  Contacter
                </button>
              </>
            )}
          </div>
        </div>

        <div className="nw-profile-layout nw-profile-layout--animate">
          <div className="nw-profile-col-main">
            <div className="nw-tabs nw-tabs--animate">
              <button
                type="button"
                className={`nw-tab${tab === 'about' ? ' nw-tab-active' : ''}`}
                onClick={() => setTab('about')}
              >
                À propos
              </button>
              <button
                type="button"
                className={`nw-tab${tab === 'reviews' ? ' nw-tab-active' : ''}`}
                onClick={() => setTab('reviews')}
              >
                Avis ({reviews.length})
              </button>
            </div>

            {tab === 'about' && (
              <div className="nw-post nw-post--animate" style={{ animationDelay: '0.12s' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: '#0f172a' }}>
                  Présentation
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.7 }}>
                  {profile.bio || `${displayName} est un cabinet comptable professionnel inscrit sur la plateforme Comptabli. Contactez-le pour en savoir plus sur ses services.`}
                </p>
                {profile.yearsExperience && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: '#64748b', fontSize: '0.85rem' }}>
                    <Briefcase size={16} />
                    <span>{profile.yearsExperience} ans d'expérience</span>
                  </div>
                )}
              </div>
            )}

            {tab === 'reviews' && (
              <>
                {/* Review Summary */}
                <div className="nw-reviews-summary nw-reviews-summary--animate">
                  <h3 className="nw-reviews-heading">Avis clients</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span className="nw-reviews-big">{profile.averageRating.toFixed(1)}</span>
                    <div className="nw-stars" style={{ fontSize: '1.25rem' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={18} fill={s <= Math.round(profile.averageRating) ? 'currentColor' : 'none'} />
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 8 }}>
                    ({profile.totalReviews} avis)
                  </p>
                  <div className="nw-reviews-bars">
                    {[5, 4, 3, 2, 1].map((stars, idx) => (
                      <div key={stars} className="nw-review-bar-row">
                        <span style={{ width: 52 }}>{stars} étoiles</span>
                        <div className="nw-review-bar-track">
                          <div
                            className="nw-review-bar-fill"
                            style={{ width: `${(reviewCounts[idx] / maxCount) * 100}%` }}
                          />
                        </div>
                        <span style={{ width: 24, textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
                          {reviewCounts[idx]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Review Compose - Only for clients with active relationship */}
                {isClient && !hasExistingReview && !reviewSuccess && (
                  <div className="nw-review-compose nw-review-item--animate">
                    {hasRelationship ? (
                      <>
                        <p className="nw-review-compose-title">Partagez votre avis</p>
                        <div className="nw-star-rating-pick" role="group" aria-label="Note sur 5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              aria-label={`Noter ${n} sur 5`}
                              onClick={() => setComposeRating(n)}
                            >
                              <Star size={26} fill={n <= composeRating ? 'currentColor' : 'none'} strokeWidth={1.6} />
                            </button>
                          ))}
                        </div>
                        <label className="nw-review-compose-label" htmlFor="nw-compose-comment">
                          Votre commentaire :
                        </label>
                        <textarea
                          id="nw-compose-comment"
                          className="nw-contact-input"
                          value={composeText}
                          onChange={(e) => setComposeText(e.target.value.slice(0, 500))}
                          placeholder="Partagez votre expérience..."
                          rows={4}
                        />
                        {reviewError && (
                          <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '8px 0 0' }}>{reviewError}</p>
                        )}
                        <div className="nw-review-compose-meta">
                          <span className="nw-review-char">
                            {composeText.length} / 500 caractères
                          </span>
                          <button
                            type="button"
                            className="nw-btn nw-modal-btn-primary"
                            onClick={handleSubmitReview}
                            disabled={composeRating < 1 || !composeText.trim() || submittingReview}
                          >
                            {submittingReview ? 'Envoi...' : 'Soumettre mon avis'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
                        <Lock size={20} color="#94a3b8" />
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                          Vous devez avoir une relation active avec ce comptable pour laisser un avis.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Success message after review */}
                {reviewSuccess && (
                  <div className="nw-review-compose nw-review-item--animate" style={{ textAlign: 'center', padding: 24 }}>
                    <CheckCircle size={40} color="#10b981" style={{ marginBottom: 12 }} />
                    <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', margin: '0 0 8px' }}>
                      Avis publié avec succès !
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                      Merci pour votre retour. Votre avis est désormais visible sur le profil du comptable.
                    </p>
                  </div>
                )}

                {/* Already reviewed message */}
                {isClient && hasExistingReview && !reviewSuccess && (
                  <div className="nw-review-compose nw-review-item--animate" style={{ textAlign: 'center', padding: 24 }}>
                    <CheckCircle size={32} color="#6366f1" style={{ marginBottom: 8 }} />
                    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                      Vous avez déjà laissé un avis pour ce comptable.
                    </p>
                  </div>
                )}

                {/* Reviews List */}
                {reviews.map((rev, i) => {
                  const reviewerName = rev.client
                    ? `${rev.client.firstName} ${rev.client.lastName}`
                    : 'Client';
                  const reviewInitials = getInitials(rev.client?.firstName, rev.client?.lastName);
                  const isYou = rev.clientId === user?.id;

                  return (
                    <div
                      key={rev.id}
                      className="nw-review-item nw-review-item--animate"
                      style={{ animationDelay: `${0.18 + i * 0.06}s` }}
                    >
                      <div className="nw-review-item-head">
                        <div className="nw-review-avatar">{reviewInitials}</div>
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '0.85rem' }}>{reviewerName}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {new Date(rev.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {isYou && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  padding: '2px 8px',
                                  background: '#dbeafe',
                                  color: '#1d4ed8',
                                  borderRadius: 4,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                }}
                              >
                                Vous
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="nw-stars" style={{ marginBottom: 8 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={14}
                            fill={s <= rev.rating ? 'currentColor' : 'none'}
                          />
                        ))}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5 }}>
                        {rev.comment || 'Aucun commentaire.'}
                      </p>
                    </div>
                  );
                })}

                {reviews.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                    <Star size={32} style={{ marginBottom: 8 }} />
                    <p style={{ fontSize: '0.9rem' }}>Aucun avis pour le moment.</p>
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="nw-profile-aside">
            <div className="nw-side-card nw-side-card--animate nw-side-card--d1">
              <div className="nw-side-title">Contact info</div>
              {profile.accountant?.phone && (
                <div className="nw-side-line">
                  <Phone size={16} />
                  <span>{profile.accountant.phone}</span>
                </div>
              )}
              {profile.accountant?.whatsapp && (
                <div className="nw-side-line">
                  <MessageCircle size={16} />
                  <span>{profile.accountant.whatsapp}</span>
                </div>
              )}
              {(profile.website || profile.accountant?.website) && (
                <div className="nw-side-line">
                  <Globe size={16} />
                  <a href={profile.website || profile.accountant?.website} target="_blank" rel="noreferrer" style={{color: 'inherit', textDecoration: 'none'}}>
                     {profile.website || profile.accountant?.website}
                  </a>
                </div>
              )}
              {(profile.accountant?.email || profile.email) && (
                <div className="nw-side-line">
                  <Mail size={16} />
                  <span>{profile.email || profile.accountant?.email}</span>
                </div>
              )}
              {profile.location && (
                <div className="nw-side-line">
                  <MapPin size={16} />
                  <span>{profile.location}</span>
                </div>
              )}
              {(profile.mapsLink || profile.location) && (
                <div style={{ marginTop: '1rem', height: '200px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <iframe 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    style={{ border: 0 }} 
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(profile.mapsLink || profile.location || 'Tunisie')}&t=&z=13&ie=UTF8&iwloc=&output=embed`} 
                    allowFullScreen
                    title="Carte de localisation networking"
                  />
                </div>
              )}
            </div>

            <div className="nw-side-card nw-side-card--animate nw-side-card--d2">
              <div className="nw-side-title">Spécialités</div>
              <div className="nw-spec-tags">
                {profile.specialties?.length > 0 ? (
                  profile.specialties.map((s, idx) => (
                    <span
                      key={`${s}-${idx}`}
                      className={`nw-spec-tag ${SPEC_CLASS[idx % 6]}`}
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucune spécialité renseignée</span>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="nw-side-card nw-side-card--animate nw-side-card--d2">
              <div className="nw-side-title">Statistiques</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Note moyenne</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {profile.averageRating.toFixed(1)} ⭐
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Total avis</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{profile.totalReviews}</span>
                </div>
                {profile.yearsExperience && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Expérience</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{profile.yearsExperience} ans</span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <ContactAccountantModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        accountantName={profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'le comptable'}
        accountantId={id || ''}
        defaultSubject={contactDefaultSubject}
      />

      <ScheduleMeetingModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        accountantName={profile?.firstName ? `${profile.firstName} ${profile.lastName}` : 'le comptable'}
        accountantId={id || ''}
      />
    </div>
  );
}
