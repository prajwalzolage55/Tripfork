'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTripId } from '@/lib/trip-routing';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import {
  getEventStream,
  replayEvents,
  appendEvents,
  generateBalanceTrace,
  type LedgerEvent,
  type TripState,
  type BalanceTrace,
} from '@/lib/ledger';
import type { Expense, ItineraryItem, TripMember, Trip } from '@/lib/types';
import {
  History,
  Layers,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  HelpCircle,
  X,
  FileText,
  DollarSign,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Receipt,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  GitFork,
  Code,
  Users,
  Tag,
  Clock,
  Info,
  Scale,
} from 'lucide-react';

export default function TripLedgerPage() {
  const tripId = useTripId();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [purging, setPurging] = useState(false);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [tripState, setTripState] = useState<TripState | null>(null);

  // Filter & Search
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Trace Modal state
  const [selectedTraceMember, setSelectedTraceMember] = useState<{ id: string; name: string } | null>(null);
  const [memberTrace, setMemberTrace] = useState<BalanceTrace[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load Event Stream and derive TripState
  const loadLedger = useCallback(async () => {
    if (!tripId) return;
    try {
      setLoading(true);
      const stream = await getEventStream(tripId);
      setEvents(stream);
      if (stream.length > 0) {
        const derived = replayEvents(tripId, stream);
        setTripState(derived);
      } else {
        setTripState(null);
      }
    } catch (err: any) {
      console.error('Failed to load ledger stream:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  // Sync real existing Firestore data (expenses, items, members) into the event stream
  const handleSyncRealData = async () => {
    if (!tripId) return;
    setSyncing(true);
    try {
      // 1. Fetch real trip data
      const [tripDoc, memRes, expRes, itemRes] = await Promise.all([
        getDocs(query(collection(db, 'trips'), where('__name__', '==', tripId))),
        getDocs(query(collection(db, 'trip_members'), where('trip_id', '==', tripId))),
        getDocs(query(collection(db, 'expenses'), where('trip_id', '==', tripId))),
        getDocs(query(collection(db, 'itinerary_items'), where('trip_id', '==', tripId))),
      ]);

      const tripData = tripDoc.docs[0]?.data() as Trip | undefined;
      const loadedMembers = memRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as TripMember));
      const loadedExpenses = expRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as Expense));
      const loadedItems = itemRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ItineraryItem));

      const newEvents: Omit<LedgerEvent, 'id' | 'version'>[] = [];
      const now = new Date().toISOString();

      // Trip created event
      newEvents.push({
        tripId,
        type: 'TRIP_CREATED',
        actorId: user?.id || 'organizer',
        timestamp: tripData?.created_at || now,
        payload: {
          tripName: tripData?.name || 'Trip',
          destination: tripData?.destination || null,
          startDate: tripData?.start_date || null,
          endDate: tripData?.end_date || null,
          createdBy: user?.id || 'organizer',
          inviteCode: tripData?.invite_code || '',
        },
      });

      // Participant joined events for real members
      for (const m of loadedMembers) {
        newEvents.push({
          tripId,
          type: 'PARTICIPANT_JOINED',
          actorId: m.id,
          timestamp: m.joined_at || now,
          payload: {
            memberId: m.id,
            userId: m.user_id,
            displayName: m.display_name,
          },
        });
      }

      // Booking created events for real itinerary items
      for (const item of loadedItems) {
        newEvents.push({
          tripId,
          type: 'BOOKING_CREATED',
          actorId: user?.id || 'organizer',
          timestamp: now,
          payload: {
            itemId: item.id,
            type: (item.type as any) || 'activity',
            label: item.label,
            cost: Number(item.cost || 0),
            currency: 'INR',
            defaultSplitType: ((item as any).split_type) || 'equal',
            participantMemberIds: loadedMembers.map(m => m.id),
            startTime: item.start_time || null,
            endTime: item.end_time || null,
            vendorName: null,
            cancellationPolicy: null,
          },
        });

        if (item.status === 'cancelled') {
          newEvents.push({
            tripId,
            type: 'BOOKING_CANCELLED',
            actorId: user?.id || 'organizer',
            timestamp: now,
            payload: {
              itemId: item.id,
              label: item.label,
              reason: 'Cancelled in itinerary',
              refundAmount: null,
              penaltyAmount: null,
              cancelledBy: user?.id || 'organizer',
            },
          });
        }
      }

      // Expense added events for real expenses
      for (const exp of loadedExpenses) {
        newEvents.push({
          tripId,
          type: 'EXPENSE_ADDED',
          actorId: exp.paid_by,
          timestamp: exp.created_at || now,
          payload: {
            expenseId: exp.id,
            itemId: exp.item_id || null,
            amount: Number(exp.amount),
            currency: 'INR',
            paidByMemberId: exp.paid_by,
            splitType: (exp.split_type as any) || 'equal',
            participantMemberIds: loadedMembers.map(m => m.id),
            note: exp.note || null,
            receiptUrl: null,
          },
        });
      }

      await appendEvents(tripId, newEvents);
      setNotification({
        type: 'success',
        message: `Successfully synced ${newEvents.length} real events into the immutable ledger!`,
      });
      await loadLedger();
    } catch (err: any) {
      console.error('Error syncing real data:', err);
      setNotification({ type: 'error', message: 'Failed to sync data: ' + err.message });
    } finally {
      setSyncing(false);
    }
  };

  // Clear all events from Firestore to remove test/dummy data
  const handleClearEvents = async () => {
    if (!confirm('Are you sure you want to clear the ledger event log? This will remove all test/dummy events.')) {
      return;
    }
    setPurging(true);
    try {
      const evQ = query(collection(db, `trips/${tripId}/events`));
      const evDocs = await getDocs(evQ);
      for (const d of evDocs.docs) {
        await deleteDoc(d.ref);
      }
      setNotification({ type: 'success', message: 'Event stream cleared. You can now sync your genuine trip data.' });
      await loadLedger();
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Error clearing events: ' + err.message });
    } finally {
      setPurging(false);
    }
  };

  // Open "Why do I owe this?" trace modal for a specific member
  const handleOpenTrace = (memberId: string, memberName: string) => {
    if (!events.length) return;
    const trace = generateBalanceTrace(tripId, events, memberId, tripState?.constitution);
    setMemberTrace(trace);
    setSelectedTraceMember({ id: memberId, name: memberName });
  };

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter(e => {
      if (filterType === 'expenses') return e.type.startsWith('EXPENSE');
      if (filterType === 'bookings') return e.type.startsWith('BOOKING');
      if (filterType === 'participants') return e.type.startsWith('PARTICIPANT');
      if (filterType === 'refunds') return e.type.startsWith('REFUND');
      if (filterType === 'forks') return e.type === 'WHAT_IF_FORK_APPROVED';
      return true;
    });
  }, [events, filterType]);

  const formatCurrency = (amt: number) => {
    const formatted = Math.abs(amt).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    return amt < 0 ? `-₹${formatted}` : `₹${formatted}`;
  };

  // Toggle raw technical JSON view per event
  const [showRawJson, setShowRawJson] = useState<Record<string, boolean>>({});

  const toggleRawMode = (eventId: string) => {
    setShowRawJson(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const getMemberName = (id?: string | null) => {
    if (!id) return 'Organizer';
    const m = tripState?.members.find(mem => mem.memberId === id || mem.userId === id);
    return m ? m.displayName : id.length > 12 ? `${id.slice(0, 6)}...` : id;
  };

  const renderFriendlyEventDetails = (event: LedgerEvent, p: any) => {
    switch (event.type) {
      case 'BOOKING_CREATED': {
        const participantNames = Array.isArray(p.participantMemberIds)
          ? p.participantMemberIds.map((id: string) => getMemberName(id))
          : [];
        const perPersonShare = p.cost && participantNames.length > 0
          ? Math.round(p.cost / participantNames.length)
          : null;

        return (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Booking / Activity</span>
                <strong className="text-xs text-slate-900 block">{p.label}</strong>
                <span className="text-[11px] text-indigo-600 capitalize font-medium">{p.type || 'Activity'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Total Reserved Cost</span>
                <strong className="text-xs font-mono text-slate-900 block">₹{Number(p.cost || 0).toLocaleString('en-IN')}</strong>
                <span className="text-[11px] text-slate-500 capitalize">Split mode: {p.defaultSplitType || 'equal'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Per-Person Share</span>
                <strong className="text-xs font-mono text-emerald-700 block">
                  {perPersonShare !== null ? `₹${perPersonShare.toLocaleString('en-IN')}` : '₹0'}
                </strong>
                <span className="text-[11px] text-slate-500">Shared among {participantNames.length} participants</span>
              </div>
            </div>

            {/* Participants Sharing */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                <Users size={12} className="text-indigo-600" />
                Participants Included in Split ({participantNames.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {participantNames.map((name: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-800 text-[11px] font-semibold"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    {name}
                  </span>
                ))}
              </div>
            </div>

            {/* Timings and Policy */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
              {p.startTime && (
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-slate-400" />
                  Scheduled: {new Date(p.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {p.vendorName && (
                <span>Vendor: <strong className="text-slate-700">{p.vendorName}</strong></span>
              )}
              <span>Status: <strong className="text-emerald-700">Confirmed in Itinerary</strong></span>
              <span>Logged by: <strong className="text-slate-700">{getMemberName(event.actorId)}</strong></span>
            </div>
          </div>
        );
      }

      case 'EXPENSE_ADDED': {
        const participantNames = Array.isArray(p.participantMemberIds)
          ? p.participantMemberIds.map((id: string) => getMemberName(id))
          : [];
        const perPerson = p.amount && participantNames.length > 0
          ? Math.round(p.amount / participantNames.length)
          : null;

        return (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Expense Note</span>
                <strong className="text-xs text-slate-900 block">{p.note || 'Group Expense'}</strong>
                <span className="text-[11px] text-slate-500">{p.itemId ? 'Linked to Itinerary' : 'Direct Expense'}</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Amount Paid</span>
                <strong className="text-xs font-mono text-slate-900 block">₹{Number(p.amount || 0).toLocaleString('en-IN')}</strong>
                <span className="text-[11px] text-indigo-700 font-medium">Paid by {getMemberName(p.paidByMemberId)}</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Per-Person Cost</span>
                <strong className="text-xs font-mono text-emerald-700 block">
                  {perPerson !== null ? `₹${perPerson.toLocaleString('en-IN')}` : '₹0'}
                </strong>
                <span className="text-[11px] text-slate-500">{participantNames.length} participants split equally</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                <Users size={12} className="text-indigo-600" />
                Who Shares This Expense ({participantNames.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {participantNames.map((name: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-medium"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      }

      case 'PARTICIPANT_JOINED':
        return (
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs text-slate-900 block">{p.displayName}</strong>
                <span className="text-[11px] text-slate-500">
                  Joined on {new Date(event.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                Active Traveler
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              Enrolled in the trip ledger with an opening balance of ₹0. Eligible for subsequent shared itinerary bookings and split calculations.
            </p>
          </div>
        );

      case 'PARTICIPANT_LEFT':
        return (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-2 text-red-950 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs block">{p.displayName} (Departed)</strong>
                <span className="text-[11px] opacity-80">Reason: {p.reason || 'Voluntary departure'}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-red-200 text-red-800 text-[11px] font-bold">
                Inactive
              </span>
            </div>
            <p className="text-[11px] opacity-90">
              Excluded from future bookings from departure date forward. All prior financial balances and agreements are immutably preserved in the ledger stream.
            </p>
          </div>
        );

      case 'TRIP_CREATED':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Trip Name</span>
              <strong className="text-xs text-slate-900 block">{p.tripName}</strong>
              <span className="text-[11px] text-slate-500">{p.destination || 'Destination not set'}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Trip Dates</span>
              <strong className="text-xs text-slate-900 block">{p.startDate || 'TBD'} – {p.endDate || 'TBD'}</strong>
              <span className="text-[11px] text-slate-500">Created by {getMemberName(p.createdBy)}</span>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Invite Code</span>
              <strong className="text-xs font-mono text-indigo-700 block">{p.inviteCode || 'N/A'}</strong>
              <span className="text-[11px] text-slate-500">Share with participants to join</span>
            </div>
          </div>
        );

      case 'BOOKING_CANCELLED':
        return (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-2 text-red-950 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs block">{p.label} (Cancelled)</strong>
                <span className="text-[11px] opacity-80">Reason: {p.reason}</span>
              </div>
              <span className="text-xs font-mono font-bold text-red-700">
                Penalty: ₹{Number(p.penaltyAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] opacity-90 pt-1">
              <span>Refund expected: <strong>₹{Number(p.refundAmount || 0).toLocaleString('en-IN')}</strong></span>
              <span>Cancelled by: <strong>{getMemberName(p.cancelledBy)}</strong></span>
            </div>
          </div>
        );

      case 'WHAT_IF_FORK_APPROVED':
        return (
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-2.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider block">
                  Timeline Milestone
                </span>
                <strong className="text-xs text-slate-900 block">{p.scenarioName}</strong>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-200 text-indigo-800 text-[11px] font-bold self-start sm:self-auto">
                {p.recommendation || 'Approved Fork'}
              </span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              {p.proposalSummary}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-indigo-800 pt-1 border-t border-indigo-100">
              <span>Group Impact: <strong>₹{Number(p.totalGroupImpact || 0).toLocaleString('en-IN')}</strong></span>
              <span>Prior baseline preserved: <strong>v{p.priorVersion}</strong></span>
              <span>Approved by: <strong>{getMemberName(p.approvedByMemberId)}</strong></span>
            </div>
          </div>
        );

      default:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {Object.entries(p || {}).map(([key, val]) => (
              <div key={key} className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {key.replace(/([A-Z])/g, ' $1')}
                </span>
                <span className="font-medium text-slate-800 break-all text-[11px]">
                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="ledger-page space-y-6 max-w-5xl mx-auto pb-16">
      {/* ─── Header ─── */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl border border-slate-700/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-400/30">
              <ShieldCheck size={13} />
              Feature 1 · Immutable Event Stream
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Event-Sourced Trip Ledger
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              The entire trip is modeled as an append-only stream of immutable events — never a mutable balance sheet.
              Every monetary state is derived dynamically by replaying events.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSyncRealData}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing Real Data...' : 'Sync Real Trip to Ledger'}
            </button>
            <button
              onClick={handleClearEvents}
              disabled={purging}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-800 text-blue-300 text-xs border border-slate-700 transition"
              title="Remove any dummy or test events"
            >
              <Trash2 size={13} />
              Clear Event Log
            </button>
          </div>
        </div>

        {/* Quick Stream Stats */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span>
            Total Immutable Events: <strong className="text-indigo-300 font-mono">v{events.length}</strong>
          </span>
          <span>·</span>
          <span>
            Tracked Members: <strong className="text-slate-200">{tripState?.members.length || 0}</strong>
          </span>
          <span>·</span>
          <span>
            Total Replayed Expenses: <strong className="text-slate-200">₹{(tripState?.totalSpent || 0).toLocaleString('en-IN')}</strong>
          </span>
          <span>·</span>
          <span className="text-emerald-400 inline-flex items-center gap-1">
            <ShieldCheck size={13} /> Provably Deterministic State
          </span>
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-500 hover:text-slate-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── Derived Balances Projection (State Derived from Event Replay) ─── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers size={18} className="text-indigo-600" />
              Dynamic Derived Balances (Replay Output)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These balances are derived on-the-fly by replaying the immutable event sequence. Nothing is hardcoded or statically stored.
            </p>
          </div>

          <button
            onClick={loadLedger}
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            <RotateCcw size={13} /> Re-run Replay
          </button>
        </div>

        {tripState && tripState.members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {tripState.members.map(m => {
              const bal = tripState.balances[m.memberId] ?? 0;
              const isPositive = bal > 0.01;
              const isNegative = bal < -0.01;

              return (
                <div
                  key={m.memberId}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900">{m.displayName}</span>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                          isPositive
                            ? 'bg-emerald-100 text-emerald-800'
                            : isNegative
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isPositive ? `+₹${bal.toLocaleString('en-IN')}` : isNegative ? `-₹${Math.abs(bal).toLocaleString('en-IN')}` : '₹0'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Joined: {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-IN') : 'Day 1'}
                    </div>
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {isPositive ? 'Owed to them' : isNegative ? 'Owes to group' : 'Settled up'}
                    </span>
                    <button
                      onClick={() => handleOpenTrace(m.memberId, m.displayName)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      <HelpCircle size={12} /> Why do they owe this?
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <History size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No events in stream yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Click &quot;Sync Real Trip to Ledger&quot; above to import your genuine itinerary items, expenses, and members into the immutable event stream.
            </p>
          </div>
        )}
      </div>

      {/* ─── Append-Only Event Stream Audit Trail ─── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History size={18} className="text-indigo-600" />
              Append-Only Event Stream ({events.length} Events)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Every action is recorded with a monotonic version number. Replaying these events in order derives the exact financial state.
            </p>
          </div>

          {/* Event Filter Pills */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {['all', 'expenses', 'bookings', 'participants', 'refunds', 'forks'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition ${
                  filterType === type
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type === 'forks' ? 'What-If Forks' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Events Timeline */}
        {filteredEvents.length > 0 ? (
          <div className="space-y-2.5 pt-2">
            {filteredEvents.map(event => {
              const isExpanded = expandedEventId === event.id;
              const p = event.payload as any;

              return (
                <div
                  key={event.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        v{event.version}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {event.type}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(event.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {p?.amount && (
                        <span className="font-mono font-bold text-xs text-indigo-700">
                          ₹{Number(p.amount).toLocaleString('en-IN')}
                        </span>
                      )}
                      {p?.cost && (
                        <span className="font-mono font-bold text-xs text-indigo-700">
                          ₹{Number(p.cost).toLocaleString('en-IN')}
                        </span>
                      )}
                      <button
                        onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                        className="text-slate-400 hover:text-slate-700 text-xs flex items-center gap-0.5"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span className="text-[11px]">{isExpanded ? 'Hide' : 'Inspect'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary line */}
                  <div className="text-xs text-slate-600 pl-1">
                    {event.type === 'TRIP_CREATED' && (
                      <span>Trip created: <strong>{p.tripName}</strong></span>
                    )}
                    {event.type === 'PARTICIPANT_JOINED' && (
                      <span>Participant joined: <strong>{p.displayName}</strong></span>
                    )}
                    {event.type === 'BOOKING_CREATED' && (
                      <span>
                        Activity/Booking scheduled: <strong>{p.label}</strong> (Cost: ₹{p.cost?.toLocaleString('en-IN')})
                      </span>
                    )}
                    {event.type === 'BOOKING_CANCELLED' && (
                      <span className="text-red-600">
                        Booking cancelled: <strong>{p.label}</strong> (Reason: {p.reason})
                      </span>
                    )}
                    {event.type === 'EXPENSE_ADDED' && (
                      <span>
                        Expense logged: <strong>{p.note || 'Expense'}</strong> for ₹{p.amount?.toLocaleString('en-IN')}
                      </span>
                    )}
                    {event.type === 'EXPENSE_DELETED' && (
                      <span className="text-red-600">
                        Expense reversed: #{p.expenseId} (₹{p.originalAmount})
                      </span>
                    )}
                    {event.type === 'REFUND_RECEIVED' && (
                      <span className="text-emerald-700">
                        Vendor refund received: ₹{p.amount?.toLocaleString('en-IN')}
                      </span>
                    )}
                    {event.type === 'REFUND_REDISTRIBUTED' && (
                      <span className="text-emerald-700">
                        Refund redistributed back to original participants (Rule: {p.rule})
                      </span>
                    )}
                    {event.type === 'WHAT_IF_FORK_APPROVED' && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900">
                        <div className="flex items-center gap-2">
                          <GitFork size={14} className="text-indigo-600 shrink-0" />
                          <span>
                            Timeline Fork Approved: <strong>{p.scenarioName}</strong> ({p.proposalSummary})
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-600 shrink-0">
                          Prior stream preserved at v{p.priorVersion}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expanded Event Inspection */}
                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                            Event Details & Breakdown
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded">
                            v{event.version} · {event.type}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleRawMode(event.id)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                        >
                          <Code size={12} />
                          {showRawJson[event.id] ? 'View Formatted Card' : 'View Technical JSON'}
                        </button>
                      </div>

                      {showRawJson[event.id] ? (
                        <div className="p-3 rounded-lg bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto">
                          <pre>{JSON.stringify(event, null, 2)}</pre>
                        </div>
                      ) : (
                        renderFriendlyEventDetails(event, p)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-4">No events found matching this filter.</p>
        )}
      </div>

      {/* ─── Trace Modal ("Why Do I Owe This?") ─── */}
      {selectedTraceMember && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-lenis-prevent="true" onClick={() => setSelectedTraceMember(null)}>
          <div
            role="dialog"
            aria-modal="true"
            data-lenis-prevent="true"
            className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto overscroll-contain border border-slate-200 shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[11px] uppercase font-bold text-indigo-600 tracking-wider">
                  Event Sequence Replay
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  Balance Audit for {selectedTraceMember.name}
                </h3>
              </div>
              <button onClick={() => setSelectedTraceMember(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500">
                This audit trail decompiles the exact event stream history affecting {selectedTraceMember.name}. Every rupee is traced to an immutable event:
              </p>

              {memberTrace.length > 0 ? (
                <div className="space-y-2.5">
                  {memberTrace.map((t, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            {t.eventType}
                          </span>
                          <div className="font-semibold text-slate-900 mt-1">
                            {t.description}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-mono font-bold ${t.impact > 0 ? 'text-emerald-600' : t.impact < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            {t.impact > 0 ? `+₹${t.impact.toLocaleString('en-IN')}` : t.impact < 0 ? `-₹${Math.abs(t.impact).toLocaleString('en-IN')}` : '₹0'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Running: ₹{t.runningBalance.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      {t.applicableRule && (
                        <div className="p-2.5 rounded-lg bg-indigo-50/80 border border-indigo-100 text-[11px] text-indigo-900">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-700 mb-0.5">
                            <Scale size={12} className="shrink-0" />
                            <span>Rule {t.applicableRule.ruleNumber}: {t.applicableRule.ruleName}</span>
                          </div>
                          <p className="text-indigo-800 italic leading-relaxed">{t.applicableRule.citation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                  No individual ledger entries affecting this member yet.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
              <button
                onClick={() => setSelectedTraceMember(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
