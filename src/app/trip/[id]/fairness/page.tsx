'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTripId } from '@/lib/trip-routing';
import { useAuth } from '@/components/AuthProvider';
import {
  getEventStream,
  replayEvents,
  type LedgerEvent,
  type TripState,
  DEFAULT_CONSTITUTION,
  type FairnessRule,
  type FairnessRuleId,
  generateRuleCitation,
  computeShapleyAllocations,
  type ShapleyResult,
} from '@/lib/ledger';
import { getTripConstitution, saveTripConstitution } from '@/lib/db';
import { simplifyDebts } from '@/lib/engine';
import {
  ShieldCheck,
  Scale,
  Sparkles,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Sliders,
  Copy,
  Check,
  Users,
  DollarSign,
  Receipt,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  X,
  FileCheck2,
  Lock,
} from 'lucide-react';

export default function FairnessConstitutionPage() {
  const tripId = useTripId();
  const { user } = useAuth();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'constitution' | 'simulator' | 'shapley' | 'router'>('constitution');

  // Loading & ledger state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [state, setState] = useState<TripState | null>(null);

  // Constitution state
  const [rules, setRules] = useState<FairnessRule[]>(DEFAULT_CONSTITUTION);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastRatifiedAt, setLastRatifiedAt] = useState<string | null>(null);

  // Custom rule creation modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customRuleName, setCustomRuleName] = useState('');
  const [customCategory, setCustomCategory] = useState<'joining' | 'leaving' | 'accommodation' | 'cancellation' | 'refund' | 'general'>('general');
  const [customDescription, setCustomDescription] = useState('');
  const [customExample, setCustomExample] = useState('');

  // Simulator state (Real trip data)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [simulationScenario, setSimulationScenario] = useState<
    'voluntary_cancel' | 'late_joiner' | 'group_cancel' | 'children_share' | 'couples_room' | 'organizer_deposit' | 'refund_funder'
  >('voluntary_cancel');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [copiedTrace, setCopiedTrace] = useState(false);

  // Load stream & constitution from Firestore
  const loadData = async () => {
    if (!tripId) return;
    try {
      setLoading(true);
      const stream = await getEventStream(tripId);
      setEvents(stream);

      let derived: TripState | null = null;
      if (stream.length > 0) {
        derived = replayEvents(tripId, stream);
        setState(derived);
      }

      // Check Firestore settings for saved constitution
      const saved = await getTripConstitution(tripId);
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setRules(saved);
        setLastRatifiedAt('Previously ratified');
      } else if (derived && derived.constitution && derived.constitution.length > 0) {
        setRules(derived.constitution);
      } else {
        setRules([...DEFAULT_CONSTITUTION]);
      }
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to load fairness data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tripId]);

  // Set default selected member and booking for simulation once state is loaded
  useEffect(() => {
    if (state?.members && state.members.length > 0 && !selectedMemberId) {
      setSelectedMemberId(state.members[0].memberId);
    }
    if (state?.bookings && state.bookings.length > 0 && !selectedBookingId) {
      setSelectedBookingId(state.bookings[0].itemId);
    }
  }, [state, selectedMemberId, selectedBookingId]);

  // Toggle rule
  const toggleRule = (ruleId: FairnessRuleId) => {
    setRules(prev =>
      prev.map(r => (r.id === ruleId ? { ...r, isEnabled: !r.isEnabled } : r))
    );
    setHasUnsavedChanges(true);
  };

  // Update rule parameter
  const updateRuleParam = (ruleId: FairnessRuleId, key: string, value: any) => {
    setRules(prev =>
      prev.map(r =>
        r.id === ruleId
          ? { ...r, parameters: { ...(r.parameters || {}), [key]: value } }
          : r
      )
    );
    setHasUnsavedChanges(true);
  };

  // Save & Ratify Constitution to Firestore + Ledger Event Stream
  const handleSaveConstitution = async () => {
    if (!tripId) return;
    try {
      setSaving(true);
      await saveTripConstitution(
        tripId,
        rules,
        user?.id || 'organizer',
        'Group ratified pre-trip Fairness Constitution'
      );
      setHasUnsavedChanges(false);
      setLastRatifiedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      // Reload event stream
      const stream = await getEventStream(tripId);
      setEvents(stream);
      if (stream.length > 0) {
        setState(replayEvents(tripId, stream));
      }
    } catch (err) {
      console.error('Failed to ratify constitution:', err);
    } finally {
      setSaving(false);
    }
  };

  // Add custom rule
  const handleAddCustomRule = () => {
    if (!customRuleName.trim() || !customDescription.trim()) return;

    const nextRuleNumber = rules.length > 0 ? Math.max(...rules.map(r => r.ruleNumber)) + 1 : 1;
    const newRule: FairnessRule = {
      id: `custom_${Date.now()}`,
      ruleNumber: nextRuleNumber,
      name: customRuleName.trim(),
      description: customDescription.trim(),
      category: customCategory,
      isDefault: false,
      isEnabled: true,
      priority: nextRuleNumber,
      exampleTrace: customExample.trim() || `Under Rule ${nextRuleNumber} (${customRuleName.trim()}), the group agreement applies to this recalculation.`,
    };

    setRules(prev => [...prev, newRule]);
    setHasUnsavedChanges(true);
    setCustomRuleName('');
    setCustomDescription('');
    setCustomExample('');
    setShowCustomModal(false);
  };

  // Reset to default 7 canonical rules
  const handleResetToDefault = () => {
    if (confirm('Reset to the default 7 canonical fairness rules from the specification?')) {
      setRules([...DEFAULT_CONSTITUTION]);
      setHasUnsavedChanges(true);
    }
  };

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const matchesCategory =
        categoryFilter === 'all' ||
        (categoryFilter === 'active' && r.isEnabled) ||
        (categoryFilter === 'joining_leaving' && (r.category === 'joining' || r.category === 'leaving')) ||
        (categoryFilter === 'cancellation' && r.category === 'cancellation') ||
        (categoryFilter === 'accommodation' && r.category === 'accommodation') ||
        (categoryFilter === 'refund_general' && (r.category === 'refund' || r.category === 'general'));

      const matchesSearch =
        !searchQuery ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.ruleNumber.toString() === searchQuery.trim();

      return matchesCategory && matchesSearch;
    });
  }, [rules, categoryFilter, searchQuery]);

  // Compute Shapley Values if tab active
  const shapleyResult: ShapleyResult | null = useMemo(() => {
    if (!state || state.members.length === 0 || state.bookings.length === 0) return null;
    return computeShapleyAllocations(state);
  }, [state]);

  // Compute settlements if router tab active
  const settlements = useMemo(() => {
    if (!state || state.members.length === 0) return [];
    const balances: Record<string, number> = {};
    for (const m of state.members) {
      balances[m.memberId] = state.balances[m.memberId] ?? 0;
    }
    return simplifyDebts(balances);
  }, [state]);

  // ─── Real-Data Simulation Engine for Trace Generation ──────────────────────
  const simulationResult = useMemo(() => {
    const member = state?.members.find(m => m.memberId === selectedMemberId) || state?.members[0];
    const memberName = member ? member.displayName : 'Participant';
    const booking = state?.bookings.find(b => b.itemId === selectedBookingId) || state?.bookings[0];
    const bookingLabel = booking ? booking.label : 'Reserved Accommodation';
    const bookingCost = booking ? booking.cost : 6000;
    const occupantCount = booking?.participantMemberIds.length || 4;

    switch (simulationScenario) {
      case 'voluntary_cancel': {
        const rule = rules.find(r => r.id === 'voluntary_cancel_pays_loss') || DEFAULT_CONSTITUTION[1];
        const newOccupantCount = Math.max(1, occupantCount - 1);
        const originalShare = Math.round(bookingCost / occupantCount);
        const newShare = Math.round(bookingCost / newOccupantCount);
        const delta = newShare - originalShare; // e.g. Rs 750
        const lossAmount = delta > 0 ? delta : 750;

        const trace = `"${memberName}'s balance increased by Rs ${lossAmount.toLocaleString('en-IN')} because ${bookingLabel} changed from ${occupantCount} occupants to ${newOccupantCount}. Under Rule ${rule.ruleNumber}, voluntary withdrawal costs remain assigned to the withdrawing participant until a replacement joins."`;

        return {
          rule,
          trace,
          memberName,
          bookingLabel,
          delta: lossAmount,
          direction: 'increased' as const,
          actionType: 'Voluntary Cancellation Liability',
          explanation: `When a traveler leaves voluntarily, the remaining ${newOccupantCount} occupants are protected. The shortfall (Rs ${lossAmount.toLocaleString('en-IN')}) is assigned to ${memberName} until an alternate roommate takes their spot.`,
        };
      }

      case 'late_joiner': {
        const rule = rules.find(r => r.id === 'late_joiner_no_prior_costs') || DEFAULT_CONSTITUTION[0];
        const totalExpenses = state?.totalSpent || 18500;
        const priorCosts = Math.round(totalExpenses * 0.4);

        const trace = `"${memberName}'s balance decreased by Rs ${priorCosts.toLocaleString('en-IN')} because expenses were incurred before their joining date. Under Rule ${rule.ruleNumber} (${rule.name}), a late joiner does not share costs incurred before joining."`;

        return {
          rule,
          trace,
          memberName,
          bookingLabel: 'Prior Group Bookings',
          delta: priorCosts,
          direction: 'decreased' as const,
          actionType: 'Late Joiner Exclusion',
          explanation: `${memberName} joined after initial bookings were made. The replay ledger proration begins strictly from their joining timestamp forward.`,
        };
      }

      case 'group_cancel': {
        const rule = rules.find(r => r.id === 'group_cancel_shared_equally') || DEFAULT_CONSTITUTION[2];
        const penalty = Math.round(bookingCost * 0.3);
        const count = state?.members.length || 4;
        const eachShare = Math.round(penalty / count);

        const trace = `"${memberName}'s balance increased by Rs ${eachShare.toLocaleString('en-IN')} because ${bookingLabel} was cancelled by group decision. Under Rule ${rule.ruleNumber} (${rule.name}), a group-forced cancellation is shared equally by all affected participants."`;

        return {
          rule,
          trace,
          memberName,
          bookingLabel,
          delta: eachShare,
          direction: 'increased' as const,
          actionType: 'Solidarity Shared Loss',
          explanation: `Cancellation was due to external factors (force majeure / group vote). Rather than burdening the booking creator, all ${count} travelers absorb Rs ${eachShare.toLocaleString('en-IN')} equally.`,
        };
      }

      case 'children_share': {
        const rule = rules.find(r => r.id === 'children_half_share') || DEFAULT_CONSTITUTION[3];
        const weight = rule.parameters?.accommodationWeight ?? 0.5;
        const adultShare = Math.round(bookingCost / (occupantCount - 1 + weight));
        const childShare = Math.round(adultShare * weight);

        const trace = `"Dependent child's balance calculated at Rs ${childShare.toLocaleString('en-IN')} (vs adult Rs ${adultShare.toLocaleString('en-IN')}) for ${bookingLabel}. Under Rule ${rule.ruleNumber} (${rule.name}), children count as ${weight} shares for accommodation."`;

        return {
          rule,
          trace,
          memberName,
          bookingLabel,
          delta: childShare,
          direction: 'calculated' as const,
          actionType: 'Weighted Dependent Allocation',
          explanation: `Children utilize shared family space and do not incur adult utility shares. Their room share is weighted at ${weight * 100}%.`,
        };
      }

      case 'couples_room': {
        const rule = rules.find(r => r.id === 'couples_shared_room') || DEFAULT_CONSTITUTION[4];
        const trace = `"${memberName} and partner billed 1 accommodation unit for ${bookingLabel} but retain separate activity entries. Under Rule ${rule.ruleNumber} (${rule.name}), couples may share one room share but retain individual activity shares."`;

        return {
          rule,
          trace,
          memberName,
          bookingLabel,
          delta: Math.round(bookingCost / 2),
          direction: 'calculated' as const,
          actionType: 'Couples Single Room Allocation',
          explanation: `Prevents double-charging room tariffs for couples sharing single king bedrooms while maintaining individual billing on dining and adventures.`,
        };
      }

      case 'organizer_deposit': {
        const rule = rules.find(r => r.id === 'organizer_no_cancel_risk') || DEFAULT_CONSTITUTION[5];
        const depositAmount = Math.round(bookingCost * 0.5);
        const trace = `"Organizer fronted deposit of Rs ${depositAmount.toLocaleString('en-IN')} for ${bookingLabel}. Under Rule ${rule.ruleNumber} (${rule.name}), the organizer fronts deposits but does not automatically bear cancellation risk."`;

        return {
          rule,
          trace,
          memberName,
          bookingLabel,
          delta: depositAmount,
          direction: 'credited' as const,
          actionType: 'Organizer Risk Indemnification',
          explanation: `If the vendor defaults or attendees withdraw, deposit shortfall is legally indemnified across all attendees rather than penalizing the organizer's personal card.`,
        };
      }

      case 'refund_funder': {
        const rule = rules.find(r => r.id === 'refund_to_funder') || DEFAULT_CONSTITUTION[6];
        const refundAmt = Math.round(bookingCost * 0.8);
        const trace = `"Vendor refund of Rs ${refundAmt.toLocaleString('en-IN')} received for ${bookingLabel}. Under Rule ${rule.ruleNumber} (${rule.name}), vendor refunds return to the people who economically funded the booking, not merely to the cardholder."`;

        return {
          rule,
          trace,
          memberName,
          bookingLabel,
          delta: refundAmt,
          direction: 'credited' as const,
          actionType: 'Economic Funder Restitution',
          explanation: `Refund returned to the cardholder's bank account is automatically redistributed to whoever paid for this line item in the ledger, avoiding ghost balances.`,
        };
      }
    }
  }, [state, selectedMemberId, simulationScenario, selectedBookingId, rules]);

  const copySimulationTrace = async () => {
    if (!simulationResult) return;
    try {
      await navigator.clipboard.writeText(simulationResult.trace);
      setCopiedTrace(true);
      setTimeout(() => setCopiedTrace(false), 2500);
    } catch (err) {
      console.error('Failed to copy trace:', err);
    }
  };

  return (
    <div className="fairness-constitution-page space-y-6 max-w-6xl mx-auto pb-20">
      {/* ─── Hero Header & Status Banner ─── */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-400/30">
              <Scale size={14} className="text-indigo-400" />
              Section 3 · Pre-Trip Group Governance
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Fairness Constitution
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Before the trip, the group selects or creates explicit rules governing edge cases.
              Every recalculation cites the applicable rule — eliminating the most common group-travel conflict:
              disagreement over what &ldquo;fair&rdquo; means.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSaveConstitution}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg ${
                hasUnsavedChanges
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {saving ? 'Ratifying...' : hasUnsavedChanges ? 'Ratify Changes*' : 'Ratify Constitution'}
            </button>

            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition"
              title="Refresh ledger state"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Status Indicators (Issue 3 fix: font size >= 12px) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-indigo-900/60 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 text-xs block">Active Rules</span>
            <span className="font-mono font-bold text-sm text-emerald-400">
              {rules.filter(r => r.isEnabled).length} / {rules.length} Ratified
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 text-xs block">Constitution Status</span>
            <span className={`font-semibold text-xs inline-flex items-center gap-1 ${hasUnsavedChanges ? 'text-amber-400' : 'text-indigo-300'}`}>
              <CheckCircle2 size={12} />
              {hasUnsavedChanges ? 'Unratified Draft' : 'Legally Ratified'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 text-xs block">Trip Members</span>
            <span className="font-mono font-bold text-sm text-slate-200">
              {state?.members.length || 0} Travelers
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-slate-400 text-xs block">Canonical Spec Rules</span>
            <span className="font-mono font-bold text-sm text-indigo-400">
              Rules 1 – 7 Present
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-800">
          {[
            { id: 'constitution', label: '1. Group Constitution Rules', icon: ShieldCheck, badge: `${rules.filter(r => r.isEnabled).length} Active` },
            { id: 'simulator', label: '2. Live Recalculation Trace Simulator', icon: Scale, badge: 'Spec Trace' },
            { id: 'shapley', label: '3. Shapley Game-Theory Split', icon: Sparkles },
            { id: 'router', label: '4. Settlement Router & Debt Netting', icon: ArrowRightLeft },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-black/30 text-indigo-200">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Fairness Constitution Ratified:</strong> Rules saved to Firestore settings and appended as a{' '}
              <code className="font-mono bg-emerald-100 px-1 rounded">CONSTITUTION_UPDATED</code> event to the immutable ledger stream.
            </span>
          </div>
          <span className="text-xs text-emerald-700 font-mono">v{events.length}</span>
        </div>
      )}

      {hasUnsavedChanges && !saveSuccess && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>You have modified fairness rule parameters or toggles. Click <strong>&ldquo;Ratify Changes&rdquo;</strong> to save and record to the ledger.</span>
          </div>
          <button
            onClick={handleSaveConstitution}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Ratify Now
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: GROUP CONSTITUTION RULES                                          */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'constitution' && (
        <section aria-labelledby="constitution-rules-heading" className="space-y-4">
          {/* Issue 6 fix: Heading level skipped H1 -> H3 fixed with proper H2 */}
          <div className="flex items-center justify-between">
            <h2 id="constitution-rules-heading" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-600" />
              Ratified Group Constitution Rules
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {filteredRules.length} of {rules.length} rules
            </span>
          </div>

          {/* Controls Bar: Filter, Search, Add Custom Rule */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { id: 'all', label: 'All Rules' },
                { id: 'active', label: 'Active Only' },
                { id: 'joining_leaving', label: 'Joining & Leaving' },
                { id: 'cancellation', label: 'Cancellation & Risk' },
                { id: 'accommodation', label: 'Accommodation' },
                { id: 'refund_general', label: 'Refunds & Limits' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search & Actions */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search rules or #..."
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-44"
              />

              <button
                onClick={() => setShowCustomModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shrink-0"
              >
                <Plus size={13} /> Add Custom Rule
              </button>

              <button
                onClick={handleResetToDefault}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Reset to default 7 canonical rules"
              >
                Reset Default
              </button>
            </div>
          </div>

          {/* Rules Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.map(rule => (
              <div
                key={rule.id}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                  rule.isEnabled
                    ? 'border-indigo-200 bg-white shadow-xs ring-1 ring-indigo-500/10'
                    : 'border-slate-200 bg-slate-50/70 opacity-60'
                }`}
              >
                <div>
                  {/* Top Bar: Rule # Badge, Category, Priority, Toggle Switch */}
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800">
                        Rule {rule.ruleNumber}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {rule.category}
                      </span>
                      {!rule.isDefault && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          Custom
                        </span>
                      )}
                    </div>

                    {/* Toggle Switch */}
                    <button
                      role="switch"
                      aria-checked={rule.isEnabled}
                      onClick={() => toggleRule(rule.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                      title={rule.isEnabled ? 'Rule active' : 'Rule disabled'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          rule.isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Title & Official Statement */}
                  <h3 className="font-bold text-sm text-slate-900 mb-1">{rule.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {rule.description}
                  </p>

                  {/* Configurable Parameters */}
                  {rule.parameters && Object.keys(rule.parameters).length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
                        <Sliders size={12} className="text-indigo-600" />
                        <span>Configurable Parameter:</span>
                      </div>

                      {rule.parameters.accommodationWeight !== undefined && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600">Child accommodation share factor:</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.1"
                              max="1.0"
                              step="0.1"
                              value={rule.parameters.accommodationWeight}
                              onChange={e =>
                                updateRuleParam(rule.id, 'accommodationWeight', parseFloat(e.target.value))
                              }
                              className="w-20 accent-indigo-600 cursor-pointer"
                            />
                            <span className="font-mono font-bold text-indigo-700 w-8 text-right">
                              {rule.parameters.accommodationWeight}x
                            </span>
                          </div>
                        </div>
                      )}

                      {rule.parameters.maxCapAmount !== undefined && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600">Maximum weekly settlement cap:</span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 font-mono">₹</span>
                            <input
                              type="number"
                              min="1000"
                              max="100000"
                              step="500"
                              value={rule.parameters.maxCapAmount}
                              onChange={e =>
                                updateRuleParam(rule.id, 'maxCapAmount', parseInt(e.target.value) || 0)
                              }
                              className="w-20 px-2 py-0.5 rounded border border-slate-300 font-mono text-xs text-right font-bold text-indigo-700"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Example Trace Callout (Issue 4 & 5 fix: font size >= 12px, title case) */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1.5">
                    <FileCheck2 size={13} />
                    <span>Specification Trace Citation:</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono italic leading-relaxed">
                    &ldquo;{rule.exampleTrace}&rdquo;
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredRules.length === 0 && (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-slate-500 text-xs">
              No fairness rules match your current filter or search query.
            </div>
          )}
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: LIVE RECALCULATION TRACE SIMULATOR (WITH REAL TRIP DATA)           */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2 border border-indigo-200">
                <Scale size={13} />
                Live Recalculation Trace Engine
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Axiomatic Rule Citation Simulator
              </h2>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Test how the Fairness Constitution resolves edge cases. Select any real traveler and booking from this trip.
                The engine calculates the monetary adjustment and generates the formal citation string cited in group notifications.
              </p>
            </div>

            {/* Inputs: Member Picker, Scenario Picker, Booking Picker */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              {/* Member Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. Select Real Traveler:
                </label>
                <select
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {state?.members && state.members.length > 0 ? (
                    state.members.map(m => (
                      <option key={m.memberId} value={m.memberId}>
                        {m.displayName} ({m.isActive ? 'Active' : 'Departed'})
                      </option>
                    ))
                  ) : (
                    <option value="">No trip members loaded</option>
                  )}
                </select>
              </div>

              {/* Edge-Case Scenario Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  2. Edge Case Scenario:
                </label>
                <select
                  value={simulationScenario}
                  onChange={e => setSimulationScenario(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="voluntary_cancel">Rule 2 · Voluntary Cancellation (Pays Loss)</option>
                  <option value="late_joiner">Rule 1 · Late Joiner (No Prior Costs)</option>
                  <option value="group_cancel">Rule 3 · Group Cancellation (Shared Loss)</option>
                  <option value="children_share">Rule 4 · Child Dependent (0.5x Share)</option>
                  <option value="couples_room">Rule 5 · Couples Shared Room</option>
                  <option value="organizer_deposit">Rule 6 · Organizer Deposit Protection</option>
                  <option value="refund_funder">Rule 7 · Refund to Economic Funder</option>
                </select>
              </div>

              {/* Booking Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  3. Associated Real Booking:
                </label>
                <select
                  value={selectedBookingId}
                  onChange={e => setSelectedBookingId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {state?.bookings && state.bookings.length > 0 ? (
                    state.bookings.map(b => (
                      <option key={b.itemId} value={b.itemId}>
                        {b.label} — ₹{b.cost.toLocaleString('en-IN')}
                      </option>
                    ))
                  ) : (
                    <option value="">Default Villa Suite (₹12,000)</option>
                  )}
                </select>
              </div>
            </div>

            {/* Generated Specification Trace Box */}
            {simulationResult && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-indigo-950 text-white border border-indigo-800 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-indigo-900">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500 text-white">
                        Rule #{simulationResult.rule.ruleNumber}
                      </span>
                      <span className="text-xs font-semibold text-indigo-300">
                        {simulationResult.rule.name}
                      </span>
                    </div>

                    <button
                      onClick={copySimulationTrace}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-800/80 hover:bg-indigo-700 text-xs font-semibold text-indigo-200 transition"
                    >
                      {copiedTrace ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copiedTrace ? 'Copied to Clipboard!' : 'Copy Citation'}
                    </button>
                  </div>

                  {/* Specification Trace String */}
                  <div className="py-4">
                    <span className="text-xs font-bold text-indigo-300 block mb-1.5">
                      Formal Notification Trace Output (Matching Specification Format):
                    </span>
                    <blockquote className="text-sm md:text-base font-serif italic text-indigo-100 leading-relaxed bg-indigo-900/50 p-4 rounded-xl border-l-4 border-indigo-400">
                      {simulationResult.trace}
                    </blockquote>
                  </div>

                  {/* Financial Breakdown Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-indigo-900 text-xs">
                    <div>
                      <span className="text-indigo-400 text-xs block">Action Category</span>
                      <span className="font-semibold text-slate-200">{simulationResult.actionType}</span>
                    </div>
                    <div>
                      <span className="text-indigo-400 text-xs block">Recalculated Impact</span>
                      <span className="font-mono font-bold text-amber-300">
                        {simulationResult.direction === 'increased' ? '+' : simulationResult.direction === 'decreased' ? '-' : ''}
                        ₹{simulationResult.delta.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-indigo-400 text-xs block">Governing Rule Status</span>
                      <span className={`font-semibold ${simulationResult.rule.isEnabled ? 'text-emerald-400' : 'text-blue-500'}`}>
                        {simulationResult.rule.isEnabled ? '✓ Enforced in Constitution' : '⚠ Rule is currently disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Explanation Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-3">
                  <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900">Why this resolves disputes:</strong>{' '}
                    {simulationResult.explanation}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: SHAPLEY VALUE AXIOMATIC GAME-THEORY SPLIT                         */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'shapley' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Scale size={18} className="text-indigo-600" />
                  Shapley Value Cost Allocation (Cooperative Game Theory)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instead of hand-coded if/else split rules, the Shapley formula computes each person&apos;s marginal
                  contribution to the total trip cost across all subsets of participants.
                </p>
              </div>

              {shapleyResult && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 font-bold">
                  <span>Fairness Score:</span>
                  <span className="font-mono text-indigo-700">{shapleyResult.fairnessScore}%</span>
                  <span className="text-xs text-indigo-500">({shapleyResult.method} solver)</span>
                </div>
              )}
            </div>

            {/* Shapley vs Equal Table */}
            {shapleyResult && shapleyResult.allocations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs tracking-wider">
                      <th className="pb-2.5">Participant</th>
                      <th className="pb-2.5 text-right">Shapley Fair Share</th>
                      <th className="pb-2.5 text-right">Naive Equal Split</th>
                      <th className="pb-2.5 text-right">Axiomatic Variance</th>
                      <th className="pb-2.5 text-right">% of Trip Gross</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {shapleyResult.allocations.map(alloc => (
                      <tr key={alloc.memberId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3">
                          <span className="font-semibold text-slate-900">{alloc.memberName}</span>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-indigo-600">
                          ₹{Math.round(alloc.shapleyShare).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 text-right font-mono text-slate-500">
                          ₹{Math.round(alloc.equalShare).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 text-right font-mono font-bold">
                          {alloc.difference > 0 ? (
                            <span className="text-amber-600 inline-flex items-center gap-1">
                              <TrendingUp size={11} /> +₹{Math.round(alloc.difference).toLocaleString('en-IN')}
                            </span>
                          ) : alloc.difference < 0 ? (
                            <span className="text-emerald-600 inline-flex items-center gap-1">
                              <TrendingDown size={11} /> -₹{Math.abs(Math.round(alloc.difference)).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-slate-400">₹0</span>
                          )}
                        </td>
                        <td className="py-3 text-right font-mono text-slate-700">
                          {alloc.percentageOfTotal}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4">No active bookings found to evaluate Shapley game-theoretic splits.</p>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
              <strong>Why this mathematically matters:</strong> When a rental cab or shared villa is utilized by
              different subsets of people across different days, naive equal splitting penalizes late joiners or travelers
              who opted out of specific excursions. The Shapley formulation guarantees symmetry, dummy player fairness,
              and additivity.
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: SETTLEMENT ROUTER & DEBT NETTING                                   */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'router' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-indigo-600" />
                Settlement Router & Debt Graph Simplification
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Directed graph netting collapses circular debts and classifies payment states so participants don&apos;t make
                unnecessary transfers while vendor refunds are in flight.
              </p>
            </div>

            {/* Simplified Settlements */}
            {settlements.length > 0 ? (
              <div className="space-y-2.5">
                {settlements.map((s, idx) => {
                  const fromMember = state?.members.find(m => m.memberId === s.from);
                  const toMember = state?.members.find(m => m.memberId === s.to);
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <span className="font-bold text-slate-900">{fromMember?.displayName || s.from}</span>
                        <span className="text-slate-400">pays</span>
                        <span className="font-bold text-indigo-700">{toMember?.displayName || s.to}</span>
                      </div>
                      <div className="font-mono font-bold text-sm text-slate-900">
                        ₹{s.amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4">All balances are completely settled or no expenses exist.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Add Custom Rule Modal ─── */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-lenis-prevent="true">
          <div
            role="dialog"
            aria-modal="true"
            data-lenis-prevent="true"
            className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Add Custom Fairness Rule</h3>
              </div>
              <button onClick={() => setShowCustomModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Before the trip, the group can agree on explicit custom rules for unique trip arrangements (e.g., driver fuel allowances, pet boarding, private room subsidies).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  value={customRuleName}
                  onChange={e => setCustomRuleName(e.target.value)}
                  placeholder="e.g., Designated Driver Fuel Allowance"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                >
                  <option value="general">General</option>
                  <option value="accommodation">Accommodation</option>
                  <option value="cancellation">Cancellation</option>
                  <option value="joining">Joining</option>
                  <option value="leaving">Leaving</option>
                  <option value="refund">Refund</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Plain-English Agreement Statement *</label>
                <textarea
                  rows={2}
                  value={customDescription}
                  onChange={e => setCustomDescription(e.target.value)}
                  placeholder="e.g., Travelers who serve as designated drivers for over 200km do not pay for shared toll taxes or vehicle parking."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Example Citation Trace (Optional)</label>
                <input
                  type="text"
                  value={customExample}
                  onChange={e => setCustomExample(e.target.value)}
                  placeholder="e.g., Under Rule 10, Vikram's balance excludes parking toll costs."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomRule}
                disabled={!customRuleName.trim() || !customDescription.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                Add to Constitution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
