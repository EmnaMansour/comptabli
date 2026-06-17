import { useState, useEffect, useRef } from 'react';
import { Upload, Download, Trash2, Eye, Search, Filter, RefreshCw } from 'lucide-react';
import { fetchDocuments, deleteDocument, uploadDocument, type AppDocument } from '../../lib/api/documentService';
import { fetchClientsStats, type ClientData } from '../../lib/api/clientService';
import { useAuthStore } from '../../store/authStore';
import { useSearchParams } from 'react-router-dom';
import { getAssetUrl } from '../../lib/api';

const getIcon = (type: string) => {
  if (type.includes('pdf')) return <div className="doc-icon pdf">PDF</div>;
  if (type.includes('spreadsheet') || type.includes('excel')) return <div className="doc-icon xlsx">XLS</div>;
  if (type.includes('image')) return <div className="doc-icon jpg">IMG</div>;
  return <div className="doc-icon doc">DOC</div>;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR');
}

export default function DocumentsPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');
  
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const highlightRef = useRef<HTMLTableRowElement>(null);

  const loadData = async () => {
    setLoading(true);
    const [docs, cls] = await Promise.all([
      fetchDocuments(),
      user?.role === 'COMPTABLE' || user?.role === 'COLLABORATEUR' ? fetchClientsStats() : Promise.resolve([])
    ]);
    setDocuments(docs);
    setClients(cls);
    if (cls.length > 0) setSelectedClientId(cls[0].id);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  useEffect(() => {
    if (highlightId && !loading && documents.length > 0) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [highlightId, loading, documents]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    
    const clientId = user?.role === 'CLIENT' ? user?.id : selectedClientId;
    if (!clientId) {
      alert('Veuillez sélectionner un client pour cet upload.');
      return;
    }

    setUploading(true);
    const res = await uploadDocument(file, clientId);
    if (res.ok) {
      loadData();
    } else {
      alert(res.message);
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce document ?')) {
      const res = await deleteDocument(id);
      if (res.ok) setDocuments(docs => docs.filter(d => d.id !== id));
      else alert(res.message);
    }
  };

  const filtered = documents.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div><h1 className="page-title">Documents</h1><p className="page-subtitle" style={{ marginBottom: 0 }}>Gérez vos documents et pièces comptables</p></div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {(user?.role === 'COMPTABLE' || user?.role === 'COLLABORATEUR') && (
            <select 
              className="form-input" 
              style={{ width: '200px' }} 
              value={selectedClientId} 
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">Sélectionner un client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.companyName || `${c.firstName} ${c.lastName}`}
                </option>
              ))}
            </select>
          )}
          <button 
            className="btn-primary" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.7rem 1.5rem' }} 
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}>
            {uploading ? <RefreshCw size={18} className="spinner" /> : <Upload size={18} />} Uploader
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} 
        />
      </div>

      <div className="upload-zone" style={{ marginBottom: '1.5rem', border: dragOver ? '2px dashed var(--primary-500)' : undefined, background: dragOver ? 'var(--primary-50)' : undefined }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
        {uploading ? (
           <RefreshCw size={48} color="var(--primary-400)" className="spinner" style={{ marginBottom: '1rem' }} />
        ) : (
           <Upload size={48} color="var(--primary-400)" style={{ marginBottom: '1rem' }} />
        )}
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Glissez vos fichiers ici</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>ou cliquez pour parcourir • PDF, XLSX, DOC, images</p>
      </div>

      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <div style={{ position: 'relative', maxWidth: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" placeholder="Rechercher un document..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}><Filter size={14} /> Filtrer</button>
          </div>
        </div>
        <div className="dashboard-card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead><tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}><th style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>Document</th><th style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>Taille</th><th style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>Date</th><th style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>Statut</th><th style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw className="spinner" size={24} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun document trouvé.</td></tr>
              ) : filtered.map(d => (
                <tr 
                  key={d.id} 
                  ref={d.id === highlightId ? highlightRef : null}
                  className={d.id === highlightId ? 'highlight-row' : ''} 
                  style={{ borderBottom: '1px solid #e5e7eb' }}
                >
                  <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', color: '#1f2937', fontWeight: 500 }}>{getIcon(d.type)}<span>{d.name}</span></td>
                  <td style={{ padding: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>{formatSize(d.size)}</td>
                  <td style={{ padding: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>{formatDate(d.createdAt)}</td>
                  <td style={{ padding: '1rem' }}><span style={{ display: 'inline-block', padding: '0.35rem 0.75rem', background: '#dbeafe', color: '#1e40af', borderRadius: '0.375rem', fontSize: '0.8rem', fontWeight: 600 }}>{d.archived ? 'Archivé' : 'Actif'}</span></td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <a href={getAssetUrl(d.url)} target="_blank" rel="noreferrer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.25rem', display: 'inline-flex', alignItems: 'center' }} title="Voir"><Eye size={18} /></a>
                      <a href={getAssetUrl(d.url)} download style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.25rem', display: 'inline-flex', alignItems: 'center' }} title="Télécharger"><Download size={18} /></a>
                      <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.25rem', display: 'inline-flex', alignItems: 'center' }} title="Supprimer"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
