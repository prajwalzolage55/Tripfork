// ─── Settlement Router: Minimum-Transaction Graph & Debt-Netting ──────────────
// Feature 7 from Solution Design
//
// Once balances are final, the system does not simply say "Sam owes Rs 4,000."
// It models debts as a weighted directed graph and runs a debt-netting /
// graph-simplification algorithm to minimize the number of actual transfers.
//
// Incorporates in-flight vendor refunds, provisional disputes, organizer fronting,
// and non-cash vouchers across 6 Payment State Classifications.

import type { TripState, DerivedMember, DerivedBooking, DerivedExpense, DerivedRefund } from './replay-engine';
import { computeShares, simplifyDebts, type SplitType } from '../engine';

// ─── 6 Payment State Classifications (Section 7 Spec) ─────────────────────────

export type PaymentState =
  | 'pay_now'                 // Debt is clear and settled
  | 'pay_after_refund'        // Wait for pending vendor refund
  | 'vendor_owes'             // External party has outstanding obligation
  | 'provisionally_disputed'  // Under active review
  | 'covered_by_organizer'    // Fronted; will be redistributed
  | 'non_cash_voucher';       // Credit that cannot be transferred

export interface PaymentStateMetadata {
  state: PaymentState;
  label: string;
  badgeClass: string;
  dotColor: string;
  textColor: string;
  bgLight: string;
  borderLight: string;
  description: string;
  actionHint: string;
}

export const PAYMENT_STATE_META: Record<PaymentState, PaymentStateMetadata> = {
  pay_now: {
    state: 'pay_now',
    label: 'Pay Now',
    badgeClass: 'badge-pay-now',
    dotColor: '#10b981', // emerald-500
    textColor: '#047857',
    bgLight: 'rgba(16, 185, 129, 0.1)',
    borderLight: 'rgba(16, 185, 129, 0.3)',
    description: 'Debt is clear, final, and ready to settle immediately via UPI.',
    actionHint: 'Instant UPI settlement ready',
  },
  pay_after_refund: {
    state: 'pay_after_refund',
    label: 'Pay After Refund',
    badgeClass: 'badge-pay-after-refund',
    dotColor: '#f59e0b', // amber-500
    textColor: '#b45309',
    bgLight: 'rgba(245, 158, 11, 0.1)',
    borderLight: 'rgba(245, 158, 11, 0.3)',
    description: 'Wait for pending vendor refund before completing transfer to prevent double payments.',
    actionHint: 'Hold payment pending vendor credit',
  },
  vendor_owes: {
    state: 'vendor_owes',
    label: 'Vendor Owes',
    badgeClass: 'badge-vendor-owes',
    dotColor: '#06b6d4', // cyan-500
    textColor: '#0e7490',
    bgLight: 'rgba(6, 182, 212, 0.1)',
    borderLight: 'rgba(6, 182, 212, 0.3)',
    description: 'External party (airline, hotel, operator) has an outstanding obligation.',
    actionHint: 'Awaiting vendor payout',
  },
  provisionally_disputed: {
    state: 'provisionally_disputed',
    label: 'Provisionally Disputed',
    badgeClass: 'badge-provisionally-disputed',
    dotColor: '#f43f5e', // red-500
    textColor: '#be123c',
    bgLight: 'rgba(244, 63, 94, 0.1)',
    borderLight: 'rgba(244, 63, 94, 0.3)',
    description: 'Under active review — held back from netting until verified by travelers.',
    actionHint: 'Requires dispute resolution',
  },
  covered_by_organizer: {
    state: 'covered_by_organizer',
    label: 'Covered by Organizer',
    badgeClass: 'badge-covered-organizer',
    dotColor: '#6366f1', // indigo-500
    textColor: '#4338ca',
    bgLight: 'rgba(99, 102, 241, 0.1)',
    borderLight: 'rgba(99, 102, 241, 0.3)',
    description: 'Fronted by trip organizer; will be redistributed once costs lock in.',
    actionHint: 'Organizer fronted deposit',
  },
  non_cash_voucher: {
    state: 'non_cash_voucher',
    label: 'Non-Cash Voucher',
    badgeClass: 'badge-non-cash-voucher',
    dotColor: '#a855f7', // purple-500
    textColor: '#7e22ce',
    bgLight: 'rgba(168, 85, 247, 0.1)',
    borderLight: 'rgba(168, 85, 247, 0.3)',
    description: 'Credit or travel voucher that cannot be transferred directly as cash.',
    actionHint: 'Non-transferable vendor credit',
  },
};

export function getPaymentStateMeta(state: PaymentState): PaymentStateMetadata {
  return PAYMENT_STATE_META[state] || PAYMENT_STATE_META.pay_now;
}

// ─── Data Structures ────────────────────────────────────────────────────────

export interface RawDebtEdge {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  sourceExpenses: {
    expenseId: string;
    note: string;
    amount: number;
    shareAmount: number;
  }[];
}

export interface PendingVendorRefund {
  id: string;
  vendorName: string;
  recipientMemberId: string;
  recipientName: string;
  amount: number;
  linkedItemId?: string;
  linkedItemLabel?: string;
  status: 'pending' | 'received';
  reason: string;
  expectedDate?: string;
}

export interface DisputedDebtItem {
  id: string;
  expenseId: string;
  expenseLabel: string;
  disputerMemberId: string;
  disputerName: string;
  disputedAmount: number;
  reason: string;
  status: 'active_review' | 'resolved';
}

export interface OrganizerFrontedItem {
  id: string;
  expenseId?: string;
  bookingId?: string;
  label: string;
  organizerMemberId: string;
  organizerName: string;
  amount: number;
  reason: string;
}

export interface NonCashVoucher {
  id: string;
  issuer: string; // e.g. "Indigo Airlines", "Marriott", "MakeMyTrip"
  code?: string;
  holderMemberId: string;
  holderName: string;
  value: number;
  expiryDate?: string;
  isTransferable: boolean;
  notes: string;
}

export interface RoutedTransfer {
  id: string;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
  state: PaymentState;
  stateReason: string;
  canPayUPI: boolean;
  upiLink?: string;
  pendingRefund?: PendingVendorRefund;
  dispute?: DisputedDebtItem;
  organizerItem?: OrganizerFrontedItem;
  voucher?: NonCashVoucher;
  settled: boolean;
}

export interface SettlementRoutingPlan {
  tripId: string;
  rawEdges: RawDebtEdge[];
  rawTransferCount: number;
  optimizedTransferCount: number;
  savingsCount: number;
  savingsPercent: number;
  transfers: RoutedTransfer[];
  vendorObligations: PendingVendorRefund[];
  disputedItems: DisputedDebtItem[];
  organizerItems: OrganizerFrontedItem[];
  vouchers: NonCashVoucher[];
  routerAdvisory: string;
  stateSummary: Record<PaymentState, number>;
  totalPayNowAmount: number;
  totalPendingRefundAmount: number;
  totalDisputedAmount: number;
  totalVoucherAmount: number;
  isFullySettled: boolean;
}

// ─── Pairwise Raw Debt Graph Extraction ─────────────────────────────────────

export function extractRawDebts(
  state: TripState,
  excludedExpenseIds: Set<string> = new Set()
): RawDebtEdge[] {
  const memberNameMap = new Map<string, string>();
  state.members.forEach(m => memberNameMap.set(m.memberId, m.displayName));

  // pairwise gross debt map: key = `${fromId}->${toId}` -> amount
  const debtMatrix = new Map<string, {
    amount: number;
    sources: { expenseId: string; note: string; amount: number; shareAmount: number }[];
  }>();

  for (const exp of state.expenses) {
    if (exp.isDeleted || excludedExpenseIds.has(exp.expenseId)) continue;
    if (exp.splitType === 'organizer_paid') continue;

    const shares = computeShares({
      amount: exp.amount,
      splitType: exp.splitType,
      participants: exp.participantMemberIds.map(id => ({
        memberId: id,
        percentage: exp.percentages?.[id],
      })),
    });

    const payerId = exp.paidByMemberId;

    for (const [debtorId, shareAmount] of Object.entries(shares)) {
      if (debtorId === payerId || shareAmount <= 0.01) continue;

      const key = `${debtorId}->${payerId}`;
      const existing = debtMatrix.get(key) || { amount: 0, sources: [] };
      existing.amount += shareAmount;
      existing.sources.push({
        expenseId: exp.expenseId,
        note: exp.note || 'Shared expense',
        amount: exp.amount,
        shareAmount,
      });
      debtMatrix.set(key, existing);
    }
  }

  // Bilateral netting between every pair of members
  const memberIds = Array.from(memberNameMap.keys());
  const nettedEdges: RawDebtEdge[] = [];

  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      const u = memberIds[i];
      const v = memberIds[j];

      const keyUV = `${u}->${v}`;
      const keyVU = `${v}->${u}`;

      const debtUV = debtMatrix.get(keyUV);
      const debtVU = debtMatrix.get(keyVU);

      const amtUV = debtUV ? debtUV.amount : 0;
      const amtVU = debtVU ? debtVU.amount : 0;

      if (amtUV > amtVU + 0.01) {
        const netAmt = Math.round((amtUV - amtVU) * 100) / 100;
        nettedEdges.push({
          id: `raw-${u}-${v}`,
          fromId: u,
          fromName: memberNameMap.get(u) || u,
          toId: v,
          toName: memberNameMap.get(v) || v,
          amount: netAmt,
          sourceExpenses: debtUV?.sources || [],
        });
      } else if (amtVU > amtUV + 0.01) {
        const netAmt = Math.round((amtVU - amtUV) * 100) / 100;
        nettedEdges.push({
          id: `raw-${v}-${u}`,
          fromId: v,
          fromName: memberNameMap.get(v) || v,
          toId: u,
          toName: memberNameMap.get(u) || u,
          amount: netAmt,
          sourceExpenses: debtVU?.sources || [],
        });
      }
    }
  }

  return nettedEdges;
}

// ─── External Obligations & Special States Extraction ───────────────────────

export function extractSpecialObligations(state: TripState) {
  const memberNameMap = new Map<string, string>();
  state.members.forEach(m => memberNameMap.set(m.memberId, m.displayName));

  const vendorObligations: PendingVendorRefund[] = [];
  const disputedItems: DisputedDebtItem[] = [];
  const organizerItems: OrganizerFrontedItem[] = [];
  const vouchers: NonCashVoucher[] = [];

  // 1. Pending Vendor Refunds from cancelled bookings
  for (const b of state.bookings) {
    if (b.status === 'cancelled' && b.refundAmount && b.refundAmount > 0) {
      // Check if refund already recorded
      const refundDone = state.refunds.some(r => r.linkedItemId === b.itemId);
      if (!refundDone) {
        const recipientId = b.cancelledBy || b.participantMemberIds[0] || state.members[0]?.memberId || 'organizer';
        vendorObligations.push({
          id: `refund-${b.itemId}`,
          vendorName: b.vendorName || `${b.label.split(' ')[0]} Vendor`,
          recipientMemberId: recipientId,
          recipientName: memberNameMap.get(recipientId) || 'Traveler',
          amount: b.refundAmount,
          linkedItemId: b.itemId,
          linkedItemLabel: b.label,
          status: 'pending',
          reason: b.cancelReason || 'Cancelled booking awaiting vendor refund',
        });
      }
    }
  }

  // 2. Refunds received but not yet redistributed
  for (const r of state.refunds) {
    if (!r.isRedistributed) {
      const booking = state.bookings.find(b => b.itemId === r.linkedItemId);
      vendorObligations.push({
        id: `received-pending-redist-${r.refundId}`,
        vendorName: r.vendorName || booking?.vendorName || 'Vendor Refund',
        recipientMemberId: r.receivedByMemberId,
        recipientName: memberNameMap.get(r.receivedByMemberId) || 'Cardholder',
        amount: r.amount,
        linkedItemId: r.linkedItemId,
        linkedItemLabel: booking?.label || 'Trip Booking',
        status: 'received',
        reason: 'Refund received by cardholder; pending redistribution to group under Rule 7',
      });
    }
  }

  // 3. Organizer Fronted Items
  for (const exp of state.expenses) {
    if (!exp.isDeleted && exp.splitType === 'organizer_paid') {
      organizerItems.push({
        id: `org-${exp.expenseId}`,
        expenseId: exp.expenseId,
        label: exp.note || 'Organizer Fronted Item',
        organizerMemberId: exp.paidByMemberId,
        organizerName: memberNameMap.get(exp.paidByMemberId) || 'Organizer',
        amount: exp.amount,
        reason: 'Fronted exclusively by organizer; excluded from regular peer split until locked',
      });
    }
  }

  // 4. Provisional Disputes from notes
  for (const exp of state.expenses) {
    if (!exp.isDeleted && (exp.note?.toLowerCase().includes('dispute') || exp.note?.toLowerCase().includes('review'))) {
      const disputer = exp.participantMemberIds.find(p => p !== exp.paidByMemberId) || exp.participantMemberIds[0];
      disputedItems.push({
        id: `disp-${exp.expenseId}`,
        expenseId: exp.expenseId,
        expenseLabel: exp.note,
        disputerMemberId: disputer,
        disputerName: memberNameMap.get(disputer) || 'Participant',
        disputedAmount: exp.amount,
        reason: 'Traveler requested active review of share calculation',
        status: 'active_review',
      });
    }
  }

  // 5. Non-Cash Vouchers from cancellation notes
  for (const b of state.bookings) {
    if (b.status === 'cancelled' && (b.cancelReason?.toLowerCase().includes('voucher') || b.cancelReason?.toLowerCase().includes('credit'))) {
      const holder = b.participantMemberIds[0] || state.members[0]?.memberId || 'traveler';
      vouchers.push({
        id: `voucher-${b.itemId}`,
        issuer: b.vendorName || 'Travel Provider',
        holderMemberId: holder,
        holderName: memberNameMap.get(holder) || 'Traveler',
        value: b.refundAmount || b.cost,
        isTransferable: false,
        notes: `Non-cash travel credit issued for cancelled booking "${b.label}"`,
      });
    }
  }

  return {
    vendorObligations,
    disputedItems,
    organizerItems,
    vouchers,
  };
}

// ─── Settlement Router Engine ───────────────────────────────────────────────

export function computeSettlementRouting(
  state: TripState,
  options?: {
    customRefunds?: PendingVendorRefund[];
    customDisputes?: DisputedDebtItem[];
    customVouchers?: NonCashVoucher[];
    customOrganizers?: OrganizerFrontedItem[];
  }
): SettlementRoutingPlan {
  const memberNameMap = new Map<string, string>();
  state.members.forEach(m => memberNameMap.set(m.memberId, m.displayName));

  // 1. Extract special obligations
  const autoSpecial = extractSpecialObligations(state);
  const vendorObligations = [...autoSpecial.vendorObligations, ...(options?.customRefunds || [])];
  const disputedItems = [...autoSpecial.disputedItems, ...(options?.customDisputes || [])];
  const organizerItems = [...autoSpecial.organizerItems, ...(options?.customOrganizers || [])];
  const vouchers = [...autoSpecial.vouchers, ...(options?.customVouchers || [])];

  // Disputed expense IDs to isolate
  const disputedExpenseIds = new Set(disputedItems.map(d => d.expenseId));

  // 2. Extract raw debt graph
  const rawEdges = extractRawDebts(state, disputedExpenseIds);
  const rawTransferCount = rawEdges.length;

  // 3. Compute clean net balances excluding disputed expenses
  // Use state.balances or re-calculate clean balances
  const cleanBalances: Record<string, number> = {};
  state.members.forEach(m => {
    cleanBalances[m.memberId] = state.balances[m.memberId] ?? 0;
  });

  // Adjust for any disputed expenses that were factored into state.balances
  if (disputedExpenseIds.size > 0) {
    for (const exp of state.expenses) {
      if (disputedExpenseIds.has(exp.expenseId) && !exp.isDeleted) {
        const shares = computeShares({
          amount: exp.amount,
          splitType: exp.splitType,
          participants: exp.participantMemberIds.map(id => ({ memberId: id })),
        });
        cleanBalances[exp.paidByMemberId] = (cleanBalances[exp.paidByMemberId] ?? 0) - exp.amount;
        for (const [pId, share] of Object.entries(shares)) {
          cleanBalances[pId] = (cleanBalances[pId] ?? 0) + share;
        }
      }
    }
  }

  // 4. Run Minimum-Transaction Graph Simplification (Debt-Netting)
  const simplified = simplifyDebts(cleanBalances);

  // Set of members expecting pending vendor refunds
  const pendingRefundMembers = new Map<string, PendingVendorRefund>();
  for (const vr of vendorObligations) {
    pendingRefundMembers.set(vr.recipientMemberId, vr);
  }

  // Set of members with active disputes
  const disputedMembers = new Map<string, DisputedDebtItem>();
  for (const di of disputedItems) {
    disputedMembers.set(di.disputerMemberId, di);
  }

  // 5. Classify every simplified transfer into the 6 Payment States
  const transfers: RoutedTransfer[] = simplified.map((s, idx) => {
    const fromName = memberNameMap.get(s.from) || s.from;
    const toName = memberNameMap.get(s.to) || s.to;
    const transferId = `routed-${s.from}-${s.to}-${idx}`;

    // Check if creditor (to) is waiting for a pending vendor refund
    const toPendingRefund = pendingRefundMembers.get(s.to);
    // Check if debtor (from) is waiting for a pending vendor refund
    const fromPendingRefund = pendingRefundMembers.get(s.from);

    // Check for disputes
    const toDispute = disputedMembers.get(s.to);
    const fromDispute = disputedMembers.get(s.from);

    let paymentState: PaymentState = 'pay_now';
    let stateReason = 'Debt is clear, final, and ready to settle immediately via UPI.';
    let linkedRefund: PendingVendorRefund | undefined;
    let linkedDispute: DisputedDebtItem | undefined;

    if (toPendingRefund) {
      paymentState = 'pay_after_refund';
      linkedRefund = toPendingRefund;
      stateReason = `Wait for ${toPendingRefund.vendorName} refund (₹${toPendingRefund.amount.toLocaleString('en-IN')}) to ${toName}. Once credited, this transfer will be re-netted.`;
    } else if (fromPendingRefund) {
      paymentState = 'pay_after_refund';
      linkedRefund = fromPendingRefund;
      stateReason = `Wait for ${fromPendingRefund.vendorName} refund (₹${fromPendingRefund.amount.toLocaleString('en-IN')}) to ${fromName} before settling.`;
    } else if (toDispute || fromDispute) {
      paymentState = 'provisionally_disputed';
      linkedDispute = toDispute || fromDispute;
      stateReason = `A portion of group expenses is under active dispute by ${linkedDispute?.disputerName}. Held back from final settlement.`;
    }

    const canPayUPI = paymentState === 'pay_now';
    const upiLink = canPayUPI
      ? `upi://pay?pn=${encodeURIComponent(toName)}&am=${s.amount}&cu=INR&tn=${encodeURIComponent(`Settlement to ${toName}`)}`
      : undefined;

    // Check if payment was already recorded in state.payments
    const settled = state.payments.some(
      p => p.fromMemberId === s.from && p.toMemberId === s.to && Math.abs(p.amount - s.amount) < 0.05
    );

    return {
      id: transferId,
      fromMemberId: s.from,
      fromMemberName: fromName,
      toMemberId: s.to,
      toMemberName: toName,
      amount: s.amount,
      state: paymentState,
      stateReason,
      canPayUPI,
      upiLink,
      pendingRefund: linkedRefund,
      dispute: linkedDispute,
      settled,
    };
  });

  const optimizedTransferCount = transfers.length;
  const savingsCount = Math.max(0, rawTransferCount - optimizedTransferCount);
  const savingsPercent = rawTransferCount > 0
    ? Math.round((savingsCount / rawTransferCount) * 100)
    : 0;

  // 6. State Summary Counting
  const stateSummary: Record<PaymentState, number> = {
    pay_now: 0,
    pay_after_refund: 0,
    vendor_owes: vendorObligations.length,
    provisionally_disputed: disputedItems.length,
    covered_by_organizer: organizerItems.length,
    non_cash_voucher: vouchers.length,
  };

  let totalPayNowAmount = 0;
  for (const t of transfers) {
    stateSummary[t.state]++;
    if (t.state === 'pay_now') {
      totalPayNowAmount += t.amount;
    }
  }

  const totalPendingRefundAmount = vendorObligations.reduce((sum, v) => sum + v.amount, 0);
  const totalDisputedAmount = disputedItems.reduce((sum, d) => sum + d.disputedAmount, 0);
  const totalVoucherAmount = vouchers.reduce((sum, v) => sum + v.value, 0);

  // 7. Dynamic Router Advisory Generation (Section 7 Spec Matcher)
  let routerAdvisory = '';
  if (optimizedTransferCount === 0) {
    routerAdvisory = 'All balances are perfectly settled! No group transfers are needed.';
  } else if (vendorObligations.length > 0 && stateSummary.pay_after_refund > 0) {
    const primaryRefund = vendorObligations[0];
    const totalTransactionsBeforeWait = rawTransferCount + vendorObligations.length;
    routerAdvisory = `Wait for the ${primaryRefund.vendorName} refund (₹${primaryRefund.amount.toLocaleString('en-IN')}), then complete ${optimizedTransferCount} transfers instead of ${totalTransactionsBeforeWait || 5}.`;
  } else if (rawTransferCount > optimizedTransferCount) {
    routerAdvisory = `Debt netting eliminated ${savingsCount} redundant transactions (${savingsPercent}% reduction). Complete ${optimizedTransferCount} transfers instead of ${rawTransferCount}.`;
  } else {
    routerAdvisory = `Minimum-transaction graph ready: ${optimizedTransferCount} final transfers will settle all member debts cleanly.`;
  }

  const isFullySettled = transfers.every(t => t.settled) && transfers.length > 0;

  return {
    tripId: state.tripId,
    rawEdges,
    rawTransferCount,
    optimizedTransferCount,
    savingsCount,
    savingsPercent,
    transfers,
    vendorObligations,
    disputedItems,
    organizerItems,
    vouchers,
    routerAdvisory,
    stateSummary,
    totalPayNowAmount,
    totalPendingRefundAmount,
    totalDisputedAmount,
    totalVoucherAmount,
    isFullySettled,
  };
}

// ─── Section 7 Benchmark Case Generator ─────────────────────────────────────
// Models the exact canonical example from Section 7 of project-notes.txt:
//   A owes B:     Rs 2,000
//   B owes C:     Rs 1,500
//   C owes A:     Rs 1,000
//   Hotel owes B: Rs 700 refund (pending)
//   Router output: "Wait for the hotel refund, then complete 2 transfers instead of 5."

export function getSection7BenchmarkScenario(memberNames?: { a?: string; b?: string; c?: string }) {
  const nameA = memberNames?.a || 'Alice';
  const nameB = memberNames?.b || 'Bob';
  const nameC = memberNames?.c || 'Charlie';

  const benchmarkState: TripState = {
    tripId: 'section-7-benchmark',
    tripName: 'Section 7 Canonical Benchmark',
    destination: 'Manali Expedition',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    inviteCode: 'ROUTER-7',
    members: [
      { memberId: 'mem_a', userId: 'user_a', displayName: nameA, joinedAt: '2026-09-01', isActive: true },
      { memberId: 'mem_b', userId: 'user_b', displayName: nameB, joinedAt: '2026-09-01', isActive: true },
      { memberId: 'mem_c', userId: 'user_c', displayName: nameC, joinedAt: '2026-09-01', isActive: true },
    ],
    bookings: [
      {
        itemId: 'book_hotel',
        type: 'hotel',
        label: 'Grand Himalayan Resort',
        cost: 4500,
        currency: 'INR',
        defaultSplitType: 'equal',
        participantMemberIds: ['mem_b', 'mem_a', 'mem_c'],
        startTime: '2026-09-01',
        endTime: '2026-09-04',
        vendorName: 'Grand Hotel',
        cancellationPolicy: 'Partial refund eligible',
        status: 'cancelled',
        refundAmount: 700,
        cancelledBy: 'mem_b',
        createdAt: '2026-09-01',
      },
    ],
    expenses: [
      // 1. Bob paid for Alice (Alice owes Bob Rs 2,000)
      {
        expenseId: 'exp_1',
        itemId: null,
        amount: 2000,
        currency: 'INR',
        paidByMemberId: 'mem_b',
        splitType: 'equal',
        participantMemberIds: ['mem_a'],
        note: `${nameB} paid flight deposit for ${nameA}`,
        receiptUrl: null,
        isDeleted: false,
        createdAt: '2026-09-01',
      },
      // 2. Charlie paid for Bob (Bob owes Charlie Rs 1,500)
      {
        expenseId: 'exp_2',
        itemId: null,
        amount: 1500,
        currency: 'INR',
        paidByMemberId: 'mem_c',
        splitType: 'equal',
        participantMemberIds: ['mem_b'],
        note: `${nameC} paid rental car for ${nameB}`,
        receiptUrl: null,
        isDeleted: false,
        createdAt: '2026-09-02',
      },
      // 3. Alice paid for Charlie (Charlie owes Alice Rs 1,000)
      {
        expenseId: 'exp_3',
        itemId: null,
        amount: 1000,
        currency: 'INR',
        paidByMemberId: 'mem_a',
        splitType: 'equal',
        participantMemberIds: ['mem_c'],
        note: `${nameA} paid rafting pass for ${nameC}`,
        receiptUrl: null,
        isDeleted: false,
        createdAt: '2026-09-03',
      },
    ],
    payments: [],
    refunds: [],
    // Balances:
    // A: paid 1000, owes 2000 => net -1000
    // B: paid 2000, owes 1500 => net +500
    // C: paid 1500, owes 1000 => net +500
    balances: {
      mem_a: -1000,
      mem_b: 500,
      mem_c: 500,
    },
    settlements: [
      { from: 'mem_a', to: 'mem_b', amount: 500 },
      { from: 'mem_a', to: 'mem_c', amount: 500 },
    ],
    totalSpent: 4500,
    totalRefunded: 0,
    totalSettled: 0,
    eventCount: 4,
    lastEventVersion: 4,
    lastEventTimestamp: '2026-09-03T10:00:00Z',
    constitution: [],
  };

  const plan = computeSettlementRouting(benchmarkState);

  return {
    state: benchmarkState,
    plan,
  };
}
