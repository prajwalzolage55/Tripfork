'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTripId } from '@/lib/trip-routing';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getEventStream,
  replayEvents,
  type LedgerEvent,
  type TripState,
  DEFAULT_CONSTITUTION,
  type FairnessRule,
  buildFinancialEventGraph,
  simulateGraphCascade,
  type FinancialGraph,
  type FinancialNode,
  type FinancialNodeType,
  type CascadeResult,
  type CascadeChangeRequest,
} from '@/lib/ledger';
import {
  Network,
  Users,
  Layers,
  Receipt,
  DollarSign,
  Gift,
  Sliders,
  AlertCircle,
  RefreshCw,
  Zap,
  Scale,
  ShieldCheck,
  X,
  Search,
  Loader2,
} from 'lucide-react';

const NODE_CONFIGS: Record<FinancialNodeType, { icon: typeof Users; label: string; color: string; bg: string; border: string; dot: string }> = {
  people: { icon: Users, label: 'People', color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe', dot: '#6366f1' },
  commitments: { icon: Layers, label: 'Commitments', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0', dot: '#10b981' },
  consumption: { icon: Receipt, label: 'Consumption', color: '#b45309', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  payments: { icon: DollarSign, label: 'Payments', color: '#7e22ce', bg: '#faf5ff', border: '#d8b4fe', dot: '#a855f7' },
  benefits: { icon: Gift, label: 'Benefits', color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc', dot: '#06b6d4' },
  dependencies: { icon: Sliders, label: 'Dependencies', color: '#be123c', bg: '#fff1f2', border: '#fecdd3', dot: '#f43f5e' },
};

export default function FinancialEventGraphPage() {
  const tripId = useTripId();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [state, setState] = useState<TripState | null>(null);

  const [selectedType, setSelectedType] = useState<FinancialNodeType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationType, setSimulationType] = useState<CascadeChangeRequest['type']>('member_withdraws');
  const [targetBookingId, setTargetBookingId] = useState<string>('');
  const [targetMemberId, setTargetMemberId] = useState<string>('');
  const [deltaPrice, setDeltaPrice] = useState<number>(2000);
  const [cascadeResult, setCascadeResult] = useState<CascadeResult | null>(null);

  const loadData = async () => {
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
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [tripId]);

  useEffect(() => {
    if (state?.bookings && state.bookings.length > 0 && !targetBookingId) setTargetBookingId(state.bookings[0].itemId);
    if (state?.members && state.members.length > 0 && !targetMemberId) setTargetMemberId(state.members[0].memberId);
  }, [state, targetBookingId, targetMemberId]);

  const baseGraph: FinancialGraph | null = useMemo(() => {
    if (!state) return null;
    return buildFinancialEventGraph(state);
  }, [state]);

  const handleRunCascade = () => {
    if (!baseGraph || !state) return;
    const result = simulateGraphCascade(baseGraph, state, { type: simulationType, targetBookingId, targetMemberId, deltaPrice });
    setCascadeResult(result);
    setIsSimulating(true);
  };

  const litNodeSet = useMemo(() => new Set(cascadeResult?.litNodeIds || []), [cascadeResult]);

  const displayNodes = useMemo(() => {
    if (!baseGraph) return [];
    return baseGraph.nodes.filter(node => {
      const matchesType = selectedType === 'all' || node.type === selectedType;
      const matchesSearch = !searchQuery || node.label.toLowerCase().includes(searchQuery.toLowerCase()) || (node.sublabel && node.sublabel.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [baseGraph, selectedType, searchQuery]);

  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId || !baseGraph) return new Set<string>();
    const connected = new Set<string>([selectedNodeId]);
    for (const edge of baseGraph.edges) {
      if (edge.fromId === selectedNodeId) connected.add(edge.toId);
      if (edge.toId === selectedNodeId) connected.add(edge.fromId);
    }
    return connected;
  }, [selectedNodeId, baseGraph]);

  const selectedNode = useMemo(() => baseGraph?.nodes.find(n => n.id === selectedNodeId) || null, [baseGraph, selectedNodeId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-900">
        <Loader2 className="animate-spin text-blue-600" size={36} />
        <p className="font-semibold text-sm text-slate-600">Building financial event graph...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      {/* ─── Hero Header (Single H1 on page) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6 sm:p-8 shadow-sm border border-slate-800"
      >
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-between items-start gap-4 flex-wrap relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-3">
              <Network size={14} />
              Section 4 · Financial Event Graph
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Six-Node Dependency Graph
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              The trip modeled as a dependency graph across <strong className="text-white">People</strong>, <strong className="text-white">Commitments</strong>, <strong className="text-white">Consumption</strong>, <strong className="text-white">Payments</strong>, <strong className="text-white">Benefits</strong>, and <strong className="text-white">Dependencies</strong>. Changes cascade through the graph.
            </p>
          </div>
          {/* Button Style 1: Glass Action Button */}
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all cursor-pointer"
            aria-label="Synchronize financial graph"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync
          </button>
        </div>

        {/* Node Count Bar */}
        {baseGraph && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-6 pt-5 border-t border-white/10 relative z-10">
            {(Object.keys(NODE_CONFIGS) as FinancialNodeType[]).map(type => {
              const cfg = NODE_CONFIGS[type];
              const count = baseGraph.nodes.filter(n => n.type === type).length;
              return (
                <div key={type} className="p-2.5 rounded-xl bg-black/30 border border-white/10">
                  <span className="block text-xs font-medium text-slate-300">{cfg.label}</span>
                  <span className="font-mono font-bold text-sm text-white">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ─── Cascade Simulator (H2) ─── */}
      <motion.section
        aria-labelledby="simulator-heading"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
      >
        <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
          <div>
            <h2 id="simulator-heading" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              Cascading Effects Simulator
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Model how changes ripple through cost, capacity, and fairness.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {isSimulating && (
              /* Button Style 2: Secondary Neutral Button */
              <button
                onClick={() => { setIsSimulating(false); setCascadeResult(null); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
            {/* Button Style 3: Primary Action Button */}
            <button
              onClick={handleRunCascade}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Zap size={14} /> Simulate Ripple
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block font-semibold text-xs text-slate-700 mb-1.5">Change Scenario</label>
            <select
              value={simulationType}
              onChange={e => setSimulationType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="member_withdraws">Participant Leaves Booking</option>
              <option value="cancel_booking">Cancel Entire Booking</option>
              <option value="price_increase">Vendor Tariff Surge (+₹2,000)</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-xs text-slate-700 mb-1.5">Target Booking</label>
            <select
              value={targetBookingId}
              onChange={e => setTargetBookingId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {state?.bookings?.length ? state.bookings.map(b => (
                <option key={b.itemId} value={b.itemId}>{b.label} — ₹{b.cost.toLocaleString('en-IN')}</option>
              )) : <option value="">No bookings</option>}
            </select>
          </div>
          {simulationType === 'member_withdraws' && (
            <div>
              <label className="block font-semibold text-xs text-slate-700 mb-1.5">Withdrawing Traveler</label>
              <select
                value={targetMemberId}
                onChange={e => setTargetMemberId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {state?.members?.length ? state.members.map(m => (
                  <option key={m.memberId} value={m.memberId}>{m.displayName}</option>
                )) : <option value="">No travelers</option>}
              </select>
            </div>
          )}
          {simulationType === 'price_increase' && (
            <div>
              <label className="block font-semibold text-xs text-slate-700 mb-1.5">Tariff Delta</label>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-400 text-xs">₹</span>
                <input
                  type="number"
                  step="500"
                  value={deltaPrice}
                  onChange={e => setDeltaPrice(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* ─── Cascade Results (H3) ─── */}
      <AnimatePresence>
        {isSimulating && cascadeResult && (
          <motion.section
            aria-labelledby="results-heading"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="p-6 rounded-2xl bg-slate-50 border border-slate-200"
          >
            <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 id="results-heading" className="font-bold text-slate-900 text-sm">
                    Ripple Results ({cascadeResult.litNodeIds?.length || 0} Nodes Glowing)
                  </h3>
                  <p className="text-xs text-slate-600">Downstream effects on participants, constraints, and fairness.</p>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-xs text-slate-500">Shifted Liability</span>
                <span className="font-mono font-black text-lg text-slate-900">
                  {cascadeResult.totalGroupImpact >= 0 ? '+' : ''}₹{Math.abs(cascadeResult.totalGroupImpact).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {cascadeResult.warnings.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-4">
                {cascadeResult.warnings.map((w, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-500 shrink-0" /> {w}
                  </div>
                ))}
              </div>
            )}

            {cascadeResult.applicableRuleCitations && cascadeResult.applicableRuleCitations.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-900 text-white mb-4">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  <Scale size={14} /> Fairness Constitution Citations
                </div>
                {cascadeResult.applicableRuleCitations.map((c, idx) => (
                  <p key={idx} className="text-xs italic text-slate-200 pl-3 border-l-2 border-blue-400 mb-1.5 leading-relaxed">
                    {c}
                  </p>
                ))}
              </div>
            )}

            {cascadeResult.memberImpacts.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 block mb-3">
                  Per-Person Financial Deltas
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {cascadeResult.memberImpacts.map(impact => (
                    <div key={impact.memberId} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <div className="font-bold text-slate-900 mb-1">{impact.memberName}</div>
                      <div className="flex justify-between font-mono text-xs text-slate-500">
                        <span>₹{Math.round(impact.previousShare).toLocaleString('en-IN')}</span>
                        <span>→ ₹{Math.round(impact.newShare).toLocaleString('en-IN')}</span>
                      </div>
                      <div className={`font-mono font-bold text-xs mt-1 ${impact.delta > 0 ? 'text-amber-800' : impact.delta < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {impact.delta > 0 ? `+₹${Math.round(impact.delta).toLocaleString('en-IN')} more` : impact.delta < 0 ? `-₹${Math.abs(Math.round(impact.delta)).toLocaleString('en-IN')} relieved` : 'No change'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ─── Graph Visualizer (H2) ─── */}
      <motion.section
        aria-labelledby="visualizer-heading"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
      >
        <div className="flex justify-between items-center flex-wrap gap-3 pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Network size={18} className="text-blue-600" />
            <h2 id="visualizer-heading" className="text-base font-bold text-slate-900">
              Interactive Node Visualizer
            </h2>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-900 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filter Bar (Standardized Pill Buttons: Button Style 2) */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setSelectedType('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              selectedType === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All ({baseGraph?.nodes.length || 0})
          </button>
          {(Object.keys(NODE_CONFIGS) as FinancialNodeType[]).map(type => {
            const cfg = NODE_CONFIGS[type];
            const count = baseGraph?.nodes.filter(n => n.type === type).length || 0;
            const isActive = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
                <span>{cfg.label}</span>
                <span className={isActive ? 'text-slate-300' : 'text-slate-400'}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Inspection Bar */}
        {selectedNode && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs mb-4">
            <span className="font-semibold text-slate-900">
              Inspecting: <span className="font-bold">{selectedNode.label}</span> <span className="text-slate-500 font-normal">· {connectedNodeIds.size - 1} connections</span>
            </span>
            {/* Button Style 4: Ghost Button */}
            <button
              onClick={() => setSelectedNodeId(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <X size={13} /> Clear
            </button>
          </div>
        )}

        {/* Node Cards Grid (H3 for each card heading) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayNodes.map(node => {
            const cfg = NODE_CONFIGS[node.type];
            const isLit = litNodeSet.has(node.id);
            const isFocused = selectedNodeId === node.id;
            const isConnected = selectedNodeId ? connectedNodeIds.has(node.id) : false;

            return (
              <motion.div
                key={node.id}
                whileHover={{ scale: 1.01, y: -2 }}
                onClick={() => setSelectedNodeId(isFocused ? null : node.id)}
                className={`p-4 rounded-xl cursor-pointer relative overflow-hidden transition-all border ${
                  isLit
                    ? 'border-amber-400 bg-amber-50/70 shadow-md ring-2 ring-amber-400/30'
                    : isFocused
                    ? 'border-slate-900 bg-white shadow-md ring-2 ring-slate-900/10'
                    : isConnected
                    ? 'border-blue-300 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {isLit && (
                  <div className="absolute top-2.5 right-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase">
                      <Zap size={10} /> Lit
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 shrink-0 text-slate-700">
                    <cfg.icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {cfg.label}
                      </span>
                      {node.status === 'violated' && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">Violated</span>
                      )}
                    </div>
                    {/* H3 Heading fixes skipped level (H2 -> H3) */}
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{node.label}</h3>
                    {node.sublabel && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{node.sublabel}</p>
                    )}
                    {node.amount !== undefined && (
                      <div className="mt-2 font-mono font-bold text-xs sm:text-sm text-slate-900">
                        ₹{node.amount.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between text-xs font-mono text-slate-400">
                  <span>{node.id.slice(0, 14)}</span>
                  <span>Click to inspect</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {displayNodes.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-xs sm:text-sm">
            <Network size={36} className="mx-auto text-slate-300 mb-3" />
            <p>No graph nodes match your query.</p>
          </div>
        )}
      </motion.section>

      {/* Footer */}
      <footer className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
          <ShieldCheck size={16} className="text-blue-600" /> Section 4 Rationale
        </div>
        <p>The Financial Event Graph operates as the dependency engine. Changes propagate through 6 node types, illuminating downstream effects and binding every delta to the Fairness Constitution.</p>
      </footer>
    </div>
  );
}
