'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, RefreshCw, ArrowDownLeft, ArrowUpRight,
  Clock, CreditCard, Building2, Inbox, SearchX,
  Zap, Info, ChevronDown, ChevronUp, Copy, Check,
  Banknote, AlertCircle, Sparkles, CheckCircle2, XCircle,
  Plus, Tag, User, Undo2, ArrowRight, ShieldCheck,
} from 'lucide-react';
import type { ParsedSmsTransaction } from '@/lib/sms/types';
import { parseBankSms, getBankInfo } from '@/lib/sms/sms-parser';
import type { RawSmsMessage } from '@/lib/sms/client';
import { useTripId } from '@/lib/trip-routing';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { appendEvent } from '@/lib/ledger';
import type { ExpenseAddedPayload } from '@/lib/ledger';
import type { TripMember, ItineraryItem, SplitType } from '@/lib/types';

// ── Design Tokens ─────────────────────────────────────────────────────────────
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

// ── Confidence badge helpers ──────────────────────────────────────────────────
function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'High';
  if (c >= 0.6) return 'Medium';
  if (c >= 0.4) return 'Low';
  return 'Fair';
}

function confidenceColor(c: number) {
  if (c >= 0.8) return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
  if (c >= 0.6) return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' };
  if (c >= 0.4) return { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' };
  return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
}

// ── Filter mode types ─────────────────────────────────────────────────────────
type DirectionFilter = 'ALL' | 'DEBIT' | 'CREDIT';
type TripRelationFilter = 'ALL' | 'TRIP' | 'PERSONAL' | 'PENDING';

interface ClassificationRecord {
  status: 'trip' | 'personal';
  addedToLedger?: boolean;
  expenseId?: string;
  updatedAt: string;
}

// ── Page Component ────────────────────────────────────────────────────────────
export default function SmsReaderPage() {
  const tripId = useTripId();
  const { user: authUser } = useAuth();

  const [allMessages, setAllMessages] = useState<RawSmsMessage[]>([]);
  const [parsedTx, setParsedTx] = useState<ParsedSmsTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');
  const [tripFilter, setTripFilter] = useState<TripRelationFilter>('ALL');
  const [isNative, setIsNative] = useState<boolean | null>(null);

  // Trip members & itinerary items for adding expenses
  const [members, setMembers] = useState<TripMember[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  // Classifications: messageId -> { status: 'trip' | 'personal', addedToLedger?: boolean }
  const [classifications, setClassifications] = useState<Record<string, ClassificationRecord>>({});

  // Expense modal state
  const [selectedTxForExpense, setSelectedTxForExpense] = useState<{
    msgId: string;
    parsed: ParsedSmsTransaction;
    sender: string;
    body: string;
  } | null>(null);
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expensePaidBy, setExpensePaidBy] = useState<string>('');
  const [expenseItemId, setExpenseItemId] = useState<string>('');
  const [expenseSplitType, setExpenseSplitType] = useState<SplitType>('equal');
  const [savingExpense, setSavingExpense] = useState(false);

  // Load classifications from localStorage
  useEffect(() => {
    if (!tripId || tripId === 'view') return;
    try {
      const saved = localStorage.getItem(`gtl_sms_classifications_${tripId}`);
      if (saved) {
        setClassifications(JSON.parse(saved));
      }
    } catch {}
  }, [tripId]);

  // Persist classifications to localStorage
  const saveClassifications = useCallback((next: Record<string, ClassificationRecord>) => {
    setClassifications(next);
    if (tripId && tripId !== 'view') {
      try {
        localStorage.setItem(`gtl_sms_classifications_${tripId}`, JSON.stringify(next));
      } catch {}
    }
  }, [tripId]);

  // Load trip members and itinerary items
  useEffect(() => {
    if (!tripId || tripId === 'view') return;
    let isMounted = true;

    async function loadTripContext() {
      try {
        // Members
        const qMembers = query(collection(db, 'trip_members'), where('trip_id', '==', tripId));
        const snapMembers = await getDocs(qMembers);
        const mList: TripMember[] = [];
        snapMembers.forEach(d => mList.push(d.data() as TripMember));
        if (!isMounted) return;
        setMembers(mList);

        if (authUser) {
          const matched = mList.find(m => m.user_id === authUser.id);
          if (matched) setCurrentMemberId(matched.id);
          else if (mList.length > 0) setCurrentMemberId(mList[0].id);
        } else if (mList.length > 0) {
          setCurrentMemberId(mList[0].id);
        }

        // Itinerary Items
        const qItems = query(collection(db, 'itinerary_items'), where('trip_id', '==', tripId));
        const snapItems = await getDocs(qItems);
        const iList: ItineraryItem[] = [];
        snapItems.forEach(d => iList.push(d.data() as ItineraryItem));
        if (!isMounted) return;
        setItems(iList);
      } catch (err) {
        console.warn('Failed to load trip members or items:', err);
      }
    }

    loadTripContext();
    return () => { isMounted = false; };
  }, [tripId, authUser]);

  // Fetch SMS from device inbox
  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { readAllDeviceSms, isNativeSmsSupported } = await import('@/lib/sms/client');
      const supported = await isNativeSmsSupported();
      setIsNative(supported);

      if (!supported) {
        setError(
          'SMS reading requires the Android app. This feature reads real bank SMS from your phone\'s inbox. ' +
          'Please open this app on your Android device to use the SMS Reader.'
        );
        setFetched(true);
        setAllMessages([]);
        setParsedTx([]);
        return;
      }

      // Fetch only bank & transaction SMS from inbox (bankOnly = true)
      const messages = await readAllDeviceSms(500, true);
      setAllMessages(messages);

      // Parse messages into structured transactions
      const transactions: ParsedSmsTransaction[] = [];
      for (const msg of messages) {
        const parsed = parseBankSms(msg.body, msg.sender, msg.timestamp);
        if (parsed) {
          transactions.push(parsed);
        }
      }
      setParsedTx(transactions);
      setFetched(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch SMS messages from your device.');
    } finally {
      setLoading(false);
    }
  }, []);

  const copyText = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Mark an SMS as trip-related or personal
  const handleClassify = useCallback((msgId: string, status: 'trip' | 'personal') => {
    const updated = {
      ...classifications,
      [msgId]: {
        ...(classifications[msgId] || {}),
        status,
        updatedAt: new Date().toISOString(),
      },
    };
    saveClassifications(updated);
  }, [classifications, saveClassifications]);

  // Clear classification (undo)
  const handleClearClassification = useCallback((msgId: string) => {
    const copy = { ...classifications };
    delete copy[msgId];
    saveClassifications(copy);
  }, [classifications, saveClassifications]);

  // Open Add to Trip modal
  const openExpenseModal = (msgId: string, parsed: ParsedSmsTransaction, sender: string, body: string) => {
    setSelectedTxForExpense({ msgId, parsed, sender, body });
    setExpenseAmount(parsed.amount ? parsed.amount.toString() : '');
    setExpenseTitle(parsed.merchant || getBankInfo(sender)?.name || 'Trip Expense');
    setExpensePaidBy(currentMemberId || (members[0]?.id ?? ''));
    setExpenseItemId('');
    setExpenseSplitType('equal');
  };

  // Save expense to Firestore & ledger
  const handleConfirmExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForExpense || !tripId) return;

    setSavingExpense(true);
    try {
      const parsedAmount = parseFloat(expenseAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert('Please enter a valid amount.');
        setSavingExpense(false);
        return;
      }

      const expRef = doc(collection(db, 'expenses'));
      const participants = members.map(m => m.id);

      await setDoc(expRef, {
        id: expRef.id,
        trip_id: tripId,
        item_id: expenseItemId || null,
        amount: parsedAmount,
        paid_by: expensePaidBy,
        split_type: expenseSplitType,
        receipt_url: null,
        note: `${expenseTitle} (Imported from SMS: ${selectedTxForExpense.parsed.upiRef ? 'UPI Ref ' + selectedTxForExpense.parsed.upiRef : selectedTxForExpense.sender})`,
        created_at: new Date().toISOString(),
      });

      // Append ledger event
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('gtl_user') : null;
      const actorId = storedUser ? JSON.parse(storedUser).id : (authUser?.id || 'unknown');

      const eventPayload: ExpenseAddedPayload = {
        expenseId: expRef.id,
        itemId: expenseItemId || null,
        amount: parsedAmount,
        currency: 'INR',
        paidByMemberId: expensePaidBy,
        splitType: expenseSplitType,
        participantMemberIds: participants,
        note: expenseTitle,
        receiptUrl: null,
      };

      appendEvent(tripId, 'EXPENSE_ADDED', actorId, eventPayload).catch(err => console.warn(err));

      // Mark classification as trip & addedToLedger
      const nextClassifications = {
        ...classifications,
        [selectedTxForExpense.msgId]: {
          status: 'trip' as const,
          addedToLedger: true,
          expenseId: expRef.id,
          updatedAt: new Date().toISOString(),
        },
      };
      saveClassifications(nextClassifications);

      setSelectedTxForExpense(null);
    } catch (err: any) {
      alert('Failed to save expense: ' + (err?.message || 'Unknown error'));
    } finally {
      setSavingExpense(false);
    }
  };

  // Generate display items with parsed data & classification
  const displayItems = useMemo(() => {
    return allMessages.map((msg, i) => {
      const parsed = parseBankSms(msg.body, msg.sender, msg.timestamp);
      const bankInfo = getBankInfo(msg.sender);
      const msgId = `sms-${msg.timestamp}-${i}`;
      const classification = classifications[msgId];

      return {
        raw: msg,
        parsed,
        bankInfo,
        index: i,
        id: msgId,
        classification,
      };
    });
  }, [allMessages, classifications]);

  // Statistics calculation
  const debitTx = parsedTx.filter(t => t.direction === 'DEBIT');
  const creditTx = parsedTx.filter(t => t.direction === 'CREDIT');

  const tripRelatedCount = displayItems.filter(item => item.classification?.status === 'trip').length;
  const personalCount = displayItems.filter(item => item.classification?.status === 'personal').length;
  const pendingCount = displayItems.filter(item => !item.classification).length;

  const totalTripAmount = displayItems
    .filter(item => item.classification?.status === 'trip' && item.parsed?.amount)
    .reduce((sum, item) => sum + (item.parsed?.amount || 0), 0);

  const totalPersonalAmount = displayItems
    .filter(item => item.classification?.status === 'personal' && item.parsed?.amount)
    .reduce((sum, item) => sum + (item.parsed?.amount || 0), 0);

  // Filter items according to user selections
  const filteredItems = displayItems.filter(item => {
    // Direction filter
    if (directionFilter === 'DEBIT' && item.parsed?.direction !== 'DEBIT') return false;
    if (directionFilter === 'CREDIT' && item.parsed?.direction !== 'CREDIT') return false;

    // Trip relation filter
    if (tripFilter === 'TRIP' && item.classification?.status !== 'trip') return false;
    if (tripFilter === 'PERSONAL' && item.classification?.status !== 'personal') return false;
    if (tripFilter === 'PENDING' && item.classification?.status !== undefined) return false;

    return true;
  });

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: `linear-gradient(165deg, ${COLORS.offWhite} 0%, #f7f0e8 50%, ${COLORS.cream}40 100%)` }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-b-3xl"
        style={{
          background: `linear-gradient(135deg, ${COLORS.burgundy} 0%, ${COLORS.deepWine} 40%, ${COLORS.rose} 100%)`,
          boxShadow: '0 8px 32px rgba(121,21,35,0.25)',
        }}
      >
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: COLORS.cream }}
        />
        <div
          className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-10 pointer-events-none"
          style={{ background: COLORS.cream }}
        />

        <div className="max-w-2xl mx-auto px-5 pt-8 pb-7 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Bank SMS Reader</h1>
                <p className="text-xs font-medium text-white/70">Verify &amp; classify trip expenses from bank SMS</p>
              </div>
            </div>

            {/* Platform badge */}
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
              style={{
                background: isNative === false ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.15)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {isNative === null ? 'Native Ready' : isNative ? 'Android Native' : 'Web Preview'}
            </span>
          </div>

          <p className="text-xs text-white/80 leading-relaxed max-w-lg mb-5">
            Only bank &amp; financial transactions are fetched. For each payment, choose whether it is
            <span className="font-bold text-white"> Trip-Related</span> to add it to your group ledger, or
            <span className="font-bold text-white"> Personal</span> to exclude it.
          </p>

          {/* Fetch Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleFetch}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Scanning Inbox for Bank SMS...' : fetched ? 'Re-scan Bank SMS' : 'Fetch Bank SMS'}
          </motion.button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        {/* ── Error Banner ────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-5 p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed"
              style={{
                background: '#fef2f2',
                borderColor: '#fca5a5',
                color: '#991b1b',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">
                <span className="font-bold">Notice: </span>
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Summary Statistics Cards ────────────────────────────── */}
        <AnimatePresence>
          {fetched && allMessages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-3 gap-3 mb-5"
            >
              <div
                className="rounded-2xl border p-3 text-center shadow-sm"
                style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'rgba(44,24,16,0.06)' }}
              >
                <div className="text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">
                  Total SMS
                </div>
                <div className="text-xl font-black text-gray-900">{allMessages.length}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Bank Transactions</div>
              </div>

              <div
                className="rounded-2xl border p-3 text-center shadow-sm"
                style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'rgba(44,24,16,0.06)' }}
              >
                <div className="text-[10px] uppercase font-black tracking-wider text-emerald-700 mb-1">
                  Trip Related ({tripRelatedCount})
                </div>
                <div className="text-lg font-black text-emerald-700">
                  ₹{totalTripAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Added / Marked</div>
              </div>

              <div
                className="rounded-2xl border p-3 text-center shadow-sm"
                style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'rgba(44,24,16,0.06)' }}
              >
                <div className="text-[10px] uppercase font-black tracking-wider text-gray-500 mb-1">
                  Personal ({personalCount})
                </div>
                <div className="text-lg font-black text-gray-700">
                  ₹{totalPersonalAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Excluded</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter Tabs ────────────────────────────────────────── */}
        <AnimatePresence>
          {fetched && allMessages.length > 0 && (
            <div className="mb-5 space-y-2.5">
              {/* Trip Relation Filter */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'ALL' as TripRelationFilter, label: `All (${displayItems.length})` },
                  { key: 'TRIP' as TripRelationFilter, label: `✈️ Trip Related (${tripRelatedCount})` },
                  { key: 'PERSONAL' as TripRelationFilter, label: `👤 Personal (${personalCount})` },
                  { key: 'PENDING' as TripRelationFilter, label: `⏳ Unclassified (${pendingCount})` },
                ].map(({ key, label }) => {
                  const active = tripFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTripFilter(key)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer"
                      style={{
                        background: active ? COLORS.burgundy : 'rgba(255,255,255,0.7)',
                        color: active ? 'white' : '#555',
                        border: active ? 'none' : '1px solid rgba(44,24,16,0.08)',
                        boxShadow: active ? '0 2px 8px rgba(121,21,35,0.2)' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Direction Filter */}
              <div className="flex gap-1.5 items-center">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">Type:</span>
                {(['ALL', 'DEBIT', 'CREDIT'] as DirectionFilter[]).map((mode) => {
                  const active = directionFilter === mode;
                  const count = mode === 'ALL' ? allMessages.length : mode === 'DEBIT' ? debitTx.length : creditTx.length;
                  return (
                    <button
                      key={mode}
                      onClick={() => setDirectionFilter(mode)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                      style={{
                        background: active ? `${COLORS.burgundy}15` : 'transparent',
                        color: active ? COLORS.burgundy : '#777',
                        border: active ? `1px solid ${COLORS.burgundy}30` : '1px solid transparent',
                      }}
                    >
                      {mode === 'ALL' ? 'All' : mode === 'DEBIT' ? '↑ Debits' : '↓ Credits'} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Transaction Cards ───────────────────────────────────── */}
        <AnimatePresence mode="popLayout">
          {fetched && filteredItems.length === 0 && allMessages.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16 text-gray-400"
            >
              <SearchX className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">No transactions match the selected filter.</p>
            </motion.div>
          )}

          {fetched && allMessages.length === 0 && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: `${COLORS.burgundy}10` }}
              >
                <Inbox className="w-7 h-7" style={{ color: COLORS.burgundy }} />
              </div>
              <p className="text-sm font-bold text-gray-700 mb-1">No Bank Transactions Found</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                No bank debit/credit SMS were found in your inbox, or SMS permission was not granted.
              </p>
            </motion.div>
          )}

          {/* Pre-fetch Hero State */}
          {!fetched && !error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center py-16 px-4"
            >
              <div
                className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.burgundy}15, ${COLORS.rose}15)`,
                }}
              >
                <Zap className="w-9 h-9" style={{ color: COLORS.rose }} />
              </div>
              <p className="text-base font-bold text-gray-800 mb-2">Ready to Scan Bank SMS</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed mb-6">
                Tap <span className="font-bold" style={{ color: COLORS.burgundy }}>&ldquo;Fetch Bank SMS&rdquo;</span> to
                automatically filter bank transactions from your phone. You can easily mark each transaction as trip-related or personal.
              </p>

              <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
                {[
                  'HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank',
                  'Kotak Mahindra', 'Bank of Baroda', 'Punjab National', 'Canara Bank',
                  'IDFC FIRST', 'Paytm', 'PhonePe', 'Google Pay', 'CRED'
                ].map(bank => (
                  <span
                    key={bank}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold border"
                    style={{
                      background: 'rgba(255,255,255,0.7)',
                      borderColor: 'rgba(44,24,16,0.08)',
                      color: COLORS.burgundy,
                    }}
                  >
                    {bank}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Card Items */}
          {filteredItems.map(({ raw, parsed, bankInfo, id: msgId, classification }, i) => {
            const expanded = expandedId === msgId;
            const isDebit = parsed?.direction === 'DEBIT';
            const bankDisplayName = bankInfo?.name || raw.sender;
            const isTrip = classification?.status === 'trip';
            const isPersonal = classification?.status === 'personal';
            const isAdded = classification?.addedToLedger;

            return (
              <motion.div
                key={msgId}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.28 }}
                className="rounded-2xl border shadow-sm mb-3.5 overflow-hidden transition-shadow hover:shadow-md"
                style={{
                  background: isTrip
                    ? 'rgba(240, 253, 244, 0.95)'
                    : isPersonal
                    ? 'rgba(249, 250, 251, 0.85)'
                    : 'rgba(255, 255, 255, 0.92)',
                  borderColor: isTrip
                    ? 'rgba(34, 197, 94, 0.3)'
                    : isPersonal
                    ? 'rgba(156, 163, 175, 0.2)'
                    : 'rgba(44, 24, 16, 0.08)',
                  borderLeft: `4px solid ${
                    isTrip ? '#16a34a' : isPersonal ? '#9ca3af' : isDebit ? '#dc2626' : '#2563eb'
                  }`,
                }}
              >
                {/* Main Card Header */}
                <div
                  onClick={() => setExpandedId(expanded ? null : msgId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isDebit ? '#fee2e2' : '#dcfce7',
                    }}
                  >
                    {isDebit ? (
                      <ArrowUpRight className="w-5 h-5 text-red-600" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {parsed?.merchant || bankDisplayName}
                      </span>

                      {/* Direction badge */}
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0 uppercase"
                        style={{
                          background: isDebit ? '#fee2e2' : '#dcfce7',
                          color: isDebit ? '#b91c1c' : '#15803d',
                        }}
                      >
                        {isDebit ? 'DEBIT' : 'CREDIT'}
                      </span>

                      {/* Classification Badge if already marked */}
                      {isTrip && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Trip Expense {isAdded ? '(In Ledger)' : ''}
                        </span>
                      )}
                      {isPersonal && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-300 flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5" />
                          Personal
                        </span>
                      )}

                      {/* Confidence */}
                      {parsed && !isTrip && !isPersonal && (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0"
                          style={{
                            ...confidenceColor(parsed.confidence),
                            border: `1px solid ${confidenceColor(parsed.confidence).border}`,
                          }}
                        >
                          {confidenceLabel(parsed.confidence)}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {raw.body.substring(0, 80)}{raw.body.length > 80 ? '…' : ''}
                    </p>
                  </div>

                  {/* Amount & Time */}
                  <div className="text-right shrink-0">
                    {parsed && parsed.amount > 0 ? (
                      <div
                        className="text-base font-black"
                        style={{ color: isDebit ? '#dc2626' : '#16a34a' }}
                      >
                        {isDebit ? '-' : '+'}₹{parsed.amount.toLocaleString('en-IN')}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-gray-500">Transaction</div>
                    )}

                    <div className="text-[10px] text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(raw.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                  </div>

                  <div className="shrink-0 text-gray-300 ml-1">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* ── Is this payment trip-related? Action Prompt ── */}
                <div
                  className="px-4 py-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
                  style={{
                    background: isTrip
                      ? 'rgba(220, 252, 231, 0.4)'
                      : isPersonal
                      ? 'rgba(243, 244, 246, 0.6)'
                      : 'rgba(254, 243, 199, 0.25)',
                    borderColor: 'rgba(44, 24, 16, 0.06)',
                  }}
                >
                  <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-semibold text-gray-700">Trip-related payment?</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* If marked Trip-Related */}
                    {isTrip ? (
                      <div className="flex items-center gap-2">
                        {isAdded ? (
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Added to Group Ledger
                          </span>
                        ) : parsed && parsed.amount > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openExpenseModal(msgId, parsed, raw.sender, raw.body);
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                            style={{ background: COLORS.burgundy }}
                          >
                            <Plus className="w-3 h-3" /> Add to Trip Expenses
                          </button>
                        ) : null}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearClassification(msgId);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 text-[11px] flex items-center gap-0.5 cursor-pointer"
                          title="Reset choice"
                        >
                          <Undo2 className="w-3 h-3" /> Reset
                        </button>
                      </div>
                    ) : isPersonal ? (
                      /* If marked Personal */
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500">
                          Marked as Personal
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearClassification(msgId);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-all cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      /* Prompt options: Yes or No */
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClassify(msgId, 'trip');
                            if (parsed && parsed.amount > 0) {
                              openExpenseModal(msgId, parsed, raw.sender, raw.body);
                            }
                          }}
                          className="px-3 py-1 rounded-lg text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Check className="w-3 h-3 text-emerald-700" /> Yes, Trip Related
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClassify(msgId, 'personal');
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-300 flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <XCircle className="w-3 h-3 text-gray-500" /> No, Personal
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details Accordion */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-3 border-t" style={{ borderColor: 'rgba(44,24,16,0.06)' }}>
                        {/* Transaction metadata */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs mb-3">
                          {parsed && (
                            <div>
                              <span className="text-gray-400 font-semibold block text-[10px]">Amount</span>
                              <p className="font-bold text-gray-800">₹{parsed.amount.toLocaleString('en-IN')}</p>
                            </div>
                          )}

                          <div>
                            <span className="text-gray-400 font-semibold block text-[10px]">Type</span>
                            <p className="font-bold text-gray-800">{isDebit ? 'Debit / Expense' : 'Credit / Income'}</p>
                          </div>

                          {parsed?.merchant && (
                            <div>
                              <span className="text-gray-400 font-semibold block text-[10px]">Payee / Merchant</span>
                              <p className="font-bold text-gray-800 truncate">{parsed.merchant}</p>
                            </div>
                          )}

                          {parsed?.accountLast4 && (
                            <div>
                              <span className="text-gray-400 font-semibold block text-[10px]">Account</span>
                              <p className="font-bold font-mono text-gray-800">••••{parsed.accountLast4}</p>
                            </div>
                          )}

                          {parsed?.upiRef && (
                            <div>
                              <span className="text-gray-400 font-semibold block text-[10px]">UPI Reference / UTR</span>
                              <p className="font-bold font-mono text-gray-800 text-[11px] truncate">{parsed.upiRef}</p>
                            </div>
                          )}

                          <div>
                            <span className="text-gray-400 font-semibold block text-[10px]">Sender Address</span>
                            <p className="font-bold font-mono text-gray-800 text-[11px]">{raw.sender}</p>
                          </div>

                          <div>
                            <span className="text-gray-400 font-semibold block text-[10px]">Timestamp</span>
                            <p className="font-bold text-gray-800 text-[11px]">
                              {new Date(raw.timestamp).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Full Raw SMS Message */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                              Original SMS Body
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyText(msgId, raw.body);
                              }}
                              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                              style={{
                                color: copiedId === msgId ? '#16a34a' : COLORS.burgundy,
                                background: copiedId === msgId ? '#dcfce7' : `${COLORS.burgundy}10`,
                              }}
                            >
                              {copiedId === msgId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedId === msgId ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <div
                            className="rounded-lg p-3 text-[11px] font-mono text-gray-700 leading-relaxed break-all whitespace-pre-wrap"
                            style={{ background: `${COLORS.cream}30`, border: `1px solid ${COLORS.cream}` }}
                          >
                            {raw.body}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* ── Info Privacy Footer ─────────────────────────────────── */}
        {fetched && allMessages.length > 0 && (
          <div
            className="mt-6 mb-8 flex items-start gap-2.5 px-4 py-3 rounded-2xl text-[11px] text-gray-500 leading-relaxed"
            style={{
              background: `${COLORS.cream}25`,
              border: `1px solid ${COLORS.cream}80`,
            }}
          >
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
            <span>
              All transactions are filtered and processed locally on your phone.
              Marking an item as &ldquo;Trip-Related&rdquo; allows you to add it directly to this trip&apos;s expenses so your group can split it fairly.
            </span>
          </div>
        )}
      </div>

      {/* ── Add to Trip Expenses Modal / Sheet ─────────────────────── */}
      <AnimatePresence>
        {selectedTxForExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs" data-lenis-prevent="true">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              role="dialog"
              aria-modal="true"
              data-lenis-prevent="true"
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh] overscroll-contain border"
              style={{ borderColor: 'rgba(44,24,16,0.1)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                    style={{ background: COLORS.burgundy }}
                  >
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Add Trip Expense</h3>
                    <p className="text-[11px] text-gray-400">Imported from verified bank SMS</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTxForExpense(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmExpense} className="space-y-4">
                {/* Amount */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-wider">
                    Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-gray-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border font-bold text-base text-gray-900 outline-none focus:ring-2"
                      style={{ borderColor: 'rgba(44,24,16,0.15)' }}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Expense Title / Merchant */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-wider">
                    Description / Payee
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-800 outline-none focus:ring-2"
                    style={{ borderColor: 'rgba(44,24,16,0.15)' }}
                    placeholder="e.g. Zostel Hospitality, Cafe Dinner"
                  />
                </div>

                {/* Paid By Member */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-wider">
                    Paid By
                  </label>
                  <select
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-800 outline-none bg-white cursor-pointer"
                    style={{ borderColor: 'rgba(44,24,16,0.15)' }}
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.display_name} {m.user_id === authUser?.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Itinerary Link (Optional) */}
                {items.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-wider">
                      Link to Activity / Itinerary (Optional)
                    </label>
                    <select
                      value={expenseItemId}
                      onChange={(e) => setExpenseItemId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-800 outline-none bg-white cursor-pointer"
                      style={{ borderColor: 'rgba(44,24,16,0.15)' }}
                    >
                      <option value="">-- General Trip Expense --</option>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.label} (₹{item.cost})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Split Type */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-wider">
                    Split Type
                  </label>
                  <select
                    value={expenseSplitType}
                    onChange={(e) => setExpenseSplitType(e.target.value as SplitType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-800 outline-none bg-white cursor-pointer"
                    style={{ borderColor: 'rgba(44,24,16,0.15)' }}
                  >
                    <option value="equal">Split Equally among all members</option>
                    <option value="flat_per_person">Flat per person</option>
                    <option value="percentage">By Percentage</option>
                    <option value="organizer_paid">Organizer Paid</option>
                  </select>
                </div>

                {/* Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTxForExpense(null)}
                    className="flex-1 py-3 rounded-xl border font-bold text-xs text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                    style={{ borderColor: 'rgba(44,24,16,0.15)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingExpense}
                    className="flex-2 py-3 rounded-xl font-bold text-xs text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
                    style={{ background: COLORS.burgundy }}
                  >
                    {savingExpense ? 'Adding to Ledger...' : 'Confirm & Add Expense'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
