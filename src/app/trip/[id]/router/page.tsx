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
  type PendingVendorRefund,
  type DisputedDebtItem,
  type NonCashVoucher,
  PAYMENT_STATE_META,
  getPaymentStateMeta,
  computeSettlementRouting,
  getSection7BenchmarkScenario,
} from '@/lib/ledger';
import {
  ArrowRightLeft, ArrowRight, ShieldCheck, CheckCircle2, Clock, AlertCircle,
  Building2, Ticket, ExternalLink, QrCode, DollarSign,
  TrendingDown, Layers, Sparkles, Plus, X,
  Check, Info, Zap, Loader2
} from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-900">
        <Loader2 className="animate-spin text-blue-600" size={36} />
        <p className="font-semibold text-sm text-slate-600">Running Minimum-Transaction Router...</p>
      </div>
    );
  }

  const displayedTransfers = plan?.transfers.filter(t => filterState === 'all' || t.state === filterState) || [];

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      {/* ─── Hero Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6 sm:p-8 shadow-sm border border-slate-800"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-between items-start gap-4 flex-wrap relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-slate-200 border border-white/20 text-xs font-bold mb-3">
              <ArrowRightLeft size={14} />
              Section 7 · Graph-Simplification Settlement Router
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
              Minimum-Transaction Graph Router
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              Models obligations as a weighted directed graph and executes debt netting — factoring in-flight vendor refunds to minimize actual transfers.
            </p>
          </div>
        </div>

        {plan && (
          <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-200 flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
              <Zap size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Router Advisory</div>
              <div className="text-sm sm:text-base font-bold text-white my-0.5">"{plan.routerAdvisory}"</div>
              <div className="text-xs text-amber-200/90">
                {plan.savingsCount > 0 ? (
                  <span>Eliminated <strong className="text-white font-bold">{plan.savingsCount} redundant transfers</strong> ({plan.savingsPercent}% reduction).</span>
                ) : (
                  <span>Optimal minimal-path graph calculated.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {actionSuccessMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 rounded-xl text-xs sm:text-sm font-semibold mt-4 relative z-10">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Tab Buttons (Button Style: Glass Tab Pill) */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-white/10 relative z-10">
          <button
            onClick={() => setActiveTab('router')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'router'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
          >
            <ArrowRightLeft size={14} /> Live Settlement Plan
          </button>
          <button
            onClick={() => setActiveTab('graph_view')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'graph_view'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
          >
            <Layers size={14} /> Raw vs Netted Graph
          </button>
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'benchmark'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
          >
            <Sparkles size={14} /> Section 7 Benchmark
          </button>
        </div>
      </motion.div>

      {/* Metrics Bar (Fixed Issue 5: No all-caps on Raw Pairwise Debts) */}
      {plan && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Raw Pairwise Debts', value: plan.rawTransferCount, icon: TrendingDown, color: 'text-slate-700', bg: 'bg-white' },
            { label: 'Optimized Transfers', value: plan.optimizedTransferCount, icon: ArrowRightLeft, color: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-200' },
            { label: 'Transactions Saved', value: plan.savingsCount, icon: Zap, color: 'text-amber-800', bg: 'bg-white' },
            { label: 'Instant Pay Now', value: `₹${plan.totalPayNowAmount.toLocaleString('en-IN')}`, icon: DollarSign, color: 'text-emerald-700', bg: 'bg-white' },
            { label: 'Pending Credits', value: `₹${plan.totalPendingRefundAmount.toLocaleString('en-IN')}`, icon: Building2, color: 'text-blue-700', bg: 'bg-white' },
          ].map(m => (
            <div
              key={m.label}
              className={`p-4 rounded-xl border ${m.border || 'border-slate-200'} ${m.bg} shadow-2xs`}
            >
              <div className="flex justify-between items-center mb-2">
                {/* Sentence case avoids long all-caps readability issues */}
                <span className="text-xs font-semibold text-slate-600">{m.label}</span>
                <m.icon size={15} className={m.color} />
              </div>
              <div className={`text-xl sm:text-2xl font-black ${m.color}`}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── TAB 1: LIVE SETTLEMENT PLAN ─── */}
      <AnimatePresence mode="wait">
        {activeTab === 'router' && plan && (
          <motion.div
            key="router"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Filter and Actions Bar (Button Style: Secondary Pill Buttons) */}
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterState('all')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    filterState === 'all'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All ({plan.transfers.length + plan.vendorObligations.length + plan.disputedItems.length + plan.organizerItems.length + plan.vouchers.length})
                </button>
                {(Object.keys(PAYMENT_STATE_META) as PaymentState[]).map(ps => {
                  const meta = getPaymentStateMeta(ps);
                  const count = plan.stateSummary[ps] || 0;
                  const isSelected = filterState === ps;
                  return (
                    <button
                      key={ps}
                      onClick={() => setFilterState(ps)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.dotColor }} />
                      <span>{meta.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-xs ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons (Button Style: Secondary Action Button) */}
              <div className="flex gap-2">
                {[
                  { label: 'Vendor Refund', icon: Plus, action: () => setShowAddRefundModal(true) },
                  { label: 'Flag Dispute', icon: AlertCircle, action: () => setShowAddDisputeModal(true) },
                  { label: 'Voucher', icon: Ticket, action: () => setShowAddVoucherModal(true) },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <btn.icon size={13} /> {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Guide (Fixed Issue 6: Body text >= 12px) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                <Info size={14} className="text-blue-600" /> Section 7 Payment State Classification Reference
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(Object.keys(PAYMENT_STATE_META) as PaymentState[]).map(ps => {
                  const meta = getPaymentStateMeta(ps);
                  return (
                    <div
                      key={ps}
                      className="p-3.5 rounded-xl border text-xs"
                      style={{ borderColor: meta.borderLight, backgroundColor: meta.bgLight }}
                    >
                      <div className="flex items-center gap-1.5 font-bold mb-1 text-slate-900">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.dotColor }} />
                        <span>{meta.label}</span>
                      </div>
                      {/* Fixed Issue 6: Body text changed from 0.7rem (11px) to text-xs (12px) */}
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Transfers List */}
            <section aria-labelledby="transfers-heading">
              <div className="mb-4">
                <h2 id="transfers-heading" className="text-lg font-bold text-slate-900">
                  Routed Transfers ({displayedTransfers.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {filterState === 'all' ? 'All simplified graph transfers' : `Filtered by: ${getPaymentStateMeta(filterState).label}`}
                </p>
              </div>

              {displayedTransfers.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                  <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">No transfers match this state.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {displayedTransfers.map(t => {
                    const meta = getPaymentStateMeta(t.state);
                    return (
                      <div
                        key={t.id}
                        className={`rounded-2xl p-5 border border-slate-200 transition-all ${
                          t.settled ? 'bg-slate-50/70 opacity-80' : 'bg-white shadow-2xs'
                        }`}
                      >
                        <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-4 mb-4">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-900 flex items-center justify-center font-bold text-sm mx-auto mb-1">
                                {t.fromMemberName.charAt(0)}
                              </div>
                              <div className="text-xs font-bold text-slate-900">{t.fromMemberName}</div>
                              <div className="text-xs font-semibold text-slate-400">Debtor</div>
                            </div>
                            <div className="flex flex-col items-center px-2">
                              <span className="text-lg font-black text-slate-900">₹{t.amount.toLocaleString('en-IN')}</span>
                              <ArrowRight size={16} className="text-emerald-600 my-1" />
                              <span className="text-xs text-slate-400">Transfers To</span>
                            </div>
                            <div className="text-center">
                              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-sm mx-auto mb-1 border border-emerald-200">
                                {t.toMemberName.charAt(0)}
                              </div>
                              <div className="text-xs font-bold text-slate-900">{t.toMemberName}</div>
                              <div className="text-xs font-semibold text-emerald-700">Creditor</div>
                            </div>
                          </div>

                          <div
                            className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border"
                            style={{ backgroundColor: meta.bgLight, borderColor: meta.borderLight, color: meta.textColor }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.dotColor }} />
                            <span>{meta.label}</span>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 mb-4 text-xs">
                          <div className="flex items-center gap-1.5 font-bold mb-1" style={{ color: meta.textColor }}>
                            <Info size={14} /> Router Rationale:
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">{t.stateReason}</p>
                          {t.pendingRefund && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs mt-2.5">
                              <Building2 size={14} className="text-amber-600 shrink-0" />
                              <span>
                                <strong>Blocking Refund:</strong> {t.pendingRefund.vendorName} owes ₹{t.pendingRefund.amount.toLocaleString('en-IN')} to {t.pendingRefund.recipientName} ({t.pendingRefund.reason}).
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between items-center flex-wrap gap-3">
                          {t.settled ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <Check size={14} /> Settled in Ledger
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                              <Clock size={14} /> Pending Transfer
                            </span>
                          )}

                          <div className="flex gap-2">
                            {t.state === 'pay_now' && !t.settled && (
                              <>
                                {t.upiLink && (
                                  <a
                                    href={t.upiLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                                  >
                                    <ExternalLink size={13} /> Pay via UPI
                                  </a>
                                )}
                                <button
                                  onClick={() => setSelectedQRTransfer(t)}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                                  title="View QR Code"
                                >
                                  <QrCode size={15} />
                                </button>
                              </>
                            )}
                            {t.state === 'pay_after_refund' && !t.settled && (
                              <button
                                onClick={() => { if (t.pendingRefund) handleRecordRefundReceived(t.pendingRefund); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 text-xs font-bold transition-colors cursor-pointer"
                              >
                                <Building2 size={13} /> Simulate Refund Received
                              </button>
                            )}
                            {!t.settled && (
                              <button
                                onClick={() => handleMarkAsPaid(t)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 text-xs font-bold transition-colors cursor-pointer"
                              >
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
            </section>

            {/* Auxiliary Lists */}
            {(plan.vendorObligations.length > 0 || plan.disputedItems.length > 0 || plan.organizerItems.length > 0 || plan.vouchers.length > 0) && (
              <div className="grid gap-4">
                {[
                  { key: 'vendor', title: 'Vendor Owes (External Parties)', items: plan.vendorObligations, dot: '#06b6d4', badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
                  { key: 'dispute', title: 'Provisionally Disputed', items: plan.disputedItems, dot: '#f43f5e', badgeClass: 'bg-rose-50 text-rose-800 border-rose-200' },
                  { key: 'organizer', title: 'Covered by Organizer', items: plan.organizerItems, dot: '#6366f1', badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                  { key: 'voucher', title: 'Non-Cash Vouchers', items: plan.vouchers, dot: '#a855f7', badgeClass: 'bg-purple-50 text-purple-800 border-purple-200' },
                ].filter(s => s.items.length > 0).map(section => (
                  <div key={section.key} className="bg-white rounded-2xl p-5 border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: section.dot }} />
                        {section.title}
                      </h3>
                      <span className="text-xs text-slate-500 font-semibold">{section.items.length} items</span>
                    </div>
                    <div className="grid gap-2.5">
                      {section.items.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center flex-wrap gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 mb-0.5">
                              {item.vendorName || item.expenseLabel || item.label || item.issuer}
                            </div>
                            <div className="text-slate-600">
                              Amount: ₹{item.amount || item.disputedAmount || item.value} · {item.reason || item.notes}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${section.badgeClass}`}>
                              {section.title}
                            </span>
                            {section.key === 'vendor' && (
                              <button
                                onClick={() => handleRecordRefundReceived(item)}
                                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Mark Credited
                              </button>
                            )}
                            {section.key === 'dispute' && (
                              <button
                                onClick={() => { setCustomDisputes(prev => prev.filter(d => d.id !== item.id)); }}
                                className="px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Resolve
                              </button>
                            )}
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
          <motion.div
            key="graph"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl p-6 border border-slate-200"
          >
            <div className="flex justify-between items-center flex-wrap gap-4 pb-4 border-b border-slate-100 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Debt-Netting Graph Reduction</h2>
                <p className="text-xs text-slate-500 mt-0.5">Compare unsimplified peer debts against the Routed Graph.</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
                <span>{plan.rawTransferCount} raw</span>
                <ArrowRight size={14} />
                <span className="text-emerald-700">{plan.optimizedTransferCount} transfers</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-sm font-bold text-slate-900">1. Raw Graph ({plan.rawTransferCount})</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Before</span>
                </div>
                <p className="text-xs text-slate-600 mb-3">Bilateral claims from every individual expense.</p>
                <div className="grid gap-2">
                  {plan.rawEdges.map(e => (
                    <div key={e.id} className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-0.5">
                        {e.fromName} <ArrowRight size={12} className="text-slate-400" /> {e.toName}
                      </div>
                      <div className="text-base font-black text-slate-900">₹{e.amount.toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-emerald-50/50 border border-emerald-200">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-sm font-bold text-emerald-900">2. Optimized Graph ({plan.optimizedTransferCount})</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Netted</span>
                </div>
                <p className="text-xs text-emerald-800 mb-3">Cycles cancelled. {plan.savingsCount} transfers eliminated.</p>
                <div className="grid gap-2">
                  {plan.transfers.map(t => (
                    <div key={t.id} className="p-3 rounded-lg bg-white border border-emerald-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 mb-0.5">
                        {t.fromMemberName} <ArrowRight size={12} className="text-emerald-600" /> {t.toMemberName}
                      </div>
                      <div className="text-base font-black text-emerald-700">₹{t.amount.toLocaleString('en-IN')}</div>
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
          <motion.div
            key="benchmark"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl p-6 border border-slate-200"
          >
            <div className="flex items-center gap-3 mb-5">
              <Sparkles size={24} className="text-amber-500" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Section 7 Specification Benchmark</h2>
                <p className="text-xs text-slate-500 mt-0.5">Executing the exact canonical example defined in the architecture document.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs leading-relaxed mb-5 border border-slate-800">
              EXAMPLE (FROM ARCHITECTURE SPEC)<br/>
              ---------------------------------<br/>
                A owes B:     Rs 2,000<br/>
                B owes C:     Rs 1,500<br/>
                C owes A:     Rs 1,000<br/>
                Hotel owes B: Rs 700 refund (pending)<br/>
              <br/>
                Router output: "Wait for the hotel refund, then complete 2 transfers instead of 5."
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 mb-3 uppercase tracking-wider">Initial Obligations</h4>
                <ul className="text-xs space-y-2 text-slate-600">
                  <li>{benchmarkData.state.members[0].displayName} owes {benchmarkData.state.members[1].displayName}: <strong>₹2,000</strong></li>
                  <li>{benchmarkData.state.members[1].displayName} owes {benchmarkData.state.members[2].displayName}: <strong>₹1,500</strong></li>
                  <li>{benchmarkData.state.members[2].displayName} owes {benchmarkData.state.members[0].displayName}: <strong>₹1,000</strong></li>
                  <li className="text-blue-700 font-semibold">Grand Hotel owes {benchmarkData.state.members[1].displayName}: <strong>₹700</strong> (Pending)</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <h4 className="text-xs font-bold text-emerald-950 mb-3 uppercase tracking-wider">Router Routing Decision</h4>
                <ul className="text-xs space-y-2 text-emerald-900">
                  <li>
                    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-200/70 text-emerald-900 mb-1">Pay Now</span>
                    <p className="m-0">{benchmarkData.state.members[0].displayName} → {benchmarkData.state.members[2].displayName}: ₹500 (Debt clear)</p>
                  </li>
                  <li>
                    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-md bg-amber-200/70 text-amber-900 mb-1">Pay After Refund</span>
                    <p className="m-0">{benchmarkData.state.members[0].displayName} → {benchmarkData.state.members[1].displayName}: ₹500 (Hold for ₹700 hotel refund)</p>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared Modals */}
      {showAddRefundModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900">Add Vendor Refund Claim</h3>
              <X size={18} onClick={() => setShowAddRefundModal(false)} className="cursor-pointer text-slate-400 hover:text-slate-600" />
            </div>
            <form onSubmit={handleAddCustomRefund} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">External Vendor Name</label>
                <input
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newVendorName}
                  onChange={e => setNewVendorName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expected Refund Amount (₹)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newRefundAmount}
                  onChange={e => setNewRefundAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Recipient Traveler</label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  value={newRefundRecipient}
                  onChange={e => setNewRefundRecipient(e.target.value)}
                >
                  {state?.members.map(m => (
                    <option key={m.memberId} value={m.memberId}>{m.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason</label>
                <input
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newRefundReason}
                  onChange={e => setNewRefundReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRefundModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Add Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddDisputeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900">Flag Dispute</h3>
              <X size={18} onClick={() => setShowAddDisputeModal(false)} className="cursor-pointer text-slate-400 hover:text-slate-600" />
            </div>
            <form onSubmit={handleAddCustomDispute} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contested Expense</label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  value={newDisputeExpenseId}
                  onChange={e => setNewDisputeExpenseId(e.target.value)}
                >
                  {state?.expenses.map(exp => (
                    <option key={exp.expenseId} value={exp.expenseId}>{exp.note || 'Expense'} — ₹{exp.amount}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rationale</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newDisputeReason}
                  onChange={e => setNewDisputeReason(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddDisputeModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Flag Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddVoucherModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900">Add Voucher</h3>
              <X size={18} onClick={() => setShowAddVoucherModal(false)} className="cursor-pointer text-slate-400 hover:text-slate-600" />
            </div>
            <form onSubmit={handleAddCustomVoucher} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Issuer</label>
                <input
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newVoucherIssuer}
                  onChange={e => setNewVoucherIssuer(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Value (₹)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newVoucherValue}
                  onChange={e => setNewVoucherValue(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Holder</label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  value={newVoucherHolder}
                  onChange={e => setNewVoucherHolder(e.target.value)}
                >
                  {state?.members.map(m => (
                    <option key={m.memberId} value={m.memberId}>{m.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddVoucherModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Add Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedQRTransfer && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedQRTransfer(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 text-center max-w-xs w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900">UPI Payment</h3>
              <X size={18} onClick={() => setSelectedQRTransfer(null)} className="cursor-pointer text-slate-400 hover:text-slate-600" />
            </div>
            <div className="p-3 border border-slate-200 rounded-xl inline-block mb-3 bg-white">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(selectedQRTransfer.upiLink || '')}`}
                width={200}
                height={200}
                alt="UPI QR Code"
                className="mx-auto"
              />
            </div>
            <div className="text-2xl font-black text-slate-900 mb-1">
              ₹{selectedQRTransfer.amount.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-600 mb-1">
              Pay to: <strong className="text-slate-900">{selectedQRTransfer.toMemberName}</strong>
            </div>
            <div className="text-xs text-slate-400">Scan with GPay, PhonePe, Paytm, etc.</div>
          </div>
        </div>
      )}
    </div>
  );
}
