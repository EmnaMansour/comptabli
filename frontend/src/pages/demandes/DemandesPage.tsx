import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  PlayCircle,
  X,
  Check,
  Mail,
  FileText,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  UserPlus,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  fetchRequests,
  fetchRequestById,
  createRequest,
  updateRequest,
  updateRequestManagement,
  deleteRequest,
  updateRequestStatus,
  postRequestComment,
  uploadRequestAttachment,
  attachRequestDocumentFromLibrary,
  deleteRequestAttachment,
  type AppRequest,
  type RequestAttachment,
} from '../../lib/api/requestService';
import { fetchDocuments, type AppDocument } from '../../lib/api/documentService';
import { fetchFolders, type Folder } from '../../lib/api/folderService';
import { fetchMessagingDirectory, type MessagingUser } from '../../lib/api/messagingService';
import '../../styles/workspace-ui.css';
import '../../styles/demandes-page.css';

type TabFilter = 'all' | 'PENDING' | 'ACTIVE' | 'INACTIVE';
const ROWS_PER_PAGE = 8;

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}
function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}
function isoToLocalDateAndTime(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
function urgencyLabel(u: string) {
  if (u === 'HIGH') return { label: 'Urgent !', cls: 'danger' as const };
  if (u === 'LOW') return { label: 'Basse', cls: 'info' as const };
  return { label: 'Medium', cls: 'warning' as const };
}
function statusLabel(status: string) {
  if (status === 'PENDING') return { label: 'Pending', cls: 'warning' as const };
  if (status === 'ACTIVE') return { label: 'In progress', cls: 'info' as const };
  return { label: 'Completed', cls: 'success' as const };
}
function statusLabelFr(status: string) {
  if (status === 'PENDING') return { label: 'En attente', cls: 'warning' as const };
  if (status === 'ACTIVE') return { label: 'En cours', cls: 'info' as const };
  return { label: 'Terminé', cls: 'success' as const };
}
function personLabel(u?: { firstName: string; lastName: string; companyName?: string | null } | null) {
  if (!u) return '—';
  return u.companyName?.trim() || `${u.firstName} ${u.lastName}`;
}
function requestTitle(r: AppRequest) {
  return (r.subject && r.subject.trim()) || r.type;
}
function fileExtType(name: string): 'pdf' | 'xls' | 'img' | 'doc' {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['xls', 'xlsx', 'csv'].includes(ext ?? '')) return 'xls';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext ?? '')) return 'img';
  return 'doc';
}
function fileExtLabel(name: string) {
  return name.split('.').pop()?.toUpperCase() ?? 'DOC';
}

/** Separate client-uploaded vs comptable-uploaded attachments */
function splitAttachments(attachments: RequestAttachment[], _clientId: string) {
  const client: RequestAttachment[] = [];
  const comptable: RequestAttachment[] = [];
  for (const a of attachments) {
    if (a.uploader?.role === 'COMPTABLE' || a.uploader?.role === 'COLLABORATEUR' || a.uploader?.role === 'ADMIN') {
      comptable.push(a);
    } else {
      client.push(a);
    }
  }
  return { client, comptable };
}

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f97316', '#8b5cf6'];
const REQUEST_SUBJECTS = [
  'Déclaration CNSS', 'Facturation', 'Bilan & clôture',
  'Juridique & statuts', 'RH & paie', 'Autre',
];

export default function DemandesPage({ forceSection }: { forceSection?: 'my' | 'clients' }) {
  const { user, token } = useAuthStore();
  const role = user?.role ?? null;
  const isClient = role === 'CLIENT';
  const isStaff = role === 'COMPTABLE' || role === 'COLLABORATEUR' || role === 'ADMIN';
  const isAccountant = role === 'COMPTABLE' || role === 'ADMIN';

  const [requests, setRequests] = useState<AppRequest[]>([]);
  const [directory, setDirectory] = useState<{ accountants: MessagingUser[]; collaborators: MessagingUser[] }>({ accountants: [], collaborators: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailFull, setDetailFull] = useState<AppRequest | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'echanges'>('details');
  const [exchangeInput, setExchangeInput] = useState('');
  const [editReq, setEditReq] = useState<AppRequest | null>(null);
  const [deleteReq, setDeleteReq] = useState<AppRequest | null>(null);
  const [assignReq, setAssignReq] = useState<AppRequest | null>(null);

  // The section is either forced by prop or defaults to 'clients' for staff (though now routes will force it)
  // For clients, it's irrelevant as they only see their own.
  const [staffSection, setStaffSection] = useState<'my' | 'clients'>(forceSection || 'clients');
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get('id');

  useEffect(() => {
    if (linkedId) setDetailId(linkedId);
  }, [linkedId]);

  // Sync state with prop if it changes
  useEffect(() => {
    if (forceSection) setStaffSection(forceSection);
  }, [forceSection]);

  // Form
  const [form, setForm] = useState({
    type: '', subject: '', description: '', urgency: 'HIGH',
    dueDate: '', desiredResponseDate: '', desiredResponseTime: '', accountantId: '',
  });

  // Assign form (staff)
  const [assignForm, setAssignForm] = useState({
    type: '', description: '', dossier: '', priority: 'NORMAL', status: 'PENDING' as string,
    respondedDate: '', respondedTime: '', dueDate: '', collaboratorId: '',
  });

  const [libraryDocs, setLibraryDocs] = useState<AppDocument[]>([]);
  const [clientFolders, setClientFolders] = useState<Folder[]>([]);
  const [staffClients, setStaffClients] = useState<MessagingUser[]>([]);
  const [createDocIds, setCreateDocIds] = useState<string[]>([]);
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [spacePickerOpen, setSpacePickerOpen] = useState(false);
  const [folderFilterId, setFolderFilterId] = useState<string>('all');

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    if (token && token !== 'demo-token' && isStaff) {
      void fetchMessagingDirectory().then(dir => {
        if (dir) setStaffClients(dir.clients);
      });
    }
  }, [token, isStaff]);

  const load = useCallback(async () => {
    if (!token || token === 'demo-token') { setRequests([]); setLoading(false); return; }
    setLoading(true);
    try { setRequests(await fetchRequests()); } finally { setLoading(false); }
  }, [token]);

  const loadDir = useCallback(async () => {
    if (!token || token === 'demo-token') return;
    const dir = await fetchMessagingDirectory();
    if (dir) setDirectory({ accountants: dir.accountants ?? [], collaborators: dir.collaborators ?? [] });
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadDir(); }, [loadDir]);

  useEffect(() => {
    if (!detailId || !token || token === 'demo-token') { setDetailFull(null); return; }
    let c = false;
    void fetchRequestById(detailId).then((d) => { if (!c) setDetailFull(d); });
    return () => { c = true; };
  }, [detailId, token]);

  const refreshDetail = useCallback(async () => {
    if (!detailId || !token || token === 'demo-token') return;
    setDetailFull(await fetchRequestById(detailId));
  }, [detailId, token]);

  const filtered = useMemo(() => {
    let list = requests;

    // First filter by staff section if applicable
    if (isStaff) {
      if (staffSection === 'my') {
        list = list.filter((r) => r.creatorId === user?.id);
      } else {
        list = list.filter((r) => r.creatorId !== user?.id);
      }
    }

    if (tab !== 'all') list = list.filter((r) => r.status === tab);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) =>
      requestTitle(r).toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      (r.subject ?? '').toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      personLabel(r.client).toLowerCase().includes(q));
    return list;
  }, [requests, tab, search, isStaff, staffSection, user?.id]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageItems = useMemo(() => filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE), [filtered, page]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const counts = useMemo(() => {
    let list = requests;
    if (isStaff) {
      if (staffSection === 'my') {
        list = list.filter((r) => r.creatorId === user?.id);
      } else {
        list = list.filter((r) => r.creatorId !== user?.id);
      }
    }
    return {
      all: list.length,
      PENDING: list.filter((r) => r.status === 'PENDING').length,
      ACTIVE: list.filter((r) => r.status === 'ACTIVE').length,
      INACTIVE: list.filter((r) => r.status === 'INACTIVE').length,
    };
  }, [requests, isStaff, staffSection, user?.id]);

  /* ──── Client actions ──── */
  const openCreate = () => {
    setForm({ type: '', subject: '', description: '', urgency: 'HIGH', dueDate: '', desiredResponseDate: '', desiredResponseTime: '', accountantId: directory.accountants[0]?.id ?? '' });
    setCreateDocIds([]); setCreateFiles([]); setFolderFilterId('all'); setCreateOpen(true);
    if (token && token !== 'demo-token') void fetchDocuments().then(setLibraryDocs);
    else setLibraryDocs([]);
  };

  const openEdit = async (r: AppRequest) => {
    const dr = isoToLocalDateAndTime(r.desiredResponseAt);
    setForm({ type: r.type, subject: r.subject ?? '', description: r.description, urgency: r.urgency || 'NORMAL', dueDate: r.dueDate ? r.dueDate.slice(0, 10) : '', desiredResponseDate: dr.date, desiredResponseTime: dr.time, accountantId: r.accountantId ?? '' });
    setDetailId(null);
    if (token && token !== 'demo-token') { const full = await fetchRequestById(r.id); setEditReq(full ?? r); }
    else setEditReq(r);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || token === 'demo-token') { showToast('err', 'Connexion requise.'); return; }
    if (!form.desiredResponseDate || !form.desiredResponseTime) { showToast('err', 'Indiquez la date et l\'heure de réponse souhaitées.'); return; }
    const desiredIso = new Date(`${form.desiredResponseDate}T${form.desiredResponseTime}`).toISOString();
    const res = await createRequest({ type: form.type.trim() || 'Demande', subject: form.subject.trim() || undefined, description: form.description, urgency: form.urgency, dueDate: form.dueDate || undefined, desiredResponseAt: desiredIso, accountantId: form.accountantId || undefined });
    if (!res.ok) { showToast('err', res.message); return; }
    const reqId = res.data.id;
    for (const docId of createDocIds) { const att = await attachRequestDocumentFromLibrary(reqId, docId); if (!att.ok) showToast('err', att.message); }
    for (const f of createFiles) { const up = await uploadRequestAttachment(reqId, f); if (!up.ok) showToast('err', up.message); }
    setCreateOpen(false); await load(); setSuccessOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReq || !token || token === 'demo-token') return;
    const desiredIso = form.desiredResponseDate && form.desiredResponseTime ? new Date(`${form.desiredResponseDate}T${form.desiredResponseTime}`).toISOString() : null;
    const res = await updateRequest(editReq.id, { type: form.type, subject: form.subject || null, description: form.description, urgency: form.urgency, dueDate: form.dueDate || null, desiredResponseAt: desiredIso, accountantId: form.accountantId || null });
    if (!res.ok) { showToast('err', res.message); return; }
    setEditReq(null); await load(); showToast('ok', 'Demande mise à jour.');
  };

  const confirmDelete = async () => {
    if (!deleteReq || !token || token === 'demo-token') return;
    const res = await deleteRequest(deleteReq.id);
    if (!res.ok) { showToast('err', res.message); return; }
    setDeleteReq(null); setDetailId(null); await load(); showToast('ok', 'Demande supprimée.');
  };

  /* ──── Staff actions ──── */
  const staffSetStatus = async (r: AppRequest, status: 'PENDING' | 'ACTIVE' | 'INACTIVE') => {
    if (!token || token === 'demo-token') return;
    const res = await updateRequestStatus(r.id, status);
    if (!res.ok) { showToast('err', res.message); return; }
    await load(); if (detailId === r.id) void refreshDetail();
    showToast('ok', 'Statut mis à jour.');
  };

  const staffSetResponded = async () => {
    if (!detailFull || !token || token === 'demo-token') return;
    const res = await updateRequestManagement(detailFull.id, { respondedAt: new Date().toISOString() });
    if (!res.ok) { showToast('err', res.message); return; }
    await load(); void refreshDetail(); showToast('ok', 'Date de réponse enregistrée.');
  };

  const openAssign = async (r: AppRequest) => {
    const rd = isoToLocalDateAndTime(r.respondedAt);
    setAssignForm({
      type: r.type, description: r.description, dossier: r.type,
      priority: r.urgency || 'NORMAL', status: r.status,
      respondedDate: rd.date, respondedTime: rd.time,
      dueDate: r.dueDate ? r.dueDate.slice(0, 10) : '',
      collaboratorId: r.accountantId ?? '',
    });
    setAssignReq(r);
    
    // Fetch folders for this client (or "Mon espace" if no clientId)
    if (token && token !== 'demo-token') {
      try {
        const folders = await fetchFolders({ clientId: r.clientId || undefined });
        setClientFolders(folders);
      } catch (err) {
        console.error("Failed to fetch folders:", err);
        setClientFolders([]);
      }
    } else {
      setClientFolders([]);
    }
  };

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignReq || !token || token === 'demo-token') return;
    const respondedAt = assignForm.respondedDate && assignForm.respondedTime
      ? new Date(`${assignForm.respondedDate}T${assignForm.respondedTime}`).toISOString() : undefined;
    
    let res;
    if (assignReq.id === 'new') {
      res = await createRequest({
        clientId: assignReq.clientId,
        type: assignForm.type || 'AUTRE',
        description: assignForm.description || '',
        urgency: assignForm.priority || 'NORMAL',
        accountantId: assignForm.collaboratorId || undefined,
        status: assignForm.status || 'PENDING',
      });
    } else {
      res = await updateRequestManagement(assignReq.id, {
        accountantId: assignForm.collaboratorId || undefined,
        dueDate: assignForm.dueDate || undefined,
        respondedAt: respondedAt || undefined,
      });

      // Update status if changed
      if (res.ok && assignForm.status !== assignReq.status) {
        await updateRequestStatus(assignReq.id, assignForm.status as 'PENDING' | 'ACTIVE' | 'INACTIVE');
      }
    }

    if (!res.ok) { showToast('err', res.message); return; }
    setAssignReq(null); 
    await load();
    showToast('ok', 'Votre modification est enregistrée avec succès.');
  };

  /* ──── Exchanges ──── */
  const sendExchange = async () => {
    const text = exchangeInput.trim();
    if (!text || !detailFull || !token || token === 'demo-token') return;
    const res = await postRequestComment(detailFull.id, text);
    if (!res.ok) { showToast('err', res.message); return; }
    setExchangeInput(''); void refreshDetail();
  };

  /* ──── Attachments ──── */
  const onAttachEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !editReq || !token || token === 'demo-token') return;
    const res = await uploadRequestAttachment(editReq.id, file); e.target.value = '';
    if (!res.ok) { showToast('err', res.message); return; }
    showToast('ok', 'Pièce jointe ajoutée.'); const full = await fetchRequestById(editReq.id); if (full) setEditReq(full);
  };
  const onAttachDetail = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !detailFull || !token || token === 'demo-token') return;
    const res = await uploadRequestAttachment(detailFull.id, file); e.target.value = '';
    if (!res.ok) { showToast('err', res.message); return; }
    void refreshDetail(); showToast('ok', 'Fichier ajouté.');
  };
  const removeAttach = async (attId: string) => {
    if (!editReq || !token || token === 'demo-token') return;
    const res = await deleteRequestAttachment(editReq.id, attId);
    if (!res.ok) { showToast('err', res.message); return; }
    const full = await fetchRequestById(editReq.id); if (full) setEditReq(full);
  };
  const removeAttachDetail = async (attId: string) => {
    if (!detailFull || !token || token === 'demo-token') return;
    const res = await deleteRequestAttachment(detailFull.id, attId);
    if (!res.ok) { showToast('err', res.message); return; }
    void refreshDetail();
  };

  const canEditPending = (r: AppRequest) => isClient && r.status === 'PENDING';
  const detailPreview = useMemo(() => (detailId ? requests.find((r) => r.id === detailId) : null), [requests, detailId]);
  const detailHeader = detailFull ?? detailPreview;

  // Collaborators list for assign modal
  const assignableUsers = useMemo(() => {
    return [...directory.accountants, ...directory.collaborators];
  }, [directory.accountants, directory.collaborators]);

  /* ══════════════════════ RENDER ══════════════════════ */
  const stLabel = isClient ? statusLabelFr : statusLabel;

  const AttachmentCard = ({ a, canDelete, onDelete }: { a: RequestAttachment; canDelete: boolean; onDelete: () => void }) => {
    const ext = fileExtType(a.name);
    return (
      <div className="dem-attach-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className={`dem-attach-icon ${ext}`}>{fileExtLabel(a.name)}</div>
          <div className="dem-attach-info">
            <div className="dem-attach-name">{a.name}</div>
            <div className="dem-attach-size">{a.size ? `${(a.size / 1024).toFixed(0)}kb` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* <button 
            type="button" 
            className="dem-attach-download" 
            title="Télécharger"
            onClick={(e) => {
              e.stopPropagation();
              if (a.url) window.open(getAssetUrl(a.url), '_blank');
            }}
          >
            <Download size={16} />
          </button> */}
          {canDelete && (
            <button 
              type="button" 
              className="dem-attach-download" 
              style={{ color: '#ef4444' }} 
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }} 
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ws-page dem-page animate-fade-in" ref={wrapRef}>
      {/* Toast */}
      {toast && (
        <div className={`ws-toast ws-toast--${toast.kind === 'ok' ? 'success' : 'error'}`}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {toast.kind === 'ok' ? <Check size={18} /> : <X size={18} />}{toast.text}
          </span>
          <button type="button" className="ws-icon-btn" onClick={() => setToast(null)}><X size={16} /></button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="dem-header-row">
        <div className="ws-title-block">
          <h1 className="page-title">
            {isClient ? 'Mes demandes' : (staffSection === 'my' ? 'Mes demandes' : 'Demandes des clients')}
          </h1>
          <p className="page-subtitle">
            {isClient ? 'Suivez l\'état de vos demandes auprès de votre cabinet.' : 'Gérez les demandes de vos clients. Traitez et assignez.'}
          </p>
        </div>
        {isClient && (
          <button type="button" className="ws-btn-primary" onClick={openCreate}>
            <Plus size={18} /> Nouvelle demande
          </button>
        )}
        {role === 'ADMIN' && staffSection !== 'clients' && (
          <button 
            type="button" 
            className="ws-btn-primary" 
            style={{ background: '#f97316' }} 
            onClick={() => openAssign({ 
              id: 'new', 
              clientId: '', 
              type: '', 
              description: '', 
              urgency: 'NORMAL', 
              status: 'PENDING', 
              createdAt: new Date().toISOString() 
            } as AppRequest)}
          >
            <Plus size={18} /> Nouvelle demande
          </button>
        )}
      </div>

      {/* ── Header meta ── */}
      <div className="dem-header-meta">
        <span className="dem-header-count">
          {isStaff && staffSection === 'my' ? 'Total mes demandes' : (isStaff ? 'Total demandes clients' : 'All requests')} ({counts.all})
        </span>
      </div>

      {/* ── Filter tabs ── */}
      <div className="dem-filter-tabs">
        {([
          ['all', 'Toutes', '', counts.all],
          ['PENDING', 'En attente', 'active-warning', counts.PENDING],
          ['ACTIVE', 'En cours', 'active', counts.ACTIVE],
          ['INACTIVE', 'Clôturées', 'active-success', counts.INACTIVE],
        ] as const).map(([key, label, activeClass, count]) => (
          <button
            key={key} type="button"
            className={`dem-filter-tab ${tab === key ? (activeClass || 'active') : ''}`}
            onClick={() => setTab(key as TabFilter)}
          >
            {label}<span className="dem-tab-count">{count}</span>
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="dem-toolbar">
        <div className="ws-search">
          <Search size={16} color="var(--text-muted)" />
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* ══════ TABLE ══════ */}
      <div className="dem-table-card">
        {loading ? (
          <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</p>
        ) : (
          <>
            <div className="dem-table-scroll">
              <table className="dem-table">
                <thead>
                  <tr>
                    <th>Request title</th>
                    {isStaff && <th>Dossier</th>}
                    {isStaff && <th>Assigned to</th>}
                    <th>{isStaff ? 'Status' : 'Statut'}</th>
                    <th>{isStaff ? 'Priority' : 'Priorité'}</th>
                    <th>{isStaff ? 'Due date' : 'Échéance'}</th>
                    <th style={{ width: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr><td colSpan={isStaff ? 7 : 5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune demande.</td></tr>
                  ) : pageItems.map((r) => {
                    const st = stLabel(r.status);
                    const ur = urgencyLabel(r.urgency);
                    return (
                      <tr key={r.id} onClick={() => { setDetailId(r.id); setDetailTab('details'); }}>
                        <td className="dem-col-name">{requestTitle(r)}</td>
                        {isStaff && <td style={{ fontSize: '0.85rem' }}>{formatDate(r.createdAt)}</td>}
                        {isStaff && <td style={{ fontSize: '0.85rem' }}>{personLabel(r.accountant)}</td>}
                        <td><span className={`status-badge ${st.cls}`}>{st.label}</span></td>
                        <td><span className={`status-badge ${ur.cls}`}>{ur.label}</span></td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatDate(r.dueDate || r.desiredResponseAt)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button type="button" className="ws-icon-btn" title="Voir" onClick={(e) => { e.stopPropagation(); setDetailId(r.id); setDetailTab('details'); }}><Eye size={16} /></button>
                            {/* {isAccountant && (
                              <button type="button" className="ws-icon-btn" title="Assigner" onClick={(e) => { e.stopPropagation(); openAssign(r); }}><UserPlus size={16} /></button>
                            )} */}
                            {canEditPending(r) && (
                              <button type="button" className="ws-icon-btn" title="Modifier" onClick={(e) => { e.stopPropagation(); void openEdit(r); }}><Pencil size={16} /></button>
                            )}
                            {(canEditPending(r) || role === 'ADMIN' || role === 'COLLABORATEUR') && (
                              <button type="button" className="ws-icon-btn" title="Supprimer" onClick={(e) => { e.stopPropagation(); setDeleteReq(r); }}><Trash2 size={16} /></button>
                            )}
                            {isAccountant && r.status === 'PENDING' && (
                              <button type="button" className="ws-icon-btn" title="Prendre en charge" onClick={(e) => { e.stopPropagation(); void staffSetStatus(r, 'ACTIVE'); }}><PlayCircle size={16} /></button>
                            )}
                            {isStaff && r.status === 'ACTIVE' && (
                              <button type="button" className="ws-icon-btn" title="Clôturer" onClick={(e) => { e.stopPropagation(); void staffSetStatus(r, 'INACTIVE'); }}><CheckCircle size={16} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="dem-pagination">
                <button type="button" className="dem-page-btn nav" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={16} /></button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let n: number;
                  if (totalPages <= 5) n = i + 1;
                  else if (page <= 3) n = i + 1;
                  else if (page >= totalPages - 2) n = totalPages - 4 + i;
                  else n = page - 2 + i;
                  return (
                    <button key={n} type="button" className={`dem-page-btn ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                  );
                })}
                {totalPages > 5 && page < totalPages - 2 && <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>…</span>}
                {totalPages > 5 && page < totalPages - 2 && (
                  <button type="button" className={`dem-page-btn ${page === totalPages ? 'active' : ''}`} onClick={() => setPage(totalPages)}>{totalPages}</button>
                )}
                <button type="button" className="dem-page-btn nav" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight size={16} /></button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════ CREATE MODAL (Client) ══════ */}
      {createOpen && (
        <div className="ws-modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="ws-modal ws-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>Créer une nouvelle demande</h2>
                <p>Soumettez une nouvelle demande d'assistance ou de services.</p>
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setCreateOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={submitCreate}>
              <div className="ws-modal-body dem-create-body">
                <div className="dem-create-row2">
                  <div>
                    <label className="ws-input-label">Titre de la demande <span className="dem-req">*</span></label>
                    <input className="ws-input" required placeholder="Saisir le Titre de la demande" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
                  </div>
                  <div>
                    <label className="ws-input-label">Priorité <span className="dem-req">*</span></label>
                    <select className="ws-select dem-create-select" value={form.urgency} onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))} required>
                      <option value="HIGH">High</option><option value="NORMAL">Medium</option><option value="LOW">Low</option>
                    </select>
                  </div>
                </div>
                <label className="ws-input-label">Sujet <span className="dem-req">*</span></label>
                <select className="ws-select" style={{ width: '100%', marginTop: 6 }} required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}>
                  <option value="">Choisir votre sujet</option>
                  {REQUEST_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {directory.accountants.length > 0 && (
                  <>
                    <label className="ws-input-label">Comptable</label>
                    <select className="ws-select" style={{ width: '100%', marginTop: 6 }} value={form.accountantId} onChange={(e) => setForm((f) => ({ ...f, accountantId: e.target.value }))}>
                      <option value="">— Choisir —</option>
                      {directory.accountants.map((a) => <option key={a.id} value={a.id}>{personLabel(a)}</option>)}
                    </select>
                  </>
                )}
                <label className="ws-input-label">Description <span className="dem-req">*</span></label>
                <textarea className="ws-input" required rows={4} maxLength={2000} placeholder="Veuillez détailler votre demande…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                <p className="dem-char-count">Characters: {form.description.length}/2000</p>
                <div className="dem-create-row2">
                  <div>
                    <label className="ws-input-label">Date de réponse souhaitée <span className="dem-req">*</span></label>
                    <input className="ws-input" type="date" required min={new Date().toISOString().split('T')[0]} value={form.desiredResponseDate} onChange={(e) => setForm((f) => ({ ...f, desiredResponseDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="ws-input-label">Heure de réponse souhaitée <span className="dem-req">*</span></label>
                    <input className="ws-input" type="time" required value={form.desiredResponseTime} onChange={(e) => setForm((f) => ({ ...f, desiredResponseTime: e.target.value }))} />
                  </div>
                </div>
                <p className="ws-input-label" style={{ marginTop: '1rem', marginBottom: 8 }}>
                  Pièces jointes ({String(createDocIds.length + createFiles.length).padStart(2, '0')} Documents.)
                </p>
                <div className="dem-attach-zone">
                  <div className="dem-attach-drop">
                    <span className="dem-attach-label">Nouveau document</span>
                    <label className="ws-btn-outline dem-attach-file-btn">
                      Parcourir…
                      <input type="file" multiple style={{ display: 'none' }} onChange={(e) => { const list = e.target.files ? Array.from(e.target.files) : []; if (list.length) setCreateFiles((prev) => [...prev, ...list]); e.target.value = ''; }} />
                    </label>
                  </div>
                  <button type="button" className="ws-btn-primary dem-space-btn" onClick={() => { if (token && token !== 'demo-token') void fetchDocuments().then(setLibraryDocs); setSpacePickerOpen(true); }}>
                    Sélectionner de "mon espace"
                  </button>
                  <div className="dem-picked-list">
                    {createDocIds.map((id) => { const doc = libraryDocs.find((d) => d.id === id); return (
                      <div key={id} className="dem-picked-chip"><FileText size={14} /><span>{doc?.name ?? id}</span><button type="button" className="dem-picked-remove" onClick={() => setCreateDocIds((p) => p.filter((x) => x !== id))}>×</button></div>
                    ); })}
                    {createFiles.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="dem-picked-chip"><FileText size={14} /><span>{f.name}</span><button type="button" className="dem-picked-remove" onClick={() => setCreateFiles((p) => p.filter((_, j) => j !== i))}>×</button></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="ws-modal-footer">
                <button type="button" className="ws-btn-outline" onClick={() => setCreateOpen(false)}>Annuler</button>
                <button type="submit" className="ws-btn-primary">Soumettre</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════ SPACE PICKER ══════ */}
      {spacePickerOpen && (
        <div className="ws-modal-overlay" onClick={() => setSpacePickerOpen(false)}>
          <div className="ws-modal ws-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div><h2>Choisir la destination de votre document</h2><p>Organisez vos documents en choisissant leur destination.</p></div>
              <button type="button" className="ws-icon-btn" onClick={() => setSpacePickerOpen(false)}><X size={20} /></button>
            </div>
            <div className="ws-modal-body">
              <label className="ws-input-label">Choisir la destination du fichier</label>
              <select className="ws-select" style={{ width: '100%', marginBottom: 12 }} value={folderFilterId} onChange={(e) => setFolderFilterId(e.target.value)}>
                <option value="all">Tous les emplacements</option>
                {Array.from(new Set(libraryDocs.map((d) => d.folder?.name ?? 'Racine'))).sort().map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <div className="dem-space-doc-list">
                {libraryDocs.filter((d) => folderFilterId === 'all' || (d.folder?.name ?? 'Racine') === folderFilterId).map((d) => {
                  const checked = createDocIds.includes(d.id);
                  return (
                    <label key={d.id} className="dem-space-doc-row">
                      <input type="checkbox" checked={checked} onChange={() => setCreateDocIds((p) => checked ? p.filter((x) => x !== d.id) : [...p, d.id])} />
                      <FileText size={16} /><span>{d.name}</span><span className="dem-space-folder-hint">{d.folder?.name ?? 'Racine'}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="ws-modal-footer">
              <button type="button" className="ws-btn-outline" onClick={() => setSpacePickerOpen(false)}>Annuler</button>
              <button type="button" className="ws-btn-primary" onClick={() => setSpacePickerOpen(false)}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ SUCCESS ══════ */}
      {successOpen && (
        <div className="ws-modal-overlay" onClick={() => setSuccessOpen(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="dem-success-overlay">
              <div className="dem-success-icon"><Mail size={28} /></div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 8 }}>Demande soumise avec succès</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Votre cabinet a été notifié.</p>
              <button type="button" className="ws-btn-primary" style={{ minWidth: 140 }} onClick={() => setSuccessOpen(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ DETAIL MODAL ══════ */}
      {detailId && (
        <div className="ws-modal-overlay" onClick={() => setDetailId(null)}>
          <div className="ws-modal ws-modal--lg" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="ws-modal-header" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h2 className="dem-detail-title">{detailHeader ? requestTitle(detailHeader) : 'Demande'}</h2>
                {detailHeader && (
                  <div className="dem-detail-badges">
                    <span className={`status-badge ${stLabel(detailHeader.status).cls}`}>{stLabel(detailHeader.status).label}</span>
                    <span className={`status-badge ${urgencyLabel(detailHeader.urgency).cls}`}>{urgencyLabel(detailHeader.urgency).label}</span>
                  </div>
                )}
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setDetailId(null)}><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div className="dem-tabs">
              <button type="button" className={detailTab === 'details' ? 'active' : ''} onClick={() => setDetailTab('details')}>Détails</button>
              <button type="button" className={detailTab === 'echanges' ? 'active' : ''} onClick={() => setDetailTab('echanges')}>Échanges</button>
            </div>

            <div className="ws-modal-body" style={{ paddingTop: 0 }}>
              {!detailFull ? (
                <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chargement…</p>
              ) : detailTab === 'details' ? (() => {
                const { client: clientAtts, comptable: comptableAtts } = splitAttachments(detailFull.attachments ?? [], detailFull.clientId);
                return (
                  <>
                    {/* Client / Sujet row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 4 }}>Client</p>
                        <p style={{ color: '#475569', fontSize: '0.88rem' }}>{personLabel(detailFull.client)}</p>
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 4 }}>Sujet</p>
                        <p style={{ color: '#475569', fontSize: '0.88rem' }}>{detailFull.subject?.trim() || detailFull.type}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 4 }}>Description</p>
                      <p style={{ color: '#475569', fontSize: '0.88rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{detailFull.description}</p>
                    </div>

                    {/* Dates row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 4 }}>Date souhaitée</p>
                        <p style={{ color: '#475569', fontSize: '0.88rem' }}>{formatDateTime(detailFull.desiredResponseAt)}</p>
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 4 }}>Date Réponse comptable</p>
                        <p style={{ color: '#475569', fontSize: '0.88rem' }}>{detailFull.respondedAt ? formatDateTime(detailFull.respondedAt) : '—'}</p>
                      </div>
                    </div>

                    {/* Pièces jointes (Client) */}
                    <p className="dem-section-label">Pièces jointes</p>
                    {clientAtts.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 12 }}>Aucune pièce jointe.</p>
                    ) : clientAtts.map((a) => (
                      <AttachmentCard key={a.id} a={a} canDelete={canEditPending(detailFull)} onDelete={() => void removeAttachDetail(a.id)} />
                    ))}

                    {/* Rendus du comptable */}
                    <div className="dem-rendus-section">
                      <p className="dem-section-label">Rendus du comptable</p>
                      {comptableAtts.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Aucun rendu pour le moment.</p>
                      ) : comptableAtts.map((a) => (
                        <AttachmentCard key={a.id} a={a} canDelete={isStaff} onDelete={() => void removeAttachDetail(a.id)} />
                      ))}
                    </div>

                    {isAccountant && (
                      <label className="ws-btn-outline" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <Paperclip size={16} /> Ajouter un fichier
                        <input type="file" style={{ display: 'none' }} onChange={(e) => void onAttachDetail(e)} />
                      </label>
                    )}

                    {isStaff && detailFull.status === 'ACTIVE' && !detailFull.respondedAt && (
                      <div style={{ marginTop: '1rem' }}>
                        <button type="button" className="ws-btn-outline" onClick={() => void staffSetResponded()}><Clock size={16} /> Enregistrer la date de réponse</button>
                      </div>
                    )}

                    {/* Footer actions */}
                    <div className="dem-detail-actions">
                      {canEditPending(detailFull) && (
                        <button type="button" className="dem-btn-edit" onClick={() => void openEdit(detailFull)}><Pencil size={16} /> Modifier</button>
                      )}
                      {isAccountant && (
                        <button type="button" className="dem-btn-edit" onClick={() => openAssign(detailFull)}><UserPlus size={16} /> Assigner</button>
                      )}

                    </div>
                  </>
                );
              })() : (
                /* ── Échanges ── */
                <>
                  <div className="dem-exchange-list">
                    {(detailFull.comments ?? []).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>Aucun message pour le moment.</p>
                    ) : (detailFull.comments ?? []).map((c, i) => {
                      const mine = c.author.id === user?.id;
                      return (
                        <div key={c.id} className="dem-exchange-bubble">
                          <div className="dem-exchange-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{c.author.firstName[0]}{c.author.lastName[0]}</div>
                          <div className="dem-exchange-body">
                            <div className="dem-exchange-name">{personLabel(c.author)}{mine && <span className="me-tag"> (moi)</span>}</div>
                            <div className="dem-exchange-content">{c.content}</div>
                            <div className="dem-exchange-meta"><Clock size={12} />{formatDateTime(c.createdAt)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="dem-exchange-input-row">
                    <input placeholder="Écrivez votre commentaire…" value={exchangeInput} onChange={(e) => setExchangeInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void sendExchange()} />
                    <button type="button" className="dem-exchange-send" onClick={() => void sendExchange()}><Send size={18} /></button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ EDIT MODAL (Client) ══════ */}
      {editReq && (
        <div className="ws-modal-overlay" onClick={() => setEditReq(null)}>
          <div className="ws-modal ws-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div><h2>Modifier votre demande</h2><p>Mettez à jour tant que la demande est en attente.</p></div>
              <button type="button" className="ws-icon-btn" onClick={() => setEditReq(null)}><X size={20} /></button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="ws-modal-body dem-create-body">
                <div className="dem-create-row2">
                  <div>
                    <label className="ws-input-label">Titre de la demande <span className="dem-req">*</span></label>
                    <input className="ws-input" required value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />
                  </div>
                  <div>
                    <label className="ws-input-label">Priorité <span className="dem-req">*</span></label>
                    <select className="ws-select dem-create-select" value={form.urgency} onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}>
                      <option value="HIGH">Urgent !</option><option value="NORMAL">Moyenne</option><option value="LOW">Basse</option>
                    </select>
                  </div>
                </div>
                <label className="ws-input-label">L'urgence</label>
                <select className="ws-select" style={{ width: '100%', marginTop: 6 }} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}>
                  <option value="">—</option>{REQUEST_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="dem-create-row2">
                  <div>
                    <label className="ws-input-label">Date de réponse souhaitée</label>
                    <input className="ws-input" type="date" min={new Date().toISOString().split('T')[0]} value={form.desiredResponseDate} onChange={(e) => setForm((f) => ({ ...f, desiredResponseDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="ws-input-label">Heure de réponse souhaitée</label>
                    <input className="ws-input" type="time" value={form.desiredResponseTime} onChange={(e) => setForm((f) => ({ ...f, desiredResponseTime: e.target.value }))} />
                  </div>
                </div>
                <label className="ws-input-label">Description <span className="dem-req">*</span></label>
                <textarea className="ws-input" required rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                <p className="dem-section-label" style={{ marginTop: '1rem' }}>Pièces jointes</p>
                {(editReq.attachments ?? []).map((a) => (
                  <AttachmentCard key={a.id} a={a} canDelete onDelete={() => void removeAttach(a.id)} />
                ))}
                <label className="ws-btn-outline" style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <Paperclip size={16} /> Ajouter<input type="file" style={{ display: 'none' }} onChange={(e) => void onAttachEdit(e)} />
                </label>
              </div>
              <div className="ws-modal-footer">
                <button type="button" className="ws-btn-outline" onClick={() => setEditReq(null)}>Annuler</button>
                <button type="submit" className="ws-btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════ ASSIGN MODAL (Comptable/Collaborateur) ══════ */}
      {assignReq && (
        <div className="ws-modal-overlay" onClick={() => setAssignReq(null)}>
          <div className="ws-modal ws-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>{assignReq.id === 'new' ? 'Nouvelle demande' : `Assigner la demande #${assignReq.id.slice(-4).toUpperCase()}`}</h2>
                <p>{assignReq.id === 'new' ? 'Créez une nouvelle demande pour un client.' : 'Assigner cette demande à un collaborateur.'}</p>
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setAssignReq(null)}><X size={20} /></button>
            </div>
            <form onSubmit={submitAssign}>
              <div className="ws-modal-body">
                <label className="ws-input-label">Title</label>
                <input className="ws-input" value={assignForm.type} onChange={(e) => setAssignForm((f) => ({ ...f, type: e.target.value }))} readOnly={assignReq.id !== 'new'} />

                <label className="ws-input-label">Description</label>
                <textarea className="ws-input" rows={3} value={assignForm.description} onChange={(e) => setAssignForm((f) => ({ ...f, description: e.target.value }))} readOnly={assignReq.id !== 'new'} />

                {assignReq.id === 'new' && (
                  <>
                    <label className="ws-input-label">Client</label>
                    <select 
                      className="ws-select" 
                      style={{ width: '100%', marginBottom: '1rem' }}
                      value={assignReq.clientId} 
                      onChange={async (e) => {
                        const cid = e.target.value;
                        setAssignReq(prev => prev ? ({ ...prev, clientId: cid }) : null);
                        if (cid) {
                          const folders = await fetchFolders({ clientId: cid });
                          setClientFolders(folders);
                        } else {
                          setClientFolders([]);
                        }
                      }}
                    >
                      <option value="">— Sélectionner le client —</option>
                      {staffClients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.companyName || `${c.firstName} ${c.lastName}`}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <label className="ws-input-label">Dossier</label>
                <select 
                  className="ws-select" 
                  style={{ width: '100%', marginBottom: '1rem' }}
                  value={assignForm.dossier} 
                  onChange={(e) => setAssignForm((f) => ({ ...f, dossier: e.target.value }))}
                  disabled={role !== 'ADMIN'}
                >
                  <option value="">— Choisir un dossier —</option>
                  {clientFolders.map((fol) => (
                    <option key={fol.id} value={fol.name}>{fol.name}</option>
                  ))}
                </select>

                <div className="dem-create-row2">
                  <div>
                    <label className="ws-input-label">Priority</label>
                    <select className="ws-select dem-create-select" value={assignForm.priority} onChange={(e) => setAssignForm((f) => ({ ...f, priority: e.target.value }))} disabled={role !== 'ADMIN'}>
                      <option value="HIGH">Urgent</option><option value="NORMAL">Medium</option><option value="LOW">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="ws-input-label">State</label>
                    <select className="ws-select dem-create-select" value={assignForm.status} onChange={(e) => setAssignForm((f) => ({ ...f, status: e.target.value }))} disabled={role !== 'ADMIN'}>
                      <option value="PENDING">Pending</option><option value="ACTIVE">In progress</option><option value="INACTIVE">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="dem-create-row2">
                  <div>
                    <label className="ws-input-label">Date Réponse comptable</label>
                    <input className="ws-input" type="date" value={assignForm.respondedDate} onChange={(e) => setAssignForm((f) => ({ ...f, respondedDate: e.target.value }))} disabled={role !== 'ADMIN'} />
                  </div>
                  <div>
                    <label className="ws-input-label">Date d'échéance</label>
                    <input className="ws-input" type="date" min={new Date().toISOString().split('T')[0]} value={assignForm.dueDate} onChange={(e) => setAssignForm((f) => ({ ...f, dueDate: e.target.value }))} disabled={role !== 'ADMIN'} />
                  </div>
                </div>

                <label className="ws-input-label">Select collaborator</label>
                <select className="ws-select" style={{ width: '100%', marginTop: 6 }} value={assignForm.collaboratorId} onChange={(e) => setAssignForm((f) => ({ ...f, collaboratorId: e.target.value }))}>
                  <option value="">Mme./Mr...</option>
                  {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              </div>
              <div className="ws-modal-footer">
                <button type="button" className="ws-btn-outline" onClick={() => setAssignReq(null)}>Annuler</button>
                <button type="submit" className="ws-btn-primary">Assigner</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════ DELETE ══════ */}
      {deleteReq && (
        <div className="ws-modal-overlay" onClick={() => setDeleteReq(null)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: 420 }}>
            <div className="ws-modal-body" style={{ paddingTop: '2rem' }}>
              <div className="dem-delete-icon-wrap">
                <div className="dem-delete-icon-inner"><Trash2 size={24} /></div>
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Êtes-vous sûr de supprimer cette demande ?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 10 }}>Cette action est irréversible.</p>
            </div>
            <div className="ws-modal-footer" style={{ justifyContent: 'center' }}>
              <button type="button" className="ws-btn-outline" onClick={() => setDeleteReq(null)}>Annuler</button>
              <button type="button" className="ws-btn-primary" style={{ background: '#dc2626', boxShadow: 'none' }} onClick={() => void confirmDelete()}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
