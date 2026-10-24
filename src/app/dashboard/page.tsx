'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getTrips, createTrip as dbCreateTrip, joinTripByCode } from '@/lib/db';
import type { Trip } from '@/lib/types';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import {
  Plane, Plus, LogIn, LogOut, MapPin, Calendar, Copy, Check,
  Loader2, Users, Compass, ArrowRight, Sparkles, Map, User,
  Link2, LayoutDashboard, Menu, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { getTripPath } from '@/lib/trip-routing';

const COLORS = {
  burgundy: '#0f172a',
  cream: '#f8fafc',
  offWhite: '#ffffff',
  rose: '#2563eb'
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1, y: 0,
    transition: { type: 'spring', stiffness: 120, damping: 14 }
  }
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
};

export default function DashboardPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Prevent background page from scrolling when cursor is over sidebar
  useEffect(() => {
    const sidebarEl = sidebarRef.current;
    if (!sidebarEl) return;

    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const scrollable = sidebarEl.querySelector('.overflow-y-auto') as HTMLElement | null;
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
        scrollable.scrollTop += e.deltaY;
      }
    };

    sidebarEl.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      sidebarEl.removeEventListener('wheel', onWheel);
    };
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('trifork_sidebar_minimized') ?? window.localStorage.getItem('tripfor_sidebar_minimized');
        if (saved === 'true') setIsMinimized(true);
      }
    } catch {}
  }, []);

  const toggleMinimized = () => {
    setIsMinimized(prev => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('trifork_sidebar_minimized', String(next));
        }
      } catch {}
      return next;
    });
  };
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);

  // Join form
  const [inviteCode, setInviteCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      router.replace('/login');
      return;
    }
    loadTrips();
  }, [authLoading, authUser]);

  async function loadTrips() {
    if (!authUser) return;
    try {
      const data = await getTrips(authUser.id);
      setTrips(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    if (!authUser) return;

    try {
      const trip = await dbCreateTrip({
        name: tripName,
        destination: destination || null,
        start_date: startDate || null,
        end_date: endDate || null
      }, authUser.id, displayName || authUser.display_name || authUser.email?.split('@')[0] || 'Organizer');
      
      router.push(getTripPath(trip.id, 'itinerary'));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function joinTrip(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setJoinError('');
    if (!authUser) return;

    try {
      const tripId = await joinTripByCode(inviteCode.trim(), authUser.id, joinName);
      router.push(getTripPath(tripId, 'itinerary'));
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  }

  function handleSignOut() {
    signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}>
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="font-bold tracking-tight">Loading Dashboard...</span>
      </div>
    );
  }

  return (
    <ReactLenis root>
      <div className="min-h-screen flex font-['Inter'] relative" style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}>
        
        {/* Mobile Backdrop */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside 
          ref={sidebarRef}
          data-lenis-prevent
          data-lenis-prevent-wheel
          data-lenis-prevent-touch
          className={`fixed md:sticky top-0 left-0 z-50 h-screen flex flex-col justify-between border-r transition-all duration-300 ease-in-out shrink-0 overscroll-contain ${
            sidebarOpen ? 'translate-x-0 shadow-2xl w-72 p-6' : '-translate-x-full md:translate-x-0'
          } ${isMinimized ? 'md:w-20 md:p-3' : 'md:w-72 md:p-6'} p-6`}
          style={{ 
            backgroundColor: '#fcfaf8',
            borderColor: `${COLORS.cream}`,
            overscrollBehavior: 'contain',
          }}
        >
          {/* Top of Sidebar */}
          <div>
            <div className={`flex items-center ${isMinimized ? 'md:flex-col md:gap-3 md:pb-4' : 'justify-between pb-6'} justify-between pb-6 border-b transition-all`} style={{ borderColor: `${COLORS.cream}` }}>
              <Link href="/" className="flex items-center gap-3 group overflow-hidden" title="TriFork: Split & Travel">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-md shrink-0" style={{ backgroundColor: COLORS.burgundy }}>
                  <Plane className="w-5 h-5 text-white" />
                </div>
                {!isMinimized && (
                  <div className="flex flex-col">
                    <span className="text-xl font-black tracking-tight" style={{ color: COLORS.burgundy }}>TriFork</span>
                    <span className="text-[10px] font-bold tracking-widest uppercase opacity-50">Split & Travel</span>
                  </div>
                )}
              </Link>
              
              <div className="flex items-center">
                {/* Desktop Toggle to Minimize / Expand */}
                <button
                  type="button"
                  onClick={toggleMinimized}
                  className="hidden md:flex p-2 rounded-xl hover:bg-black/5 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                  title={isMinimized ? "Expand sidebar" : "Minimize sidebar"}
                >
                  {isMinimized ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
                {/* Mobile Close Button */}
                <button 
                  type="button"
                  onClick={() => setSidebarOpen(false)} 
                  className="md:hidden p-2 rounded-lg hover:bg-black/5 text-gray-500"
                  title="Close Sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Menu Navigation */}
            <div className={`py-6 ${isMinimized ? 'space-y-3' : 'space-y-2'}`}>
              {!isMinimized && (
                <div className="px-3 pb-2 text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Menu
                </div>
              )}

              {/* Dashboard Item (Active) */}
              <div 
                className={`flex items-center ${isMinimized ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-2xl font-bold text-sm shadow-xs cursor-pointer transition-all`}
                style={{ backgroundColor: `${COLORS.burgundy}12`, color: COLORS.burgundy }}
                title="Dashboard"
              >
                <LayoutDashboard className="w-5 h-5 shrink-0" />
                {!isMinimized && <span>Dashboard</span>}
              </div>

              {/* Quick Actions */}
              {!isMinimized ? (
                <div className="pt-6 px-3 pb-2 text-[11px] font-black uppercase tracking-wider text-gray-400">
                  Actions
                </div>
              ) : (
                <div className="pt-2 border-t my-1" style={{ borderColor: `${COLORS.cream}` }} />
              )}

              <button
                type="button"
                onClick={() => { setShowCreate(true); setSidebarOpen(false); }}
                className={`w-full flex items-center ${isMinimized ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-2xl font-bold text-sm text-gray-700 hover:text-white transition-all group hover:scale-[1.02] shadow-xs text-left cursor-pointer`}
                style={{ backgroundColor: `${COLORS.burgundy}08` }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.burgundy; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${COLORS.burgundy}08`; e.currentTarget.style.color = '#374151'; }}
                title="Create a Trip"
              >
                <Plus className="w-5 h-5 shrink-0" />
                {!isMinimized && <span>Create a Trip</span>}
              </button>

              <button
                type="button"
                onClick={() => { setShowJoin(true); setSidebarOpen(false); }}
                className={`w-full flex items-center ${isMinimized ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-2xl font-bold text-sm text-gray-700 hover:text-white transition-all group hover:scale-[1.02] shadow-xs text-left cursor-pointer`}
                style={{ backgroundColor: `${COLORS.rose}10` }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.rose; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${COLORS.rose}10`; e.currentTarget.style.color = '#374151'; }}
                title="Join with Code"
              >
                <Link2 className="w-5 h-5 shrink-0" />
                {!isMinimized && <span>Join with Code</span>}
              </button>

              {/* Recent Trips Shortcuts */}
              {trips.length > 0 && (
                <div className={isMinimized ? "pt-2 border-t my-1" : "pt-6"} style={isMinimized ? { borderColor: `${COLORS.cream}` } : undefined}>
                  {!isMinimized && (
                    <div className="flex items-center justify-between px-3 pb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Your Journeys</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${COLORS.cream}`, color: COLORS.burgundy }}>
                        {trips.length}
                      </span>
                    </div>
                  )}
                  <div className={`space-y-1 mt-1 ${isMinimized ? 'max-h-36 overflow-y-auto' : 'max-h-48 overflow-y-auto pr-1'}`}>
                    {trips.slice(0, 5).map((t) => (
                      <Link
                        key={t.id}
                        href={`/trip/${t.id}/itinerary`}
                        prefetch={true}
                        className={`flex items-center ${isMinimized ? 'justify-center p-2.5' : 'gap-2.5 px-3.5 py-2.5'} rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-black/5 cursor-pointer truncate transition-colors`}
                        title={t.name}
                      >
                        <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: COLORS.rose }} />
                        {!isMinimized && <span className="truncate">{t.name}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Profile and Sign Out */}
          <div className="pt-4 border-t space-y-3" style={{ borderColor: `${COLORS.cream}` }}>
            <div 
              className={`flex items-center ${isMinimized ? 'justify-center p-1.5' : 'gap-3 p-3'} rounded-2xl bg-white border shadow-xs`} 
              style={{ borderColor: `${COLORS.cream}` }}
              title={authUser?.display_name || authUser?.email || 'Viraj'}
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-white shadow-sm shrink-0"
                style={{ backgroundColor: '#d97706' }}
              >
                {authUser?.display_name ? authUser.display_name[0].toUpperCase() : (authUser?.email ? authUser.email[0].toUpperCase() : 'V')}
              </div>
              {!isMinimized && (
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-sm text-gray-900 truncate">
                    {authUser?.display_name || authUser?.email?.split('@')[0] || 'Viraj'}
                  </span>
                  <span className="text-xs font-medium text-gray-400 truncate">
                    {authUser?.email || 'Logged in'}
                  </span>
                </div>
              )}
            </div>

            <button 
              onClick={handleSignOut}
              className={`w-full flex items-center justify-center ${isMinimized ? 'p-2.5' : 'gap-2 px-4 py-2.5'} rounded-xl font-bold text-xs text-red-700/80 hover:text-red-700 hover:bg-red-50/80 border border-transparent hover:border-red-100 transition-all cursor-pointer`}
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isMinimized && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-h-screen overflow-x-hidden relative pb-32">
          
          {/* Animated Background Orbs */}
          <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-30 mix-blend-multiply pointer-events-none" style={{ backgroundColor: COLORS.cream }} />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full blur-[100px] opacity-30 mix-blend-multiply pointer-events-none" style={{ backgroundColor: COLORS.rose }} />

          {/* Mobile-only header (allows opening the sidebar on phones) */}
          <div className="md:hidden flex items-center justify-between p-4 border-b bg-[#ffffff]/90 sticky top-0 z-30" style={{ borderColor: `${COLORS.cream}` }}>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-xs" style={{ backgroundColor: COLORS.burgundy }}>
                <Plane className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-black tracking-tight" style={{ color: COLORS.burgundy }}>TriFork</span>
            </Link>
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-black/5 text-gray-700"
              title="Open Sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-6xl mx-auto px-6 md:px-12 pt-8 md:pt-12 relative z-10">
          
          {/* Greeting Section */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 flex items-center gap-2" style={{ color: COLORS.burgundy }}>
              Welcome back, {authUser?.display_name?.split(' ')[0] || 'Viraj'} <span>👋</span>
            </h1>
            <p className="text-base text-gray-600 font-medium">
              Manage your group trips or start a new adventure. AI automatically splits costs with friends. You just focus on the sunset.
            </p>
          </motion.div>

          {/* Two Action Cards: Create a Trip & Join a Trip */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
          >
            {/* Create a Trip Card (Burgundy) */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowCreate(true)}
              className="relative overflow-hidden p-8 md:p-9 rounded-[2rem] text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group flex flex-col justify-between"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.burgundy} 0%, #560e19 100%)`,
                boxShadow: `0 20px 40px -15px ${COLORS.burgundy}55`
              }}
            >
              {/* Subtle ambient light orb inside */}
              <div 
                className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-2xl opacity-20 pointer-events-none" 
                style={{ backgroundColor: COLORS.cream }} 
              />

              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-white/20 backdrop-blur-md border border-white/20 text-white shadow-inner transition-transform group-hover:scale-110 duration-200">
                  <Plus className="w-7 h-7 stroke-[2.5]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2 text-white">
                  Create a Trip
                </h2>
                <p className="text-sm md:text-base font-medium leading-relaxed text-white/85 mb-8 max-w-sm">
                  Start organizing a new group trip. Add members, bookings, and expenses.
                </p>
              </div>

              <div className="relative z-10 pt-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-black transition-all hover:scale-105 shadow-md bg-white group-hover:shadow-xl"
                  style={{ color: COLORS.burgundy }}
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Get started</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>

            {/* Join a Trip Card (Rose) */}
            <motion.div
              whileHover={{ y: -6, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowJoin(true)}
              className="relative overflow-hidden p-8 md:p-9 rounded-[2rem] text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group flex flex-col justify-between"
              style={{ 
                background: `linear-gradient(135deg, ${COLORS.rose} 0%, #992837 100%)`,
                boxShadow: `0 20px 40px -15px ${COLORS.rose}55`
              }}
            >
              {/* Subtle ambient light orb inside */}
              <div 
                className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-2xl opacity-25 pointer-events-none" 
                style={{ backgroundColor: COLORS.offWhite }} 
              />

              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-white/20 backdrop-blur-md border border-white/20 text-white shadow-inner transition-transform group-hover:scale-110 duration-200">
                  <Link2 className="w-7 h-7 stroke-[2.5]" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2 text-white">
                  Join a Trip
                </h2>
                <p className="text-sm md:text-base font-medium leading-relaxed text-white/85 mb-8 max-w-sm">
                  Got an invite code from your group? Enter it to join an existing trip.
                </p>
              </div>

              <div className="relative z-10 pt-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-black transition-all hover:scale-105 shadow-md bg-white group-hover:shadow-xl"
                  style={{ color: COLORS.rose }}
                >
                  <Link2 className="w-4 h-4 stroke-[3]" />
                  <span>Enter code</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          </motion.div>

          {/* My Trips Section Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight text-gray-900">My Trips</h2>
            <span 
              className="px-3.5 py-1 rounded-full text-xs font-bold border"
              style={{ backgroundColor: `${COLORS.cream}50`, borderColor: COLORS.cream, color: COLORS.burgundy }}
            >
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
            </span>
          </div>

          {/* Empty State or Trip Cards */}
          {trips.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="py-16 px-6 text-center rounded-2xl border bg-white/95 backdrop-blur-sm shadow-sm"
              style={{ borderColor: COLORS.cream }}
            >
              <div 
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 border"
                style={{ backgroundColor: `${COLORS.cream}40`, borderColor: `${COLORS.cream}80`, color: COLORS.burgundy }}
              >
                <Compass className="w-7 h-7 opacity-75" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">No trips yet</h3>
              <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto mb-6">
                Create a new trip or join one using an invite code.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-transform hover:scale-105 shadow-md"
                style={{ backgroundColor: COLORS.burgundy }}
              >
                <Plus className="w-4 h-4" /> Start a New Trip
              </button>
            </motion.div>
          ) : (
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {trips.map((trip) => (
                <motion.div 
                  key={trip.id}
                  variants={fadeUp}
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="group relative cursor-pointer p-7 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border bg-white flex flex-col justify-between"
                  style={{ borderColor: COLORS.cream }}
                >
                  <Link
                    href={getTripPath(trip.id, 'itinerary')}
                    prefetch={true}
                    className="absolute inset-0 z-10 rounded-2xl"
                    aria-label={`Open ${trip.name}`}
                  />
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="text-xl font-black tracking-tight text-gray-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                        {trip.name}
                      </h3>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:rotate-45" style={{ backgroundColor: `${COLORS.cream}60`, color: COLORS.burgundy }}>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-6">
                      {trip.destination && (
                        <div className="flex items-center gap-2.5 text-sm font-semibold text-gray-600">
                          <MapPin className="w-4 h-4" style={{ color: COLORS.rose }} />
                          <span>{trip.destination}</span>
                        </div>
                      )}
                      {trip.start_date && (
                        <div className="flex items-center gap-2.5 text-sm font-semibold text-gray-500">
                          <Calendar className="w-4 h-4" style={{ color: COLORS.burgundy }} />
                          <span>
                            {new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {trip.end_date && ` — ${new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: `${COLORS.cream}80` }}>
                    <div 
                      onClick={(e) => { e.stopPropagation(); copyCode(trip.invite_code); }}
                      className="relative z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all hover:brightness-95 border cursor-pointer"
                      style={{ color: COLORS.burgundy, backgroundColor: `${COLORS.cream}40`, borderColor: `${COLORS.cream}` }}
                      title="Copy Invite Code"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{trip.invite_code}</span>
                      {copiedCode === trip.invite_code ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 opacity-50" />}
                    </div>
                    <span className="text-xs font-bold transition-colors group-hover:underline" style={{ color: COLORS.burgundy }}>
                      Open trip →
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Create Trip Modal */}
        <AnimatePresence>
          {showCreate && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowCreate(false)}
              />
              <motion.div 
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative w-full max-w-lg p-8 rounded-[2rem] shadow-2xl bg-white border"
                style={{ borderColor: COLORS.cream }}
              >
                <h2 className="text-3xl font-black mb-6" style={{ color: COLORS.burgundy }}>Create a New Trip</h2>
                <form onSubmit={createTrip} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Trip Name</label>
                    <input type="text" required value={tripName} onChange={e => setTripName(e.target.value)} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="e.g. Summer in Tokyo"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Your Display Name</label>
                    <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="How friends will see you"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Destination (Optional)</label>
                    <input type="text" value={destination} onChange={e => setDestination(e.target.value)} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="e.g. Tokyo, Japan"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Start Date</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} 
                        className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                        style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">End Date</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} 
                        className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                        style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="submit" disabled={creating} className="flex-1 py-4 rounded-2xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.burgundy }}>
                      {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      Create Trip
                    </button>
                    <button type="button" onClick={() => setShowCreate(false)} className="px-8 py-4 rounded-2xl font-bold transition-colors hover:bg-gray-100 bg-gray-50 border">Cancel</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Join Trip Modal */}
        <AnimatePresence>
          {showJoin && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowJoin(false)}
              />
              <motion.div 
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative w-full max-w-md p-8 rounded-[2rem] shadow-2xl bg-white border"
                style={{ borderColor: COLORS.cream }}
              >
                <h2 className="text-3xl font-black mb-6" style={{ color: COLORS.burgundy }}>Join a Trip</h2>
                <form onSubmit={joinTrip} className="space-y-5">
                  {joinError && (
                    <div className="p-4 rounded-2xl bg-red-50 text-red-700 text-sm font-bold border border-red-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> {joinError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Invite Code</label>
                    <input type="text" required value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-bold font-mono tracking-[0.2em] text-lg text-center shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all uppercase"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="XXXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Your Display Name</label>
                    <input type="text" required value={joinName} onChange={e => setJoinName(e.target.value)} 
                      className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="How friends will see you"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="submit" disabled={joining} className="flex-1 py-4 rounded-2xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.rose }}>
                      {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                      Join Trip
                    </button>
                    <button type="button" onClick={() => setShowJoin(false)} className="px-6 py-4 rounded-2xl font-bold transition-colors hover:bg-gray-100 bg-gray-50 border">Cancel</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
      </div>
    </ReactLenis>
  );
}
