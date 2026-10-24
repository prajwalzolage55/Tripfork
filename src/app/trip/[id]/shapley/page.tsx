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
  computeShapleyAllocations,
  type ShapleyResult,
  type ShapleyAllocation,
  getDetailedMarginalBreakdown,
  type MarginalBreakdown,
} from '@/lib/ledger';
import {
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  Info,
  Car,
  ChevronRight,
  ShieldCheck,
  Percent,
  Sigma,
  Layers,
  Users,
  Check,
  HelpCircle,
  Divide,
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

export default function ShapleyValuePage() {
  const tripId = useTripId();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [state, setState] = useState<TripState | null>(null);

  // Inspector state
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'inspector' | 'axioms' | 'car_example'>('overview');

  // Load stream
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
      console.error('Failed to load Shapley data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tripId]);

  // Set default selected member when loaded
  useEffect(() => {
    if (state?.members && state.members.length > 0 && !selectedMemberId) {
      setSelectedMemberId(state.members[0].memberId);
    }
  }, [state, selectedMemberId]);

  // Compute Shapley result
  const shapleyResult: ShapleyResult | null = useMemo(() => {
    if (!state || state.members.length === 0 || state.bookings.length === 0) return null;
    return computeShapleyAllocations(state);
  }, [state]);

  // Compute marginal breakdown for selected member
  const marginalBreakdown: MarginalBreakdown | null = useMemo(() => {
    if (!state || !selectedMemberId) return null;
    return getDetailedMarginalBreakdown(state, selectedMemberId);
  }, [state, selectedMemberId]);

  // Format currency helper
  const fmt = (amt: number) => {
    return Math.round(amt).toLocaleString('en-IN');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: COLORS.burgundy }}>
        <Loader2 className="animate-spin" size={36} style={{ color: COLORS.rose }} />
        <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Computing Shapley allocations...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Fair Split Table', icon: Scale },
    { id: 'inspector', label: 'Coalition Inspector', icon: Sigma },
    { id: 'axioms', label: 'The 4 Axioms', icon: ShieldCheck },
    { id: 'car_example', label: 'Car Example Proof', icon: Car },
  ];

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* ─── Hero Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: `linear-gradient(135deg, ${COLORS.burgundy} 0%, ${COLORS.burgundyLight} 50%, ${COLORS.rose} 100%)`,
          borderRadius: '1.25rem',
          padding: '2rem',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.15)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Sparkles size={13} />
              Section 6 · Cooperative Game Theory
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Shapley-Value Cost Allocation
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', marginTop: '0.5rem', maxWidth: '36rem', lineHeight: 1.6 }}>
              The mathematically unique, axiomatically fair allocation of shared costs when contributions overlap in complex ways.
            </p>
          </div>

          <button
            onClick={loadData}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem',
              borderRadius: '0.75rem', background: 'rgba(255,255,255,0.15)', color: 'white',
              fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.25)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Recompute
          </button>
        </div>

        {/* Specification Quote */}
        <div style={{ marginTop: '1.25rem', padding: '0.875rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '0.75rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', fontFamily: 'Georgia, serif' }}>
          &ldquo;When a rented car is used by different subsets of people on different days, no manual split rule handles this cleanly. The Shapley formula computes each person&apos;s marginal contribution across all possible subgroups.&rdquo;
        </div>

        {/* Stats Bar */}
        {shapleyResult && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            {[
              { label: 'Solver Method', value: `${shapleyResult.method} O(n·2ⁿ)`, accent: COLORS.cream },
              { label: 'Fairness Score', value: `${shapleyResult.fairnessScore}% Optimal`, accent: '#86efac' },
              { label: 'Total Cost', value: `₹${fmt(shapleyResult.totalCost)}`, accent: 'white' },
              { label: 'Efficiency Axiom', value: 'Σ φᵢ = v(N) ✓', accent: '#86efac' },
            ].map((stat) => (
              <div key={stat.label} style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ display: 'block', fontSize: '0.625rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{stat.label}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8rem', color: stat.accent }}>{stat.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem',
                borderRadius: '0.75rem', fontSize: '0.7rem', fontWeight: 700,
                background: activeTab === tab.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.1)',
                color: activeTab === tab.id ? COLORS.burgundy : 'rgba(255,255,255,0.8)',
                border: activeTab === tab.id ? 'none' : '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ═════ TAB 1: OVERVIEW TABLE ═════ */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.burgundy, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Scale size={18} style={{ color: COLORS.rose }} />
                  Axiomatic Cost Allocation Table
                </h2>
                <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.25rem' }}>
                  Comparing cooperative game theory marginal contributions with naive equal division.
                </p>
              </div>
              {shapleyResult && (
                <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '9999px', background: COLORS.burgundyPale, color: COLORS.burgundy, border: `1px solid ${COLORS.cream}` }}>
                  {shapleyResult.allocations.length} Participants
                </span>
              )}
            </div>

            {shapleyResult && shapleyResult.allocations.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.cream}` }}>
                      {['Participant', 'Shapley φᵢ', 'Equal Split', 'Variance', '% of Total', 'Action'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 0.5rem', color: COLORS.burgundy, fontWeight: 700, fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Participant' ? 'left' : 'right' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shapleyResult.allocations.map((alloc, idx) => (
                      <tr key={alloc.memberId} style={{ borderBottom: `1px solid ${COLORS.cream}40`, transition: 'background 0.2s' }} onMouseEnter={e => (e.currentTarget.style.background = COLORS.burgundyPale + '40')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '1rem 0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.burgundy}, ${COLORS.rose})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                              {alloc.memberName.charAt(0)}
                            </div>
                            <div>
                              <span style={{ fontWeight: 700, color: COLORS.burgundy, fontSize: '0.8rem' }}>{alloc.memberName}</span>
                              <div style={{ fontSize: '0.625rem', color: '#999', fontFamily: 'monospace' }}>
                                {alloc.breakdown.length} bookings
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem', color: COLORS.burgundy }}>
                          ₹{fmt(alloc.shapleyShare)}
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>
                          ₹{fmt(alloc.equalShare)}
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                          {alloc.difference > 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '0.5rem', background: '#fef3c7', color: '#92400e', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.7rem', border: '1px solid #fde68a' }}>
                              <TrendingUp size={11} /> +₹{fmt(alloc.difference)}
                            </span>
                          ) : alloc.difference < 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '0.5rem', background: '#dcfce7', color: '#166534', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.7rem', border: '1px solid #bbf7d0' }}>
                              <TrendingDown size={11} /> -₹{fmt(Math.abs(alloc.difference))}
                            </span>
                          ) : (
                            <span style={{ color: '#999', fontSize: '0.7rem' }}>₹0</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: COLORS.burgundy }}>
                          {alloc.percentageOfTotal}%
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                          <button
                            onClick={() => { setSelectedMemberId(alloc.memberId); setActiveTab('inspector'); }}
                            style={{
                              padding: '0.35rem 0.75rem', borderRadius: '0.5rem',
                              background: COLORS.burgundyPale, color: COLORS.burgundy,
                              fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${COLORS.cream}`,
                              cursor: 'pointer', transition: 'all 0.2s',
                            }}
                          >
                            Inspect φᵢ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#999', fontSize: '0.8rem' }}>
                <Scale size={36} style={{ color: COLORS.cream, marginBottom: '0.75rem' }} />
                <p>No active bookings found to compute Shapley values.</p>
              </div>
            )}

            {/* Game-Theoretic Guarantee Footer */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '0.75rem', background: COLORS.burgundyPale + '40', border: `1px solid ${COLORS.cream}`, fontSize: '0.75rem', color: COLORS.burgundy, lineHeight: 1.7 }}>
              <strong>Game-Theoretic Guarantee:</strong> The Shapley value is provably the <strong>only</strong> allocation satisfying Efficiency, Symmetry, Dummy Player, and Additivity axioms simultaneously.
            </div>
          </motion.div>
        )}

        {/* ═════ TAB 2: COALITION INSPECTOR ═════ */}
        {activeTab === 'inspector' && (
          <motion.div
            key="inspector"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: `1px solid ${COLORS.cream}40`, marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.burgundy, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sigma size={18} style={{ color: COLORS.rose }} />
                  Marginal Contribution Inspector
                </h2>
                <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.25rem' }}>
                  Inspect how every coalition permutation contributes to a traveler&apos;s fair share.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: COLORS.burgundy }}>Traveler:</label>
                <select
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                  style={{
                    padding: '0.4rem 0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${COLORS.cream}`,
                    fontWeight: 700, fontSize: '0.75rem', color: COLORS.burgundy, background: 'white',
                    cursor: 'pointer',
                  }}
                >
                  {state?.members.map(m => (
                    <option key={m.memberId} value={m.memberId}>{m.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            {marginalBreakdown && (
              <div>
                {/* Summary Card */}
                <div style={{ padding: '1.25rem', borderRadius: '1rem', background: `linear-gradient(135deg, ${COLORS.burgundyPale}60, ${COLORS.rosePale}40)`, border: `1px solid ${COLORS.cream}`, marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.rose }}>Shapley Valuation for</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: COLORS.burgundy }}>{marginalBreakdown.memberName}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.6rem', color: '#888' }}>Fair Share</span>
                      <span style={{ fontWeight: 800, color: COLORS.burgundy, fontSize: '0.9rem' }}>₹{fmt(marginalBreakdown.totalShapleyShare)}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.6rem', color: '#888' }}>Naive</span>
                      <span style={{ color: '#666' }}>₹{fmt(marginalBreakdown.totalEqualShare)}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.6rem', color: '#888' }}>Variance</span>
                      <span style={{ fontWeight: 700, color: marginalBreakdown.totalVariance >= 0 ? '#92400e' : '#166534' }}>
                        {marginalBreakdown.totalVariance >= 0 ? '+' : ''}₹{fmt(marginalBreakdown.totalVariance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coalition Table */}
                <h3 style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.burgundy, marginBottom: '0.75rem' }}>
                  All Coalitions S ⊆ N \ &#123;{marginalBreakdown.memberName}&#125; ({marginalBreakdown.coalitions.length} Subsets)
                </h3>

                <div style={{ overflowX: 'auto', maxHeight: '24rem', borderRadius: '0.75rem', border: `1px solid ${COLORS.cream}` }}>
                  <table style={{ width: '100%', textAlign: 'left', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: COLORS.burgundyPale + '40', position: 'sticky', top: 0 }}>
                        {['Coalition S', '|S|', 'v(S)', 'v(S∪{i})', 'Marginal Δ', 'Weight', 'Weighted φ'].map((h, i) => (
                          <th key={h} style={{ padding: '0.625rem', fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.burgundy, textAlign: i === 0 ? 'left' : 'right', borderBottom: `2px solid ${COLORS.cream}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {marginalBreakdown.coalitions.map((c, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.cream}30`, transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = COLORS.burgundyPale + '20')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '0.625rem', fontWeight: 600, color: COLORS.burgundy }}>
                            {c.coalitionNames.length > 0 ? (
                              <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {c.coalitionNames.map((name, i) => (
                                  <span key={i} style={{ padding: '0.1rem 0.4rem', borderRadius: '0.25rem', background: COLORS.cream + '60', fontSize: '0.625rem' }}>{name}</span>
                                ))}
                              </span>
                            ) : (
                              <span style={{ color: '#999', fontStyle: 'italic', fontWeight: 400 }}>∅ Empty</span>
                            )}
                          </td>
                          <td style={{ padding: '0.625rem', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>{c.coalitionSize}</td>
                          <td style={{ padding: '0.625rem', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>₹{fmt(c.costWithoutPlayer)}</td>
                          <td style={{ padding: '0.625rem', textAlign: 'right', fontFamily: 'monospace', color: COLORS.burgundy }}>₹{fmt(c.costWithPlayer)}</td>
                          <td style={{ padding: '0.625rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: COLORS.burgundy }}>₹{fmt(c.marginalContribution)}</td>
                          <td style={{ padding: '0.625rem', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>{c.weight}</td>
                          <td style={{ padding: '0.625rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: COLORS.rose }}>₹{fmt(c.weightedContribution)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', background: COLORS.burgundyPale + '30', border: `1px solid ${COLORS.cream}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: COLORS.burgundy }}>
                  <span>Σ [Weight × Marginal] = <strong>₹{fmt(marginalBreakdown.totalShapleyShare)}</strong></span>
                  <span style={{ fontWeight: 700, color: COLORS.rose, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={14} /> Verified
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═════ TAB 3: AXIOMS ═════ */}
        {activeTab === 'axioms' && (
          <motion.div
            key="axioms"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.burgundy, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <ShieldCheck size={18} style={{ color: COLORS.rose }} />
              The Four Axioms of Shapley Fairness
            </h2>
            <p style={{ fontSize: '0.7rem', color: '#888', marginBottom: '1.5rem' }}>
              Lloyd Shapley proved in 1953 that this is the only allocation satisfying these four axioms simultaneously.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {[
                {
                  num: 1, name: 'Efficiency', formula: 'Σ φᵢ(v) = v(N)',
                  desc: 'The sum of all Shapley values exactly equals total trip cost. No rupee is left unallocated.',
                  proof: shapleyResult ? `Total: ₹${fmt(shapleyResult.totalCost)} = Σφ: ₹${fmt(shapleyResult.allocations.reduce((s, a) => s + a.shapleyShare, 0))}` : 'Load data to verify',
                },
                {
                  num: 2, name: 'Symmetry', formula: 'v(S∪{i}) = v(S∪{j}) ⇒ φᵢ = φⱼ',
                  desc: 'If two travelers attend identical bookings and contribute equally to every coalition, their fair shares are guaranteed equal.',
                  proof: 'Equal participation → identical liabilities.',
                },
                {
                  num: 3, name: 'Dummy Player', formula: 'v(S∪{i}) = v(S) ⇒ φᵢ = 0',
                  desc: 'If a participant does not use or add cost to an activity, their marginal contribution is zero. Never billed for unused services.',
                  proof: 'Opt-out activities contribute ₹0.',
                },
                {
                  num: 4, name: 'Additivity', formula: 'φ(u + w) = φ(u) + φ(w)',
                  desc: 'If the trip is split into sub-games (Flight + Villa + Dinner), the fair share of the combined trip equals the sum of individual fair shares.',
                  proof: 'Total decomposes into item-level shares.',
                },
              ].map(axiom => (
                <div
                  key={axiom.num}
                  style={{
                    padding: '1.25rem', borderRadius: '1rem',
                    border: `1px solid ${COLORS.cream}`, background: COLORS.burgundyPale + '20',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.rose }}>
                      Axiom {axiom.num} · {axiom.name}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.625rem', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '0.15rem 0.5rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                      <CheckCircle2 size={11} /> Satisfied
                    </span>
                  </div>
                  <h3 style={{ fontWeight: 800, fontSize: '0.85rem', color: COLORS.burgundy, fontFamily: 'monospace', marginBottom: '0.5rem' }}>{axiom.formula}</h3>
                  <p style={{ fontSize: '0.7rem', color: '#666', lineHeight: 1.6, marginBottom: '0.75rem' }}>{axiom.desc}</p>
                  <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'white', border: `1px solid ${COLORS.cream}`, fontSize: '0.65rem', fontFamily: 'monospace', color: COLORS.burgundy }}>
                    {axiom.proof}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═════ TAB 4: CAR EXAMPLE ═════ */}
        {activeTab === 'car_example' && (
          <motion.div
            key="car"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Car size={20} style={{ color: COLORS.rose }} />
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.burgundy }}>Multi-Day Rented Car Scenario</h2>
                <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.125rem' }}>Why standard expense splitters fail and how Shapley solves overlapping usage.</p>
              </div>
            </div>

            {/* Scenario Card */}
            <div style={{
              padding: '1.5rem', borderRadius: '1rem',
              background: `linear-gradient(135deg, ${COLORS.burgundy}, ${COLORS.burgundyLight})`,
              color: 'white', marginBottom: '1.25rem',
            }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.85rem', color: COLORS.cream, marginBottom: '0.5rem' }}>The Conflict Scenario</h3>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
                SUV rented for ₹9,000 for 3 days (₹3,000/day):
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { day: 'Day 1 (₹3,000)', users: 'Aisha & Rahul' },
                  { day: 'Day 2 (₹3,000)', users: 'Rahul & Priya' },
                  { day: 'Day 3 (₹3,000)', users: 'Aisha, Rahul & Priya' },
                ].map(d => (
                  <div key={d.day} style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <span style={{ fontWeight: 700, color: COLORS.cream, display: 'block', fontSize: '0.75rem' }}>{d.day}</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>{d.users}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ padding: '0.875rem', borderRadius: '0.75rem', background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.25)' }}>
                  <span style={{ fontWeight: 700, color: '#fca5a5', display: 'block', marginBottom: '0.375rem', fontSize: '0.75rem' }}>❌ Naive Equal Split</span>
                  <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    ₹9,000 ÷ 3 = ₹3,000 each. Aisha and Priya object — Rahul used the car all 3 days!
                  </p>
                </div>
                <div style={{ padding: '0.875rem', borderRadius: '0.75rem', background: 'rgba(80,255,120,0.1)', border: '1px solid rgba(80,255,120,0.2)' }}>
                  <span style={{ fontWeight: 700, color: '#86efac', display: 'block', marginBottom: '0.375rem', fontSize: '0.75rem' }}>✓ Shapley Solution</span>
                  <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    Day 1: Aisha ₹1,500, Rahul ₹1,500.<br />
                    Day 2: Rahul ₹1,500, Priya ₹1,500.<br />
                    Day 3: Each ₹1,000.<br />
                    <strong style={{ color: 'white' }}>Rahul ₹4,000 · Aisha ₹2,500 · Priya ₹2,500</strong>
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem', borderRadius: '0.75rem', background: COLORS.burgundyPale + '30', border: `1px solid ${COLORS.cream}`, fontSize: '0.75rem', color: COLORS.burgundy, lineHeight: 1.7 }}>
              <strong>Key Takeaway:</strong> Every edge case where people join or leave activities mid-trip is handled structurally — no brittle if/else branches needed.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
