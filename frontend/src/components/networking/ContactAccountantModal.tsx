import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, User, Building2, Phone, Mail, Send, ChevronRight, ChevronLeft } from 'lucide-react';
import { sendContactToAccountant, sendVisitorContactToAccountant } from '../../lib/api/reviewContactService';
import { useAuthStore } from '../../store/authStore';

export type ContactAccountantModalProps = {
  open: boolean;
  onClose: () => void;
  accountantName: string;
  accountantId: string;
  /** Préremplit le champ sujet (ex. demande de RDV depuis la grille) */
  defaultSubject?: string;
};

export default function ContactAccountantModal({
  open,
  onClose,
  accountantName,
  accountantId,
  defaultSubject = '',
}: ContactAccountantModalProps) {
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFullName(user ? `${user.firstName} ${user.lastName}` : '');
    setCompany(user?.companyName || '');
    setPhone(user?.phone || '');
    setEmail(user?.email || '');
    setSubject(defaultSubject || 'Demande de contact');
    setContent('');
    setSent(false);
    setSending(false);
    setError('');
    setStep(1);
  }, [open, defaultSubject, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleNext = () => {
    if (step === 1 && (!fullName || !email || !phone || !company)) return;
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !fullName || !email) return;

    setSending(true);
    setError('');

    try {
      const fullMessage = `[NOUVEAU CONTACT]
Nom: ${fullName}
Entreprise: ${company}
Tel: ${phone}
Email: ${email}
Sujet: ${subject}

Message:
${content}`;

      if (user) {
        await sendContactToAccountant(accountantId, fullMessage);
      } else {
        await sendVisitorContactToAccountant(accountantId, {
          name: fullName,
          email,
          phone,
          company,
          subject,
          message: content,
        });
      }
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="nw-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="nw-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', borderRadius: '24px' }}>
        <button type="button" className="nw-modal-close" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>

        {sent ? (
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 16px rgba(34, 197, 94, 0.15)' }}>
              <CheckCircle size={44} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.5px' }}>Message envoyé !</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: 36 }}>
              Votre demande a bien été transmise à <strong style={{ color: '#1e293b' }}>{accountantName}</strong>.<br /> 
              Le comptable recevra une notification et vous recontactera sous peu.
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
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Contacter le comptable</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Envoyez votre demande à {accountantName}</p>
                </div>
              </div>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800 }}>
                Étape {step} sur 2
              </div>
            </div>

            {/* Smooth Progress */}
            <div style={{ padding: '0 32px 24px' }}>
              <div style={{ width: '100%', height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(step / 2) * 100}%`, height: '100%', background: '#2563eb', transition: 'width 0.3s ease' }} />
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '0 32px 32px' }}>
              {error && (
                <div style={{ display: 'flex', gap: 12, background: '#fef2f2', border: '1px solid #fecaca', padding: 16, borderRadius: 12, color: '#991b1b', marginBottom: 24, fontSize: '0.9rem' }}>
                  <AlertCircle size={20} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}

              {step === 1 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Nom complet <span style={{ color: '#ef4444' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Votre nom"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Entreprise <span style={{ color: '#ef4444' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <Building2 size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }}
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="Nom de société"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Téléphone <span style={{ color: '#ef4444' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <Phone size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+216 ..."
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>E-mail <span style={{ color: '#ef4444' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }}
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="votre@email.com"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Sujet de votre demande <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      style={{ width: '100%', padding: '0.85rem 1rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Ex: Devis pour tenue comptable"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Votre message <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea
                      style={{ width: '100%', padding: '0.85rem 1rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      required
                      rows={5}
                      placeholder="Détaillez votre besoin ici..."
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                {step > 1 ? (
                  <button type="button" onClick={handleBack} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft size={18} style={{ marginRight: 8 }} /> Retour
                  </button>
                ) : (
                  <button type="button" onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>
                    Annuler
                  </button>
                )}

                {step < 2 ? (
                  <button 
                    type="button" 
                    onClick={handleNext} 
                    disabled={!fullName || !email || !phone || !company}
                    style={{ flex: 2, padding: '14px', borderRadius: '12px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, cursor: (!fullName || !email || !phone || !company) ? 'not-allowed' : 'pointer', opacity: (!fullName || !email || !phone || !company) ? 0.6 : 1, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    Suivant <ChevronRight size={18} style={{ marginLeft: 8 }} />
                  </button>
                ) : (
                  <button 
                    type="submit" 
                    disabled={sending || !content.trim()}
                    style={{ flex: 2, padding: '14px', borderRadius: '12px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, cursor: (sending || !content.trim()) ? 'not-allowed' : 'pointer', opacity: (sending || !content.trim()) ? 0.8 : 1, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {sending ? 'Envoi...' : (
                      <>Envoyer le message <Send size={18} style={{ marginLeft: 8 }} /></>
                    )}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
