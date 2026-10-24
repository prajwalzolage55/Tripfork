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
  CheckCircle2,
  RefreshCw,
  Zap,
  Info,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Scale,
  ShieldCheck,
  Check,
  X,
  Search,
  Loader2,
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: COLORS.burgundy }}>
        <Loader2 className="animate-spin" size={36} style={{ color: COLORS.rose }} />
        <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Building financial event graph...</p>
      </div>
    );
  }

  const selectStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${COLORS.cream}`,
    fontWeight: 600, fontSize: '0.75rem', color: COLORS.burgundy, background: 'white', cursor: 'pointer', width: '100%',
  };

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* ─── Hero Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: `linear-gradient(135deg, ${COLORS.burgundy} 0%, #3a1520 50%, #1a0a10 100%)`,
          borderRadius: '1.25rem', padding: '2rem', color: 'white', position: 'relative', overflow: 'hidden', marginBottom: '1.5rem',
        }}
      >
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(184,58,75,0.25) 0%, transparent 70%)', borderRadius: '50%' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(16,185,129,0.15)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.75rem', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
              <Network size={13} />
              Section 4 · Financial Event Graph
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em' }}>Six-Node Dependency Graph</h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', marginTop: '0.5rem', maxWidth: '40rem', lineHeight: 1.6 }}>
              The trip modeled as a dependency graph across <strong style={{ color: 'white' }}>People</strong>, <strong style={{ color: 'white' }}>Commitments</strong>, <strong style={{ color: 'white' }}>Consumption</strong>, <strong style={{ color: 'white' }}>Payments</strong>, <strong style={{ color: 'white' }}>Benefits</strong>, and <strong style={{ color: 'white' }}>Dependencies</strong>. Changes cascade through the graph.
            </p>
          </div>
          <button onClick={loadData} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Sync
          </button>
        </div>

        {/* Node Count Bar */}
        {baseGraph && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {(Object.keys(NODE_CONFIGS) as FinancialNodeType[]).map(type => {
              const cfg = NODE_CONFIGS[type];
              const count = baseGraph.nodes.filter(n => n.type === type).length;
              return (
                <div key={type} style={{ padding: '0.625rem', borderRadius: '0.625rem', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ color: cfg.dot, fontWeight: 600, display: 'block', fontSize: '0.625rem' }}>{cfg.label}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ─── Cascade Simulator ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.burgundy, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} style={{ color: '#f59e0b' }} />
              Cascading Effects Simulator
            </h2>
            <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.25rem' }}>Model how changes ripple through cost, capacity, and fairness.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isSimulating && (
              <button onClick={() => { setIsSimulating(false); setCascadeResult(null); }} style={{ padding: '0.4rem 0.75rem', borderRadius: '0.625rem', fontSize: '0.7rem', fontWeight: 600, color: '#666', background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                Clear
              </button>
            )}
            <button onClick={handleRunCascade} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.625rem', background: `linear-gradient(135deg, ${COLORS.burgundy}, ${COLORS.rose})`, color: 'white', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              <Zap size={14} /> Simulate Ripple
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${COLORS.cream}40` }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.7rem', color: COLORS.burgundy, marginBottom: '0.375rem' }}>Change Scenario</label>
            <select value={simulationType} onChange={e => setSimulationType(e.target.value as any)} style={selectStyle}>
              <option value="member_withdraws">Participant Leaves Booking</option>
              <option value="cancel_booking">Cancel Entire Booking</option>
              <option value="price_increase">Vendor Tariff Surge (+₹2,000)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.7rem', color: COLORS.burgundy, marginBottom: '0.375rem' }}>Target Booking</label>
            <select value={targetBookingId} onChange={e => setTargetBookingId(e.target.value)} style={selectStyle}>
              {state?.bookings?.length ? state.bookings.map(b => (
                <option key={b.itemId} value={b.itemId}>{b.label} — ₹{b.cost.toLocaleString('en-IN')}</option>
              )) : <option value="">No bookings</option>}
            </select>
          </div>
          {simulationType === 'member_withdraws' && (
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.7rem', color: COLORS.burgundy, marginBottom: '0.375rem' }}>Withdrawing Traveler</label>
              <select value={targetMemberId} onChange={e => setTargetMemberId(e.target.value)} style={selectStyle}>
                {state?.members?.length ? state.members.map(m => (
                  <option key={m.memberId} value={m.memberId}>{m.displayName}</option>
                )) : <option value="">No travelers</option>}
              </select>
            </div>
          )}
          {simulationType === 'price_increase' && (
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.7rem', color: COLORS.burgundy, marginBottom: '0.375rem' }}>Tariff Delta</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontFamily: 'monospace', color: '#888' }}>₹</span>
                <input type="number" step="500" value={deltaPrice} onChange={e => setDeltaPrice(parseInt(e.target.value) || 0)} style={{ ...selectStyle, fontFamily: 'monospace', fontWeight: 700 }} />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ─── Cascade Results ─── */}
      <AnimatePresence>
        {isSimulating && cascadeResult && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            style={{ padding: '1.5rem', borderRadius: '1rem', background: COLORS.rosePale, border: `2px solid ${COLORS.rose}40`, marginBottom: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.625rem', borderRadius: '0.75rem', background: COLORS.rose, color: 'white' }}><Zap size={18} /></div>
                <div>
                  <h3 style={{ fontWeight: 800, color: COLORS.burgundy, fontSize: '0.95rem' }}>Ripple Results ({cascadeResult.litNodeIds?.length || 0} Nodes Glowing)</h3>
                  <p style={{ fontSize: '0.7rem', color: COLORS.burgundy + 'aa' }}>Downstream effects on participants, constraints, and fairness.</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '0.6rem', color: '#888' }}>Shifted Liability</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.1rem', color: COLORS.burgundy }}>
                  {cascadeResult.totalGroupImpact >= 0 ? '+' : ''}₹{Math.abs(cascadeResult.totalGroupImpact).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {cascadeResult.warnings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
                {cascadeResult.warnings.map((w, idx) => (
                  <div key={idx} style={{ padding: '0.625rem', borderRadius: '0.625rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} /> {w}
                  </div>
                ))}
              </div>
            )}

            {cascadeResult.applicableRuleCitations && cascadeResult.applicableRuleCitations.length > 0 && (
              <div style={{ padding: '1rem', borderRadius: '0.75rem', background: COLORS.burgundy, color: 'white', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.cream, marginBottom: '0.5rem' }}>
                  <Scale size={13} /> Fairness Constitution Citations
                </div>
                {cascadeResult.applicableRuleCitations.map((c, idx) => (
                  <p key={idx} style={{ fontSize: '0.7rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', paddingLeft: '0.75rem', borderLeft: `2px solid ${COLORS.rose}`, marginBottom: '0.375rem', lineHeight: 1.6, fontFamily: 'Georgia, serif' }}>{c}</p>
                ))}
              </div>
            )}

            {cascadeResult.memberImpacts.length > 0 && (
              <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', border: `1px solid ${COLORS.cream}` }}>
                <span style={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.burgundy, display: 'block', marginBottom: '0.75rem' }}>Per-Person Financial Deltas</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.625rem' }}>
                  {cascadeResult.memberImpacts.map(impact => (
                    <div key={impact.memberId} style={{ padding: '0.75rem', borderRadius: '0.625rem', background: COLORS.burgundyPale + '30', border: `1px solid ${COLORS.cream}`, fontSize: '0.7rem' }}>
                      <div style={{ fontWeight: 700, color: COLORS.burgundy, marginBottom: '0.25rem' }}>{impact.memberName}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '0.625rem', color: '#888' }}>
                        <span>₹{Math.round(impact.previousShare).toLocaleString('en-IN')}</span>
                        <span>→ ₹{Math.round(impact.newShare).toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.7rem', marginTop: '0.25rem', color: impact.delta > 0 ? '#92400e' : impact.delta < 0 ? '#166534' : '#888' }}>
                        {impact.delta > 0 ? `+₹${Math.round(impact.delta).toLocaleString('en-IN')} more` : impact.delta < 0 ? `-₹${Math.abs(Math.round(impact.delta)).toLocaleString('en-IN')} relieved` : 'No change'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Graph Visualizer ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        {/* Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1rem', borderBottom: `1px solid ${COLORS.cream}40`, marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            <button
              onClick={() => setSelectedType('all')}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '0.625rem', fontSize: '0.7rem', fontWeight: 700,
                background: selectedType === 'all' ? COLORS.burgundy : COLORS.burgundyPale + '40',
                color: selectedType === 'all' ? 'white' : COLORS.burgundy,
                border: `1px solid ${selectedType === 'all' ? COLORS.burgundy : COLORS.cream}`, cursor: 'pointer',
              }}
            >
              All ({baseGraph?.nodes.length || 0})
            </button>
            {(Object.keys(NODE_CONFIGS) as FinancialNodeType[]).map(type => {
              const cfg = NODE_CONFIGS[type];
              const count = baseGraph?.nodes.filter(n => n.type === type).length || 0;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.375rem 0.625rem', borderRadius: '0.625rem', fontSize: '0.65rem', fontWeight: 700,
                    background: selectedType === type ? COLORS.burgundy : cfg.bg,
                    color: selectedType === type ? 'white' : cfg.color,
                    border: `1px solid ${selectedType === type ? COLORS.burgundy : cfg.border}`, cursor: 'pointer',
                  }}
                >
                  <cfg.icon size={12} /> {cfg.label} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#bbb' }} />
            <input
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search nodes..."
              style={{ paddingLeft: '2rem', paddingRight: '0.75rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.75rem', borderRadius: '0.625rem', border: `1.5px solid ${COLORS.cream}`, width: '11rem', outline: 'none' }}
            />
          </div>
        </div>

        {/* Inspection Bar */}
        {selectedNode && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: COLORS.burgundyPale + '40', border: `1px solid ${COLORS.cream}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 700, color: COLORS.burgundy }}>
              Inspecting: {selectedNode.label} <span style={{ fontWeight: 400, color: '#888' }}>· {connectedNodeIds.size - 1} connections</span>
            </span>
            <button onClick={() => setSelectedNodeId(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, color: COLORS.rose, background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={13} /> Clear
            </button>
          </div>
        )}

        {/* Node Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {displayNodes.map(node => {
            const cfg = NODE_CONFIGS[node.type];
            const isLit = litNodeSet.has(node.id);
            const isFocused = selectedNodeId === node.id;
            const isConnected = selectedNodeId ? connectedNodeIds.has(node.id) : false;

            return (
              <motion.div
                key={node.id}
                whileHover={{ scale: 1.02, y: -2 }}
                onClick={() => setSelectedNodeId(isFocused ? null : node.id)}
                style={{
                  padding: '1rem', borderRadius: '0.875rem', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  border: `2px solid ${isLit ? '#f59e0b' : isFocused ? COLORS.burgundy : isConnected ? COLORS.rose + '60' : cfg.border}`,
                  background: isLit ? '#fffbeb' : isFocused ? 'white' : isConnected ? COLORS.rosePale + '40' : cfg.bg + '60',
                  boxShadow: isLit ? '0 0 20px rgba(245,158,11,0.3)' : isFocused ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {isLit && (
                  <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.125rem 0.375rem', borderRadius: '9999px', background: '#f59e0b', color: '#1a1a1a', fontWeight: 900, fontSize: '0.55rem', textTransform: 'uppercase' }}>
                      <Zap size={9} /> Lit
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                  <div style={{ padding: '0.5rem', borderRadius: '0.625rem', background: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>
                    <cfg.icon size={15} style={{ color: cfg.color }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.08rem 0.375rem', borderRadius: '0.25rem', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                      {node.status === 'violated' && (
                        <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '0.08rem 0.375rem', borderRadius: '0.25rem', background: '#fef2f2', color: '#be123c' }}>Violated</span>
                      )}
                    </div>
                    <h4 style={{ fontWeight: 700, fontSize: '0.8rem', color: COLORS.burgundy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</h4>
                    {node.sublabel && <p style={{ fontSize: '0.65rem', color: '#888', marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.sublabel}</p>}
                    {node.amount !== undefined && (
                      <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8rem', color: COLORS.burgundy }}>₹{node.amount.toLocaleString('en-IN')}</div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '0.625rem', paddingTop: '0.5rem', borderTop: `1px solid ${cfg.border}40`, display: 'flex', justifyContent: 'space-between', fontSize: '0.575rem', fontFamily: 'monospace', color: '#bbb' }}>
                  <span>{node.id.slice(0, 14)}</span>
                  <span>Click to inspect</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {displayNodes.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#999', fontSize: '0.8rem' }}>
            <Network size={36} style={{ color: COLORS.cream, marginBottom: '0.75rem' }} />
            <p>No graph nodes match your query.</p>
          </div>
        )}
      </motion.div>

      {/* Footer */}
      <div style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '0.75rem', background: COLORS.burgundyPale + '30', border: `1px solid ${COLORS.cream}`, fontSize: '0.75rem', color: COLORS.burgundy, lineHeight: 1.7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, marginBottom: '0.375rem' }}>
          <ShieldCheck size={16} style={{ color: COLORS.rose }} /> Section 4 Rationale
        </div>
        <p>The Financial Event Graph operates as the dependency engine. Changes propagate through 6 node types, illuminating downstream effects and binding every delta to the Fairness Constitution.</p>
      </div>
    </div>
  );
}
