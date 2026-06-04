import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  Search,
  FileText,
  MoreVertical,
  FilePlus,
  Calendar,
  LayoutGrid,
  List,
  Eye,
  Download,
  Trash2,
  Check,
  X,
  Building2,
  Filter,
  ListRestart,
  Send,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  fetchFolders,
  setFolderArchived,
  type Folder,
} from '../../lib/api/folderService';
import {
  fetchDocuments,
  fetchDocumentById,
  setDocumentArchived,
  deleteDocument,
  type AppDocument,
  type DocumentDetail,
} from '../../lib/api/documentService';
import EntityMenu, { type EntityAction } from '../../components/common/EntityMenu';
import { getAssetUrl } from '../../lib/api';
import '../../styles/workspace-ui.css';

function formatShortDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function fileExt(name: string) {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['xls', 'xlsx', 'xlc'].includes(ext ?? '')) {
    return <div style={{ background: '#107c41', color: '#fff', padding: '2px 4px', borderRadius: 3, fontWeight: 900, fontSize: '0.65rem' }}>X</div>;
  }
  if (['pdf'].includes(ext ?? '')) {
    return <div style={{ background: '#ef4444', color: '#fff', padding: '2px 4px', borderRadius: 3, fontWeight: 900, fontSize: '0.65rem' }}>PDF</div>;
  }
  if (['png', 'jpg', 'jpeg'].includes(ext ?? '')) {
    return <div style={{ background: '#3b82f6', color: '#fff', padding: '2px 4px', borderRadius: 3, fontWeight: 900, fontSize: '0.65rem' }}>IMG</div>;
  }
  return <div style={{ background: '#94a3b8', color: '#fff', padding: '2px 4px', borderRadius: 3, fontWeight: 900, fontSize: '0.65rem' }}>DOC</div>;
}

export default function ArchivesPage() {
  const { clientId: urlClientId } = useParams<{ clientId?: string }>();
  const { user, token } = useAuthStore();
  const targetClientId = urlClientId || undefined;
  const isViewingClient = !!urlClientId;

  const [allDocs, setAllDocs] = useState<AppDocument[]>([]);
  const [archivedFolders, setArchivedFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [docSearch, setDocSearch] = useState('');
  const [folderSearch, setFolderSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [docView, setDocView] = useState<'grid' | 'list'>('grid');
  const [, setOpenDocMenu] = useState<string | null>(null);
  const [openFolderMenu, setOpenFolderMenu] = useState<string | null>(null);
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);
  const [drawerDoc, setDrawerDoc] = useState<AppDocument | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<DocumentDetail | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'echanges' | 'preview'>('preview');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [targetDoc, setTargetDoc] = useState<AppDocument | null>(null);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [targetFolder, setTargetFolder] = useState<Folder | null>(null);
  const [exchangeInput, setExchangeInput] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    if (!token || token === 'demo-token') {
      setAllDocs([]);
      setArchivedFolders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [docs, fld] = await Promise.all([
        fetchDocuments({ archived: true, clientId: targetClientId }),
        fetchFolders({ archived: true, clientId: targetClientId })
      ]);
      setAllDocs(docs);
      setArchivedFolders(fld);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, targetClientId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenDocMenu(null);
        setOpenFolderMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const foldersFiltered = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return archivedFolders;
    return archivedFolders.filter(f => f.name.toLowerCase().includes(q));
  }, [archivedFolders, folderSearch]);

  const archivedDocs = useMemo(() => {
    let list = [...allDocs];
    const q = docSearch.trim().toLowerCase();
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q));
    if (docTypeFilter !== 'all') {
      list = list.filter((d) => {
        const ext = fileExt(d.name);
        if (docTypeFilter === 'pdf') return ext === 'PDF';
        if (docTypeFilter === 'image') return ['PNG', 'JPG', 'JPEG', 'GIF'].includes(ext);
        if (docTypeFilter === 'sheet') return ['XLS', 'XLSX', 'CSV'].includes(ext);
        return true;
      });
    }
    if (agencyFilter) {
      list = list.filter((d) => (d.folder?.name ?? 'Sans dossier') === agencyFilter);
    }
    return list;
  }, [allDocs, docSearch, docTypeFilter, agencyFilter]);

  const agencies = useMemo(() => {
    const m = new Map<string, number>();
    allDocs.forEach((d) => {
      const label = d.folder?.name ?? 'Sans dossier';
      m.set(label, (m.get(label) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allDocs]);

  useEffect(() => {
    if (!drawerDoc || !token || token === 'demo-token') {
      setDrawerDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const detail = await fetchDocumentById(drawerDoc.id);
      if (!cancelled && detail) setDrawerDetail(detail);
    })();
    return () => {
      cancelled = true;
    };
  }, [drawerDoc, token]);

  const handleDocAction = async (doc: AppDocument, action: EntityAction) => {
    setTargetDoc(doc);
    switch (action) {
      case 'view':
        setDrawerDoc(doc);
        setDrawerTab('preview');
        break;
      case 'download':
        if (doc.url) window.open(getAssetUrl(doc.url), '_blank');
        break;
      case 'unarchive':
        await unarchiveDoc(doc);
        break;
      case 'delete':
        setDeleteOpen(true);
        break;
      default:
        break;
    }
  };

  const handleFolderAction = async (folder: Folder, action: 'unarchive' | 'delete') => {
    setTargetFolder(folder);
    if (action === 'unarchive') {
      await unarchiveFolder(folder);
    } else {
      setDeleteFolderOpen(true);
    }
  };

  const unarchiveDoc = async (doc: AppDocument) => {
    if (!token || token === 'demo-token') {
      showToast('err', 'Connectez-vous pour désarchiver.');
      return;
    }
    const res = await setDocumentArchived(doc.id, false);
    if (!res.ok) {
      showToast('err', res.message);
      return;
    }
    setDrawerDoc(null);
    setOpenDocMenu(null);
    await load();
    showToast('ok', 'Votre fichier est restauré avec succès dans votre répertoire.');
  };

  const unarchiveFolder = async (folder: Folder) => {
    if (!token || token === 'demo-token') {
      showToast('err', 'Connectez-vous pour désarchiver.');
      return;
    }
    const res = await setFolderArchived(folder.id, false);
    if (!res.ok) {
      showToast('err', res.message ?? 'Erreur');
      return;
    }
    setOpenFolderMenu(null);
    await load();
    showToast('ok', 'Le dossier et ses documents ont été restaurés avec succès.');
  };

  const removeArchived = async (doc: AppDocument) => {
    if (!token || token === 'demo-token') {
      showToast('err', 'Connectez-vous pour supprimer.');
      return;
    }
    const res = await deleteDocument(doc.id);
    if (!res.ok) {
      showToast('err', res.message);
      return;
    }
    setDeleteOpen(false);
    setDrawerDoc(null);
    setTargetDoc(null);
    await load();
    showToast('ok', 'Document supprimé définitivement.');
  };

  const removeArchivedFolder = async (folder: Folder) => {
    if (!token || token === 'demo-token') {
      showToast('err', 'Connectez-vous pour supprimer.');
      return;
    }
    const ok = await deleteFolder(folder.id);
    if (!ok) {
      showToast('err', 'Suppression impossible.');
      return;
    }
    setDeleteFolderOpen(false);
    setTargetFolder(null);
    await load();
    showToast('ok', 'Dossier supprimé définitivement.');
  };

  const handlePostComment = async () => {
    if (!drawerDoc || !exchangeInput.trim()) return;
    const res = await addDocumentComment(drawerDoc.id, exchangeInput.trim());
    if (res.ok) {
      setExchangeInput('');
      const updated = await fetchDocumentById(drawerDoc.id);
      if (updated) setDrawerDetail(updated);
    }
  };

  if (user?.role && !['CLIENT', 'COMPTABLE', 'COLLABORATEUR', 'ADMIN'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const breadcrumbTail = agencyFilter ? agencyFilter : 'Banque';

  return (
    <div className="ws-page animate-fade-in" ref={menuRef}>
      {toast && (
        <div className={`ws-toast ws-toast--${toast.kind === 'ok' ? 'success' : 'error'}`}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {toast.kind === 'ok' ? <Check size={18} /> : <X size={18} />}
            {toast.text}
          </span>
          <button type="button" onClick={() => setToast(null)} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="ws-top-bar">
        <div className="ws-title-block">
          <h1 className="page-title">Archives</h1>
          <p className="page-subtitle">Consultez vos documents archivés depuis Mon espace.</p>
        </div>
      </div>

      <nav className="ws-breadcrumb" aria-label="Fil d'Ariane">
        <button type="button" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>
          Archives
        </button>
        <span className="sep">/</span>
        <span style={{ color: 'var(--text-secondary)' }}>{breadcrumbTail}</span>
      </nav>

      <section>
        <div className="ws-section-head">
          <h2 className="ws-section-title">Dossiers archivés</h2>
          <div className="ws-search">
            <Search size={16} color="var(--text-muted)" />
            <input 
              placeholder="Rechercher..." 
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
            />
          </div>
        </div>
        {foldersFiltered.length > 0 ? (
          <div className="ws-folder-scroll">
            {foldersFiltered.map((f) => (
              <div
                key={f.id}
                className="ws-folder-card"
                style={{ cursor: 'default' }}
                onClick={() => setAgencyFilter(f.name === agencyFilter ? null : f.name)}
                role="presentation"
              >
                <div className="ws-folder-card-top">
                  <div className="ws-folder-icon">
                    <Building2 size={22} />
                  </div>
                  <div className="ws-menu-wrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="ws-folder-menu-btn"
                      aria-label="Menu"
                      onClick={() =>
                        setOpenFolderMenu(openFolderMenu === f.id ? null : f.id)
                      }
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openFolderMenu === f.id && (
                      <div className="ws-dropdown">
                        <button
                          type="button"
                          onClick={() => handleFolderAction(f, 'unarchive')}
                        >
                          <ListRestart size={16} /> Désarchiver
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleFolderAction(f, 'delete')}
                        >
                          <Trash2 size={16} /> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="ws-folder-name" style={{ marginBottom: 4 }}>
                  {f.name}
                </div>
                <div className="ws-folder-meta" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                   {f._count?.documents ?? 0} documents
                </div>
                <div className="ws-folder-date">
                  {agencyFilter === f.name ? 'Filtre actif' : 'Clic pour filtrer documents'}
                </div>
              </div>
            ))}
          </div>
        ) : !loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0 0 1rem' }}>
            Aucun dossier archivé trouvé.
          </p>
        ) : null}
      </section>

      <section>
        <div className="ws-section-head">
          <h2 className="ws-section-title">Documents</h2>
          <div className="ws-doc-toolbar">
            <button
              type="button"
              className="ws-icon-btn"
              onClick={() => setDocView('grid')}
              style={docView === 'grid' ? { borderColor: '#2563eb', color: '#2563eb' } : undefined}
              aria-label="Grille"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              type="button"
              className="ws-icon-btn"
              onClick={() => setDocView('list')}
              style={docView === 'list' ? { borderColor: '#2563eb', color: '#2563eb' } : undefined}
              aria-label="Liste"
            >
              <List size={18} />
            </button>
            <button type="button" className="ws-icon-btn" aria-label="Calendrier">
              <Calendar size={18} />
            </button>
            <select className="ws-select" value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)}>
              <option value="all">Type</option>
              <option value="pdf">PDF</option>
              <option value="image">Image</option>
              <option value="sheet">Tableur</option>
            </select>
            <div className="ws-search">
              <Search size={16} color="var(--text-muted)" />
              <input
                placeholder="Rechercher..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Chargement…</p>
        ) : archivedDocs.length > 0 ? (
          <div
            className="ws-doc-grid"
            style={docView === 'list' ? { gridTemplateColumns: '1fr' } : undefined}
          >
            {archivedDocs.map((doc) => {
              const actions: EntityAction[] = ['view', 'download', 'unarchive', 'delete'];
              const isImage = ['png', 'jpg', 'jpeg'].includes(fileExt(doc.name).toLowerCase());

              return (
                <div
                  key={doc.id}
                  className="ws-doc-card"
                  style={docView === 'list' ? { display: 'flex', flexDirection: 'row', alignItems: 'center' } : undefined}
                >
                  <div
                    className="ws-doc-thumb"
                    style={{
                      position: 'relative',
                      ...(docView === 'list' ? { width: 72, minWidth: 72, height: 72, borderRadius: '12px 0 0 12px', borderBottom: 'none', borderRight: '1px solid #f1f5f9' } : {}),
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setDrawerDoc(doc);
                      setDrawerTab('preview');
                    }}
                  >
                    {isImage && doc.url ? (
                      <img src={getAssetUrl(doc.url)} alt={doc.name} />
                    ) : (
                      <FileText size={docView === 'list' ? 24 : 40} className="doc-icon-large" />
                    )}
                    
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#d1fae5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #10b981'
                      }}
                    >
                      <Check size={12} color="#059669" />
                    </span>
                  </div>
                  <div className="ws-doc-footer" style={docView === 'list' ? { flex: 1 } : undefined}>
                    <div className="ws-doc-info">
                      {getFileIcon(doc.name)}
                      <span className="ws-doc-name">{doc.name}</span>
                    </div>
                    <EntityMenu 
                      actions={actions} 
                      onAction={(act) => handleDocAction(doc, act)} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <FilePlus size={44} color="var(--gray-300)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
              Aucun document archivé pour le moment.
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Archivez un fichier depuis <strong>Mon espace</strong> pour le retrouver ici.
            </p>
          </div>
        )}
      </section>

      {drawerDoc && (
        <>
          <div className="ws-drawer-overlay" aria-hidden onClick={() => setDrawerDoc(null)} />
          <aside className="ws-drawer">
            <div className="ws-drawer-head">
              <div className="ws-drawer-head-top">
                <div>
                  <h2 className="ws-drawer-title">{drawerDoc.name}</h2>
                  <p className="ws-drawer-sub">Ajouté le {formatShortDate(drawerDoc.createdAt)}</p>
                  <button
                    type="button"
                    className="ws-drawer-link"
                    onClick={() => drawerDoc.url && window.open(getAssetUrl(drawerDoc.url), '_blank')}
                  >
                    <Eye size={16} /> Voir le doc
                  </button>
                </div>
                <button type="button" className="ws-icon-btn" onClick={() => setDrawerDoc(null)} aria-label="Fermer">
                  <X size={20} />
                </button>
              </div>
              <div className="ws-drawer-tabs">
                <button
                  type="button"
                  className={drawerTab === 'preview' ? 'active' : ''}
                  onClick={() => setDrawerTab('preview')}
                >
                  Aperçu
                </button>
                <button
                  type="button"
                  className={drawerTab === 'details' ? 'active' : ''}
                  onClick={() => setDrawerTab('details')}
                >
                  Détails
                </button>
                <button
                  type="button"
                  className={drawerTab === 'echanges' ? 'active' : ''}
                  onClick={() => setDrawerTab('echanges')}
                >
                  Échanges
                </button>
              </div>
            </div>
            <div className="ws-drawer-body" style={{ background: '#f8fafc', padding: 0 }}>
              {drawerTab === 'preview' ? (
                 <div style={{ height: 'calc(100vh - 180px)', width: '100%', overflow: 'hidden' }}>
                    {drawerDoc.url ? (
                      drawerDoc.type?.toLowerCase().includes('pdf') || fileExt(drawerDoc.name) === 'PDF' ? (
                        <iframe 
                          src={`${getAssetUrl(drawerDoc.url)}#toolbar=0`} 
                          title="Preview" 
                          style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                      ) : drawerDoc.type?.toLowerCase().startsWith('image/') || ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes(fileExt(drawerDoc.name)) ? (
                        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                           <img src={getAssetUrl(drawerDoc.url)} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        </div>
                      ) : (
                        <iframe 
                          src={getAssetUrl(drawerDoc.url)} 
                          title="Preview Fallback" 
                          style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                      )
                    ) : (
                      <p style={{ padding: '2rem' }}>Fichier non trouvé.</p>
                    )}
                 </div>
              ) : drawerTab === 'details' ? (
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Emplacement
                      </p>
                      <p style={{ fontSize: '0.88rem', color: '#3b82f6', fontWeight: 600 }}>
                        Banque &gt; {drawerDoc.folder?.name ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Catégorie
                      </p>
                      <p style={{ fontSize: '0.88rem' }}>{drawerDoc.category || 'Non classé'}</p>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Niveau de traitement
                  </p>
                  <div className="ws-pill-row" style={{ marginBottom: '1.5rem' }}>
                    <span className={`ws-pill ${drawerDoc.extractedData ? 'ws-pill--ok' : 'ws-pill--bad'}`}>
                      {drawerDoc.extractedData ? <Check size={14} /> : <X size={14} />} Extrait
                    </span>
                    <span className="ws-pill ws-pill--ok">
                      <Check size={14} /> Enregistré
                    </span>
                    <span className={`ws-pill ${drawerDoc.status === 'DONE' ? 'ws-pill--ok' : 'ws-pill--bad'}`}>
                      {drawerDoc.status === 'DONE' ? <Check size={14} /> : <X size={14} />} Synchronisé
                    </span>
                  </div>

                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Historique des versions
                  </p>
                  {drawerDetail?.versions && drawerDetail.versions.length > 0 ? (
                    [...drawerDetail.versions]
                      .sort((a, b) => b.versionNumber - a.versionNumber)
                      .map((v, i) => (
                        <div key={v.id} className="ws-version-row">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={18} color="#ef4444" /> V{v.versionNumber}
                            {i === 0 ? ' (Actuel)' : ''}
                          </span>
                          <button
                            type="button"
                            className="ws-icon-btn"
                            aria-label="Télécharger"
                            onClick={() => v.url && window.open(getAssetUrl(v.url), '_blank')}
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      ))
                  ) : (
                    <div className="ws-version-row">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={18} color="#ef4444" /> Version actuelle
                      </span>
                      <button
                        type="button"
                        className="ws-icon-btn"
                        aria-label="Télécharger"
                        onClick={() => drawerDoc.url && window.open(getAssetUrl(drawerDoc.url), '_blank')}
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  )}

                  <div style={{ marginTop: '2rem' }}>
                    <button
                      type="button"
                      className="ws-btn-primary"
                      style={{ width: '100%' }}
                      onClick={() => void unarchiveDoc(drawerDoc)}
                    >
                      Désarchiver le document
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {(drawerDetail?.comments ?? []).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Aucun commentaire.</p>
                    ) : (drawerDetail?.comments ?? []).map((c, i) => {
                      const mine = c.author.id === user?.id;
                      return (
                        <div key={c.id} className="ws-comment">
                          <div className="ws-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], width: 40, height: 40, fontSize: '0.7rem' }}>
                            {c.author.firstName[0].toUpperCase()}
                          </div>
                          <div className="ws-comment-body">
                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                              {c.author.companyName || `${c.author.firstName} ${c.author.lastName}`}
                              {mine && <span style={{ color: 'var(--primary-600)', fontSize: '0.75rem', marginLeft: 6 }}>(moi)</span>}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {new Date(c.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <p style={{ marginTop: 6, fontSize: '0.88rem' }}>{c.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {deleteOpen && targetDoc && (
        <div className="ws-modal-overlay" onClick={() => setDeleteOpen(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="ws-modal-body" style={{ paddingTop: '1.75rem' }}>
              <div className="ws-delete-modal-icon">
                <Trash2 size={24} />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Supprimer définitivement ?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 8 }}>
                Le fichier sera supprimé de la base. Cette action est irréversible.
              </p>
            </div>
            <div className="ws-modal-footer" style={{ justifyContent: 'center' }}>
              <button type="button" className="ws-btn-outline" onClick={() => setDeleteOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="ws-btn-primary"
                style={{ background: '#dc2626', boxShadow: 'none' }}
                onClick={() => void removeArchived(targetDoc)}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteFolderOpen && targetFolder && (
        <div className="ws-modal-overlay" onClick={() => setDeleteFolderOpen(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="ws-modal-body" style={{ paddingTop: '1.75rem' }}>
              <div className="ws-delete-modal-icon">
                <Trash2 size={24} />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Supprimer définitivement le dossier ?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 8 }}>
                Le dossier « {targetFolder.name} » et tous ses documents seront définitivement supprimés.
              </p>
            </div>
            <div className="ws-modal-footer" style={{ justifyContent: 'center' }}>
              <button type="button" className="ws-btn-outline" onClick={() => setDeleteFolderOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="ws-btn-primary"
                style={{ background: '#dc2626', boxShadow: 'none' }}
                onClick={() => void removeArchivedFolder(targetFolder)}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
