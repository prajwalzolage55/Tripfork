'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTripId } from '@/lib/trip-routing';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getEventStream,
  replayEvents,
  appendEvent,
  type LedgerEvent,
  type TripState,
  type PaymentState,
  type RoutedTransfer,
  type SettlementRoutingPlan,
  type RawDebtEdge,
  type PendingVendorRefund,
  type DisputedDebtItem,
  type OrganizerFrontedItem,
  type NonCashVoucher,
  PAYMENT_STATE_META,
  getPaymentStateMeta,
  computeSettlementRouting,
  getSection7BenchmarkScenario,
} from '@/lib/ledger';
import {
  ArrowRightLeft, ArrowRight, ShieldCheck, CheckCircle2, Clock, AlertCircle,
  Building2, Ticket, HelpCircle, ExternalLink, QrCode, DollarSign,
  TrendingDown, Layers, Sparkles, RefreshCw, Plus, X, FileText, User,
  Check, Info, ChevronRight, Filter, Eye, Zap, Loader2
} from 'lucide-react';

const COLORS = {
  burgundy: '#0f172a',
  burgundyLight: '#1e293b',
  burgundyPale: '#f1f5f9',
  cream: '#f8fafc',
  creamDark: '#e2e8f0',
  offWhite: '#ffffff',
  rose: '#2563eb',
  rosePale: '#eff6ff',
  deepWine: '#0f172a',
};

export default function SettlementRouterPage() {
  const tripId = useTripId();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [state, setState] = useState<TripState | null>(null);

  const [activeTab, setActiveTab] = useState<'router' | 'graph_view' | 'benchmark'>('router');
  const [filterState, setFilterState] = useState<PaymentState | 'all'>('all');

  const [customRefunds, setCustomRefunds] = useState<PendingVendorRefund[]>([]);
  const [customDisputes, setCustomDisputes] = useState<DisputedDebtItem[]>([]);
  const [customVouchers, setCustomVouchers] = useState<NonCashVoucher[]>([]);

  const [showAddRefundModal, setShowAddRefundModal] = useState(false);
  const [showAddDisputeModal, setShowAddDisputeModal] = useState(false);
  const [showAddVoucherModal, setShowAddVoucherModal] = useState(false);
  const [selectedQRTransfer, setSelectedQRTransfer] = useState<RoutedTransfer | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const [newVendorName, setNewVendorName] = useState('Grand Hotel');
  const [newRefundAmount, setNewRefundAmount] = useState('700');
  const [newRefundRecipient, setNewRefundRecipient] = useState('');
  const [newRefundReason, setNewRefundReason] = useState('Hotel room cancellation refund (pending)');

  const [newDisputeExpenseId, setNewDisputeExpenseId] = useState('');
  const [newDisputeReason, setNewDisputeReason] = useState('Alcohol split should not apply to non-drinkers');

  const [newVoucherIssuer, setNewVoucherIssuer] = useState('IndiGo Airlines');
  const [newVoucherValue, setNewVoucherValue] = useState('2400');
  const [newVoucherHolder, setNewVoucherHolder] = useState('');
  const [newVoucherNotes, setNewVoucherNotes] = useState('Non-refundable flight credit voucher');

  const loadData = useCallback(async () => {
    if (!tripId) return;
    try {
      setLoading(true);
      const stream = await getEventStream(tripId);
      setEvents(stream);
      if (stream.length > 0) {
        const derived = replayEvents(tripId, stream);
        setState(derived);
      }
    } catch (err) {
      console.error('Failed to load Settlement Router data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (state?.members && state.members.length > 0) {
      if (!newRefundRecipient) setNewRefundRecipient(state.members[0].memberId);
      if (!newVoucherHolder) setNewVoucherHolder(state.members[0].memberId);
      if (!newDisputeExpenseId && state.expenses.length > 0) {
        setNewDisputeExpenseId(state.expenses[0].expenseId);
      }
    }
  }, [state, newRefundRecipient, newVoucherHolder, newDisputeExpenseId]);

  const plan: SettlementRoutingPlan | null = useMemo(() => {
    if (!state || state.members.length === 0) return null;
    return computeSettlementRouting(state, { customRefunds, customDisputes, customVouchers });
  }, [state, customRefunds, customDisputes, customVouchers]);

  const benchmarkData = useMemo(() => {
    const memberA = state?.members[0]?.displayName || 'Alice';
    const memberB = state?.members[1]?.displayName || 'Bob';
    const memberC = state?.members[2]?.displayName || 'Charlie';
    return getSection7BenchmarkScenario({ a: memberA, b: memberB, c: memberC });
  }, [state]);

  const handleMarkAsPaid = async (transfer: RoutedTransfer) => {
    if (!state) return;
    try {
      await appendEvent(tripId, 'PAYMENT_MADE', user?.id || transfer.fromMemberId, {
        settlementId: transfer.id, fromMemberId: transfer.fromMemberId, toMemberId: transfer.toMemberId,
        amount: transfer.amount, currency: 'INR', method: 'upi', upiTransactionId: `UPI-${Date.now().toString(36).toUpperCase()}`,
      });
      setActionSuccessMsg(`Recorded payment of ₹${transfer.amount.toLocaleString('en-IN')} from ${transfer.fromMemberName} to ${transfer.toMemberName}!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadData();
    } catch (err) { console.error(err); }
  };

  const handleRecordRefundReceived = async (refund: PendingVendorRefund) => {
    if (!state) return;
    try {
      await appendEvent(tripId, 'REFUND_RECEIVED', user?.id || refund.recipientMemberId, {
        refundId: `ref-${Date.now()}`, linkedItemId: refund.linkedItemId || 'vendor-claim',
        amount: refund.amount, currency: 'INR', receivedByMemberId: refund.recipientMemberId, vendorName: refund.vendorName, isFullRefund: true,
      });
      setCustomRefunds(prev => prev.filter(r => r.id !== refund.id));
      setActionSuccessMsg(`Recorded ₹${refund.amount.toLocaleString('en-IN')} refund received from ${refund.vendorName}! Router will now redistribute.`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
      await loadData();
    } catch (err) { console.error(err); }
  };

  const handleAddCustomRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefundAmount || isNaN(Number(newRefundAmount))) return;
    const recipient = state?.members.find(m => m.memberId === newRefundRecipient);
    const newRefund: PendingVendorRefund = {
      id: `custom-ref-${Date.now()}`, vendorName: newVendorName.trim() || 'Vendor', recipientMemberId: newRefundRecipient,
      recipientName: recipient?.displayName || 'Traveler', amount: Number(newRefundAmount), status: 'pending', reason: newRefundReason.trim() || 'Pending vendor refund',
    };
    setCustomRefunds(prev => [...prev, newRefund]);
    setShowAddRefundModal(false);
    setActionSuccessMsg(`Added in-flight refund claim: ${newRefund.vendorName} owes ₹${newRefund.amount} to ${newRefund.recipientName}`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleAddCustomDispute = (e: React.FormEvent) => {
    e.preventDefault();
    const exp = state?.expenses.find(x => x.expenseId === newDisputeExpenseId);
    if (!exp) return;
    const disputerId = exp.participantMemberIds[0] || state?.members[0]?.memberId || 'disputer';
    const disputer = state?.members.find(m => m.memberId === disputerId);
    const newDisp: DisputedDebtItem = {
      id: `custom-disp-${Date.now()}`, expenseId: exp.expenseId, expenseLabel: exp.note || `Expense of ₹${exp.amount}`,
      disputerMemberId: disputerId, disputerName: disputer?.displayName || 'Participant', disputedAmount: exp.amount, reason: newDisputeReason.trim() || 'Contested share', status: 'active_review',
    };
    setCustomDisputes(prev => [...prev, newDisp]);
    setShowAddDisputeModal(false);
    setActionSuccessMsg(`Flagged expense "${newDisp.expenseLabel}" as Disputed. Router isolated ₹${newDisp.disputedAmount}.`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const handleAddCustomVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoucherValue || isNaN(Number(newVoucherValue))) return;
    const holder = state?.members.find(m => m.memberId === newVoucherHolder);
    const newV: NonCashVoucher = {
      id: `custom-v-${Date.now()}`, issuer: newVoucherIssuer.trim() || 'Airline', holderMemberId: newVoucherHolder,
      holderName: holder?.displayName || 'Traveler', value: Number(newVoucherValue), isTransferable: false, notes: newVoucherNotes.trim() || 'Credit voucher',
    };
    setCustomVouchers(prev => [...prev, newV]);
    setShowAddVoucherModal(false);
    setActionSuccessMsg(`Recorded ₹${newV.value} voucher from ${newV.issuer} held by ${newV.holderName}`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: COLORS.burgundy }}>
        <Loader2 className="animate-spin" size={36} style={{ color: COLORS.rose }} />
        <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Running Minimum-Transaction Router...</p>
      </div>
    );
  }

  const displayedTransfers = plan?.transfers.filter(t => filterState === 'all' || t.state === filterState) || [];

  const tabStyle = (id: string) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem',
    borderRadius: '0.75rem', fontSize: '0.7rem', fontWeight: 700,
    background: activeTab === id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.1)',
    color: activeTab === id ? COLORS.burgundy : 'rgba(255,255,255,0.8)',
    border: activeTab === id ? 'none' : '1px solid rgba(255,255,255,0.15)',
    cursor: 'pointer', transition: 'all 0.2s',
  });

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* ─── Hero Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: `linear-gradient(135deg, ${COLORS.burgundy} 0%, ${COLORS.burgundyLight} 50%, ${COLORS.rose} 100%)`,
          borderRadius: '1.25rem', padding: '2rem', color: 'white', position: 'relative', overflow: 'hidden', marginBottom: '1.5rem',
        }}
      >
        <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.15)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}>
              <ArrowRightLeft size={13} /> Section 7 · Graph-Simplification Settlement Router
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>Minimum-Transaction Graph Router</h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', marginTop: '0.5rem', maxWidth: '36rem', lineHeight: 1.6 }}>
              Models obligations as a weighted directed graph and executes debt netting — factoring in-flight vendor refunds to minimize actual transfers.
            </p>
          </div>
        </div>

        {plan && (
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', borderRadius: '1rem', background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.9) 0%, rgba(253, 230, 138, 0.7) 100%)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '1rem', color: '#92400e' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(245,158,11,0.2)' }}>
              <Zap size={20} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#b45309' }}>Router Advisory</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0.125rem 0' }}>"{plan.routerAdvisory}"</div>
              <div style={{ fontSize: '0.75rem', color: '#78350f' }}>
                {plan.savingsCount > 0 ? <span>Eliminated <strong>{plan.savingsCount} redundant transfers</strong> ({plan.savingsPercent}% reduction).</span> : <span>Optimal minimal-path graph calculated.</span>}
              </div>
            </div>
          </div>
        )}

        {actionSuccessMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '0.75rem', fontSize: '0.8rem', fontWeight: 600, marginTop: '1rem' }}>
            <CheckCircle2 size={16} /> {actionSuccessMsg}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => setActiveTab('router')} style={tabStyle('router')}><ArrowRightLeft size={13} /> Live Settlement Plan</button>
          <button onClick={() => setActiveTab('graph_view')} style={tabStyle('graph_view')}><Layers size={13} /> Raw vs Netted Graph</button>
          <button onClick={() => setActiveTab('benchmark')} style={tabStyle('benchmark')}><Sparkles size={13} /> Section 7 Benchmark</button>
        </div>
      </motion.div>

      {/* Metrics Bar */}
      {plan && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Raw Pairwise Debts', value: plan.rawTransferCount, icon: TrendingDown, color: COLORS.burgundyLight },
            { label: 'Optimized Transfers', value: plan.optimizedTransferCount, icon: ArrowRightLeft, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
            { label: 'Transactions Saved', value: plan.savingsCount, icon: Zap, color: '#d97706' },
            { label: 'Instant Pay Now', value: `₹${plan.totalPayNowAmount.toLocaleString()}`, icon: DollarSign, color: '#059669' },
            { label: 'Pending Credits', value: `₹${plan.totalPendingRefundAmount.toLocaleString()}`, icon: Building2, color: '#0891b2' },
          ].map(m => (
            <div key={m.label} style={{ padding: '1rem', borderRadius: '1rem', background: m.bg || 'white', border: `1px solid ${m.border || COLORS.cream}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.burgundy }}>{m.label}</span>
                <m.icon size={14} style={{ color: m.color }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: m.color === COLORS.burgundyLight ? COLORS.burgundy : m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ─── TAB 1: LIVE SETTLEMENT PLAN ─── */}
      <AnimatePresence mode="wait">
        {activeTab === 'router' && plan && (
          <motion.div key="router" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            
            {/* Filter and Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                <button
                  onClick={() => setFilterState('all')}
                  style={{
                    padding: '0.4rem 0.875rem', borderRadius: '0.75rem', fontSize: '0.7rem', fontWeight: 700,
                    background: filterState === 'all' ? COLORS.burgundy : 'white',
                    color: filterState === 'all' ? 'white' : COLORS.burgundy, border: `1px solid ${COLORS.cream}`, cursor: 'pointer'
                  }}
                >
                  All ({plan.transfers.length + plan.vendorObligations.length + plan.disputedItems.length + plan.organizerItems.length + plan.vouchers.length})
                </button>
                {(Object.keys(PAYMENT_STATE_META) as PaymentState[]).map(ps => {
                  const meta = getPaymentStateMeta(ps);
                  const count = plan.stateSummary[ps] || 0;
                  return (
                    <button
                      key={ps} onClick={() => setFilterState(ps)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        padding: '0.4rem 0.875rem', borderRadius: '0.75rem', fontSize: '0.7rem', fontWeight: 700,
                        background: filterState === ps ? COLORS.burgundy : 'white',
                        color: filterState === ps ? 'white' : COLORS.burgundy, border: `1px solid ${COLORS.cream}`, cursor: 'pointer'
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dotColor }} />
                      {meta.label} <span style={{ padding: '0.1rem 0.4rem', borderRadius: '9999px', background: filterState === ps ? 'rgba(255,255,255,0.2)' : COLORS.burgundyPale, fontSize: '0.65rem' }}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { label: 'Vendor Refund', icon: Plus, action: () => setShowAddRefundModal(true) },
                  { label: 'Flag Dispute', icon: AlertCircle, action: () => setShowAddDisputeModal(true) },
                  { label: 'Voucher', icon: Ticket, action: () => setShowAddVoucherModal(true) },
                ].map(btn => (
                  <button key={btn.label} onClick={btn.action} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.45rem 0.875rem', borderRadius: '0.75rem', background: 'white', color: COLORS.burgundy, fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${COLORS.cream}`, cursor: 'pointer' }}>
                    <btn.icon size={13} /> {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Guide */}
            <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', border: `1px solid ${COLORS.cream}`, marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', fontWeight: 800, color: COLORS.burgundyLight, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.875rem' }}>
                <Info size={14} /> Section 7 Payment State Classification Reference
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {(Object.keys(PAYMENT_STATE_META) as PaymentState[]).map(ps => {
                  const meta = getPaymentStateMeta(ps);
                  return (
                    <div key={ps} style={{ padding: '0.875rem', borderRadius: '0.75rem', border: `1px solid ${meta.borderLight}`, background: meta.bgLight }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem', fontSize: '0.75rem', fontWeight: 800, color: meta.textColor }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dotColor }} /> {meta.label}
                      </div>
                      <p style={{ fontSize: '0.7rem', color: COLORS.burgundyLight, margin: 0, lineHeight: 1.5 }}>{meta.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Transfers List */}
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: COLORS.burgundy, marginBottom: '0.25rem' }}>Routed Transfers ({displayedTransfers.length})</h2>
              <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1.25rem' }}>{filterState === 'all' ? 'All simplified graph transfers' : `Filtered by: ${getPaymentStateMeta(filterState).label}`}</p>
              
              {displayedTransfers.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '1rem', border: `1px dashed ${COLORS.cream}` }}>
                  <CheckCircle2 size={36} style={{ color: '#10b981', margin: '0 auto 0.75rem' }} />
                  <p style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>No transfers match this state.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {displayedTransfers.map(t => {
                    const meta = getPaymentStateMeta(t.state);
                    return (
                      <div key={t.id} style={{ background: t.settled ? '#f8fafc' : 'white', opacity: t.settled ? 0.75 : 1, border: `1px solid ${COLORS.cream}`, borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: `1px solid ${COLORS.cream}`, paddingBottom: '1rem', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: COLORS.burgundyPale, color: COLORS.burgundy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', margin: '0 auto 0.25rem' }}>{t.fromMemberName.charAt(0)}</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t.fromMemberName}</div>
                              <div style={{ fontSize: '0.6rem', color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Debtor</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1rem' }}>
                              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: COLORS.burgundy }}>₹{t.amount.toLocaleString()}</span>
                              <ArrowRight size={16} style={{ color: '#10b981', margin: '0.25rem 0' }} />
                              <span style={{ fontSize: '0.6rem', color: '#aaa', textTransform: 'uppercase', fontWeight: 600 }}>Transfers To</span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', margin: '0 auto 0.25rem' }}>{t.toMemberName.charAt(0)}</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t.toMemberName}</div>
                              <div style={{ fontSize: '0.6rem', color: '#059669', textTransform: 'uppercase', fontWeight: 700 }}>Creditor</div>
                            </div>
                          </div>
                          <div style={{ padding: '0.4rem 0.875rem', borderRadius: '9999px', background: meta.bgLight, border: `1px solid ${meta.borderLight}`, color: meta.textColor, fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dotColor }} /> {meta.label}
                          </div>
                        </div>

                        <div style={{ padding: '0.875rem', borderRadius: '0.75rem', background: COLORS.burgundyPale + '40', border: `1px solid ${COLORS.cream}`, marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', fontWeight: 700, color: meta.textColor, marginBottom: '0.25rem' }}>
                            <Info size={13} /> Router Rationale:
                          </div>
                          <p style={{ fontSize: '0.75rem', color: COLORS.burgundy, margin: 0 }}>{t.stateReason}</p>
                          {t.pendingRefund && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem', borderRadius: '0.5rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.75rem', marginTop: '0.625rem' }}>
                              <Building2 size={14} style={{ color: '#d97706' }} />
                              <strong>Blocking Refund:</strong> {t.pendingRefund.vendorName} owes ₹{t.pendingRefund.amount.toLocaleString()} to {t.pendingRefund.recipientName} ({t.pendingRefund.reason}).
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                          {t.settled ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}><Check size={14} /> Settled in Ledger</span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}><Clock size={14} /> Pending Transfer</span>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {t.state === 'pay_now' && !t.settled && (
                              <>
                                {t.upiLink && (
                                  <a href={t.upiLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.625rem', background: '#10b981', color: 'white', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}>
                                    <ExternalLink size={13} /> Pay via UPI
                                  </a>
                                )}
                                <button onClick={() => setSelectedQRTransfer(t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '0.625rem', background: 'white', border: `1px solid ${COLORS.cream}`, cursor: 'pointer' }}><QrCode size={14} /></button>
                              </>
                            )}
                            {t.state === 'pay_after_refund' && !t.settled && (
                              <button onClick={() => { if (t.pendingRefund) handleRecordRefundReceived(t.pendingRefund); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.625rem', background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                                <Building2 size={13} /> Simulate Refund Received
                              </button>
                            )}
                            {!t.settled && (
                              <button onClick={() => handleMarkAsPaid(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.625rem', background: 'white', border: `1px solid ${COLORS.cream}`, color: COLORS.burgundy, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                                <Check size={13} /> Mark Paid
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Auxiliary Lists */}
            {(plan.vendorObligations.length > 0 || plan.disputedItems.length > 0 || plan.organizerItems.length > 0 || plan.vouchers.length > 0) && (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                {[
                  { key: 'vendor', title: 'Vendor Owes (External Parties)', items: plan.vendorObligations, dot: '#06b6d4', badgeClass: { bg: '#cffafe', color: '#0891b2' } },
                  { key: 'dispute', title: 'Provisionally Disputed', items: plan.disputedItems, dot: '#f43f5e', badgeClass: { bg: '#ffe4e6', color: '#e11d48' } },
                  { key: 'organizer', title: 'Covered by Organizer', items: plan.organizerItems, dot: '#6366f1', badgeClass: { bg: '#e0e7ff', color: '#4f46e5' } },
                  { key: 'voucher', title: 'Non-Cash Vouchers', items: plan.vouchers, dot: '#a855f7', badgeClass: { bg: '#f3e8ff', color: '#9333ea' } },
                ].filter(s => s.items.length > 0).map(section => (
                  <div key={section.key} style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', border: `1px solid ${COLORS.cream}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.burgundy, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: section.dot }} /> {section.title}
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>{section.items.length} items</span>
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {section.items.map((item: any) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '0.875rem 1rem', borderRadius: '0.75rem', background: COLORS.burgundyPale + '30', border: `1px solid ${COLORS.cream}` }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: COLORS.burgundy, marginBottom: '0.125rem' }}>{item.vendorName || item.expenseLabel || item.label || item.issuer}</div>
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>Amount: ₹{item.amount || item.disputedAmount || item.value} · {item.reason || item.notes}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', ...section.badgeClass }}>{section.title}</span>
                            {section.key === 'vendor' && <button onClick={() => handleRecordRefundReceived(item)} style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', background: '#0891b2', color: 'white', fontSize: '0.7rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Mark Credited</button>}
                            {section.key === 'dispute' && <button onClick={() => { setCustomDisputes(prev => prev.filter(d => d.id !== item.id)); }} style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', background: 'white', color: COLORS.burgundy, fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${COLORS.cream}`, cursor: 'pointer' }}>Resolve</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── TAB 2: GRAPH COMPARISON ─── */}
      <AnimatePresence mode="wait">
        {activeTab === 'graph_view' && plan && (
          <motion.div key="graph" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: `1px solid ${COLORS.cream}` }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: COLORS.burgundy }}>Debt-Netting Graph Reduction</h2>
                <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>Compare unsimplified peer debts against the Routed Graph.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '9999px', background: COLORS.burgundyPale, border: `1px solid ${COLORS.cream}`, fontSize: '0.8rem', fontWeight: 700, color: COLORS.burgundy }}>
                {plan.rawTransferCount} <ArrowRight size={14} /> <span style={{ color: '#059669' }}>{plan.optimizedTransferCount} transfers</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              <div style={{ padding: '1.5rem', borderRadius: '1rem', background: COLORS.burgundyPale + '30', border: `1px solid ${COLORS.cream}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.burgundy }}>1. Raw Graph ({plan.rawTransferCount})</h3>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '9999px', background: '#f1f5f9', color: '#475569' }}>Before</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1rem' }}>Bilateral claims from every individual expense.</p>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {plan.rawEdges.map(e => (
                    <div key={e.id} style={{ padding: '1rem', borderRadius: '0.75rem', background: 'white', border: `1px solid ${COLORS.cream}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontWeight: 700, color: COLORS.burgundy, marginBottom: '0.25rem' }}>{e.fromName} <ArrowRight size={12} style={{ color: '#aaa' }} /> {e.toName}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: COLORS.burgundy }}>₹{e.amount.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '1.5rem', borderRadius: '1rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(16,185,129,0.01) 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#064e3b' }}>2. Optimized Graph ({plan.optimizedTransferCount})</h3>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '9999px', background: '#ecfdf5', color: '#047857' }}>Netted</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#065f46', marginBottom: '1rem' }}>Cycles cancelled. {plan.savingsCount} transfers eliminated.</p>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {plan.transfers.map(t => (
                    <div key={t.id} style={{ padding: '1rem', borderRadius: '0.75rem', background: 'white', border: '1px solid #a7f3d0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontWeight: 700, color: '#064e3b', marginBottom: '0.25rem' }}>{t.fromMemberName} <ArrowRight size={12} style={{ color: '#10b981' }} /> {t.toMemberName}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#047857' }}>₹{t.amount.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── TAB 3: BENCHMARK ─── */}
      <AnimatePresence mode="wait">
        {activeTab === 'benchmark' && (
          <motion.div key="benchmark" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Sparkles size={24} style={{ color: '#f59e0b' }} />
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: COLORS.burgundy }}>Section 7 Specification Benchmark</h2>
                <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.125rem' }}>Executing the exact canonical example defined in the architecture document.</p>
              </div>
            </div>

            <div style={{ padding: '1.25rem', borderRadius: '0.75rem', background: COLORS.burgundy, color: COLORS.cream, fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              EXAMPLE (FROM ARCHITECTURE SPEC)<br/>
              ---------------------------------<br/>
                A owes B:     Rs 2,000<br/>
                B owes C:     Rs 1,500<br/>
                C owes A:     Rs 1,000<br/>
                Hotel owes B: Rs 700 refund (pending)<br/>
              <br/>
                Router output: "Wait for the hotel refund, then complete 2 transfers instead of 5."
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
              <div style={{ padding: '1.25rem', borderRadius: '0.875rem', background: COLORS.burgundyPale + '30', border: `1px solid ${COLORS.cream}` }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: COLORS.burgundy, marginBottom: '0.75rem' }}>Initial Obligations</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.75rem', display: 'grid', gap: '0.5rem', color: '#666' }}>
                  <li>{benchmarkData.state.members[0].displayName} owes {benchmarkData.state.members[1].displayName}: <strong>₹2,000</strong></li>
                  <li>{benchmarkData.state.members[1].displayName} owes {benchmarkData.state.members[2].displayName}: <strong>₹1,500</strong></li>
                  <li>{benchmarkData.state.members[2].displayName} owes {benchmarkData.state.members[0].displayName}: <strong>₹1,000</strong></li>
                  <li style={{ color: '#0891b2' }}>Grand Hotel owes {benchmarkData.state.members[1].displayName}: <strong>₹700</strong> (Pending)</li>
                </ul>
              </div>
              
              <div style={{ padding: '1.25rem', borderRadius: '0.875rem', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#064e3b', marginBottom: '0.75rem' }}>Router Routing Decision</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.75rem', display: 'grid', gap: '0.5rem', color: '#065f46' }}>
                  <li>
                    <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#047857', marginBottom: '0.25rem' }}>Pay Now</span>
                    <p style={{ margin: 0 }}>{benchmarkData.state.members[0].displayName} → {benchmarkData.state.members[2].displayName}: ₹500 (Debt clear)</p>
                  </li>
                  <li>
                    <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#b45309', marginBottom: '0.25rem' }}>Pay After Refund</span>
                    <p style={{ margin: 0 }}>{benchmarkData.state.members[0].displayName} → {benchmarkData.state.members[1].displayName}: ₹500 (Hold for ₹700 hotel refund)</p>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared Modal Styling */}
      {(() => {
        const modalBackdrop = { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(121,21,35,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' };
        const modalContent = { background: 'white', borderRadius: '1rem', width: '100%', maxWidth: '420px', padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
        const inputStyle = { width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', border: `1.5px solid ${COLORS.cream}`, fontSize: '0.8rem', fontFamily: 'inherit', marginTop: '0.375rem', outline: 'none' };
        const labelStyle = { fontSize: '0.75rem', fontWeight: 700, color: COLORS.burgundy };
        const btnBase = { padding: '0.625rem 1rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: 'none' };

        return (
          <>
            {showAddRefundModal && (
              <div style={modalBackdrop}>
                <div style={modalContent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}><h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: COLORS.burgundy }}>Add Vendor Refund Claim</h3><X size={18} onClick={() => setShowAddRefundModal(false)} style={{ cursor: 'pointer', color: '#888' }} /></div>
                  <form onSubmit={handleAddCustomRefund}>
                    <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>External Vendor Name</label><input style={inputStyle} value={newVendorName} onChange={e => setNewVendorName(e.target.value)} required /></div>
                    <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Expected Refund Amount (₹)</label><input type="number" style={inputStyle} value={newRefundAmount} onChange={e => setNewRefundAmount(e.target.value)} required /></div>
                    <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Recipient Traveler</label><select style={inputStyle} value={newRefundRecipient} onChange={e => setNewRefundRecipient(e.target.value)}>{state?.members.map(m => <option key={m.memberId} value={m.memberId}>{m.displayName}</option>)}</select></div>
                    <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Reason</label><input style={inputStyle} value={newRefundReason} onChange={e => setNewRefundReason(e.target.value)} /></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                      <button type="button" onClick={() => setShowAddRefundModal(false)} style={{ ...btnBase, background: 'transparent', border: `1px solid ${COLORS.cream}`, color: COLORS.burgundy }}>Cancel</button>
                      <button type="submit" style={{ ...btnBase, background: COLORS.burgundy, color: 'white' }}>Add Claim</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {showAddDisputeModal && (
              <div style={modalBackdrop}>
                <div style={modalContent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}><h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: COLORS.burgundy }}>Flag Dispute</h3><X size={18} onClick={() => setShowAddDisputeModal(false)} style={{ cursor: 'pointer', color: '#888' }} /></div>
                  <form onSubmit={handleAddCustomDispute}>
                    <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Contested Expense</label><select style={inputStyle} value={newDisputeExpenseId} onChange={e => setNewDisputeExpenseId(e.target.value)}>{state?.expenses.map(exp => <option key={exp.expenseId} value={exp.expenseId}>{exp.note || 'Expense'} — ₹{exp.amount}</option>)}</select></div>
                    <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Rationale</label><textarea rows={3} style={inputStyle} value={newDisputeReason} onChange={e => setNewDisputeReason(e.target.value)} required /></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                      <button type="button" onClick={() => setShowAddDisputeModal(false)} style={{ ...btnBase, background: 'transparent', border: `1px solid ${COLORS.cream}`, color: COLORS.burgundy }}>Cancel</button>
                      <button type="submit" style={{ ...btnBase, background: COLORS.burgundy, color: 'white' }}>Flag Dispute</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {showAddVoucherModal && (
              <div style={modalBackdrop}>
                <div style={modalContent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}><h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: COLORS.burgundy }}>Add Voucher</h3><X size={18} onClick={() => setShowAddVoucherModal(false)} style={{ cursor: 'pointer', color: '#888' }} /></div>
                  <form onSubmit={handleAddCustomVoucher}>
                    <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Issuer</label><input style={inputStyle} value={newVoucherIssuer} onChange={e => setNewVoucherIssuer(e.target.value)} required /></div>
                    <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Value (₹)</label><input type="number" style={inputStyle} value={newVoucherValue} onChange={e => setNewVoucherValue(e.target.value)} required /></div>
                    <div style={{ marginBottom: '1rem' }}><label style={labelStyle}>Holder</label><select style={inputStyle} value={newVoucherHolder} onChange={e => setNewVoucherHolder(e.target.value)}>{state?.members.map(m => <option key={m.memberId} value={m.memberId}>{m.displayName}</option>)}</select></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                      <button type="button" onClick={() => setShowAddVoucherModal(false)} style={{ ...btnBase, background: 'transparent', border: `1px solid ${COLORS.cream}`, color: COLORS.burgundy }}>Cancel</button>
                      <button type="submit" style={{ ...btnBase, background: COLORS.burgundy, color: 'white' }}>Add Voucher</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {selectedQRTransfer && (
              <div style={modalBackdrop} onClick={() => setSelectedQRTransfer(null)}>
                <div style={{ ...modalContent, textAlign: 'center', maxWidth: '320px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}><h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: COLORS.burgundy }}>UPI Payment</h3><X size={18} onClick={() => setSelectedQRTransfer(null)} style={{ cursor: 'pointer', color: '#888' }} /></div>
                  <div style={{ padding: '0.75rem', border: `1px solid ${COLORS.cream}`, borderRadius: '0.75rem', display: 'inline-block', marginBottom: '1rem' }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(selectedQRTransfer.upiLink || '')}`} width={220} height={220} alt="QR Code" />
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: COLORS.burgundy, marginBottom: '0.25rem' }}>₹{selectedQRTransfer.amount.toLocaleString()}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Pay to: <strong>{selectedQRTransfer.toMemberName}</strong></div>
                  <div style={{ fontSize: '0.7rem', color: '#aaa' }}>Scan with GPay, PhonePe, Paytm, etc.</div>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
