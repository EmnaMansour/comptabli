import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
  Mail,
  Eye,
  EyeOff,
  Check,
  X,
  Phone,
  Globe,
  MapPin,
  MessageCircle,
  UploadCloud,
  Camera,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  changeAdminPassword,
  fetchAdminProfile,
  updateAdminProfile,
} from '../../lib/api/adminService';
import {
  fetchMyAccountantProfile,
  updateMyAccountantProfile,
} from '../../lib/api/accountantProfileService';
import { authFetch } from '../../lib/authFetch';
import { getAssetUrl, apiErrorMessage } from '../../lib/api';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const isComptable = user?.role === 'COMPTABLE';
  
  const [editing, setEditing] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const patenteInputRef = useRef<HTMLInputElement>(null);
  const rneInputRef = useRef<HTMLInputElement>(null);

  const [identity, setIdentity] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    companyName: '',
    legalType: '',
    activitySector: '',
    headquarters: '',
    rcNumber: '',
    email: user?.email || '',
    phone: '',
    whatsapp: '',
    location: '',
    mapsLink: '',
    website: '',
    patenteUrl: '',
    rneUrl: '',
    coverImageUrl: '',
    profileImageUrl: '',
  });

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
  });

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    if (isAdmin) {
      fetchAdminProfile()
        .then((profile) => {
          if (!mounted) return;
          setIdentity((prev) => ({
            ...prev,
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            email: profile.email || '',
            // Les admins n'ont pas ces autres champs
            companyName: 'Comptabli',
            phone: '',
            whatsapp: '',
            legalType: '',
            activitySector: '',
            headquarters: '',
            rcNumber: '',
            location: '',
            mapsLink: '',
            profileImageUrl: profile.profileImageUrl || '',
            coverImageUrl: profile.coverImageUrl || '',
          }));
        })
        .catch((err: Error) => setToast(err.message));
    } else if (isComptable) {
      fetchMyAccountantProfile()
        .then((profile) => {
          if (!mounted) return;
          setIdentity((prev) => ({
            ...prev,
            firstName: profile.accountant.firstName || '',
            lastName: profile.accountant.lastName || '',
            companyName: profile.companyName || profile.accountant.companyName || '',
            email: profile.email || profile.accountant.email || '',
            phone: profile.phone || profile.accountant.phone || '',
            whatsapp: profile.accountant.whatsapp || '',
            legalType: profile.accountant.legalType || '',
            activitySector: profile.accountant.activitySector || '',
            headquarters: profile.accountant.headquarters || '',
            rcNumber: profile.accountant.rcNumber || '',
            location: profile.location || profile.accountant.location || '',
            mapsLink: profile.mapsLink || profile.accountant.mapsLink || '',
            website: profile.website || profile.accountant.website || '',
            patenteUrl: profile.accountant.patenteUrl || '',
            rneUrl: profile.accountant.rneUrl || '',
            coverImageUrl: profile.coverImageUrl || '',
            profileImageUrl: profile.profileImageUrl || '',
          }));
        })
        .catch((err: Error) => setToast(err.message));
    }
    return () => {
      mounted = false;
    };
  }, [isAdmin, isComptable]);

  const initials = [identity.firstName?.[0], identity.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U';
  const displayName = [identity.firstName, identity.lastName].filter(Boolean).join(' ').trim() || identity.companyName;

  const handleSave = async () => {
    try {
      if (isAdmin) {
        await updateAdminProfile({
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
          profileImageUrl: identity.profileImageUrl,
          coverImageUrl: identity.coverImageUrl,
        });
        if (passwords.currentPassword && passwords.newPassword) {
          await changeAdminPassword(passwords);
          setPasswords({ currentPassword: '', newPassword: '' });
        }
        setToast('Votre profil ADMIN a été mis à jour avec succès');
      } else if (isComptable) {
        await updateMyAccountantProfile({
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
          phone: identity.phone,
          whatsapp: identity.whatsapp,
          companyName: identity.companyName,
          legalType: identity.legalType,
          activitySector: identity.activitySector,
          headquarters: identity.headquarters,
          rcNumber: identity.rcNumber,
          location: identity.location,
          mapsLink: identity.mapsLink,
          website: identity.website,
          patenteUrl: identity.patenteUrl,
          rneUrl: identity.rneUrl,
          coverImageUrl: identity.coverImageUrl,
          profileImageUrl: identity.profileImageUrl,
        });
        setToast('Votre profil a été mis à jour avec succès');
      } else {
        // Fallback for Clients / Collaborators
        const res = await authFetch('/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: identity.firstName,
            lastName: identity.lastName,
            companyName: identity.companyName,
            legalType: identity.legalType,
            activitySector: identity.activitySector,
            headquarters: identity.headquarters,
            rcNumber: identity.rcNumber,
            phone: identity.phone,
            whatsapp: identity.whatsapp,
            location: identity.location,
            mapsLink: identity.mapsLink,
            website: identity.website,
            patenteUrl: identity.patenteUrl,
            rneUrl: identity.rneUrl,
            coverImageUrl: identity.coverImageUrl,
            profileImageUrl: identity.profileImageUrl,
          }),
        });
        if (!res.ok) throw new Error(await apiErrorMessage(res, 'Mise à jour impossible'));
        
        // Also update the store if needed
        const updatedData = await res.json();
        useAuthStore.setState({ user: { ...useAuthStore.getState().user!, ...updatedData } });
        
        setToast('Votre profil a été mis à jour avec succès');
      }
      setEditing(false);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof identity) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!['pdf', 'png', 'jpg', 'jpeg', 'jfif'].includes(ext)) {
         setToast(`Le type de fichier .${ext} n'est pas autorisé. Seuls PDF et images.`);
         e.target.value = '';
         return;
      }
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await authFetch('/users/me/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const url = getAssetUrl(data.url);
        
        setIdentity((prev) => ({ ...prev, [field]: url }));
        setToast(`${file.name} téléchargé avec succès`);
      } catch (err) {
        setToast('Échec du téléchargement du fichier');
      }
    }
  };

  const renderFilePreview = (url: string, field: keyof typeof identity, label: string) => {
    if (!url) {
      if (!editing) return <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Non renseigné</div>;
      return (
        <div 
          onClick={() => field === 'patenteUrl' ? patenteInputRef.current?.click() : rneInputRef.current?.click()}
          style={{ border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '2rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}
        >
          <UploadCloud style={{ margin: '0 auto', color: '#94a3b8', marginBottom: '8px' }} />
          <p style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600, marginBottom: '4px' }}>Glissez-déposez vos documents</p>
          <button type="button" style={{ fontSize: '0.8rem', color: '#64748b', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 12px' }}>Sélectionner Un Fichier</button>
        </div>
      );
    }

    const fileName = url.split('/').pop() || label;
    const isImage = url.match(/\.(jpeg|jpg|gif|png)$/i) != null;

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold' }}>
              {isImage ? 'JPG' : 'DOC'}
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500 }}>{fileName}</p>
              <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none' }}>Voir le fichier</a>
            </div>
          </div>
          {editing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                title="Remplacer le fichier"
                onClick={() => field === 'patenteUrl' ? patenteInputRef.current?.click() : rneInputRef.current?.click()}
                style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <RefreshCw size={18} />
              </button>
              <button type="button" onClick={() => setIdentity({ ...identity, [field]: '' })} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ height: '100%', position: 'relative', paddingBottom: '4rem' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#10b981', color: 'white', padding: '12px 24px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}>
          <Check size={18} />
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{toast}</span>
          <button type="button" onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ fontSize: '1.5rem', marginBottom: 4 }}>{editing ? 'Modifier mon profil' : 'Mon profil'}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tout sur votre profil en un seul endroit</p>
      </div>

      <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: '1.5rem' }}>
        {/* Cover Image */}
        <div style={{ 
          height: '200px', 
          background: identity.coverImageUrl ? `url(${identity.coverImageUrl}) center/cover no-repeat` : 'linear-gradient(90deg, #fce7f3 0%, #fbcfe8 100%)',
          position: 'relative'
        }}>
          {editing && (
            <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
              <button onClick={() => coverInputRef.current?.click()} style={{ background: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <Camera size={16} /> Changer la couverture
              </button>
              <input type="file" ref={coverInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, 'coverImageUrl')} />
            </div>
          )}
        </div>

        {/* Profile Header Info */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 2rem 1.5rem 2rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '-50px' }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'white', border: '4px solid white', position: 'relative', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              {identity.profileImageUrl ? (
                <img src={identity.profileImageUrl} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', color: '#0f172a' }}>
                  {initials}
                </div>
              )}
              {editing && (
                <div 
                  onClick={() => avatarInputRef.current?.click()}
                  style={{ position: 'absolute', bottom: 0, right: 0, background: '#2563eb', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white' }}
                >
                  <Camera size={14} />
                </div>
              )}
              <input type="file" ref={avatarInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e, 'profileImageUrl')} />
            </div>
            <div style={{ paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{identity.companyName || displayName}</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{identity.email}</p>
            </div>
          </div>
          <div>
            {!editing && (
              <button onClick={() => setEditing(true)} className="ws-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '8px', fontSize: '0.9rem' }}>
                <Camera size={16} /> Modifier
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Split Layout Container */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem', alignItems: 'flex-start' }}>
        
        {/* LEFT PANEL: Mes Informations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', padding: '2rem', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>Mes Informations</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Nom de l'entreprise</label>
                <input className="form-input" disabled={!editing} value={identity.companyName} onChange={e => setIdentity({...identity, companyName: e.target.value})} style={{ background: editing ? 'white' : '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Raison sociale</label>
                <input className="form-input" disabled={!editing} value={identity.legalType} onChange={e => setIdentity({...identity, legalType: e.target.value})} placeholder="ex : SARL" style={{ background: editing ? 'white' : '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Secteur d'activité</label>
                <select className="form-input" disabled={!editing} value={identity.activitySector} onChange={e => setIdentity({...identity, activitySector: e.target.value})} style={{ background: editing ? 'white' : '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%', appearance: 'none' }}>
                  <option value="">Sélectionner</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Technologie">Technologie</option>
                  <option value="Finance">Finance</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Siège social</label>
                <input className="form-input" disabled={!editing} value={identity.headquarters} onChange={e => setIdentity({...identity, headquarters: e.target.value})} style={{ background: editing ? 'white' : '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
              </div>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Patente</label>
                {renderFilePreview(identity.patenteUrl, 'patenteUrl', 'Patente')}
                <input type="file" ref={patenteInputRef} style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg,.jfif" onChange={(e) => handleFileUpload(e, 'patenteUrl')} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>RNE</label>
                {renderFilePreview(identity.rneUrl, 'rneUrl', 'RNE')}
                <input type="file" ref={rneInputRef} style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg,.jfif" onChange={(e) => handleFileUpload(e, 'rneUrl')} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Registre de commerce</label>
                <input className="form-input" disabled={!editing} value={identity.rcNumber} onChange={e => setIdentity({...identity, rcNumber: e.target.value})} style={{ background: editing ? 'white' : '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Nom du représentant</label>
                <input className="form-input" disabled={!editing} value={identity.firstName} onChange={e => setIdentity({...identity, firstName: e.target.value})} placeholder="Prénom Nom" style={{ background: editing ? 'white' : '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Mot de passe */}
          <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', padding: '2rem', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>Mot de passe</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Login</label>
                <input className="form-input" disabled value={identity.email} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Nouveau mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPw ? 'text' : 'password'}
                    className="form-input" 
                    disabled={!editing} 
                    value={editing ? passwords.newPassword : '••••••••••••'} 
                    onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                    placeholder={editing ? "Saisir nouveau mot de passe" : ""}
                    style={{ background: editing ? 'white' : '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%', paddingRight: 40 }} 
                  />
                  {editing && (
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT PANEL: Contact info */}
        <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', padding: '2rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>Contact {editing ? '' : 'info'}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {editing ? (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Adresse email professionnelle <span style={{color: '#ef4444'}}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input" disabled value={identity.email} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%', paddingRight: '100px' }} />
                    <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>
                      <Check size={14} /> Vérifié
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Numéro de téléphone <span style={{color: '#ef4444'}}>*</span></label>
                  <input className="form-input" value={identity.phone} onChange={e => setIdentity({...identity, phone: e.target.value})} style={{ background: 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Numéro WhatsApp</label>
                  <input className="form-input" value={identity.whatsapp} onChange={e => setIdentity({...identity, whatsapp: e.target.value})} placeholder="Entrer votre numéro whatsapp" style={{ background: 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Localisation</label>
                  <input className="form-input" value={identity.location} onChange={e => setIdentity({...identity, location: e.target.value})} placeholder="rue , immeuble , region" style={{ background: 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 8 }}>Siteweb</label>
                  <input className="form-input" value={identity.website} onChange={e => setIdentity({...identity, website: e.target.value})} placeholder="https://CRK.tn" style={{ background: 'white', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', width: '100%' }} />
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '50%', color: '#64748b' }}><Mail size={18} /></div>
                  <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{identity.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '50%', color: '#64748b' }}><Phone size={18} /></div>
                  <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{identity.phone || 'Non renseigné'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '50%', color: '#64748b' }}><MessageCircle size={18} /></div>
                  <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{identity.whatsapp || 'Non renseigné'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '50%', color: '#64748b' }}><Globe size={18} /></div>
                  <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{identity.website || identity.mapsLink || 'Non renseigné'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '50%', color: '#64748b' }}><MapPin size={18} /></div>
                  <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{identity.location || 'Non renseigné'}</span>
                </div>
                {/* Real map embed */}
                {(identity.mapsLink || identity.location) && (
                  <div style={{ marginTop: '1rem', height: '200px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <iframe 
                      width="100%" 
                      height="100%" 
                      frameBorder="0" 
                      style={{ border: 0 }} 
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(identity.mapsLink || identity.location || 'Tunisie')}&t=&z=13&ie=UTF8&iwloc=&output=embed`} 
                      allowFullScreen
                      title="Carte de localisation"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* Footer Action Buttons when editing */}
      {editing && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '1rem 2rem', background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem', zIndex: 10 }}>
          <button onClick={() => setEditing(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} className="ws-btn-primary" style={{ padding: '10px 32px', borderRadius: '8px', fontSize: '0.95rem' }}>Enregistrer</button>
        </div>
      )}
    </div>
  );
}
