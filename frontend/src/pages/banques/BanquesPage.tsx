import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  FileText,
  Trash2,
  ArrowLeft,
  Pencil,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuthStore } from '../../store/authStore';
import {
  fetchBankAccounts,
  fetchBankAccount,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  type BankAccount,
  type BankTransaction,
} from '../../lib/api/bankService';
import '../../styles/banks.css';

const TX_POS = '#00b388';
const TX_NEG = '#ff4b4b';

const CHART_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil'];

const DEMO_STATEMENTS = [
  'ExtraitJanvier.pdf',
  'ExtraitFevrier.pdf',
  'ExtraitMars.pdf',
  'ExtraitAvril.pdf',
  'ExtraitMai.pdf',
  'ExtraitJuin.pdf',
  'ExtraitJuillet.pdf',
  'ExtraitAout.pdf',
  'ExtraitSeptembre.pdf',
  'ExtraitOctobre.pdf',
  'ExtraitNovembre.pdf',
  'ExtraitDecembre.pdf',
  'Extrait2024_S1.pdf',
  'Extrait2024_S2.pdf',
  'Extrait2023_Annuel.pdf',
];

function formatTableDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function getCardStyle(name: string, index: number): string {
  const n = name.toLowerCase();
  if (n.includes('flouci')) return 'card-flouci';
  if (n.includes('dinar')) return 'card-edinar';
  if (n.includes('attijari')) return 'card-attijari';
  if (n.includes('zitouna')) return 'card-zitouna';
  if (n.includes('techno')) return 'card-tech';
  const fallbacks = ['card-flouci', 'card-abstract', 'card-tech', 'card-edinar', 'card-zitouna'];
  return fallbacks[index % fallbacks.length];
}

const BankCard: React.FC<{
  account: BankAccount;
  index: number;
  holder: string;
  onClick: () => void;
}> = ({ account, index, holder, onClick }) => {
  const cls = getCardStyle(account.bankName, index);
  const isLight = account.bankName.toLowerCase().includes('dinar');

  return (
    <div className={`bank-card ${cls}`} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="card-top">
        <span className="card-bank-name">{account.bankName}</span>
        <div className="card-chip" />
      </div>
      <div className="card-mid">
        <div className="card-number">•••• •••• •••• {account.rib?.slice(-4) || '4242'}</div>
        <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>EXPIRE À FIN : 09/28</div>
      </div>
      <div className="card-bottom">
        <span className="card-holder">{holder}</span>
        <span className="card-brand">{isLight ? 'mastercard' : 'VISA'}</span>
      </div>
    </div>
  );
};

type DrawerView = 'details' | 'transactions';

export default function BanquesPage() {
  const { token, user } = useAuthStore();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailAccount, setDetailAccount] = useState<BankAccount | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('details');
  const [statementsOpen, setStatementsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addSuccessOpen, setAddSuccessOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [statementSearch, setStatementSearch] = useState('');
  const [statementPage, setStatementPage] = useState(1);
  const [statementFilter, setStatementFilter] = useState('all');

  const [txDrawerSearch, setTxDrawerSearch] = useState('');

  const [step1, setStep1] = useState({
    bankName: '',
    agency: '',
    accountType: 'Courant',
    pack: 'Gold',
    rib: '',
  });
  const [step2, setStep2] = useState({ login: '', password: '' });

  const [editForm, setEditForm] = useState({
    bankName: '',
    agency: '',
    accountType: 'Courant',
    pack: 'Gold',
    rib: '',
    login: '',
    password: '',
  });

  const holderName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'CLIENT';

  const loadData = useCallback(async () => {
    if (!token || token === 'demo-token') {
      setAccounts([]);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchBankAccounts();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDetails = async (acc: BankAccount) => {
    setDetailAccount(acc);
    setDrawerView('details');
    setDrawerOpen(true);
    setTxDrawerSearch('');
    if (!token || token === 'demo-token') return;
    try {
      const full = await fetchBankAccount(acc.id);
      setDetailAccount(full);
    } catch (e) {
      console.error(e);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerView('details');
    setDetailAccount(null);
  };

  const allTransactions = useMemo(() => {
    const list: BankTransaction[] = [];
    for (const acc of accounts) {
      for (const tx of acc.transactions || []) {
        list.push(tx);
      }
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [accounts]);

  const filteredTableTx = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allTransactions;
    return allTransactions.filter(
      (tx) =>
        tx.operation.toLowerCase().includes(q) ||
        (tx.details && tx.details.toLowerCase().includes(q)) ||
        (tx.reference && tx.reference.toLowerCase().includes(q)),
    );
  }, [allTransactions, searchQuery]);

  const chartData = useMemo(() => {
    if (!detailAccount) return [];
    
    // Get last 6 months
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: d.toLocaleDateString('fr-FR', { month: 'short' }),
        date: d,
        balance: 0
      });
    }

    // Sort transactions by date ascending
    const txs = [...(detailAccount.transactions || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate balance at each month end
    let currentBalance = detailAccount.balance;
    // We start from current and go backwards to find historical points? 
    // Actually simpler: 
    // balance_at_time_T = current_balance - sum(transactions from T to now)
    
    return months.map(m => {
      const monthEnd = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0, 23, 59, 59);
      const futureTxs = txs.filter(t => new Date(t.date) > monthEnd);
      const futureSum = futureTxs.reduce((sum, t) => sum + t.amount, 0);
      return {
        name: m.name,
        balance: Math.round(currentBalance - futureSum)
      };
    });
  }, [detailAccount]);

  const detailTxFiltered = useMemo(() => {
    const txs = [...(detailAccount?.transactions || [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const q = txDrawerSearch.trim().toLowerCase();
    if (!q) return txs;
    return txs.filter(
      (tx) =>
        tx.operation.toLowerCase().includes(q) ||
        (tx.details && tx.details.toLowerCase().includes(q)),
    );
  }, [detailAccount?.transactions, txDrawerSearch]);

  const txGroupedByDate = useMemo(() => {
    const map = new Map<string, BankTransaction[]>();
    for (const tx of detailTxFiltered) {
      const key = new Date(tx.date).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries());
  }, [detailTxFiltered]);

  const availableStatements = useMemo(() => {
    if (!detailAccount || !detailAccount.statements) return [];
    return detailAccount.statements.map(s => s.name);
  }, [detailAccount]);

  const filteredStatements = useMemo(() => {
    let list = availableStatements.length > 0 ? availableStatements : [...DEMO_STATEMENTS];
    if (statementFilter === 'recent') list = list.slice(0, 6);
    const q = statementSearch.trim().toLowerCase();
    if (q) list = list.filter((n) => n.toLowerCase().includes(q));
    return list;
  }, [availableStatements, statementSearch, statementFilter]);

  const statementPageSize = 9;
  const statementTotalPages = Math.max(1, Math.ceil(filteredStatements.length / statementPageSize));
  const statementSlice = filteredStatements.slice(
    (statementPage - 1) * statementPageSize,
    statementPage * statementPageSize,
  );

  useEffect(() => {
    setStatementPage(1);
  }, [statementSearch, statementFilter]);

  useEffect(() => {
    if (statementPage > statementTotalPages) setStatementPage(statementTotalPages);
  }, [statementPage, statementTotalPages]);

  const resetAddWizard = () => {
    setAddStep(1);
    setStep1({ bankName: '', agency: '', accountType: 'Courant', pack: 'Gold', rib: '' });
    setStep2({ login: '', password: '' });
    setShowPassword(false);
  };

  const openAdd = () => {
    resetAddWizard();
    setErrorBanner(null);
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    resetAddWizard();
  };

  const submitCreate = async () => {
    if (!token || token === 'demo-token') {
      setErrorBanner("Mode démo : connexion API indisponible. Connectez-vous avec un compte réel.");
      closeAdd();
      return;
    }
    try {
      await createBankAccount({
        bankName: step1.bankName,
        agency: step1.agency,
        accountType: step1.accountType,
        pack: step1.pack,
        rib: step1.rib,
        login: step2.login,
        password: step2.password,
        balance: 0,
        currency: 'TND',
      });
      closeAdd();
      setAddSuccessOpen(true);
      loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Une erreur est survenue.';
      setErrorBanner(
        msg.toLowerCase().includes('login') || msg.toLowerCase().includes('mot de passe')
          ? msg
          : "Le Login de l'application ou le mot de passe est invalide.",
      );
      closeAdd();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !token || token === 'demo-token') {
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteBankAccount(deleteTarget.id);
      setDeleteTarget(null);
      closeDrawer();
      loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const openEdit = () => {
    if (!detailAccount) return;
    setEditForm({
      bankName: detailAccount.bankName,
      agency: detailAccount.agency || '',
      accountType: detailAccount.accountType || 'Courant',
      pack: detailAccount.pack || 'Gold',
      rib: detailAccount.rib || '',
      login: detailAccount.login || '',
      password: '',
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailAccount || !token || token === 'demo-token') return;
    try {
      await updateBankAccount(detailAccount.id, {
        bankName: editForm.bankName,
        agency: editForm.agency,
        accountType: editForm.accountType,
        pack: editForm.pack,
        rib: editForm.rib,
        login: editForm.login,
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      setEditOpen(false);
      const full = await fetchBankAccount(detailAccount.id);
      setDetailAccount(full);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  if (user && user.role !== 'CLIENT') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="banks-page banks-page--client animate-fade-in">
      {errorBanner && (
        <div className="banks-error-banner">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => {
              setErrorBanner(null);
              setAddStep(2);
              setAddOpen(true);
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      <header className="banks-header">
        <div className="banks-header-text">
          <h1 className="page-title">Mes comptes bancaires</h1>
          <p className="page-subtitle">Suivez vos soldes et transactions en temps réel.</p>
        </div>
        <button type="button" className="banks-btn-new" onClick={openAdd}>
          <Plus size={18} strokeWidth={2.5} />
          Nouvelle carte
        </button>
      </header>

      <div className="banks-section-head">
        <h2 className="banks-section-title">Mes cartes</h2>
        <button type="button" className="banks-chevron-btn" aria-label="Voir plus">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="cards-scroll-container">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="bank-card"
              style={{
                background: '#e5e7eb',
                animation: 'pulse 1.5s infinite',
                cursor: 'default',
              }}
            />
          ))
        ) : accounts.length > 0 ? (
          accounts.map((acc, i) => (
            <BankCard key={acc.id} account={acc} index={i} holder={holderName} onClick={() => openDetails(acc)} />
          ))
        ) : (
          <div
            style={{
              padding: '2.5rem',
              border: '2px dashed var(--border-color)',
              borderRadius: 16,
              width: '100%',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              background: 'var(--bg-primary)',
            }}
          >
            Aucun compte configuré. Cliquez sur « Nouvelle carte » pour commencer.
          </div>
        )}
      </div>

      <div className="banks-section-head">
        <h2 className="banks-section-title">Dernières transactions</h2>
        <div className="banks-search-wrap">
          <Search size={16} color="var(--text-muted)" />
          <input
            type="search"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Rechercher une transaction"
          />
        </div>
      </div>

      <div className="banks-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Opération</th>
              <th>Détails opération</th>
              <th>Référence</th>
              <th style={{ textAlign: 'right' }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {filteredTableTx.length > 0 ? (
              filteredTableTx.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontWeight: 600 }}>{formatTableDate(tx.date)}</td>
                  <td>{tx.operation}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{tx.details ?? '—'}</td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}>{tx.reference ?? '—'}</td>
                  <td
                    style={{ textAlign: 'right' }}
                    className={tx.amount < 0 ? 'banks-tx-neg' : 'banks-tx-pos'}
                  >
                    {tx.amount < 0 ? '−' : '+'} {Math.abs(tx.amount).toLocaleString('fr-FR')} {tx.currency}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Aucune transaction à afficher.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Overlay drawer */}
      {drawerOpen && (
        <>
          <div className="bank-overlay" aria-hidden onClick={closeDrawer} />
          <aside className="bank-drawer" role="dialog" aria-labelledby="bank-drawer-title">
            {drawerView === 'transactions' ? (
              <>
                <div className="bank-drawer-header">
                  <button type="button" className="bank-drawer-back" onClick={() => setDrawerView('details')}>
                    <ArrowLeft size={18} />
                    Transactions
                  </button>
                  <button type="button" className="bank-drawer-close" onClick={closeDrawer} aria-label="Fermer">
                    ×
                  </button>
                </div>
                <div className="bank-drawer-body">
                  <div className="bank-tx-toolbar">
                    <div className="banks-search-wrap">
                      <Search size={16} color="var(--text-muted)" />
                      <input
                        type="search"
                        placeholder="Rechercher..."
                        value={txDrawerSearch}
                        onChange={(e) => setTxDrawerSearch(e.target.value)}
                      />
                    </div>
                    <button type="button" className="bank-btn-filter">
                      <Filter size={16} />
                      Filtrer
                    </button>
                  </div>
                  {txGroupedByDate.map(([dateKey, txs]) => (
                    <div key={dateKey}>
                      <div className="bank-tx-date-group">{formatShortDate(txs[0].date)}</div>
                      {txs.map((tx) => (
                        <div key={tx.id} className="bank-tx-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div
                              className="bank-tx-icon"
                              style={{
                                background: tx.amount < 0 ? '#fef2f2' : '#ecfdf5',
                              }}
                            >
                              {tx.amount < 0 ? (
                                <ArrowUpRight size={16} color={TX_NEG} />
                              ) : (
                                <ArrowDownLeft size={16} color={TX_POS} />
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="bank-tx-name">{tx.operation}</div>
                              <div className="bank-tx-sub">{tx.details ?? formatShortDate(tx.date)}</div>
                            </div>
                          </div>
                          <span style={{ fontWeight: 700, color: tx.amount < 0 ? TX_NEG : TX_POS, flexShrink: 0 }}>
                            {tx.amount < 0 ? '−' : '+'} {Math.abs(tx.amount).toLocaleString('fr-FR')} {tx.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {detailTxFiltered.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                      Aucune transaction.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="bank-drawer-header">
                  <h2 id="bank-drawer-title" className="bank-drawer-title">
                    Détails de la carte
                  </h2>
                  <button type="button" className="bank-drawer-close" onClick={closeDrawer} aria-label="Fermer">
                    ×
                  </button>
                </div>
                <div className="bank-drawer-body">
                  {detailAccount && (
                    <>
                      <div className="bank-meta-grid">
                        <div>
                          <span className="bank-meta-label">Nom de la banque</span>
                          <p className="bank-meta-value">{detailAccount.bankName}</p>
                        </div>
                        <div>
                          <span className="bank-meta-label">Agence</span>
                          <p className="bank-meta-value">{detailAccount.agency || '—'}</p>
                        </div>
                        <div className="full">
                          <span className="bank-meta-label">RIB</span>
                          <p className="bank-meta-value">{detailAccount.rib || '—'}</p>
                        </div>
                        <div>
                          <span className="bank-meta-label">Type du compte</span>
                          <p className="bank-meta-value">{detailAccount.accountType || '—'}</p>
                        </div>
                        <div>
                          <span className="bank-meta-label">Login</span>
                          <p className="bank-meta-value">{detailAccount.login || '—'}</p>
                        </div>
                        <div>
                          <span className="bank-meta-label">Mot de passe</span>
                          <p className="bank-meta-value">••••••••</p>
                        </div>
                      </div>

                      <div className="balance-card">
                        <p className="balance-label">Solde actuel</p>
                        <div className="balance-amount">
                          {detailAccount.balance.toLocaleString('fr-FR')} {detailAccount.currency}
                        </div>
                        <div style={{ height: 200, width: '100%', marginTop: 12 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <defs>
                                <linearGradient id="bankColorBal" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2d60ff" stopOpacity={0.35} />
                                  <stop offset="95%" stopColor="#2d60ff" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                              <YAxis hide domain={['dataMin - 500', 'dataMax + 500']} />
                              <Tooltip />
                              <Area
                                type="monotone"
                                dataKey="balance"
                                stroke="#2d60ff"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#bankColorBal)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bank-subsection-head">
                        <h3>Extraits bancaires</h3>
                        <button type="button" className="bank-link-all" onClick={() => setStatementsOpen(true)}>
                           Voir tout
                        </button>
                      </div>
                      <div className="statements-grid">
                        {detailAccount.statements && detailAccount.statements.length > 0 ? (
                          detailAccount.statements.slice(0, 3).map((stmt) => (
                            <button
                              key={stmt.id}
                              type="button"
                              className="statement-item"
                              onClick={() => setStatementsOpen(true)}
                            >
                              <div className="statement-thumb">
                                <FileText size={28} color="#94a3b8" />
                              </div>
                              <p style={{ fontSize: '0.72rem', fontWeight: 700, margin: 0 }}>{stmt.name}</p>
                            </button>
                          ))
                        ) : (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aucun extrait disponible.</p>
                        )}
                      </div>

                      <div className="bank-subsection-head" style={{ marginTop: '1.5rem' }}>
                        <h3>Transactions</h3>
                        <button type="button" className="bank-link-all" onClick={() => setDrawerView('transactions')}>
                          Voir tout
                        </button>
                      </div>
                      <div>
                        {(detailAccount.transactions || []).slice(0, 4).map((tx) => (
                          <div key={tx.id} className="bank-tx-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                className="bank-tx-icon"
                                style={{ background: tx.amount < 0 ? '#fef2f2' : '#ecfdf5' }}
                              >
                                {tx.amount < 0 ? (
                                  <ArrowUpRight size={16} color={TX_NEG} />
                                ) : (
                                  <ArrowDownLeft size={16} color={TX_POS} />
                                )}
                              </div>
                              <div>
                                <div className="bank-tx-name">{tx.operation}</div>
                                <div className="bank-tx-sub">{formatTableDate(tx.date)}</div>
                              </div>
                            </div>
                            <span style={{ fontWeight: 700, color: tx.amount < 0 ? TX_NEG : TX_POS }}>
                              {tx.amount < 0 ? '−' : '+'} {Math.abs(tx.amount).toLocaleString('fr-FR')} {tx.currency}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="bank-drawer-actions">
                        <button type="button" className="bank-btn-ghost" onClick={openEdit}>
                          <Pencil size={16} />
                          Modifier
                        </button>
                        <button type="button" className="bank-btn-danger-ghost" onClick={() => setDeleteTarget(detailAccount)}>
                          <Trash2 size={16} />
                          Supprimer
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </aside>
        </>
      )}

      {/* Extraits — modale */}
      {statementsOpen && (
        <div
          className="bank-modal-overlay"
          role="dialog"
          aria-labelledby="statements-title"
          onClick={() => setStatementsOpen(false)}
        >
          <div className="bank-modal bank-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="bank-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  className="bank-drawer-back"
                  onClick={() => setStatementsOpen(false)}
                  style={{ marginRight: 4 }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="bank-modal-header-text">
                  <h2 id="statements-title">Extrait bancaires</h2>
                </div>
              </div>
              <button
                type="button"
                className="bank-drawer-close"
                onClick={() => setStatementsOpen(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <div className="bank-modal-body">
              <div className="bank-statements-toolbar">
                <div className="banks-search-wrap">
                  <Search size={16} color="var(--text-muted)" />
                  <input
                    type="search"
                    placeholder="Rechercher..."
                    value={statementSearch}
                    onChange={(e) => setStatementSearch(e.target.value)}
                  />
                </div>
                <select
                  className="bank-filter-select"
                  value={statementFilter}
                  onChange={(e) => setStatementFilter(e.target.value)}
                >
                  <option value="all">Tous les extraits</option>
                  <option value="recent">Récents</option>
                </select>
              </div>
              <div className="bank-statements-grid">
                {statementSlice.map((name) => (
                  <div key={name} className="bank-statement-doc">
                    <div className="bank-statement-doc-thumb">
                      <FileText size={40} color="#cbd5e1" />
                    </div>
                    <div className="bank-statement-doc-name">
                      <FileText size={14} color={TX_NEG} />
                      {name}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bank-pagination">
                <button
                  type="button"
                  disabled={statementPage <= 1}
                  onClick={() => setStatementPage(1)}
                  aria-label="Première page"
                >
                  ≪
                </button>
                <button
                  type="button"
                  disabled={statementPage <= 1}
                  onClick={() => setStatementPage((p) => Math.max(1, p - 1))}
                  aria-label="Page précédente"
                >
                  ‹
                </button>
                {Array.from({ length: statementTotalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={statementPage === p ? 'active' : ''}
                    onClick={() => setStatementPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={statementPage >= statementTotalPages}
                  onClick={() => setStatementPage((p) => Math.min(statementTotalPages, p + 1))}
                  aria-label="Page suivante"
                >
                  ›
                </button>
                <button
                  type="button"
                  disabled={statementPage >= statementTotalPages}
                  onClick={() => setStatementPage(statementTotalPages)}
                  aria-label="Dernière page"
                >
                  ≫
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suppression */}
      {deleteTarget && (
        <div className="bank-modal-overlay">
          <div className="bank-modal bank-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bank-modal-body" style={{ paddingTop: '1.75rem' }}>
              <div className="bank-delete-icon">
                <Trash2 size={26} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                Supprimer cette carte ?
              </h2>
              <p>
                Êtes-vous sûr de supprimer cette carte ? La suppression de la carte sera définitive.
              </p>
            </div>
            <div className="bank-modal-footer" style={{ justifyContent: 'center' }}>
              <button type="button" className="bank-btn-cancel" onClick={() => setDeleteTarget(null)}>
                Annuler
              </button>
              <button type="button" className="bank-btn-delete" onClick={confirmDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ajout — étapes */}
      {addOpen && (
        <div className="bank-modal-overlay">
          <div className="bank-modal" onClick={(e) => e.stopPropagation()}>
            {addStep === 1 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAddStep(2);
                }}
              >
                <div className="bank-modal-header">
                  <div className="bank-modal-header-text">
                    <h2>Nouveau compte bancaire</h2>
                    <p>Ajoutez votre compte en toute sécurité</p>
                  </div>
                  <button type="button" className="bank-drawer-close" onClick={closeAdd} aria-label="Fermer">
                    ×
                  </button>
                </div>
                <div className="bank-modal-body">
                  <div className="bank-form-grid">
                    <div className="bank-field full">
                      <label>
                        Nom de votre banque <span className="req">*</span>
                      </label>
                      <input
                        required
                        placeholder="ex. Attijari, Flouci…"
                        value={step1.bankName}
                        onChange={(e) => setStep1({ ...step1, bankName: e.target.value })}
                      />
                    </div>
                    <div className="bank-field full">
                      <label>
                        Votre agence <span className="req">*</span>
                      </label>
                      <input
                        required
                        placeholder="ex. Menzah 1"
                        value={step1.agency}
                        onChange={(e) => setStep1({ ...step1, agency: e.target.value })}
                      />
                    </div>
                    <div className="bank-field">
                      <label>
                        Type du compte <span className="req">*</span>
                      </label>
                      <select
                        value={step1.accountType}
                        onChange={(e) => setStep1({ ...step1, accountType: e.target.value })}
                      >
                        <option>Courant</option>
                        <option>Epargne</option>
                      </select>
                    </div>
                    <div className="bank-field">
                      <label>
                        Pack <span className="req">*</span>
                      </label>
                      <select value={step1.pack} onChange={(e) => setStep1({ ...step1, pack: e.target.value })}>
                        <option>Gold</option>
                        <option>Silver</option>
                        <option>Standard</option>
                      </select>
                    </div>
                    <div className="bank-field full">
                      <label>
                        RIB <span className="req">*</span>
                      </label>
                      <input
                        required
                        placeholder="Numéro RIB"
                        value={step1.rib}
                        onChange={(e) => setStep1({ ...step1, rib: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="bank-modal-footer">
                  <button type="button" className="bank-btn-cancel" onClick={closeAdd}>
                    Annuler
                  </button>
                  <button type="submit" className="bank-btn-submit">
                    Suivant
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="bank-modal-header">
                  <div className="bank-modal-header-text">
                    <h2>Entrez vos identifiants</h2>
                    <p>Connexion sécurisée à votre espace bancaire</p>
                  </div>
                  <button type="button" className="bank-drawer-close" onClick={closeAdd} aria-label="Fermer">
                    ×
                  </button>
                </div>
                <div className="bank-modal-body">
                  <div className="bank-field full" style={{ marginBottom: '1rem' }}>
                    <label>Login</label>
                    <input
                      autoComplete="username"
                      placeholder="Identifiant"
                      value={step2.login}
                      onChange={(e) => setStep2({ ...step2, login: e.target.value })}
                    />
                  </div>
                  <div className="bank-field full">
                    <label>Mot de passe</label>
                    <div className="bank-password-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={step2.password}
                        onChange={(e) => setStep2({ ...step2, password: e.target.value })}
                      />
                      <button
                        type="button"
                        className="bank-password-toggle"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Masquer' : 'Afficher'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="bank-modal-footer">
                  <button type="button" className="bank-btn-cancel" onClick={() => setAddStep(1)}>
                    Retour
                  </button>
                  <button type="button" className="bank-btn-submit" onClick={submitCreate}>
                    Créer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Succès */}
      {addSuccessOpen && (
        <div className="bank-modal-overlay">
          <div className="bank-modal bank-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bank-modal-body bank-success-modal">
              <div className="bank-success-card-icon">VISA</div>
              <h3>Votre carte a été enregistrée avec succès !</h3>
              <button type="button" className="bank-btn-submit" style={{ width: '100%' }} onClick={() => setAddSuccessOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifier */}
      {editOpen && detailAccount && (
        <div className="bank-modal-overlay">
          <form className="bank-modal" onSubmit={submitEdit} onClick={(e) => e.stopPropagation()}>
            <div className="bank-modal-header">
              <div className="bank-modal-header-text">
                <h2>Modifier vos informations bancaires</h2>
                <p>Ajoutez votre compte en toute sécurité</p>
              </div>
              <button
                type="button"
                className="bank-drawer-close"
                onClick={() => setEditOpen(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <div className="bank-modal-body">
              <div className="bank-form-grid">
                <div className="bank-field">
                  <label>
                    Nom de votre banque <span className="req">*</span>
                  </label>
                  <input
                    required
                    value={editForm.bankName}
                    onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                  />
                </div>
                <div className="bank-field">
                  <label>
                    Votre agence <span className="req">*</span>
                  </label>
                  <input
                    required
                    value={editForm.agency}
                    onChange={(e) => setEditForm({ ...editForm, agency: e.target.value })}
                  />
                </div>
                <div className="bank-field">
                  <label>
                    Type du compte <span className="req">*</span>
                  </label>
                  <select
                    value={editForm.accountType}
                    onChange={(e) => setEditForm({ ...editForm, accountType: e.target.value })}
                  >
                    <option>Courant</option>
                    <option>Epargne</option>
                  </select>
                </div>
                <div className="bank-field">
                  <label>
                    Pack <span className="req">*</span>
                  </label>
                  <select value={editForm.pack} onChange={(e) => setEditForm({ ...editForm, pack: e.target.value })}>
                    <option>Gold</option>
                    <option>Silver</option>
                    <option>Standard</option>
                  </select>
                </div>
                <div className="bank-field full">
                  <label>
                    RIB <span className="req">*</span>
                  </label>
                  <input
                    required
                    value={editForm.rib}
                    onChange={(e) => setEditForm({ ...editForm, rib: e.target.value })}
                  />
                </div>
                <div className="bank-field">
                  <label>Login</label>
                  <input
                    value={editForm.login}
                    onChange={(e) => setEditForm({ ...editForm, login: e.target.value })}
                  />
                </div>
                <div className="bank-field">
                  <label>Nouveau mot de passe</label>
                  <input
                    type="password"
                    placeholder="Laisser vide pour ne pas changer"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="bank-modal-footer">
              <button type="button" className="bank-btn-cancel" onClick={() => setEditOpen(false)}>
                Annuler
              </button>
              <button type="submit" className="bank-btn-submit">
                Suivant
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
