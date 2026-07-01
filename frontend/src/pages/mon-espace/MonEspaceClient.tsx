import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FolderOpen,
  Search,
  Plus,
  FileText,
  MoreVertical,
  FilePlus,
  Calendar,
  LayoutGrid,
  List,
  Eye,
  Pencil,
  Share2,
  Trash2,
  Archive,
  Send,
  Check,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  fetchFolders,
  createFolder,
  updateFolder,
  setFolderArchived,
  deleteFolder,
  type Folder,
} from '../../lib/api/folderService';
import {
  fetchDocuments,
  fetchDocumentById,
  addDocumentComment,
  uploadDocument,
  setDocumentArchived,
  deleteDocument,
  renameDocument,
  moveDocument,
  type AppDocument,
  type DocumentDetail,
} from '../../lib/api/documentService';
import { fetchClientById } from '../../lib/api/clientService';
import { useHiddenDocumentIds } from '../../hooks/useLocalDocumentState';
import { createInvoice } from '../../lib/api/invoiceService';
import { lancerExtraction, pollerResultat } from '../../lib/api/ocrService';
import { getAssetUrl } from '../../lib/api';
import EntityMenu, { type EntityAction } from '../../components/common/EntityMenu';
import '../../styles/workspace-ui.css';

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const MOCK_ACCOUNTANTS = [
  { id: 'a1', name: 'Mr. John Doe', line: 'Tax and Financial reports', initials: 'JD', color: '#6366f1' },
  { id: 'a2', name: 'Marie Doe', line: 'Business advisory', initials: 'MD', color: '#f97316' },
  { id: 'a3', name: 'Jason Alami', line: 'Tax and Financial reports', initials: 'JA', color: '#10b981' },
];

const DOC_CATEGORIES = ['Facturation', 'Devis', 'Bilan', 'Contrat', 'Fiscalité', 'RH', 'Autre'];

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

function formatShortDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function fileExt(name: string) {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

export default function MonEspaceClient() {
  const { clientId: urlClientId } = useParams<{ clientId?: string }>();
  const { user, token } = useAuthStore();
  const { hiddenIds } = useHiddenDocumentIds();

  // If URL has clientId, use it (accountant viewing client space); otherwise use own id
  const targetClientId = urlClientId || undefined;
  const isViewingClient = !!urlClientId;
  const [clientName, setClientName] = useState<string>('');

  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Mon espace' },
  ]);

  const [folderSearch, setFolderSearch] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [docView, setDocView] = useState<'grid' | 'list'>('grid');

  const [openFolderMenu, setOpenFolderMenu] = useState<string | null>(null);
  const [, setOpenDocMenu] = useState<string | null>(null);

  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isSuccessFolderOpen, setIsSuccessFolderOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // --- OCR Extraction State ---
  const [extractState, setExtractState] = useState<'idle' | 'extracting' | 'form' | 'synced'>('idle');
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    deliveryDate: '',
    totalHT: '',
    totalTVA: '',
    totalTTC: '',
    tvaPercent: '19.00',
    currency: 'TND',
    vendorName: '',
    clientName: '',
    paymentTerms: '',
  });
  const [invoiceItems, setInvoiceItems] = useState<{ description: string; quantity: string; rate: string; amount: string }[]>([]);

  // --- Auto-calculation helpers ---
  const fmt3 = (n: number) => (isNaN(n) ? '' : n.toFixed(3));

  const recalcFromItems = (items: typeof invoiceItems, tvaPct: string) => {
    const totalHT = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
    const pct = parseFloat(tvaPct) || 0;
    const totalTVA = totalHT * pct / 100;
    const totalTTC = totalHT + totalTVA;
    return { totalHT: fmt3(totalHT), totalTVA: fmt3(totalTVA), totalTTC: fmt3(totalTTC) };
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...invoiceItems];
    (newItems[index] as any)[field] = value;
    if (field === 'quantity' || field === 'rate') {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const rate = parseFloat(newItems[index].rate) || 0;
      newItems[index].amount = fmt3(qty * rate);
    }
    setInvoiceItems(newItems);
    const totals = recalcFromItems(newItems, invoiceData.tvaPercent);
    setInvoiceData(prev => ({ ...prev, ...totals }));
  };

  const addItem = () => {
    setInvoiceItems(prev => [...prev, { description: '', quantity: '1', rate: '0', amount: '0.000' }]);
  };

  const removeItem = (index: number) => {
    const newItems = invoiceItems.filter((_, i) => i !== index);
    setInvoiceItems(newItems);
    const totals = recalcFromItems(newItems, invoiceData.tvaPercent);
    setInvoiceData(prev => ({ ...prev, ...totals }));
  };

  const handleTvaPercentChange = (value: string) => {
    const totals = recalcFromItems(invoiceItems, value);
    setInvoiceData(prev => ({ ...prev, tvaPercent: value, ...totals }));
  };

  const [drawerDoc, setDrawerDoc] = useState<AppDocument | null>(null);
  const [detailFull, setDetailFull] = useState<DocumentDetail | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'echanges' | 'preview'>('preview');
  const [exchangeInput, setExchangeInput] = useState('');

  // --- Deep-link: open a specific doc on a specific tab from URL params ---
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const docId = searchParams.get('doc');
    const tab = searchParams.get('tab') as 'details' | 'echanges' | 'preview' | null;
    if (!docId) return;
    // Fetch & open the document
    fetchDocumentById(docId).then((detail) => {
      if (!detail) return;
      setDrawerDoc(detail as AppDocument);
      setDetailFull(detail);
      if (tab === 'echanges' || tab === 'details' || tab === 'preview') {
        setDrawerTab(tab);
      } else {
        setDrawerTab('echanges');
      }
      // Clean params from URL without navigating
      setSearchParams({}, { replace: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [shareOpen, setShareOpen] = useState(false);
  const [sharePick, setSharePick] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteDocOpen, setDeleteDocOpen] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [folderRenameTarget, setFolderRenameTarget] = useState<Folder | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [menuTargetDoc, setMenuTargetDoc] = useState<AppDocument | null>(null);

  useEffect(() => {
    if (drawerDoc) {
      void fetchDocumentById(drawerDoc.id).then(setDetailFull);
      if (drawerTab === 'details' && drawerDoc.category !== 'Facturation') {
        setDrawerTab('preview');
      }
      
      if (drawerDoc.category === 'Facturation') {
        if (drawerDoc.extractedData) {
           try {
              const data = JSON.parse(drawerDoc.extractedData);
              if (drawerDoc.status === 'VALIDATED' || data.statut === 'TERMINE') {
                 setExtractState(drawerDoc.status === 'VALIDATED' ? 'synced' : 'form');
                 const getValue = (val: any) => {
                   if (val && typeof val === 'object' && 'value' in val) return val.value;
                   return val;
                 };
                 const formatAmount = (val: any) => {
                   const actual = getValue(val);
                   if (!actual) return '';
                   const num = Number(actual);
                   if (isNaN(num)) return String(actual);
                   return num.toFixed(3);
                 };
                 setInvoiceData({
                   invoiceNumber: getValue(data.numero_facture) || '',
                   invoiceDate: getValue(data.date_emission) || '',
                   deliveryDate: '',
                   totalHT: formatAmount(data.total_ht),
                   totalTVA: formatAmount(data.tva),
                   totalTTC: formatAmount(data.total_ttc),
                   tvaPercent: '19.00',
                   currency: getValue(data.devise) || 'TND',
                   vendorName: getValue(data.fournisseur) || '',
                   clientName: getValue(data.client) || '',
                   paymentTerms: '',
                 });
                 // Seed items table from extracted data
                 const extractedItems = (data.lignes || []).map((li: any) => ({
                   description: li.description || '',
                   quantity: getValue(li.quantite) || '1',
                   rate: formatAmount(li.prix_unitaire),
                   amount: formatAmount(li.montant),
                 }));
                 if (extractedItems.length > 0) {
                   setInvoiceItems(extractedItems);
                 } else {
                   const htVal = parseFloat(data.total_ht) || 0;
                   if (htVal > 0) {
                     setInvoiceItems([{ description: 'Article extrait', quantity: '1', rate: formatAmount(data.total_ht), amount: formatAmount(data.total_ht) }]);
                   } else {
                     setInvoiceItems([]);
                   }
                 }
              } else if (data.statut === 'EN_COURS') {
                 setExtractState('extracting');
              } else if (data.statut === 'ERREUR') {
                 setExtractState('idle');
                 // Ne montrer le toast d'erreur que si on vient d'ouvrir le tiroir
                 if (!detailFull) {
                    showToast('err', data.message || "Erreur lors de l'extraction automatique");
                 }
              } else {
                 setExtractState('idle');
              }
           } catch {
              setExtractState('idle');
           }
        } else {
           setExtractState('idle');
        }
      } else {
         setExtractState('idle');
      }
    } else {
      setDetailFull(null);
    }
  }, [drawerDoc, drawerTab]);

  const sendExchange = async () => {
    if (!drawerDoc || !exchangeInput.trim() || !token || token === 'demo-token') return;
    const res = await addDocumentComment(drawerDoc.id, exchangeInput.trim());
    if (res.ok) {
      setExchangeInput('');
      setDetailFull((prev) => prev ? { ...prev, comments: [...(prev.comments || []), res.data] } : null);
    }
  };
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ category: 'Facturation' });
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, doc: AppDocument) => {
    e.dataTransfer.setData('application/x-doc-id', doc.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderId !== folderId) setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const docId = e.dataTransfer.getData('application/x-doc-id');
    if (!docId || !token || token === 'demo-token') return;

    // Optimistic update: remove from current document list
    setDocuments(prev => prev.filter(d => d.id !== docId));
    
    // Optimistic update: increment folder count
    setFolders(prev => prev.map(f => {
      if (f.id === folderId) {
        return {
          ...f,
          _count: f._count ? {
            ...f._count,
            documents: (f._count.documents || 0) + 1
          } : { documents: 1, subFolders: 0 }
        };
      }
      return f;
    }));

    const res = await moveDocument(docId, folderId);
    if (res.ok) {
      showToast('ok', 'Document déplacé avec succès.');
      loadContent(); // Refresh to sync with server
    } else {
      showToast('err', res.message);
      loadContent(); // Revert if failed
    }
  };

  const loadContent = useCallback(async () => {
    if (!token || token === 'demo-token') {
      setFolders([]);
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const parentId = currentFolderId || 'root';
      const [f, d] = await Promise.all([
        fetchFolders({ parentId, archived: false, clientId: targetClientId }),
        fetchDocuments({ folderId: parentId, archived: false, clientId: targetClientId }),
      ]);
      setFolders(f);
      setDocuments(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, currentFolderId, targetClientId]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  useEffect(() => {
    if (targetClientId) {
      void fetchClientById(targetClientId).then(c => {
        if (c) setClientName(`${c.firstName} ${c.lastName}`);
      });
    }
  }, [targetClientId]);

  const insideBanque = useMemo(
    () => breadcrumbs.some((b) => b.name.toLowerCase() === 'banque'),
    [breadcrumbs],
  );

  const foldersFiltered = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, folderSearch]);

  const documentsFiltered = useMemo(() => {
    let list = documents.filter((d) => !hiddenIds.has(d.id));
    const q = docSearch.trim().toLowerCase();
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q));
    if (docTypeFilter !== 'all') {
      list = list.filter((d) => {
        const ext = fileExt(d.name);
        if (docTypeFilter === 'pdf') return ext === 'PDF';
        if (docTypeFilter === 'image') return ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(ext);
        if (docTypeFilter === 'sheet') return ['XLS', 'XLSX', 'CSV'].includes(ext);
        return true;
      });
    }
    return list;
  }, [documents, hiddenIds, docSearch, docTypeFilter]);

  const showToast = (kind: 'ok' | 'err', text: any) => {
    let safeText = text;
    if (typeof text === 'object' && text !== null) {
      safeText = Array.isArray(text) 
        ? text.map((t: any) => t.msg || JSON.stringify(t)).join(', ') 
        : (text.message || text.msg || JSON.stringify(text));
    }
    setToast({ kind, text: String(safeText || 'Erreur inconnue') });
    window.setTimeout(() => setToast(null), 4500);
  };

  const handleNavigate = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setOpenFolderMenu(null);
  };

  const handleBreadcrumbClick = (id: string | null, index: number) => {
    setCurrentFolderId(id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newFolderName || token === 'demo-token') {
      showToast('err', 'Connexion requise pour créer un dossier.');
      return;
    }
    const res = await createFolder(newFolderName, currentFolderId || undefined, targetClientId);
    if (res.ok) {
      setIsFolderModalOpen(false);
      setNewFolderName('');
      setIsSuccessFolderOpen(true);
      loadContent();
    } else {
      showToast('err', res.message ?? 'Erreur');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedFile || !user?.id || token === 'demo-token') {
      showToast('err', 'Fichier ou session manquant.');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadDocument(
        selectedFile,
        targetClientId || user.id,
        uploadFolderId || currentFolderId || undefined,
        customName,
        uploadCategory
      );
      if (res.ok) {
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setCustomName('');
        setUploadCategory('');
        showToast('ok', 'Document importé avec succès.');
        loadContent();
      } else {
        showToast('err', res.message ?? 'Erreur upload');
      }
    } catch {
      showToast('err', 'Erreur lors de l’importation.');
    } finally {
      setUploading(false);
    }
  };

  const handleExtraire = async (docId?: string) => {
    const targetId = docId || drawerDoc?.id;
    if (!targetId) return;
    setExtractState('extracting');
    const { ok, message } = await lancerExtraction(targetId);
    if (!ok) {
      showToast('err', message || 'Erreur lors du lancement OCR');
      setExtractState('idle');
      return;
    }
    const poller = pollerResultat(targetId, (result) => {
      if (result.statut === 'TERMINE') {
        setExtractState('form');
        const getValue = (val: any) => {
          if (val && typeof val === 'object' && 'value' in val) return val.value;
          return val;
        };
        const formatAmount = (val: any) => {
          const actual = getValue(val);
          if (!actual) return '';
          const num = Number(actual);
          if (isNaN(num)) return String(actual);
          return num.toFixed(3);
        };
        
        setInvoiceData({
          invoiceNumber: getValue(result.numero_facture) || '',
          invoiceDate: getValue(result.date_emission) || '',
          deliveryDate: '',
          totalHT: formatAmount(result.total_ht),
          totalTVA: formatAmount(result.tva),
          totalTTC: formatAmount(result.total_ttc),
          tvaPercent: '19.00',
          currency: getValue(result.devise) || 'TND',
          vendorName: getValue(result.fournisseur) || '',
          clientName: getValue(result.client) || '',
          paymentTerms: '',
        });
        // Seed items table from extraction
        const extractedItems = (result.lignes || []).map((li) => ({
          description: li.description || '',
          quantity: getValue(li.quantite) || '1',
          rate: formatAmount(li.prix_unitaire),
          amount: formatAmount(li.montant),
        }));
        if (extractedItems.length > 0) {
          setInvoiceItems(extractedItems);
        } else {
          const htVal = parseFloat(getValue(result.total_ht) || '0') || 0;
          if (htVal > 0) {
            setInvoiceItems([{ description: 'Article extrait', quantity: '1', rate: formatAmount(result.total_ht), amount: formatAmount(result.total_ht) }]);
          } else {
            setInvoiceItems([]);
          }
        }
        showToast('ok', `Extraction terminée — confiance ${result.confiance}`);
      } else if (result.statut === 'ERREUR') {
        setExtractState('idle');
        showToast('err', result.message || 'Erreur OCR');
      }
    });
    return () => poller.stop();
  };

  const handleSyncInvoice = async () => {
    if (!drawerDoc || !token || token === 'demo-token') {
       showToast('err', 'Action non disponible en mode hors-ligne');
       return;
    }
    const amountFloat = parseFloat(invoiceData.totalTTC.replace(',', '.'));
    const taxFloat = parseFloat(invoiceData.totalTVA.replace(',', '.'));
    const dDate = new Date(invoiceData.invoiceDate.split('/').reverse().join('-')); // approx parsing DD/MM/YYYY
    const res = await createInvoice({
       documentId: drawerDoc.id,
       vendorName: invoiceData.vendorName,
       invoiceNumber: invoiceData.invoiceNumber,
       invoiceDate: isNaN(dDate.getTime()) ? null : dDate,
       totalAmount: isNaN(amountFloat) ? null : amountFloat,
       taxAmount: isNaN(taxFloat) ? null : taxFloat,
       currency: invoiceData.currency,
       extractedData: JSON.stringify({
         statut: 'TERMINE',
         numero_facture: invoiceData.invoiceNumber,
         date_emission: invoiceData.invoiceDate,
         fournisseur: invoiceData.vendorName,
         client: invoiceData.clientName,
         total_ht: invoiceData.totalHT,
         tva: invoiceData.totalTVA,
         total_ttc: invoiceData.totalTTC,
         devise: invoiceData.currency,
         lignes: invoiceItems.map(item => ({
           description: item.description,
           quantite: item.quantity,
           prix_unitaire: item.rate,
           montant: item.amount
         }))
       })
    });
    if (res.ok) {
        setExtractState('synced');
        showToast('ok', 'Facture synchronisée avec succès !');
    } else {
        showToast('err', res.message ?? 'Erreur lors de la synchronisation.');
    }
  };

  const openShare = (doc: AppDocument) => {
    setMenuTargetDoc(doc);
    setSharePick(null);
    setShareOpen(true);
    setOpenDocMenu(null);
  };

  const confirmShare = () => {
    setShareOpen(false);
    showToast('ok', 'Votre document a été partagé avec succès.');
  };

  const openRenameDoc = (doc: AppDocument) => {
    setMenuTargetDoc(doc);
    setRenameValue(doc.name.replace(/\.[^/.]+$/, ''));
    setRenameOpen(true);
    setOpenDocMenu(null);
  };

  const confirmRenameDoc = async () => {
    if (!menuTargetDoc || !token || token === 'demo-token') {
      setRenameOpen(false);
      return;
    }
    const base = renameValue.trim();
    if (!base) {
      showToast('err', 'Indiquez un nom.');
      return;
    }
    const dot = menuTargetDoc.name.lastIndexOf('.');
    const ext = dot > 0 ? menuTargetDoc.name.slice(dot) : '';
    const newName = `${base}${ext}`;
    const res = await renameDocument(menuTargetDoc.id, newName);
    if (!res.ok) {
      showToast('err', res.message);
      return;
    }
    setRenameOpen(false);
    await loadContent();
    showToast('ok', 'Document renommé.');
  };

  const openEditDoc = (doc: AppDocument) => {
    setMenuTargetDoc(doc);
    setEditOpen(true);
    setDrawerDoc(null);
    setOpenDocMenu(null);
  };

  const openDeleteDoc = (doc: AppDocument) => {
    setMenuTargetDoc(doc);
    setDeleteDocOpen(true);
    setOpenDocMenu(null);
  };

  const handleDocAction = async (doc: AppDocument, action: EntityAction) => {
    setMenuTargetDoc(doc);
    switch (action) {
      case 'view':
        setDrawerDoc(doc);
        setDrawerTab(doc.category === 'Facturation' ? 'details' : 'preview');
        break;
      case 'share':
        openShare(doc);
        break;
      case 'download':
        if (doc.url) window.open(getAssetUrl(doc.url), '_blank');
        break;
      case 'rename':
        openRenameDoc(doc);
        break;
      case 'move':
        setIsMoveModalOpen(true);
        break;
      case 'archive':
        await archiveDoc(doc);
        break;
      case 'delete':
        openDeleteDoc(doc);
        break;
      default:
        break;
    }
  };

  const confirmMoveDoc = async (targetFolderId: string | null) => {
    if (!menuTargetDoc || !token || token === 'demo-token') {
      setIsMoveModalOpen(false);
      return;
    }
    const res = await moveDocument(menuTargetDoc.id, targetFolderId);
    if (res.ok) {
      setIsMoveModalOpen(false);
      setMenuTargetDoc(null);
      showToast('ok', 'Document déplacé avec succès.');
      loadContent();
    } else {
      showToast('err', res.message);
    }
  };

  const confirmDeleteDoc = async () => {
    if (!menuTargetDoc) return;
    if (!token || token === 'demo-token') {
      setDeleteDocOpen(false);
      setDrawerDoc(null);
      showToast('err', 'Mode démo: action non supportée.');
      return;
    }
    const res = await deleteDocument(menuTargetDoc.id);
    if (!res.ok) {
      showToast('err', res.message);
      return;
    }
    setDeleteDocOpen(false);
    setDrawerDoc(null);
    await loadContent();
    showToast('ok', 'Votre document a été supprimé avec succès.');
  };

  const archiveDoc = async (doc: AppDocument) => {
    setOpenDocMenu(null);
    setDrawerDoc(null);
    if (!token || token === 'demo-token') {
      showToast('err', 'Connectez-vous pour archiver sur le serveur.');
      return;
    }
    const res = await setDocumentArchived(doc.id, true);
    if (!res.ok) {
      showToast('err', res.message);
      return;
    }
    await loadContent();
    showToast('ok', 'Document archivé. Retrouvez-le dans Archives.');
  };

  const archiveFolderDocs = async (folder: Folder) => {
    if (!token || token === 'demo-token') {
      showToast('err', 'Connectez-vous pour archiver sur le serveur.');
      return;
    }
    const res = await setFolderArchived(folder.id, true);
    if (!res.ok) {
      showToast('err', res.message ?? 'Erreur');
      return;
    }
    await loadContent();
    showToast('ok', 'Dossier archivé. Retrouvez-le dans Archives.');
  };

  const confirmRenameFolder = async () => {
    if (!folderRenameTarget || !token || token === 'demo-token') {
      setRenameFolderOpen(false);
      return;
    }
    const name = folderRenameValue.trim();
    if (!name) {
      showToast('err', 'Indiquez un nom de dossier.');
      return;
    }
    const res = await updateFolder(folderRenameTarget.id, name);
    if (!res.ok) {
      showToast('err', res.message ?? 'Erreur');
      return;
    }
    setRenameFolderOpen(false);
    setFolderRenameTarget(null);
    await loadContent();
    showToast('ok', 'Dossier renommé.');
  };

  const confirmDeleteFolder = async () => {
    if (!deleteFolderTarget || !token || token === 'demo-token') {
      setDeleteFolderOpen(false);
      setDeleteFolderTarget(null);
      return;
    }
    const target = deleteFolderTarget;
    const ok = await deleteFolder(target.id);
    if (!ok) {
      showToast('err', 'Suppression impossible (dossier non vide ou erreur serveur).');
      return;
    }
    setDeleteFolderOpen(false);
    setDeleteFolderTarget(null);
    if (currentFolderId === target.id) {
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: null, name: 'Mon espace' }]);
    }
    await loadContent();
    showToast('ok', 'Dossier supprimé.');
  };
  if (user?.role && !['CLIENT', 'COMPTABLE', 'COLLABORATEUR', 'ADMIN'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const pageTitle = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1].name : (isViewingClient ? `Espace de ${clientName || '...'}` : 'Mon espace');
  const subtitle =
    breadcrumbs.length > 1
      ? 'Gérez vos documents en toute simplicité.'
      : (isViewingClient ? `Gérez les documents de ${clientName || 'votre client'}.` : 'Gérer vos documents en toute simplicité.');

  return (
    <div className="ws-page animate-fade-in">
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
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="ws-actions">
          <button type="button" className="ws-btn-outline" onClick={() => setIsFolderModalOpen(true)}>
            <FolderOpen size={18} />
            Nouveau dossier
          </button>
          <button type="button" className="ws-btn-primary" onClick={() => setIsUploadModalOpen(true)}>
            <Plus size={18} /> Nouveau document
          </button>
        </div>
      </div>

      <nav className="ws-breadcrumb" aria-label="Fil d'Ariane">
        {breadcrumbs.map((b, i) => (
          <span key={`${b.id ?? 'root'}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span className="sep">/</span>}
            <button type="button" onClick={() => handleBreadcrumbClick(b.id, i)}>
              {b.name}
            </button>
          </span>
        ))}
      </nav>

      <section>
        <div className="ws-section-head">
          <h2 className="ws-section-title">{insideBanque ? 'Agences' : 'Dossiers'}</h2>
          <div className="ws-search">
            <Search size={16} color="var(--text-muted)" />
            <input
              placeholder="Rechercher..."
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '1.5rem' }}>Chargement…</p>
        ) : foldersFiltered.length > 0 ? (
          <div className="ws-folder-scroll">
            {foldersFiltered.map((folder) => (
              <div
                key={folder.id}
                className={`ws-folder-card${dragOverFolderId === folder.id ? ' ws-folder-card--drag-over' : ''}`}
                onClick={() => handleNavigate(folder)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleNavigate(folder)}
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => { e.stopPropagation(); void handleFolderDrop(e, folder.id); }}
              >
                <div className="ws-folder-card-top">
                  <div className="ws-folder-icon">
                    <FolderOpen size={22} />
                  </div>
                  <div className="ws-menu-wrap">
                    <button
                      type="button"
                      className="ws-folder-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFolderMenu(openFolderMenu === folder.id ? null : folder.id);
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openFolderMenu === folder.id && (
                      <div className="ws-dropdown">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFolderMenu(null);
                            setFolderRenameTarget(folder);
                            setFolderRenameValue(folder.name);
                            setRenameFolderOpen(true);
                          }}
                        >
                          <Pencil size={16} /> Renommer
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFolderMenu(null);
                            showToast('ok', 'Dossier partagé (démo).');
                          }}
                        >
                          <Share2 size={16} /> Partager
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFolderMenu(null);
                            void archiveFolderDocs(folder);
                          }}
                        >
                          <Archive size={16} /> Archiver
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFolderMenu(null);
                            setDeleteFolderTarget(folder);
                            setDeleteFolderOpen(true);
                          }}
                        >
                          <Trash2 size={16} /> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="ws-folder-name">{folder.name}</div>
                <div className="ws-folder-meta">{folder._count?.documents ?? 0} docs</div>
                <div className="ws-folder-date">Modifié : {formatShortDate(folder.updatedAt)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              border: '2px dashed var(--border-color)',
              borderRadius: 14,
              color: 'var(--text-secondary)',
              marginBottom: '2rem',
            }}
          >
            Aucun dossier ici. Créez un dossier pour organiser vos documents.
          </div>
        )}
      </section>

      <section>
        <div className="ws-section-head">
          <h2 className="ws-section-title">{breadcrumbs.length > 1 ? 'Documents' : 'Documents ajoutés récemment'}</h2>
          <div className="ws-doc-toolbar">
            <button
              type="button"
              className="ws-icon-btn"
              aria-label="Vue grille"
              onClick={() => setDocView('grid')}
              style={docView === 'grid' ? { borderColor: '#2563eb', color: '#2563eb' } : undefined}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              type="button"
              className="ws-icon-btn"
              aria-label="Vue liste"
              onClick={() => setDocView('list')}
              style={docView === 'list' ? { borderColor: '#2563eb', color: '#2563eb' } : undefined}
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

        {documentsFiltered.length > 0 ? (
          <div
            className="ws-doc-grid"
            style={docView === 'list' ? { gridTemplateColumns: '1fr' } : undefined}
          >
            {documentsFiltered.map((doc) => {
              const actions: EntityAction[] = ['view', 'download', 'rename', 'move', 'archive', 'delete'];
              const isImage = ['png', 'jpg', 'jpeg'].includes(fileExt(doc.name).toLowerCase());
              
              return (
                <div
                  key={doc.id}
                  className="ws-doc-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, doc)}
                  style={{
                    cursor: 'grab',
                    ...(docView === 'list' ? { display: 'flex', flexDirection: 'row', alignItems: 'center' } : {}),
                  }}
                >
                  <div
                    className="ws-doc-thumb"
                    style={docView === 'list' ? { width: 72, minWidth: 72, height: 72, borderRadius: '12px 0 0 12px', borderBottom: 'none', borderRight: '1px solid #f1f5f9' } : undefined}
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
            <p style={{ color: 'var(--text-secondary)' }}>Aucun document à afficher.</p>
          </div>
        )}
      </section>

      {/* Drawer détail */}
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
                {drawerDoc.category === 'Facturation' && (
                  <button
                    type="button"
                    className={drawerTab === 'details' ? 'active' : ''}
                    onClick={() => setDrawerTab('details')}
                  >
                    Détails
                  </button>
                )}
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
                        /* Try to show in iframe anyway as a last resort, many browsers handle more formats */
                        <iframe 
                          src={getAssetUrl(drawerDoc.url)} 
                          title="Preview Fallback" 
                          style={{ width: '100%', height: '100%', border: 'none' }}
                          onError={(e) => {
                             // If iframe fails, show the fallback message
                             (e.target as any).style.display = 'none';
                          }}
                        />
                      )
                    ) : (
                      <p style={{ padding: '2rem' }}>Fichier non trouvé.</p>
                    )}
                 </div>
              ) : drawerTab === 'details' ? (
                <div style={{ padding: '1.5rem', height: 'calc(100vh - 180px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {extractState === 'idle' ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                         <div>
                            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                              Emplacement
                            </p>
                            <p style={{ fontSize: '0.88rem', color: '#3b82f6', fontWeight: 600 }}>
                              Banque &gt; {drawerDoc.folder?.name ?? 'QNB'} &gt; Factures
                            </p>
                         </div>
                         <div>
                            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                              Catégorie
                            </p>
                            <p style={{ fontSize: '0.88rem' }}>{drawerDoc.category || 'Facturation'}</p>
                          </div>
                      </div>

                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Niveau de traitement :
                      </p>
                      <div className="ws-pill-row" style={{ marginBottom: '1.5rem' }}>
                        {(drawerDoc.category !== 'Facturation' && drawerDoc.category !== 'FACTURE') ? (
                           <span className="ws-pill ws-pill--ok">
                              <Check size={14} /> Document Validé
                           </span>
                        ) : (
                          <>
                            <span className="ws-pill ws-pill--bad">
                              <X size={14} /> Extrait
                            </span>
                            <span className="ws-pill ws-pill--bad">
                              <X size={14} /> Enregistré
                            </span>
                            <span className="ws-pill ws-pill--bad">
                              <X size={14} /> Synchronisé
                            </span>
                          </>
                        )}
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: '2rem' }}>
                        {(user?.role === 'COMPTABLE' || user?.role === 'ADMIN') && (drawerDoc.category === 'Facturation' || drawerDoc.category === 'FACTURE') ? (
                          <button type="button" className="ws-btn-primary" style={{ background: '#3b82f6', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => handleExtraire()}>
                            <FileText size={18} />
                            Extraire
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: 10 }}>
                             {!(drawerDoc.extractedData && drawerDoc.extractedData.includes('"statut":"ERREUR"')) && (
                               <button type="button" className="ws-btn-outline" onClick={() => openEditDoc(drawerDoc)}>Modifier</button>
                             )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : extractState === 'extracting' ? (
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', flex: 1 }}>
                        <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', position: 'relative' }}>
                            <FileText size={38} color="#fff" />
                            <div className="spinner-ring" style={{ position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: '50%', border: '4px solid #e0e7ff', borderTopColor: '#4f46e5', animation: 'spin 1.2s linear infinite' }} />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: '#1e293b' }}>Extraction en cours</h3>
                        <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Stay here this may take a little bit .</p>
                     </div>
                  ) : (
                     <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
                         <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Niveau de traitement :</p>
                            <div className="ws-pill-row">
                              <span className="ws-pill ws-pill--ok"><Check size={14} /> Extrait</span>
                              <span className={extractState === 'synced' ? "ws-pill ws-pill--ok" : "ws-pill ws-pill--bad"}>{extractState === 'synced' ? <Check size={14} /> : <X size={14} />} Enregistré</span>
                              <span className={extractState === 'synced' ? "ws-pill ws-pill--ok" : "ws-pill ws-pill--bad"}>{extractState === 'synced' ? <Check size={14} /> : <X size={14} />} Synchronisé</span>
                            </div>
                         </div>

                         <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1rem' }}>
                               <FileText size={16} /> Informations de base
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                               <div>
                                  <label className="ws-input-label">Numéro de facture</label>
                                  <input className="ws-input" placeholder="CRK-2025-001" value={invoiceData.invoiceNumber} onChange={(e) => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})} disabled={extractState === 'synced'} />
                               </div>
                               <div>
                                  <label className="ws-input-label">Date de facture</label>
                                  <input className="ws-input" placeholder="jj/mm/aaaa" value={invoiceData.invoiceDate} onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})} disabled={extractState === 'synced'} />
                               </div>
                               <div>
                                  <label className="ws-input-label">Date de livraison</label>
                                  <input className="ws-input" placeholder="jj/mm/aaaa" value={invoiceData.deliveryDate} onChange={(e) => setInvoiceData({...invoiceData, deliveryDate: e.target.value})} disabled={extractState === 'synced'} />
                               </div>
                               <div>
                                  <label className="ws-input-label">Total de la facture</label>
                                  <input className="ws-input" placeholder="0.000" value={invoiceData.totalTTC} readOnly style={{ background: '#f1f5f9', cursor: 'default' }} />
                               </div>
                            </div>

                            {/* ── Articles / Lignes de facture ── */}
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                               <LayoutGrid size={16} /> Articles
                            </h3>
                            <div style={{ overflowX: 'auto', marginBottom: '0.75rem' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                  <tr style={{ background: '#f1f5f9' }}>
                                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0' }}>Description</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', width: 60 }}>Qté</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', width: 100 }}>P.U.</th>
                                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', width: 100 }}>Montant</th>
                                    {extractState !== 'synced' && <th style={{ width: 36, borderBottom: '2px solid #e2e8f0' }} />}
                                  </tr>
                                </thead>
                                <tbody>
                                  {invoiceItems.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '6px 10px' }}>
                                        <input className="ws-input" style={{ fontSize: '0.82rem', padding: '6px 8px' }} value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} disabled={extractState === 'synced'} />
                                      </td>
                                      <td style={{ padding: '6px 4px' }}>
                                        <input className="ws-input" style={{ fontSize: '0.82rem', padding: '6px 8px', textAlign: 'center' }} type="number" min="0" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} disabled={extractState === 'synced'} />
                                      </td>
                                      <td style={{ padding: '6px 4px' }}>
                                        <input className="ws-input" style={{ fontSize: '0.82rem', padding: '6px 8px', textAlign: 'right' }} type="number" step="0.001" min="0" value={item.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} disabled={extractState === 'synced'} />
                                      </td>
                                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                                        {item.amount}
                                      </td>
                                      {extractState !== 'synced' && (
                                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                          <button type="button" onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }} title="Supprimer">
                                            <Trash2 size={14} />
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {invoiceItems.length === 0 && (
                                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', padding: '1rem 0' }}>Aucun article. Ajoutez-en un ci-dessous.</p>
                              )}
                            </div>
                            {extractState !== 'synced' && (
                              <button type="button" onClick={addItem} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', color: '#2563eb', border: '1px dashed #93c5fd', borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1.25rem' }}>
                                <Plus size={14} /> Ajouter un article
                              </button>
                            )}

                            {/* ── Détails financiers ── */}
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1rem', marginTop: '0.5rem' }}>
                               <LayoutGrid size={16} /> Détails financiers
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                               <div>
                                  <label className="ws-input-label">TVA (%)</label>
                                  <input className="ws-input" placeholder="19.00" value={invoiceData.tvaPercent} onChange={(e) => handleTvaPercentChange(e.target.value)} disabled={extractState === 'synced'} />
                               </div>
                               <div>
                                  <label className="ws-input-label">Devise</label>
                                  <input className="ws-input" placeholder="TND" value={invoiceData.currency} onChange={(e) => setInvoiceData({...invoiceData, currency: e.target.value})} disabled={extractState === 'synced'} />
                               </div>
                               <div>
                                  <label className="ws-input-label">Sous-total HT</label>
                                  <input className="ws-input" placeholder="0.000" value={invoiceData.totalHT} readOnly style={{ background: '#f1f5f9', fontWeight: 600, cursor: 'default' }} />
                               </div>
                               <div>
                                  <label className="ws-input-label">TVA ({invoiceData.tvaPercent || '0'}%)</label>
                                  <input className="ws-input" placeholder="0.000" value={invoiceData.totalTVA} readOnly style={{ background: '#f1f5f9', cursor: 'default' }} />
                               </div>
                               <div style={{ gridColumn: '1 / -1', background: '#f0fdf4', borderRadius: 10, padding: '12px 14px', border: '1px solid #bbf7d0' }}>
                                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d', marginBottom: 4, display: 'block' }}>Total TTC</label>
                                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#166534' }}>{invoiceData.currency} {invoiceData.totalTTC || '0.000'}</span>
                               </div>
                               <div>
                                  <label className="ws-input-label">Fournisseur</label>
                                  <input className="ws-input" placeholder="Nom du fournisseur" value={invoiceData.vendorName} onChange={(e) => setInvoiceData({...invoiceData, vendorName: e.target.value})} disabled={extractState === 'synced'} />
                               </div>
                               <div>
                                  <label className="ws-input-label">Client</label>
                                  <input className="ws-input" value={invoiceData.clientName} onChange={(e) => setInvoiceData({...invoiceData, clientName: e.target.value})} disabled={extractState === 'synced'} />
                               </div>
                            </div>
                         </div>

                         <div style={{ marginTop: 'auto', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                            {extractState !== 'synced' ? (
                                <>
                                    <button type="button" className="ws-btn-outline" onClick={() => setExtractState('idle')}>Annuler</button>
                                    <button type="button" className="ws-btn-primary" style={{ background: '#3b82f6', borderColor: '#3b82f6', display: 'flex', alignItems: 'center', gap: 8 }} onClick={handleSyncInvoice}>
                                      <Check size={16} /> Enregistrer
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" className="ws-btn-outline" onClick={() => setExtractState('form')}>Modifier</button>
                                    <button type="button" className="ws-btn-primary" style={{ background: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <Check size={16} /> Synchronisé
                                    </button>
                                </>
                            )}
                         </div>
                     </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {(detailFull?.comments ?? []).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Aucun commentaire.</p>
                    ) : (detailFull?.comments ?? []).map((c, i) => {
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
                  <div className="ws-comment-input-row">
                    <input 
                      placeholder="Écrivez votre commentaire…" 
                      value={exchangeInput}
                      onChange={(e) => setExchangeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void sendExchange()}
                    />
                    <button type="button" className="ws-send-btn" onClick={() => void sendExchange()} aria-label="Envoyer">
                      <Send size={18} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Modale dossier */}
      {isFolderModalOpen && (
        <div className="ws-modal-overlay" onClick={() => setIsFolderModalOpen(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>Créer un nouveau dossier</h2>
                <p>Créez un nouveau dossier pour organiser vos documents.</p>
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setIsFolderModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="ws-modal-body">
                <label className="ws-input-label">Nom du dossier</label>
                <input
                  className="ws-input"
                  placeholder="Saisir le nom du dossier"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  required
                />
              </div>
              <div className="ws-modal-footer">
                <button type="button" className="ws-btn-outline" onClick={() => setIsFolderModalOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="ws-btn-primary">
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSuccessFolderOpen && (
        <div className="ws-modal-overlay" onClick={() => setIsSuccessFolderOpen(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="ws-modal-body" style={{ paddingTop: '2rem' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                  color: '#2563eb',
                }}
              >
                <FolderOpen size={40} />
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>Dossier créé avec succès !</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Vous pouvez maintenant y organiser vos documents.
              </p>
              <button type="button" className="ws-btn-primary" style={{ width: '100%' }} onClick={() => setIsSuccessFolderOpen(false)}>
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import */}
      {isUploadModalOpen && (
        <div className="ws-modal-overlay" onClick={() => setIsUploadModalOpen(false)}>
          <div className="ws-modal ws-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>Importer un document</h2>
                <p>Ajoutez un fichier à votre espace (JPEG, PNG, JPG, JFIF, PDF — max 50 Mo).</p>
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setIsUploadModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="ws-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem 2rem' }}>
                <div
                  className="ws-dropzone"
                  style={{
                    border: '2px dashed #e2e8f0',
                    borderRadius: '12px',
                    padding: '2rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: selectedFile ? '#f8fafc' : '#ffffff',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => document.getElementById('ws-file')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) {
                      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
                      if (!['pdf', 'png', 'jpg', 'jpeg', 'jfif'].includes(ext)) {
                        showToast('err', `Le type de fichier .${ext} n'est pas autorisé. Seuls les PDF et images sont acceptés.`);
                        return;
                      }
                      setSelectedFile(f);
                      if (!customName) setCustomName(f.name.replace(/\.[^/.]+$/, ""));
                    }
                  }}
                >
                  <input
                    id="ws-file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.jfif"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f) {
                        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
                        if (!['pdf', 'png', 'jpg', 'jpeg', 'jfif'].includes(ext)) {
                          showToast('err', `Le type de fichier .${ext} n'est pas autorisé. Seuls les PDF et images sont acceptés.`);
                          e.target.value = '';
                          return;
                        }
                      }
                      setSelectedFile(f);
                      if (f && !customName) setCustomName(f.name.replace(/\.[^/.]+$/, ""));
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '12px' }}>
                       <FileText size={28} color="#64748b" />
                    </div>
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                    Glissez-déposez vos documents
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
                    JPEG, PNG, JPG, JFIF, PDF, jusqu'à 50 Mo
                  </p>
                  
                  {selectedFile ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#eff6ff', color: '#2563eb', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                      <Check size={16} /> {selectedFile.name}
                    </div>
                  ) : (
                    <button type="button" style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }} onClick={(e) => { e.stopPropagation(); document.getElementById('ws-file')?.click(); }}>
                      Sélectionner un fichier
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Nom du document</label>
                  <input
                    className="ws-input"
                    placeholder="Saisir le nom du document"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Catégorie</label>
                  <select
                    className="ws-select"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', appearance: 'none', background: '#fff url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                  >
                    <option value="" disabled>Sélectionnez une catégorie</option>
                    {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {uploadCategory === 'Facturation' && (
                    <p style={{ fontSize: '0.78rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontWeight: 500 }}>
                      <Check size={14} /> Extraction intelligente activée
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Choisir la destination du document</label>
                  <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', maxHeight: '180px', overflowY: 'auto' }}>
                    {folders.length > 0 ? (
                      folders.map((f, i) => (
                        <div 
                          key={f.id}
                          onClick={() => setUploadFolderId(f.id)}
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', 
                            borderBottom: i < folders.length - 1 ? '1px solid #f1f5f9' : 'none',
                            cursor: 'pointer',
                            background: uploadFolderId === f.id ? '#f8fafc' : '#ffffff',
                          }}
                        >
                          <div style={{ color: uploadFolderId === f.id ? '#2563eb' : '#94a3b8' }}>
                            <FolderOpen size={18} />
                          </div>
                          <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: uploadFolderId === f.id ? 600 : 400 }}>{f.name}</span>
                          {uploadFolderId === f.id && <Check size={16} color="#2563eb" style={{ marginLeft: 'auto' }} />}
                        </div>
                      ))
                    ) : (
                       <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
                         Aucun dossier disponible
                       </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="ws-modal-footer" style={{ padding: '1.25rem 2rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }} onClick={() => setIsUploadModalOpen(false)}>
                  Annuler
                </button>
                <button type="submit" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer', fontSize: '0.9rem', opacity: !selectedFile || uploading ? 0.7 : 1 }} disabled={!selectedFile || uploading}>
                  {uploading ? 'Import…' : 'Importer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partager */}
      {shareOpen && menuTargetDoc && (
        <div className="ws-modal-overlay" onClick={() => setShareOpen(false)}>
          <div className="ws-modal ws-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>Partagez le fichier avec votre comptable</h2>
                <p>Sélectionnez un comptable pour partager « {menuTargetDoc.name} ».</p>
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setShareOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ws-modal-body">
              <label className="ws-input-label">Sélectionnez votre comptable</label>
              {MOCK_ACCOUNTANTS.map((a) => (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  className={`ws-share-option ${sharePick === a.id ? 'selected' : ''}`}
                  onClick={() => setSharePick(a.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSharePick(a.id)}
                >
                  <div className="ws-avatar" style={{ background: a.color, width: 44, height: 44 }}>
                    {a.initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.line}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="ws-modal-footer">
              <button type="button" className="ws-btn-outline" onClick={() => setShareOpen(false)}>
                Annuler
              </button>
              <button type="button" className="ws-btn-primary" onClick={confirmShare} disabled={!sharePick}>
                Partager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifier document */}
      {editOpen && menuTargetDoc && (
        <div className="ws-modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="ws-modal ws-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>Modifier le document</h2>
                <p>Mettez à jour le contenu de votre document.</p>
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setEditOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ws-modal-body">
              <label className="ws-input-label">Nom du document</label>
              <input
                className="ws-input"
                defaultValue={menuTargetDoc.name}
              />
              <label className="ws-input-label" style={{ marginTop: 12 }}>
                Catégorie
              </label>
              <select
                className="ws-input"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              >
                {DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="ws-input-label" style={{ marginTop: 12 }}>
                Destination
              </label>
              <input
                className="ws-input"
                readOnly
                value={`${breadcrumbs.map((b) => b.name).join(' > ')} > ${menuTargetDoc.folder?.name ?? 'Racine'}`}
              />
              <p style={{ fontWeight: 700, fontSize: '0.85rem', marginTop: '1rem' }}>Partagé avec</p>
              <div className="ws-avatar-row">
                {['AB', 'CD', 'EF'].map((x, i) => (
                  <div
                    key={x}
                    className="ws-avatar"
                    style={{ background: ['#8b5cf6', '#f97316', '#22c55e'][i] }}
                  >
                    {x}
                  </div>
                ))}
              </div>
              <p style={{ fontWeight: 700, fontSize: '0.85rem', marginTop: '1rem' }}>Document actuel</p>
              <div className="ws-version-row" style={{ border: '1px solid var(--border-color)', padding: '0.65rem', borderRadius: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color="#ef4444" /> {menuTargetDoc.name}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Aujourd’hui</span>
              </div>
            </div>
            <div className="ws-modal-footer">
              <button type="button" className="ws-btn-outline" onClick={() => setEditOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="ws-btn-primary"
                onClick={() => {
                  setEditOpen(false);
                  showToast('ok', 'Votre modification est enregistrée avec succès');
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renommer */}
      {renameOpen && menuTargetDoc && (
        <div className="ws-modal-overlay" onClick={() => setRenameOpen(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>Renommer votre document</h2>
                <p>Mettez à jour le nom de votre document.</p>
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setRenameOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ws-modal-body">
              <label className="ws-input-label">Nouveau nom du fichier</label>
              <input
                className="ws-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
              />
            </div>
            <div className="ws-modal-footer">
              <button type="button" className="ws-btn-outline" onClick={() => setRenameOpen(false)}>
                Annuler
              </button>
              <button type="button" className="ws-btn-primary" onClick={() => void confirmRenameDoc()}>
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supprimer fichier */}
      {deleteDocOpen && menuTargetDoc && (
        <div className="ws-modal-overlay" onClick={() => setDeleteDocOpen(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="ws-modal-body" style={{ paddingTop: '1.75rem' }}>
              <div className="ws-delete-modal-icon">
                <Trash2 size={24} />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 8 }}>Êtes-vous sûr de supprimer ce fichier ?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Le document sera supprimé du serveur. Cette action est irréversible.
              </p>
            </div>
            <div className="ws-modal-footer" style={{ justifyContent: 'center' }}>
              <button type="button" className="ws-btn-outline" onClick={() => setDeleteDocOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="ws-btn-primary"
                style={{ background: '#dc2626', boxShadow: 'none' }}
                onClick={() => void confirmDeleteDoc()}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renommer dossier */}
      {renameFolderOpen && folderRenameTarget && (
        <div className="ws-modal-overlay" onClick={() => setRenameFolderOpen(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>Renommer le dossier</h2>
                <p>Le nouveau nom sera visible dans Mon espace et dans Archives.</p>
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setRenameFolderOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ws-modal-body">
              <label className="ws-input-label">Nom du dossier</label>
              <input
                className="ws-input"
                value={folderRenameValue}
                onChange={(e) => setFolderRenameValue(e.target.value)}
              />
            </div>
            <div className="ws-modal-footer">
              <button type="button" className="ws-btn-outline" onClick={() => setRenameFolderOpen(false)}>
                Annuler
              </button>
              <button type="button" className="ws-btn-primary" onClick={() => void confirmRenameFolder()}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supprimer dossier */}
      {deleteFolderOpen && deleteFolderTarget && (
        <div className="ws-modal-overlay" onClick={() => setDeleteFolderOpen(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="ws-modal-body" style={{ paddingTop: '1.75rem' }}>
              <div className="ws-delete-modal-icon">
                <Trash2 size={24} />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Supprimer « {deleteFolderTarget.name} » ?</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 8 }}>
                Le dossier doit être vide (aucun sous-dossier ni document). Action irréversible.
              </p>
            </div>
            <div className="ws-modal-footer" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="ws-btn-outline"
                onClick={() => {
                  setDeleteFolderOpen(false);
                  setDeleteFolderTarget(null);
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className="ws-btn-primary"
                style={{ background: '#dc2626', boxShadow: 'none' }}
                onClick={() => void confirmDeleteFolder()}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Déplacer document */}
      {isMoveModalOpen && menuTargetDoc && (
        <div className="ws-modal-overlay" onClick={() => setIsMoveModalOpen(false)}>
          <div className="ws-modal ws-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <div>
                <h2>Déplacer le document</h2>
                <p>Choisissez le dossier de destination pour « {menuTargetDoc.name} ».</p>
              </div>
              <button type="button" className="ws-icon-btn" onClick={() => setIsMoveModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ws-modal-body">
              <label className="ws-input-label">Dossiers disponibles</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button 
                  className="ws-share-option" 
                  style={{ width: '100%', textAlign: 'left', border: '1px solid var(--border-color)', borderRadius: 8 }}
                  onClick={() => confirmMoveDoc(null)}
                >
                  <FolderOpen size={20} color="#94a3b8" />
                  <span style={{ fontWeight: 600 }}>Racine (Mon espace)</span>
                </button>
                {folders.filter(f => f.id !== menuTargetDoc.folderId).map(f => (
                  <button 
                    key={f.id}
                    className="ws-share-option" 
                    style={{ width: '100%', textAlign: 'left', border: '1px solid var(--border-color)', borderRadius: 8 }}
                    onClick={() => confirmMoveDoc(f.id)}
                  >
                    <FolderOpen size={20} color="#3b82f6" />
                    <span style={{ fontWeight: 600 }}>{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="ws-modal-footer">
              <button type="button" className="ws-btn-outline" onClick={() => setIsMoveModalOpen(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
