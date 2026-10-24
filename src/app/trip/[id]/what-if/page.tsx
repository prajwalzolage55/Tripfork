'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useTripId, getTripPath } from '@/lib/trip-routing';
import { useAuth } from '@/components/AuthProvider';
import {
  getEventStream,
  replayEvents,
  appendEvents,
  type LedgerEvent,
  type TripState,
  type WhatIfComparison,
  type WhatIfScenario,
  type ChangeSimulationType,
  generateMemberLeavesAfterDayScenarios,
  generateParticipantSkipsBookingScenarios,
  generatePrivateRoomsScenarios,
  generateHotelCancelsRoomScenarios,
  generateAirlineVouchersScenarios,
  generateSpendingCapScenarios,
  parseWhatIfQuery,
} from '@/lib/ledger';
import {
  GitFork,
  RotateCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Info,
  UserX,
  CalendarX,
  FileCheck2,
  Bed,
  Hotel,
  Plane,
  Coins,
  Search,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Clock,
  Check,
} from 'lucide-react';

export default function WhatIfPage() {
  const tripId = useTripId();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [baseState, setBaseState] = useState<TripState | null>(null);

  // Natural query search bar
  const [searchQuery, setSearchQuery] = useState('');

  // Active Simulation Type
  const [changeType, setChangeType] = useState<ChangeSimulationType>('member_leaves_after_day');

  // Interactive parameters (backed by real trip data)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [dayCutoff, setDayCutoff] = useState<number>(2);
  const [privateRoomMembers, setPrivateRoomMembers] = useState<string[]>([]);
  const [privateRoomSurcharge, setPrivateRoomSurcharge] = useState<number>(6000);
  const [hotelRefundAmount, setHotelRefundAmount] = useState<number>(4500);
  const [voucherAmount, setVoucherAmount] = useState<number>(15000);
  const [cashAlternative, setCashAlternative] = useState<number>(8600);
  const [spendingCapAmount, setSpendingCapAmount] = useState<number>(8000);

  // Selected scenario within the 4 parallel options
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0);

  const [comparison, setComparison] = useState<WhatIfComparison | null>(null);
  const [applyingFork, setApplyingFork] = useState(false);
  const [forkSuccess, setForkSuccess] = useState<string | null>(null);

  // Load real event stream & compute base state
  const loadTripData = useCallback(async () => {
    if (!tripId) return;
    try {
      setLoading(true);
      const stream = await getEventStream(tripId);
      setEvents(stream);
      if (stream.length > 0) {
        const state = replayEvents(tripId, stream);
        setBaseState(state);

        if (state.members.length > 0 && !selectedMemberId) {
          setSelectedMemberId(state.members[0].memberId);
        }
        if (state.members.length >= 2 && privateRoomMembers.length === 0) {
          setPrivateRoomMembers([state.members[0].memberId, state.members[1].memberId]);
        }
        if (state.bookings.length > 0 && !selectedBookingId) {
          setSelectedBookingId(state.bookings[0].itemId);
        }
      } else {
        setBaseState(null);
      }
    } catch (err) {
      console.error('Failed to load event stream for what-if:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId, selectedMemberId, selectedBookingId, privateRoomMembers.length]);

  useEffect(() => {
    loadTripData();
  }, [loadTripData]);

  // Memoized unique members and bookings (prevents duplicate key errors from legacy data)
  const uniqueMembers = useMemo(() => {
    if (!baseState?.members) return [];
    const map = new Map<string, typeof baseState.members[0]>();
    for (const m of baseState.members) {
      if (m.memberId && !map.has(m.memberId)) {
        map.set(m.memberId, m);
      }
    }
    return Array.from(map.values());
  }, [baseState?.members]);

  const uniqueBookings = useMemo(() => {
    if (!baseState?.bookings) return [];
    const map = new Map<string, typeof baseState.bookings[0]>();
    for (const b of baseState.bookings) {
      if (b.itemId && !map.has(b.itemId)) {
        map.set(b.itemId, b);
      }
    }
    return Array.from(map.values());
  }, [baseState?.bookings]);

  // Handle Natural Search Query
  const handleRunSearchQuery = (queryText: string) => {
    if (!baseState) return;
    setSearchQuery(queryText);
    const parsed = parseWhatIfQuery(queryText, baseState.members, baseState.bookings);
    if (parsed) {
      setChangeType(parsed.type);
      if (parsed.memberId) setSelectedMemberId(parsed.memberId);
      if (parsed.bookingId) setSelectedBookingId(parsed.bookingId);
      if (parsed.dayCutoff) setDayCutoff(parsed.dayCutoff);
      if (parsed.amount) {
        if (parsed.type === 'spending_cap') setSpendingCapAmount(parsed.amount);
        if (parsed.type === 'private_rooms') setPrivateRoomSurcharge(parsed.amount);
        if (parsed.type === 'hotel_cancels_room') setHotelRefundAmount(parsed.amount);
        if (parsed.type === 'airline_vouchers') setVoucherAmount(parsed.amount);
      }
      setSelectedScenarioIndex(0);
    }
  };

  // Re-run counterfactual replay whenever the trigger changes
  useEffect(() => {
    if (!baseState || events.length === 0) {
      setComparison(null);
      return;
    }

    const currentMember = baseState.members.find(m => m.memberId === selectedMemberId) || baseState.members[0];
    const memberName = currentMember ? currentMember.displayName : 'Traveler';
    const effectiveMemberId = currentMember ? currentMember.memberId : selectedMemberId;

    let comp: WhatIfComparison | null = null;

    switch (changeType) {
      case 'member_leaves_after_day':
        comp = generateMemberLeavesAfterDayScenarios(
          tripId,
          events,
          effectiveMemberId,
          memberName,
          dayCutoff,
          5
        );
        break;

      case 'member_skips_booking':
        if (selectedBookingId) {
          comp = generateParticipantSkipsBookingScenarios(
            tripId,
            events,
            effectiveMemberId,
            selectedBookingId
          );
        }
        break;

      case 'private_rooms':
        const targetIds = privateRoomMembers.length > 0
          ? privateRoomMembers
          : baseState.members.slice(0, 2).map(m => m.memberId);
        comp = generatePrivateRoomsScenarios(
          tripId,
          events,
          targetIds,
          privateRoomSurcharge
        );
        break;

      case 'hotel_cancels_room':
        const hotelBookingId = selectedBookingId || baseState.bookings[0]?.itemId || 'hotel-room';
        comp = generateHotelCancelsRoomScenarios(
          tripId,
          events,
          hotelBookingId,
          hotelRefundAmount
        );
        break;

      case 'airline_vouchers':
        const flightBookingId = selectedBookingId || baseState.bookings[0]?.itemId || 'flight-booking';
        comp = generateAirlineVouchersScenarios(
          tripId,
          events,
          flightBookingId,
          voucherAmount,
          cashAlternative
        );
        break;

      case 'spending_cap':
        comp = generateSpendingCapScenarios(
          tripId,
          events,
          effectiveMemberId,
          memberName,
          spendingCapAmount
        );
        break;
    }

    setComparison(comp);
    setSelectedScenarioIndex(0);
  }, [
    changeType,
    selectedMemberId,
    selectedBookingId,
    dayCutoff,
    privateRoomMembers,
    privateRoomSurcharge,
    hotelRefundAmount,
    voucherAmount,
    cashAlternative,
    spendingCapAmount,
    baseState,
    events,
    tripId,
  ]);

  const activeScenario: WhatIfScenario | null = useMemo(() => {
    if (!comparison || comparison.scenarios.length === 0) return null;
    return comparison.scenarios[selectedScenarioIndex] || comparison.scenarios[0];
  }, [comparison, selectedScenarioIndex]);

  // "Nothing changes until the group approves a scenario. The approved timeline becomes the new official ledger."
  const handleApproveAndFork = async () => {
    if (!activeScenario || !tripId) return;
    setApplyingFork(true);
    try {
      const forkEvents: Omit<LedgerEvent, 'id' | 'version'>[] = [];
      const timestamp = new Date().toISOString();
      const priorVersion = events.length;

      // 1. Explicit What-If Fork Approved Milestone Event
      forkEvents.push({
        tripId,
        type: 'WHAT_IF_FORK_APPROVED',
        actorId: user?.id || 'organizer',
        timestamp,
        payload: {
          forkId: activeScenario.id,
          scenarioName: activeScenario.name,
          proposalSummary: comparison?.proposalTitle || activeScenario.description,
          recommendation: activeScenario.recommendation,
          totalGroupImpact: activeScenario.cascade.totalGroupImpact || 0,
          approvedByMemberId: user?.id || 'organizer',
          priorVersion,
          changesApplied: [
            activeScenario.description,
            activeScenario.cheapestFairPlan.summary,
          ],
        },
        metadata: {
          source: 'web',
          whatIfBranch: activeScenario.id,
        },
      });

      // 2. Specific domain adjustments depending on scenario
      if (changeType === 'member_leaves_after_day') {
        const member = baseState?.members.find(m => m.memberId === selectedMemberId);
        forkEvents.push({
          tripId,
          type: 'PARTICIPANT_LEFT',
          actorId: user?.id || 'organizer',
          timestamp,
          payload: {
            memberId: selectedMemberId,
            userId: member?.userId || 'unknown',
            displayName: member?.displayName || 'Traveler',
            reason: 'voluntary',
          },
          metadata: { whatIfBranch: activeScenario.id },
        });
      } else if (changeType === 'member_skips_booking') {
        forkEvents.push({
          tripId,
          type: 'PARTICIPANT_OPTED_OUT',
          actorId: user?.id || selectedMemberId,
          timestamp,
          payload: {
            memberId: selectedMemberId,
            itemId: selectedBookingId,
            reason: `What-If Approved: ${activeScenario.name}`,
          },
          metadata: { whatIfBranch: activeScenario.id },
        });
      }

      await appendEvents(tripId, forkEvents);
      setForkSuccess(
        `Scenario "${activeScenario.name}" was approved! The official ledger timeline has been updated to v${priorVersion + forkEvents.length}. Prior states remain accessible.`
      );
      setTimeout(() => setForkSuccess(null), 8000);
      await loadTripData();
    } catch (err: any) {
      console.error('Failed to commit approved scenario:', err);
    } finally {
      setApplyingFork(false);
    }
  };

  const formatCurrency = (amt: number) => {
    const formatted = Math.abs(amt).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    return amt < 0 ? `-₹${formatted}` : `₹${formatted}`;
  };

  const getRecommendationBadge = (rec: string) => {
    switch (rec) {
      case 'Lowest total cost':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Best overall value':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Most flexible':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Simple but expensive':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  return (
    <div className="what-if-page space-y-6 max-w-6xl mx-auto pb-16">
      {/* ─── Hero Header ─── */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-400/30">
              <GitFork size={13} className="text-indigo-400 animate-pulse" />
              Feature 2 · Counterfactual Trip Fork Sandbox
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              What-If Time Machine <span className="text-indigo-400">· Trip Fork Engine</span>
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              &quot;If we make this change — exactly who pays more, who gets money back, which bookings become invalid, and what is the cheapest fair way to reorganize?&quot;
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={getTripPath(tripId, 'ledger')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
            >
              <span>Ledger Stream</span>
              <ArrowRight size={13} />
            </Link>
            <button
              onClick={loadTripData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700"
            >
              <RotateCcw size={13} />
              Reload
            </button>
          </div>
        </div>

        {events.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>
              Official Stream: <strong className="text-indigo-300 font-mono">v{events.length} events</strong>
            </span>
            <span>·</span>
            <span>
              Active Members: <strong className="text-slate-200">{baseState?.members.length || 0}</strong>
            </span>
            <span>·</span>
            <span>
              Active Bookings: <strong className="text-slate-200">{baseState?.bookings.length || 0}</strong>
            </span>
            <span>·</span>
            <span className="text-emerald-400 inline-flex items-center gap-1">
              <ShieldCheck size={13} /> Parallel Counterfactual Replay Active
            </span>
          </div>
        )}
      </div>

      {/* ─── Weather Twin What-If Simulation Studio Banner ─── */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-blue-500/30 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white">Weather-Driven Digital Twin Simulation Studio</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white">LIVE AI</span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Simulate counterfactual micro-climates (blizzards, cloudbursts, extreme heat), mountain pass closures, transit delays, and cascading schedule viability adjustments.
            </p>
          </div>
        </div>

        <Link
          href={`/trip/${tripId}/weather`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition shrink-0"
        >
          <span>Launch Weather Simulator</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {forkSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <p className="text-xs sm:text-sm font-semibold">{forkSuccess}</p>
          </div>
          <Link
            href={getTripPath(tripId, 'ledger')}
            className="text-xs font-bold text-emerald-700 hover:underline shrink-0 flex items-center gap-1"
          >
            Audit in Ledger <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* ─── Organizer Omni-Change Search & Quick Chips ─── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Organizer Change Input
          </span>
          <p className="text-xs text-slate-500">
            Enter any proposed change in plain text, or select one of the 6 canonical scenarios below.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleRunSearchQuery(e.target.value)}
            placeholder='Type any change (e.g. "Aisha leaves after Day 2", "Rahul skips rafting", "Two people want private rooms")'
            className="w-full text-xs font-medium pl-10 pr-4 py-3 rounded-xl border border-slate-300 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
          />
        </div>

        {/* Quick Suggestion Chips using Real Trip Data */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Sparkles size={12} className="text-indigo-600" />
            Quick Example Scenarios (from your trip):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              {
                text: `${uniqueMembers[0]?.displayName || 'Aisha'} leaves after Day 2`,
                type: 'member_leaves_after_day',
              },
              {
                text: `${uniqueMembers[1]?.displayName || uniqueMembers[0]?.displayName || 'Rahul'} skips ${uniqueBookings[0]?.label || 'rafting'}`,
                type: 'member_skips_booking',
              },
              {
                text: 'Two people want private rooms',
                type: 'private_rooms',
              },
              {
                text: 'The hotel cancels one room',
                type: 'hotel_cancels_room',
              },
              {
                text: 'The airline offers vouchers instead of cash',
                type: 'airline_vouchers',
              },
              {
                text: `${uniqueMembers[0]?.displayName || 'Aisha'} cannot pay more than Rs 8,000 this week`,
                type: 'spending_cap',
              },
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleRunSearchQuery(chip.text)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition font-medium text-left"
              >
                &ldquo;{chip.text}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* 6 Specification Tabs */}
        <div className="pt-2 border-t border-slate-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { id: 'member_leaves_after_day', label: 'Leaves After Day', icon: UserX },
              { id: 'member_skips_booking', label: 'Skips Activity', icon: CalendarX },
              { id: 'private_rooms', label: 'Private Rooms', icon: Bed },
              { id: 'hotel_cancels_room', label: 'Hotel Cancels', icon: Hotel },
              { id: 'airline_vouchers', label: 'Airline Vouchers', icon: Plane },
              { id: 'spending_cap', label: 'Spending Cap', icon: Coins },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setChangeType(tab.id as ChangeSimulationType);
                  setSelectedScenarioIndex(0);
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-semibold transition border ${
                  changeType === tab.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <tab.icon size={16} className="mb-1" />
                <span className="text-center truncate w-full">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Parameter Tuner (Backed by Real Trip Data) */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            Tune Simulation Parameters:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Participant selector */}
            {(changeType === 'member_leaves_after_day' ||
              changeType === 'member_skips_booking' ||
              changeType === 'spending_cap') && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Participant:
                </label>
                <select
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {uniqueMembers.map(m => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.displayName} (Net: {formatCurrency(baseState?.balances[m.memberId] ?? 0)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Day cutoff selector for leaves_after_day */}
            {changeType === 'member_leaves_after_day' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Leaves After Day:
                </label>
                <select
                  value={dayCutoff}
                  onChange={e => setDayCutoff(parseInt(e.target.value, 10))}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={1}>After Day 1</option>
                  <option value={2}>After Day 2 (Spec Example)</option>
                  <option value={3}>After Day 3</option>
                  <option value={4}>After Day 4</option>
                </select>
              </div>
            )}

            {/* Booking / Activity selector */}
            {(changeType === 'member_skips_booking' ||
              changeType === 'hotel_cancels_room' ||
              changeType === 'airline_vouchers') && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Activity / Booking:
                </label>
                <select
                  value={selectedBookingId}
                  onChange={e => setSelectedBookingId(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {uniqueBookings.map(b => (
                    <option key={b.itemId} value={b.itemId}>
                      {b.label} — ₹{b.cost.toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Private rooms surcharge */}
            {changeType === 'private_rooms' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Private Room Surcharge (₹):
                </label>
                <input
                  type="number"
                  value={privateRoomSurcharge}
                  onChange={e => setPrivateRoomSurcharge(Number(e.target.value))}
                  step={500}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Hotel refund amount */}
            {changeType === 'hotel_cancels_room' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hotel Refund Payout (₹):
                </label>
                <input
                  type="number"
                  value={hotelRefundAmount}
                  onChange={e => setHotelRefundAmount(Number(e.target.value))}
                  step={500}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Airline voucher vs cash */}
            {changeType === 'airline_vouchers' && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Voucher Offer (₹):
                  </label>
                  <input
                    type="number"
                    value={voucherAmount}
                    onChange={e => setVoucherAmount(Number(e.target.value))}
                    step={500}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cash Alternative (₹):
                  </label>
                  <input
                    type="number"
                    value={cashAlternative}
                    onChange={e => setCashAlternative(Number(e.target.value))}
                    step={500}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}

            {/* Spending cap amount */}
            {changeType === 'spending_cap' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Weekly Max Cap (₹):
                </label>
                <input
                  type="number"
                  value={spendingCapAmount}
                  onChange={e => setSpendingCapAmount(Number(e.target.value))}
                  step={500}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Parallel Scenarios Table (Matching Solution Design Spec) ─── */}
      {comparison && comparison.scenarios.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" />
                Parallel Settlement Scenarios Generated (4 Options)
              </h2>
              <p className="text-xs text-slate-500">
                {comparison.proposalTitle} · Pick any scenario to inspect who pays more, who gets money back, and reorganization plans.
              </p>
            </div>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 self-start sm:self-auto">
              Parallel Simulation Active
            </span>
          </div>

          {/* Scenario Overview Table (Exact table from Section 2 spec) */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Scenario</th>
                    <th className="py-3 px-4">Group Impact</th>
                    <th className="py-3 px-4">Who Is Affected</th>
                    <th className="py-3 px-4">Recommendation</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {comparison.scenarios.map((scen, idx) => {
                    const isSelected = selectedScenarioIndex === idx;
                    return (
                      <tr
                        key={scen.id}
                        onClick={() => setSelectedScenarioIndex(idx)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-indigo-50/70 font-semibold' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <strong className="text-slate-900 block text-xs">{scen.name}</strong>
                              <span className="text-[11px] text-slate-500 font-normal line-clamp-1">
                                {scen.description}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800 shrink-0">
                          {scen.groupImpactText}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {scen.whoIsAffectedText}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${getRecommendationBadge(
                              scen.recommendation
                            )}`}
                          >
                            {scen.recommendation}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedScenarioIndex(idx);
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── The 4 Core Questions Deep-Dive Panel ─── */}
      {activeScenario && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <HelpCircle size={18} className="text-indigo-600" />
              <span>Answers to Key Questions for &quot;{activeScenario.name}&quot;</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Impact: {activeScenario.groupImpactText}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Question 1: Exactly Who Pays More? */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                <TrendingUp size={16} />
                <span>Exactly Who Pays More?</span>
              </div>
              {activeScenario.whoPaysMore.length > 0 ? (
                <div className="space-y-2">
                  {activeScenario.whoPaysMore.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-red-50/60 border border-red-100 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong className="text-slate-900 block">{p.memberName}</strong>
                        <span className="text-[11px] text-slate-600">{p.reason}</span>
                      </div>
                      <span className="font-mono font-bold text-red-700 shrink-0">
                        +{formatCurrency(p.delta)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  No participants pay more under this scenario.
                </div>
              )}
            </div>

            {/* Question 2: Who Gets Money Back? */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <TrendingDown size={16} />
                <span>Who Gets Money Back?</span>
              </div>
              {activeScenario.whoGetsMoneyBack.length > 0 ? (
                <div className="space-y-2">
                  {activeScenario.whoGetsMoneyBack.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong className="text-slate-900 block">{p.memberName}</strong>
                        <span className="text-[11px] text-slate-600">{p.reason}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 shrink-0">
                        {formatCurrency(p.delta)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  No refunds or savings distributions in this option.
                </div>
              )}
            </div>

            {/* Question 3: Which Bookings Become Invalid? */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                <AlertTriangle size={16} />
                <span>Which Bookings Become Invalid?</span>
              </div>
              {activeScenario.invalidBookings.length > 0 ? (
                <div className="space-y-2">
                  {activeScenario.invalidBookings.map((b, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs ${
                        b.severity === 'critical'
                          ? 'bg-red-50 border-red-200 text-red-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <strong className="block mb-0.5">{b.label}</strong>
                      <span className="text-[11px] opacity-90">{b.reason}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>All room capacities and booking constraints remain completely valid.</span>
                </div>
              )}
            </div>

            {/* Question 4: What is the Cheapest Fair Way to Reorganize? */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                  <Sparkles size={16} />
                  <span>What is the Cheapest Fair Way to Reorganize?</span>
                </div>
                {activeScenario.cheapestFairPlan.estimatedSavings > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Saves ₹{activeScenario.cheapestFairPlan.estimatedSavings.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-2">
                <p className="font-semibold text-slate-900">
                  {activeScenario.cheapestFairPlan.summary}
                </p>
                <div className="space-y-1 pt-1">
                  {activeScenario.cheapestFairPlan.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-slate-700 text-[11px]">
                      <span className="text-indigo-600 font-bold">•</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Selected Scenario Deep-Dive & Side-by-Side Impact Matrix ─── */}
      {activeScenario && comparison && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>Side-by-Side Participant Cost Impact</span>
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono">
                  {activeScenario.name}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculated by counterfactual replay against the official ledger without mutating stored state.
              </p>
            </div>

            {/* Approve & Fork Button */}
            <button
              onClick={handleApproveAndFork}
              disabled={applyingFork}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50"
            >
              <GitFork size={14} />
              {applyingFork ? 'Committing Fork...' : 'Approve & Fork to Official Ledger'}
            </button>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="pb-2.5">Traveler</th>
                  <th className="pb-2.5 text-right">Official Balance</th>
                  <th className="pb-2.5 text-right">Scenario Balance</th>
                  <th className="pb-2.5 text-right">Net Change</th>
                  <th className="pb-2.5 text-center">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {comparison.memberDiffs.map(diff => {
                  const scenBalObj = diff.scenarioBalances.find(s => s.scenarioId === activeScenario.id);
                  const newBal = scenBalObj ? scenBalObj.balance : diff.originalBalance;
                  const delta = scenBalObj ? scenBalObj.delta : 0;
                  const isTargeted = diff.memberId === selectedMemberId;

                  return (
                    <tr
                      key={diff.memberId}
                      className={`hover:bg-slate-50/80 transition ${isTargeted ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[11px] text-slate-700">
                            {diff.memberName.charAt(0)}
                          </span>
                          <span className="font-semibold text-slate-900">{diff.memberName}</span>
                          {isTargeted && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                              target
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-slate-600">
                        {formatCurrency(diff.originalBalance)}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(newBal)}
                      </td>
                      <td className="py-3 text-right font-mono font-bold">
                        {delta > 0 ? (
                          <span className="text-red-600">+{formatCurrency(delta)}</span>
                        ) : delta < 0 ? (
                          <span className="text-emerald-600">{formatCurrency(delta)}</span>
                        ) : (
                          <span className="text-slate-400">₹0</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {delta > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold border border-red-200">
                            <TrendingUp size={11} /> Pays More
                          </span>
                        ) : delta < 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                            <TrendingDown size={11} /> Saves
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Unchanged</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <Info size={16} className="text-indigo-600 shrink-0" />
            <span>
              <strong>Group Approval Guarantee:</strong> Nothing changes until the group approves a scenario.
              The approved timeline becomes the new official ledger, with every adjustment preserved and every prior state still accessible.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
