'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTripId, getTripPath } from '@/lib/trip-routing';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getEventStream,
  replayEvents,
  generateBalanceTrace,
  type BalanceTrace,
  type LedgerEvent,
  type TripState,
  type DerivedMember,
  computePersonalImpactProfile,
  type PersonalImpactProfile,
  type PrivacyScopeSettings,
} from '@/lib/ledger';
import {
  User, DollarSign, ArrowRight, ArrowDown, ArrowUp, Loader2, CheckCircle2, Clock,
  ExternalLink, Plane, Hotel, Activity, Car, UtensilsCrossed, MoreHorizontal,
  Map as LucideMap, HelpCircle, ShieldCheck, X, Sparkles, Lock, Scale, Eye, EyeOff,
  AlertTriangle, Building2, Calendar, Check, QrCode, Share2, Shield, Layers, ChevronRight, FileText,
  Users
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

function typeIcon(type: string) {
  switch (type) {
    case 'flight': return Plane;
    case 'hotel': return Hotel;
    case 'activity': return Activity;
    case 'transfer': return Car;
    case 'dining': return UtensilsCrossed;
    default: return MoreHorizontal;
  }
}

export default function PersonalImpactLensPage() {
  const tripId = useTripId();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [currentMember, setCurrentMember] = useState<DerivedMember | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [state, setState] = useState<TripState | null>(null);
  const [trace, setTrace] = useState<BalanceTrace[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'cancellations' | 'refunds'>('overview');

  const [simulatedPrivacyScope, setSimulatedPrivacyScope] = useState<PrivacyScopeSettings>({
    memberId: '',
    shareItinerary: true,
    shareTotalSpend: false,
    shareIndividualExpenses: false,
    shareTransactionsWithGroup: false,
    shareReceiptsWithGroup: false,
    maskIndividualLineItems: true,
  });

  const [showTraceModal, setShowTraceModal] = useState(false);
  const [traceModalTab, setTraceModalTab] = useState<'tree' | 'chronological'>('tree');
  const [qrSettlement, setQrSettlement] = useState<{ amount: number, name: string, upiLink?: string } | null>(null);

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
    } catch (err) { console.error('Failed to load Me page data:', err); }
    finally { setLoading(false); }
  }, [tripId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (state?.members && state.members.length > 0) {
      // Strictly locked to the authenticated user's own profile; no viewing other profiles
      const match = state.members.find(m => m.userId === user?.id || m.memberId === user?.id) || state.members[0];
      setCurrentMember(match);
    }
  }, [state, user?.id]);

  useEffect(() => {
    if (currentMember) {
      setSimulatedPrivacyScope(prev => ({ ...prev, memberId: currentMember.memberId }));
    }
  }, [currentMember]);

  useEffect(() => {
    if (currentMember && events.length > 0 && tripId) {
      const tr = generateBalanceTrace(tripId, events, currentMember.memberId, state?.constitution);
      setTrace(tr);
    }
  }, [currentMember, events, tripId, state?.constitution]);

  const togglePrivacySetting = (key: string) => {
    setSimulatedPrivacyScope(prev => ({ ...prev, [key]: !(prev as Record<string, any>)[key] }));
  };

  const profile: PersonalImpactProfile | null = useMemo(() => {
    if (!state || !currentMember) return null;
    return computePersonalImpactProfile(state, currentMember.memberId, simulatedPrivacyScope);
  }, [state, currentMember, simulatedPrivacyScope]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: COLORS.burgundy }}>
        <Loader2 className="animate-spin" size={36} style={{ color: COLORS.rose }} />
        <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Loading Personal Lens...</p>
      </div>
    );
  }

  const netBalance = profile ? (profile.netBalance ?? ((profile.totalFronted ?? profile.totalPaid ?? 0) - profile.totalConsumed)) : 0;
  const isOwed = netBalance > 0;
  const isOwing = netBalance < 0;

  const btnTab = (id: string) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 700,
    background: activeTab === id ? 'white' : 'transparent', color: activeTab === id ? COLORS.burgundy : COLORS.burgundyLight, border: `1px solid ${activeTab === id ? COLORS.cream : 'transparent'}`, cursor: 'pointer', transition: 'all 0.2s',
  });

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: COLORS.burgundyPale, border: `1px solid ${COLORS.cream}`, color: COLORS.burgundy, fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <User size={13} /> Section 10 · Personal Impact Lens
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', color: COLORS.burgundy, margin: '0 0 0.25rem 0' }}>Your Trip Dashboard</h1>
          <p style={{ color: COLORS.burgundyLight, fontSize: '0.875rem', margin: 0 }}>Privacy-scoped view showing only your portion of the itinerary, costs, and exposure.</p>
        </div>
        
        {currentMember && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', background: 'white', border: `1px solid ${COLORS.cream}`, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: COLORS.burgundy, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                {currentMember.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '0.825rem', fontWeight: 800, color: COLORS.burgundy }}>{currentMember.displayName}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Your Profile
                </div>
              </div>
            </div>
            <Link
              href={getTripPath(tripId, 'group')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.55rem 0.95rem', borderRadius: '0.75rem', background: COLORS.burgundy, color: 'white', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(15,23,42,0.1)' }}
            >
              <Users size={14} /> View Group Dashboard &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* ─── Privacy Banner ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', padding: '1.25rem', borderRadius: '1rem', background: `linear-gradient(135deg, ${COLORS.burgundyPale} 0%, ${COLORS.rosePale} 100%)`, border: `1px solid ${COLORS.cream}`, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${COLORS.cream}` }}>
            {simulatedPrivacyScope.shareTotalSpend ? <Share2 size={20} style={{ color: '#059669' }} /> : <Shield size={20} style={{ color: COLORS.burgundy }} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: COLORS.burgundy, margin: 0 }}>Privacy Scope Active</h3>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', background: simulatedPrivacyScope.shareTotalSpend ? '#d1fae5' : 'white', color: simulatedPrivacyScope.shareTotalSpend ? '#065f46' : COLORS.burgundy, border: `1px solid ${COLORS.cream}` }}>
                {simulatedPrivacyScope.shareTotalSpend ? 'Shared' : 'Private'}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: COLORS.burgundyLight, margin: 0 }}>This personal dashboard shows only your individual obligations. For complete group balances and member settlements, use Group View.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => togglePrivacySetting('shareTotalSpend')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.625rem', background: simulatedPrivacyScope.shareTotalSpend ? COLORS.burgundy : 'white', color: simulatedPrivacyScope.shareTotalSpend ? 'white' : COLORS.burgundy, fontSize: '0.75rem', fontWeight: 700, border: `1px solid ${COLORS.cream}`, cursor: 'pointer', transition: 'all 0.2s' }}>
            {simulatedPrivacyScope.shareTotalSpend ? <Eye size={14} /> : <EyeOff size={14} />} {simulatedPrivacyScope.shareTotalSpend ? 'Totals Public' : 'Totals Private'}
          </button>
        </div>
      </motion.div>

      {/* ─── Metric Cards ─── */}
      {profile && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Net Balance', value: `${isOwed ? '+' : ''}₹${Math.abs(netBalance).toLocaleString('en-IN')}`, desc: isOwed ? 'You will be repaid' : isOwing ? 'You owe the group' : 'Settled', color: isOwed ? '#059669' : isOwing ? '#dc2626' : '#64748b', bg: isOwed ? '#ecfdf5' : isOwing ? '#fef2f2' : 'white', border: isOwed ? '#a7f3d0' : isOwing ? '#fecaca' : COLORS.cream, action: () => setShowTraceModal(true) },
            { label: 'Total Consumed', value: `₹${(profile.totalConsumed ?? 0).toLocaleString('en-IN')}`, desc: 'Your share of trip expenses', color: COLORS.burgundy, action: null },
            { label: 'Fronted / Paid', value: `₹${(profile.totalFronted ?? profile.totalPaid ?? 0).toLocaleString('en-IN')}`, desc: 'Amount you paid on behalf of group', color: COLORS.burgundy, action: null },
          ].map(m => (
            <div key={m.label} style={{ padding: '1.25rem', borderRadius: '1rem', background: m.bg || 'white', border: `1px solid ${m.border || COLORS.cream}`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{m.label}</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: m.color, marginBottom: '0.25rem' }}>{m.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: m.action ? '1rem' : 0 }}>{m.desc}</div>
              {m.action && (
                <button onClick={m.action} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', background: 'white', color: m.color, fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${m.border}`, cursor: 'pointer' }}>
                  <HelpCircle size={13} /> Why do I {isOwed ? 'get this' : 'owe this'}?
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: `1px solid ${COLORS.cream}`, paddingBottom: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <button onClick={() => setActiveTab('overview')} style={btnTab('overview')}>Overview</button>
        <button onClick={() => setActiveTab('itinerary')} style={btnTab('itinerary')}>My Itinerary</button>
        <button onClick={() => setActiveTab('cancellations')} style={btnTab('cancellations')}>Cancel Exposure</button>
        <button onClick={() => setActiveTab('refunds')} style={btnTab('refunds')}>Pending Refunds</button>
      </div>

      <AnimatePresence mode="wait">
        {/* ─── TAB: OVERVIEW ─── */}
        {activeTab === 'overview' && profile && (
          <motion.div key="overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            
            {/* Category Breakdown */}
            <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: COLORS.burgundy }}>Your Consumption Breakdown</h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: COLORS.burgundyPale, color: COLORS.burgundy }}>{(profile.categoryBreakdown || profile.consumedByCategory || []).length} Categories</span>
              </div>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {(profile.categoryBreakdown || profile.consumedByCategory || []).map(cat => {
                  const Icon = typeIcon(cat.category);
                  const pct = profile.totalConsumed > 0 ? (cat.amount / profile.totalConsumed) * 100 : 0;
                  return (
                    <div key={cat.category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, color: COLORS.burgundy, marginBottom: '0.375rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'capitalize' }}><div style={{ width: 24, height: 24, borderRadius: '0.375rem', background: COLORS.burgundyPale, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={14} /></div> {cat.category}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>₹{(cat.amount ?? 0).toLocaleString('en-IN')} <span style={{ color: '#888', fontWeight: 600 }}>{pct.toFixed(0)}%</span></div>
                      </div>
                      <div style={{ height: 6, background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: COLORS.burgundy, borderRadius: '9999px' }} /></div>
                    </div>
                  );
                })}
                {(!profile.categoryBreakdown || profile.categoryBreakdown.length === 0) && (!profile.consumedByCategory || profile.consumedByCategory.length === 0) && <div style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.8rem', border: `1px dashed ${COLORS.cream}`, borderRadius: '0.75rem' }}>No expenses recorded yet.</div>}
              </div>
            </div>

            {/* Settlements Box */}
            <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}` }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: COLORS.burgundy, marginBottom: '0.25rem' }}>Next Actions for You</h3>
              <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1.5rem' }}>Simplified transfers to settle your balance.</p>
              
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {(profile.directSettlements || []).map(s => (
                  <div key={s.id} style={{ padding: '1rem', borderRadius: '0.75rem', background: 'white', border: `1px solid ${s.direction === 'owe' ? '#fecaca' : '#a7f3d0'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: s.direction === 'owe' ? '#fee2e2' : '#d1fae5', color: s.direction === 'owe' ? '#dc2626' : '#059669' }}>
                        {s.direction === 'owe' ? 'You Pay' : 'You Receive'}
                      </span>
                      {s.direction === 'owe' && (
                        <button onClick={() => setQrSettlement({ amount: s.amount, name: s.otherMemberName, upiLink: s.upiLink })} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#10b981', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                          <QrCode size={12} /> UPI
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: COLORS.burgundy, marginBottom: '0.25rem' }}>₹{(s.amount ?? 0).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{s.direction === 'owe' ? 'to' : 'from'} <strong>{s.otherMemberName}</strong></div>
                  </div>
                ))}
                {(!profile.directSettlements || profile.directSettlements.length === 0) && <div style={{ padding: '2rem', textAlign: 'center', color: '#10b981', fontSize: '0.8rem', border: `1px dashed #a7f3d0`, background: '#ecfdf5', borderRadius: '0.75rem' }}><strong>All Settled!</strong> You have no pending transfers.</div>}
              </div>
            </div>

            {/* Group Aggregate Reference */}
            <div style={{ gridColumn: '1 / -1', background: '#f8fafc', borderRadius: '1rem', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#475569' }}><Users size={16} /><h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>Group Aggregates Reference</h4></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.8rem' }}>
                <div><span style={{ color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Total Trip Spend</span><strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>₹{(profile.groupAggregates?.totalGroupSpend ?? (profile.groupAggregates as any)?.totalSpend ?? 0).toLocaleString('en-IN')}</strong></div>
                <div><span style={{ color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Group Size</span><strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{profile.groupAggregates?.totalGroupMembers ?? (profile.groupAggregates as any)?.memberCount ?? 0} Travelers</strong></div>
                <div><span style={{ color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Your Consumption Share</span><strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{((profile.totalConsumed / Math.max(1, profile.groupAggregates?.totalGroupSpend || (profile.groupAggregates as any)?.totalSpend || 1)) * 100).toFixed(1)}% of total</strong></div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── TAB: ITINERARY ─── */}
        {activeTab === 'itinerary' && profile && (
          <motion.div key="itinerary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} style={{ display: 'grid', gap: '0.75rem' }}>
            {(profile.itineraryInvolvement || []).map((item, idx) => {
              const Icon = typeIcon(item.type);
              return (
                <div key={item.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderRadius: '1rem', background: item.isAttending ? 'white' : '#f8fafc', border: `1px solid ${COLORS.cream}`, opacity: item.isAttending ? 1 : 0.6 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: item.isAttending ? COLORS.burgundyPale : '#e2e8f0', color: item.isAttending ? COLORS.burgundy : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: COLORS.burgundy }}>{item.label}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: item.isAttending ? '#dcfce7' : '#f1f5f9', color: item.isAttending ? '#166534' : '#64748b' }}>
                        {item.isAttending ? 'Attending' : 'Opted Out'}
                      </span>
                    </div>
                    {item.dateStr && <div style={{ fontSize: '0.75rem', color: '#888', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Calendar size={12} /> {item.dateStr}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: COLORS.burgundy }}>₹{(item.myShareAmount ?? 0).toLocaleString('en-IN')}</div>
                    {item.totalItemCost > 0 && <div style={{ fontSize: '0.7rem', color: '#888' }}>Total: ₹{(item.totalItemCost ?? 0).toLocaleString('en-IN')}</div>}
                  </div>
                </div>
              );
            })}
            {(!profile.itineraryInvolvement || profile.itineraryInvolvement.length === 0) && <div style={{ padding: '3rem', textAlign: 'center', border: `1px dashed ${COLORS.cream}`, borderRadius: '1rem', color: '#888', fontSize: '0.85rem' }}>No itinerary items recorded yet.</div>}
          </motion.div>
        )}

        {/* ─── TAB: CANCELLATIONS ─── */}
        {activeTab === 'cancellations' && profile && (
          <motion.div key="cancellations" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
              <AlertTriangle size={24} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: COLORS.burgundy, margin: '0 0 0.25rem 0' }}>Your Cancellation Exposure</h3>
                <p style={{ fontSize: '0.75rem', color: '#888', margin: 0, lineHeight: 1.5 }}>
                  If you drop out of the trip right now, these are the non-refundable costs you are contractually exposed to based on the Fairness Constitution.
                  Total estimated exposure: <strong>₹{(profile.cancellationExposure?.totalPotentialExposure ?? 0).toLocaleString('en-IN')}</strong>.
                </p>
              </div>
            </div>
            
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {(profile.cancellationExposure?.items || []).map(exp => (
                <div key={exp.bookingId} style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid #fde68a', background: '#fffbeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#92400e', marginBottom: '0.25rem' }}>{exp.label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{exp.riskLevel} Risk</span> — {exp.cancellationPolicy}
                    </div>
                    {exp.reason && <div style={{ fontSize: '0.7rem', color: '#78350f', marginTop: '0.2rem' }}>{exp.reason}</div>}
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#b45309' }}>Exposed: ₹{(exp.potentialLoss ?? 0).toLocaleString('en-IN')}</div>
                </div>
              ))}
              {(!profile.cancellationExposure?.items || profile.cancellationExposure.items.length === 0) && <div style={{ padding: '2rem', textAlign: 'center', color: '#10b981', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.75rem', fontSize: '0.85rem', fontWeight: 700 }}>You have ₹0 non-refundable exposure.</div>}
            </div>
          </motion.div>
        )}

        {/* ─── TAB: REFUNDS ─── */}
        {activeTab === 'refunds' && profile && (
          <motion.div key="refunds" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${COLORS.cream}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
              <Building2 size={24} style={{ color: '#0ea5e9', flexShrink: 0 }} />
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: COLORS.burgundy, margin: '0 0 0.25rem 0' }}>Your Expected Credits</h3>
                <p style={{ fontSize: '0.75rem', color: '#888', margin: 0, lineHeight: 1.5 }}>
                  Refunds pending from vendors that will positively impact your balance when they clear.
                  Total expected: <strong>₹{(profile.expectedRefunds?.totalExpectedRefund ?? 0).toLocaleString('en-IN')}</strong>.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {(profile.pendingRefundImpacts || []).map((ref, idx) => (
                <div key={ref.id || idx} style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid #bae6fd', background: '#f0f9ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0369a1', marginBottom: '0.25rem' }}>{ref.vendorName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#0284c7' }}>Confidence: {ref.confidence}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0369a1' }}>+₹{(ref.myShareOfRefund ?? 0).toLocaleString('en-IN')}</div>
                    {ref.totalRefundAmount > 0 && <div style={{ fontSize: '0.7rem', color: '#0284c7' }}>Total Refund: ₹{(ref.totalRefundAmount ?? 0).toLocaleString('en-IN')}</div>}
                  </div>
                </div>
              ))}
              {(!profile.pendingRefundImpacts || profile.pendingRefundImpacts.length === 0) && <div style={{ padding: '2rem', textAlign: 'center', color: '#888', border: `1px dashed ${COLORS.cream}`, borderRadius: '0.75rem', fontSize: '0.85rem' }}>No pending vendor refunds affect you.</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MODALS ─── */}
      {showTraceModal && profile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(121,21,35,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', width: '100%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '1.5rem', borderBottom: `1px solid ${COLORS.cream}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: COLORS.burgundy, margin: 0 }}>"Why Do I Owe This?"</h3>
                <p style={{ fontSize: '0.75rem', color: '#888', margin: '0.25rem 0 0 0' }}>Line-item breakdown of your exact liability.</p>
              </div>
              <X size={20} onClick={() => setShowTraceModal(false)} style={{ cursor: 'pointer', color: '#888' }} />
            </div>

            <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${COLORS.cream}`, display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setTraceModalTab('tree')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, background: traceModalTab === 'tree' ? COLORS.burgundyPale : 'transparent', color: traceModalTab === 'tree' ? COLORS.burgundy : '#666', border: 'none', cursor: 'pointer' }}><Layers size={14} /> Tree Format</button>
              <button onClick={() => setTraceModalTab('chronological')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, background: traceModalTab === 'chronological' ? COLORS.burgundyPale : 'transparent', color: traceModalTab === 'chronological' ? COLORS.burgundy : '#666', border: 'none', cursor: 'pointer' }}><Clock size={14} /> Event Stream</button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {traceModalTab === 'tree' ? (
                <div>
                  <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1.5rem' }}>Every expense is mathematically decomposed into sub-components, occupancy allocations, and refund credits with cited rules:</p>
                  <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                    {(profile.hierarchicalBreakdown || []).map((item, idx) => (
                      <div key={idx} style={{ padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${COLORS.cream}`, background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: COLORS.burgundy }}><span style={{ textTransform: 'capitalize', color: '#888', fontWeight: 600, marginRight: '0.5rem', fontSize: '0.75rem' }}>{item.category}</span> {item.itemLabel}</div>
                          <div style={{ textAlign: 'right', fontSize: '1rem', fontWeight: 900, color: COLORS.burgundy }}><span style={{ fontSize: '0.65rem', color: '#aaa', display: 'block' }}>Your Share</span> ₹{(item.myTotalShare ?? 0).toLocaleString('en-IN')}</div>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {(item.lines || []).map((line, lIdx) => (
                            <div key={lIdx} style={{ display: 'flex', gap: '0.75rem', padding: '0.375rem 0', borderTop: lIdx === 0 ? 'none' : `1px dashed ${COLORS.cream}` }}>
                              <div style={{ color: '#ccc' }}>{lIdx === item.lines.length - 1 ? '└──' : '├──'}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ color: '#444' }}>{line.label}</div>
                                {line.citation && <div style={{ color: '#0891b2', fontSize: '0.65rem', marginTop: '0.125rem' }}>{line.citation}</div>}
                              </div>
                              <div style={{ fontWeight: 800, color: line.amount < 0 ? '#10b981' : COLORS.burgundy }}>{line.amount < 0 ? `-₹${Math.abs(line.amount).toLocaleString('en-IN')}` : `₹${line.amount.toLocaleString('en-IN')}`}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '1.25rem', borderRadius: '0.75rem', background: COLORS.burgundyPale, border: `1px solid ${COLORS.cream}` }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: COLORS.burgundy, marginBottom: '0.75rem' }}>Mathematical Net Balance Synthesis:</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.375rem', color: '#666' }}><span>Total Fronted / Paid Out:</span><strong style={{ color: '#10b981' }}>+₹{(profile.totalFronted ?? profile.totalPaid ?? 0).toLocaleString('en-IN')}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.75rem', color: '#666', borderBottom: `1px solid ${COLORS.cream}`, paddingBottom: '0.75rem' }}><span>Total Consumed Shares:</span><strong style={{ color: '#dc2626' }}>-₹{(profile.totalConsumed ?? 0).toLocaleString('en-IN')}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 900, color: COLORS.burgundy }}><span>Your Net Balance:</span><strong style={{ color: netBalance >= 0 ? '#059669' : '#dc2626' }}>{netBalance >= 0 ? '+' : ''}₹{netBalance.toLocaleString('en-IN')}</strong></div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {trace.map((tItem, idx) => (
                    <div key={idx} style={{ padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${COLORS.cream}`, background: '#ffffff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div><span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px', background: '#e2e8f0', color: '#334155', marginRight: '0.5rem' }}>{tItem.eventType}</span> <span style={{ fontSize: '0.7rem', color: '#888' }}>{new Date(tItem.timestamp || Date.now()).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 900, fontFamily: 'monospace', color: tItem.impact > 0 ? '#16a34a' : tItem.impact < 0 ? '#dc2626' : '#666' }}>{tItem.impact > 0 ? `+₹${tItem.impact.toLocaleString()}` : tItem.impact < 0 ? `-₹${Math.abs(tItem.impact).toLocaleString()}` : '₹0'}</div>
                          <div style={{ fontSize: '0.65rem', color: '#888' }}>Run: ₹{tItem.runningBalance.toLocaleString()}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: COLORS.burgundy, marginBottom: tItem.applicableRule ? '0.5rem' : 0 }}>{tItem.description}</div>
                      {tItem.applicableRule && <div style={{ display: 'flex', gap: '0.375rem', fontSize: '0.7rem', color: '#4f46e5', background: '#eef2ff', padding: '0.375rem 0.5rem', borderRadius: '0.375rem' }}><Scale size={12} style={{ flexShrink: 0 }} /> <span><strong>Rule {tItem.applicableRule.ruleNumber}:</strong> {tItem.applicableRule.citation}</span></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {qrSettlement && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(121,21,35,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }} onClick={() => setQrSettlement(null)}>
          <div style={{ background: 'white', borderRadius: '1rem', width: '100%', maxWidth: '360px', padding: '1.5rem', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}><h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: COLORS.burgundy }}>Instant UPI Payment</h3><X size={18} onClick={() => setQrSettlement(null)} style={{ cursor: 'pointer', color: '#888' }} /></div>
            <div style={{ padding: '0.75rem', border: `1px solid ${COLORS.cream}`, borderRadius: '0.75rem', display: 'inline-block', marginBottom: '1rem', background: 'white' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrSettlement.upiLink || '')}`} width={200} height={200} alt="QR Code" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: COLORS.burgundy, marginBottom: '0.25rem' }}>₹{qrSettlement.amount.toLocaleString()}</div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Transfer to <strong>{qrSettlement.name}</strong></div>
            <p style={{ fontSize: '0.7rem', color: '#aaa', margin: 0 }}>Scan with GPay, PhonePe, Paytm, BHIM</p>
          </div>
        </div>
      )}
    </div>
  );
}
