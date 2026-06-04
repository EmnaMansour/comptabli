import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { authFetch } from '../../lib/authFetch';
import { Save, Bell, Mail, RefreshCw, FolderTree, Plus, X, Trash2 } from 'lucide-react';
import '../../styles/settings-page.css';

interface Preferences {
  emailDailySummary: boolean;
  emailMeetingReminders: boolean;
  emailTaskUpdates: boolean;
  emailNewDocuments: boolean;
  inAppNotifications: boolean;
}

interface FolderModel {
  name: string;
  children: string[];
}

export default function SettingsPage() {
  const { token, user } = useAuthStore();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [folderTemplate, setFolderTemplate] = useState<FolderModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const [prefRes, templateRes] = await Promise.all([
          authFetch('/notifications/preferences'),
          user?.role === 'COMPTABLE' ? authFetch('/accountant-profile/me/folder-template') : Promise.resolve(null)
        ]);

        if (prefRes.ok) {
          const data = await prefRes.json();
          setPrefs(data);
        }

        if (templateRes && templateRes.ok) {
          const data = await templateRes.json();
          if (data.template) {
            setFolderTemplate(JSON.parse(data.template));
          } else {
            // Default professional model if none set
            setFolderTemplate([
              { name: '01. Ventes', children: ['Factures Clients', 'Avoirs'] },
              { name: '02. Achats', children: ['Factures Fournisseurs', 'Notes de frais'] },
              { name: '03. Banque', children: ['Relevés Bancaires', 'Justificatifs'] },
              { name: '04. Social & RH', children: ['Bulletins de paie', 'Contrats'] },
              { name: '05. Fiscal', children: ['TVA', 'IS / IR'] },
              { name: '08. Op. Diverses', children: [] },
            ]);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, user?.role]);

  const togglePref = (key: keyof Preferences) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
  };

  const handleSave = async () => {
    if (!prefs || !token) return;
    setSaving(true);
    setToast(null);
    try {
      const results = await Promise.all([
        authFetch('/notifications/preferences', {
          method: 'PATCH',
          body: JSON.stringify(prefs)
        }),
        user?.role === 'COMPTABLE' ? authFetch('/accountant-profile/me/folder-template', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: JSON.stringify(folderTemplate) })
        }) : Promise.resolve({ ok: true })
      ]);

      if (results.every(r => r.ok)) {
        setToast({ kind: 'ok', text: 'Paramètres sauvegardés avec succès.' });
      } else {
        setToast({ kind: 'err', text: 'Erreur lors de la sauvegarde.' });
      }
    } catch {
      setToast({ kind: 'err', text: 'Erreur de connexion.' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Folder Template Helpers
  const addRootFolder = () => {
    setFolderTemplate([...folderTemplate, { name: 'Nouveau dossier', children: [] }]);
  };

  const removeRootFolder = (index: number) => {
    const next = [...folderTemplate];
    next.splice(index, 1);
    setFolderTemplate(next);
  };

  const updateRootName = (index: number, name: string) => {
    const next = [...folderTemplate];
    next[index].name = name;
    setFolderTemplate(next);
  };

  const addChild = (rootIndex: number, childName: string) => {
    if (!childName.trim()) return;
    const next = [...folderTemplate];
    next[rootIndex].children.push(childName.trim());
    setFolderTemplate(next);
  };

  const removeChild = (rootIndex: number, childIndex: number) => {
    const next = [...folderTemplate];
    next[rootIndex].children.splice(childIndex, 1);
    setFolderTemplate(next);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex-center" style={{ height: '50vh' }}>
          <RefreshCw className="spinner" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">Gérez vos préférences et votre modèle de cabinet</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="spinner" size={18} /> : <Save size={18} />}
          <span>Enregistrer</span>
        </button>
      </div>

      {toast && (
        <div className={`toast toast-${toast.kind}`} style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
          {toast.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'COMPTABLE' ? '1fr 1fr' : '1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Column: Notifications */}
        {prefs && (
          <div className="settings-card" style={{ margin: 0 }}>
            <h3 className="settings-section-title">
              <Mail size={18} /> Notifications par email
            </h3>
            <div className="settings-list">
              <label className="settings-item">
                <div className="settings-item-text">
                  <strong>Résumé Quotidien</strong>
                  <span>Recevoir un e-mail global à 18h00</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.emailDailySummary}
                  onChange={() => togglePref('emailDailySummary')}
                />
              </label>
              <label className="settings-item">
                <div className="settings-item-text">
                  <strong>Rappels de réunion</strong>
                  <span>Recevoir un e-mail 24h et 1h avant</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.emailMeetingReminders}
                  onChange={() => togglePref('emailMeetingReminders')}
                />
              </label>
              <label className="settings-item">
                <div className="settings-item-text">
                  <strong>Nouveaux documents</strong>
                  <span>Alerte immédiate par e-mail</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.emailNewDocuments}
                  onChange={() => togglePref('emailNewDocuments')}
                />
              </label>
            </div>

            <h3 className="settings-section-title mt-xl">
              <Bell size={18} /> Temps réel
            </h3>
            <div className="settings-list">
              <label className="settings-item">
                <div className="settings-item-text">
                  <strong>Notifications Web</strong>
                  <span>Recevoir des alertes dans l'app</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.inAppNotifications}
                  onChange={() => togglePref('inAppNotifications')}
                />
              </label>
            </div>
          </div>
        )}

        {/* Right Column: Folder Template (COMPTABLE ONLY) */}
        {user?.role === 'COMPTABLE' && (
          <div className="settings-card" style={{ margin: 0 }}>
            <h3 className="settings-section-title">
              <FolderTree size={18} /> Mon Modèle de Dossiers
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Définissez la structure par défaut qui sera créée pour chaque nouveau client.
            </p>

            <div className="folder-template-editor">
              {folderTemplate.map((root, ridx) => (
                <div key={ridx} className="template-item">
                  <div className="template-item-head">
                    <input 
                      className="template-input"
                      value={root.name}
                      onChange={(e) => updateRootName(ridx, e.target.value)}
                    />
                    <button className="btn-icon-danger" onClick={() => removeRootFolder(ridx)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="child-tags">
                    {root.children.map((child, cidx) => (
                      <div key={cidx} className="child-tag">
                        {child}
                        <span className="child-tag-remove" onClick={() => removeChild(ridx, cidx)}>
                          <X size={12} />
                        </span>
                      </div>
                    ))}
                    <input 
                      className="add-child-input"
                      placeholder="+ Ajouter sous-dossier"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addChild(ridx, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
              
              <button className="add-root-btn" onClick={addRootFolder}>
                <Plus size={18} /> Ajouter un dossier principal
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
