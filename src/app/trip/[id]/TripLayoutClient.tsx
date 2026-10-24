'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { getTrip } from '@/lib/db';
import { useAuth } from '@/components/AuthProvider';
import type { Trip } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import {
  Map, Receipt, Users, User, ArrowLeft, Copy, Check, History,
  GitFork, Scale, Network, Sparkles, ArrowRightLeft,
  Menu, X, ChevronLeft, ChevronRight, MapPin, CloudSun,
  Sun, CloudRain, Snowflake, Smartphone
} from 'lucide-react';
import Link from 'next/link';
import { fetchLiveWeather, type LiveWeatherReport } from '@/lib/weather';

import { useTripId, getTripPath } from '@/lib/trip-routing';

const COLORS = {
  burgundy: '#0f172a',
  cream: '#f8fafc',
  offWhite: '#ffffff',
  rose: '#2563eb'
};

const NAV_ITEMS = [
  { key: 'itinerary', label: 'Itinerary', icon: Map },
  { key: 'weather', label: 'Weather Twin', icon: CloudSun, badge: 'LIVE' },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'what-if', label: 'What-If Fork', icon: GitFork },
  { key: 'ledger', label: 'Ledger Stream', icon: History },
  { key: 'fairness', label: 'Constitution', icon: Scale },
  { key: 'shapley', label: 'Shapley Split', icon: Sparkles },
  { key: 'router', label: 'Settlement Router', icon: ArrowRightLeft },
  { key: 'graph', label: 'Event Graph', icon: Network },
  { key: 'sms-reader', label: 'SMS Reader', icon: Smartphone, badge: 'NEW' },
  { key: 'group', label: 'Group', icon: Users },
  { key: 'me', label: 'My View', icon: User },
];

export default function TripLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tripId = useTripId();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [weather, setWeather] = useState<LiveWeatherReport | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { user: authUser, loading: authLoading } = useAuth();
  const sidebarRef = useRef<HTMLElement>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);

  const activeTab = pathname.split('/').pop() || 'itinerary';

  // Prevent background page from scrolling when cursor is over sidebar,
  // and ensure sidebar navigation scrolls cleanly
  useEffect(() => {
    const sidebarEl = sidebarRef.current;
    if (!sidebarEl) return;

    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();

      const navEl = navScrollRef.current;
      if (!navEl) {
        e.preventDefault();
        return;
      }

      const isOverNav = navEl.contains(e.target as Node);
      const maxScroll = navEl.scrollHeight - navEl.clientHeight;

      if (maxScroll <= 0) {
        // Sidebar nav fits entirely; prevent page from scrolling
        e.preventDefault();
        return;
      }

      if (isOverNav) {
        // Directly over nav tabs: prevent chaining to page when at top/boundary
        const atTop = navEl.scrollTop <= 0 && e.deltaY < 0;
        const atBottom = navEl.scrollTop >= maxScroll - 1 && e.deltaY > 0;
        if (atTop || atBottom) {
          e.preventDefault();
        }
      } else {
        // Over header, badge, footer, or padding outside navEl:
        // redirect scroll to navEl and prevent page from scrolling
        e.preventDefault();
        navEl.scrollTop += e.deltaY;
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
        const saved = window.localStorage.getItem('trifork_triplayout_sidebar_minimized') ?? window.localStorage.getItem('tripfor_triplayout_sidebar_minimized');
        if (saved === 'true') setIsMinimized(true);
      }
    } catch {}
  }, []);

  const toggleMinimized = () => {
    setIsMinimized(prev => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('trifork_triplayout_sidebar_minimized', String(next));
        }
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      router.replace('/login');
      return;
    }
    if (!tripId) return;
    async function load() {
      try {
        const data = await getTrip(tripId);
        if (data) {
          setTrip(data);
          const dest = data.destination || data.name;
          if (dest) {
            setWeatherLoading(true);
            fetchLiveWeather(dest)
              .then(rep => setWeather(rep))
              .catch(err => console.warn('Sidebar live weather fetch error:', err))
              .finally(() => setWeatherLoading(false));
          }
        }
      } catch (err) {
        console.error('Failed to load trip:', err);
      }
    }
    load();
  }, [tripId, router, authUser, authLoading]);

  async function copyInvite() {
    if (trip) {
      await navigator.clipboard.writeText(trip.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          {/* Top Section */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Return to Dashboard + Minimize Toggle */}
            <div className={`shrink-0 flex items-center ${isMinimized ? 'md:flex-col md:gap-3 md:pb-3' : 'justify-between pb-4'} justify-between pb-4 border-b transition-all`} style={{ borderColor: `${COLORS.cream}` }}>
              <button
                type="button"
                onClick={() => router.push('/hub')}
                className={`flex items-center ${isMinimized ? 'justify-center p-2.5' : 'gap-2 px-3 py-1.5'} rounded-xl font-bold text-xs transition-all hover:bg-black/5 cursor-pointer`}
                style={{ color: COLORS.burgundy }}
                title="Back to All Trips"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                {!isMinimized && <span>All Trips</span>}
              </button>

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

            {/* Trip Identity Badge with Dynamic Live OpenWeather */}
            <div className={`shrink-0 pt-4 pb-4 border-b ${isMinimized ? 'text-center' : ''}`} style={{ borderColor: `${COLORS.cream}` }}>
              {!isMinimized ? (
                <div>
                  <h2 className="text-lg font-black tracking-tight leading-tight truncate text-gray-900" title={trip?.name}>
                    {trip?.name || 'Trip Overview'}
                  </h2>
                  {(trip?.destination || weather?.current.city_name) && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold mt-1 text-gray-500 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: COLORS.rose }} />
                      <span className="truncate">{trip?.destination || weather?.current.city_name}</span>
                    </div>
                  )}
                  <Link
                    href={`/trip/${tripId}/weather`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold mt-2 px-2.5 py-1 rounded-lg bg-amber-50/90 hover:bg-amber-100 text-amber-950 border border-amber-200/90 shadow-2xs transition-colors cursor-pointer"
                    title="View Weather-Driven Digital Twin"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    {weather ? (
                      <span className="truncate">
                        {weather.current.temp}°C {weather.current.condition} • OpenWeather
                      </span>
                    ) : weatherLoading ? (
                      <span className="text-amber-800/80 animate-pulse">Syncing Weather...</span>
                    ) : (
                      <span>OpenWeather Live</span>
                    )}
                  </Link>
                </div>
              ) : (
                <Link
                  href={`/trip/${tripId}/weather`}
                  className="flex flex-col items-center gap-1 cursor-pointer group"
                  title={`${trip?.name || 'Trip'} ${weather ? `• ${weather.current.temp}°C ${weather.current.condition} (OpenWeather)` : '• Weather Twin'}`}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform" style={{ backgroundColor: `${COLORS.burgundy}15`, color: COLORS.burgundy }}>
                    <MapPin className="w-5 h-5" style={{ color: COLORS.rose }} />
                  </div>
                  <span className="text-[9px] font-black text-amber-900 group-hover:text-amber-700">
                    {weather ? `${weather.current.temp}°C` : weatherLoading ? '...' : '--'}
                  </span>
                </Link>
              )}
            </div>

            {/* Navigation Tabs (Vertical in Sidebar) */}
            <div 
              ref={navScrollRef}
              data-lenis-prevent
              data-lenis-prevent-wheel
              data-lenis-prevent-touch
              className="py-4 space-y-1 overflow-y-auto flex-1 min-h-0 overscroll-contain pr-1"
              style={{
                overscrollBehavior: 'contain',
              }}
            >
              {!isMinimized && (
                <div className="px-3 pb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Navigation
                </div>
              )}

              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      router.push(getTripPath(tripId, item.key));
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center ${
                      isMinimized ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'
                    } rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      isActive 
                        ? 'shadow-xs' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
                    }`}
                    style={isActive ? {
                      backgroundColor: `${COLORS.burgundy}15`,
                      color: COLORS.burgundy
                    } : undefined}
                    title={item.label}
                  >
                    <item.icon 
                      className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'scale-110' : ''}`} 
                      style={isActive ? { color: COLORS.rose } : undefined} 
                    />
                    {!isMinimized && (
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="truncate">{item.label}</span>
                        {(item as any).badge && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {(item as any).badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Section: Invite Code & User Profile */}
          <div className="pt-4 border-t space-y-3 shrink-0" style={{ borderColor: `${COLORS.cream}` }}>
            {trip && (
              <div 
                onClick={copyInvite}
                className={`flex items-center ${
                  isMinimized ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
                } rounded-xl border font-mono text-xs font-bold transition-all hover:brightness-95 cursor-pointer`}
                style={{
                  backgroundColor: `${COLORS.cream}40`,
                  borderColor: `${COLORS.cream}`,
                  color: COLORS.burgundy
                }}
                title={`Copy Invite Code: ${trip.invite_code}`}
              >
                {!isMinimized && (
                  <div className="flex items-center gap-2 truncate">
                    <Users className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{trip.invite_code}</span>
                  </div>
                )}
                {copied ? <Check className="w-4 h-4 text-green-600 shrink-0" /> : <Copy className="w-4 h-4 opacity-50 shrink-0" />}
              </div>
            )}

            {!isMinimized && (
              <div className="flex items-center gap-2.5 px-2 text-xs font-semibold text-gray-500">
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px] text-white shrink-0"
                  style={{ backgroundColor: '#d97706' }}
                >
                  {authUser?.display_name ? authUser.display_name[0].toUpperCase() : (authUser?.email ? authUser.email[0].toUpperCase() : 'V')}
                </div>
                <span className="truncate">{authUser?.display_name || authUser?.email || 'Logged in'}</span>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-h-screen overflow-x-hidden relative flex flex-col">
          {/* Mobile-only Top Bar */}
          <div className="md:hidden flex items-center justify-between p-4 border-b bg-[#ffffff]/95 backdrop-blur-md sticky top-0 z-30" style={{ borderColor: `${COLORS.cream}` }}>
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl hover:bg-black/5 text-gray-700 cursor-pointer"
                title="Open Sidebar"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex flex-col">
                <h1 className="text-base font-black tracking-tight leading-none truncate max-w-[180px]">
                  {trip?.name || 'Trip'}
                </h1>
                {trip?.destination && (
                  <span className="text-[11px] font-semibold opacity-60 mt-0.5 truncate max-w-[180px]">
                    {trip.destination}
                  </span>
                )}
              </div>
            </div>

            {trip && (
              <button
                type="button"
                onClick={copyInvite}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-bold border"
                style={{ backgroundColor: `${COLORS.cream}50`, borderColor: COLORS.cream, color: COLORS.burgundy }}
                title="Copy Invite Code"
              >
                <span>{trip.invite_code}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 opacity-50" />}
              </button>
            )}
          </div>

          {/* Subpage Container */}
          <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </ReactLenis>
  );
}
