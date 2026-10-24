'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Plane,
  Clock,
  ShieldCheck,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  ArrowRight,
  Receipt,
  PiggyBank,
  Globe,
  Sparkles,
  CloudSun,
  CreditCard,
  GitFork,
  Compass,
  HelpCircle,
  ChevronDown,
  Check,
  Smartphone,
  RefreshCw,
  Layers,
  Shield,
  Zap,
  TrendingUp,
  Info,
  LogIn,
  LayoutDashboard,
  ChevronRight,
  Sliders,
  Play,
  ExternalLink,
  ArrowUpRight,
  LogOut,
  UserCheck,
  BarChart3,
  Star,
  Radio,
  Terminal,
  Activity,
} from 'lucide-react';

import Link from 'next/link';

// Brand Color Palette Tokens
const COLORS = {
  burgundy: '#0f172a', // Deep Slate-900 (replaces burgundy)
  darkBurgundy: '#020617', // Slate-950
  cream: '#f8fafc', // Clean light surface (replaces cream)
  offWhite: '#ffffff', // Pure White
  rose: '#2563eb', // Modern Tech Blue (replaces pink rose)
  surfaceGold: '#e2e8f0', // Clean Slate border
  warmIvory: '#ffffff', // Pure White
  cardBg: '#ffffff',
  slateDark: '#0f172a',
  slateMuted: '#64748b',
};

// Interactive What-If Scenarios Data
const SIMULATION_SCENARIOS = {
  baseline: {
    id: 'baseline',
    label: 'Standard Trip (Baseline)',
    description: '4 friends on a 3-day Goa trip. 4-bedroom beach villa, 2 rental cars, private dining.',
    totalCost: 40000,
    perPerson: 10000,
    impactSummary: 'Standard equal split across all 4 participants.',
    settlementsCount: 2,
    rawTransfers: 6,
    members: [
      { name: 'Arjun (Organizer)', paid: 32000, share: 10000, balance: 22000, status: 'receives' },
      { name: 'Priya', paid: 8000, share: 10000, balance: -2000, status: 'pays' },
      { name: 'Rahul', paid: 0, share: 10000, balance: -10000, status: 'pays' },
      { name: 'Ananya', paid: 0, share: 10000, balance: -10000, status: 'pays' },
    ],
    settlementFlows: [
      { from: 'Rahul', to: 'Arjun', amount: 10000, via: 'UPI (GPay / PhonePe)' },
      { from: 'Ananya', to: 'Arjun', amount: 10000, via: 'UPI (GPay / PhonePe)' },
      { from: 'Priya', to: 'Arjun', amount: 2000, via: 'UPI (GPay / PhonePe)' },
    ],
    ruleApplied: 'Rule 1: Standard equal consumption split for collective bookings.',
  },
  early_leave: {
    id: 'early_leave',
    label: 'Rahul Leaves After Day 1',
    description: 'Rahul departs early after Day 1. System replays event ledger with prorated room & dining.',
    totalCost: 40000,
    perPerson: 0,
    impactSummary: 'Rahul saves ₹5,500. Remaining room cost reallocated or covered per group constitution.',
    settlementsCount: 2,
    rawTransfers: 7,
    members: [
      { name: 'Arjun (Organizer)', paid: 32000, share: 11833, balance: 20167, status: 'receives' },
      { name: 'Priya', paid: 8000, share: 11833, balance: -3833, status: 'pays' },
      { name: 'Rahul (Left Day 1)', paid: 0, share: 4500, balance: -4500, status: 'pays' },
      { name: 'Ananya', paid: 0, share: 11833, balance: -11833, status: 'pays' },
    ],
    settlementFlows: [
      { from: 'Rahul', to: 'Arjun', amount: 4500, via: 'UPI Instant 1-Tap' },
      { from: 'Ananya', to: 'Arjun', amount: 11833, via: 'UPI Instant 1-Tap' },
      { from: 'Priya', to: 'Arjun', amount: 3833, via: 'UPI Instant 1-Tap' },
    ],
    ruleApplied: 'Rule 4: Nightly room proration + individual day-1 activity consumption applied.',
  },
  vendor_refund: {
    id: 'vendor_refund',
    label: 'Watersports Cancelled (Refund Credited)',
    description: 'Scuba & jet-ski cancelled due to high sea swells. ₹10,000 vendor refund credited to card.',
    totalCost: 30000,
    perPerson: 7500,
    impactSummary: 'System catches ₹10,000 refund event and auto-credits ₹2,500 to every participant.',
    settlementsCount: 2,
    rawTransfers: 6,
    members: [
      { name: 'Arjun (Organizer)', paid: 22000, share: 7500, balance: 14500, status: 'receives' },
      { name: 'Priya', paid: 8000, share: 7500, balance: 500, status: 'receives' },
      { name: 'Rahul', paid: 0, share: 7500, balance: -7500, status: 'pays' },
      { name: 'Ananya', paid: 0, share: 7500, balance: -7500, status: 'pays' },
    ],
    settlementFlows: [
      { from: 'Rahul', to: 'Arjun', amount: 7500, via: 'UPI Instant 1-Tap' },
      { from: 'Ananya', to: 'Arjun', amount: 7000, via: 'UPI Instant 1-Tap' },
      { from: 'Ananya', to: 'Priya', amount: 500, via: 'UPI Instant 1-Tap' },
    ],
    ruleApplied: 'Rule 7: Ghost refund accountability. Vendor credits return to economic funders.',
  },
  shapley_car: {
    id: 'shapley_car',
    label: 'Shapley Allocation: Shared Rentals',
    description: 'Car 1 used by 4 travelers all 3 days. Car 2 used by only Priya and Arjun on Day 2 & 3.',
    totalCost: 40000,
    perPerson: 0,
    impactSummary: 'Axiomatic game-theoretic marginal contribution calculated for overlapping car use.',
    settlementsCount: 2,
    rawTransfers: 8,
    members: [
      { name: 'Arjun (Organizer)', paid: 32000, share: 12250, balance: 19750, status: 'receives' },
      { name: 'Priya', paid: 8000, share: 12250, balance: -4250, status: 'pays' },
      { name: 'Rahul', paid: 0, share: 7750, balance: -7750, status: 'pays' },
      { name: 'Ananya', paid: 0, share: 7750, balance: -7750, status: 'pays' },
    ],
    settlementFlows: [
      { from: 'Rahul', to: 'Arjun', amount: 7750, via: 'UPI Instant 1-Tap' },
      { from: 'Ananya', to: 'Arjun', amount: 7750, via: 'UPI Instant 1-Tap' },
      { from: 'Priya', to: 'Arjun', amount: 4250, via: 'UPI Instant 1-Tap' },
    ],
    ruleApplied: 'Lloyd Shapley Axiomatic Value: Fair marginal attribution across cooperative coalitions.',
  },
};

// FAQ List
const FAQS = [
  {
    q: 'How does TriFork differ from Splitwise or Google Sheets?',
    a: 'TriFork is not just a ledger calculator; it is an event-sourced financial digital twin of your trip. Traditional splitters suffer from out-of-sync edits, lost vendor refunds, and zero what-if simulation. TriFork lets you simulate scenario branches ("What if Priya cancels the scuba trip?") before committing, computes Nobel-prize winning Shapley value splits, visualizes travel stops on a 3D Cesium globe, and provides 1-tap Indian UPI payment links.',
  },
  {
    q: 'What is the "What-If Time Machine" (Trip Fork)?',
    a: 'Whenever someone proposes a change during a trip—like changing hotels, dropping an activity, leaving early, or getting a flight voucher—TriFork forks the ledger into an alternate sandbox timeline. It immediately shows who pays more, who gets money back, and what is the cheapest fair reallocation. Once the group agrees, that scenario becomes official.',
  },
  {
    q: 'How does the Minimum-Payment Debt Settlement work?',
    a: 'Instead of having 8 friends execute 25 fragmented payments back and forth, TriFork models all net liabilities as a directed acyclic graph. It runs a debt-netting simplification algorithm that cancels out circular debt cycles, reducing 50 chaotic transfers down to just 2 or 3 clean payments.',
  },
  {
    q: 'How do the 1-Tap UPI payment links work in India?',
    a: 'TriFork generates standard UPI deep-links (upi://pay) populated with the recipient’s VPA (Virtual Payment Address / UPI ID), payee name, exact mathematically simplified split amount, and trip transaction reference. On mobile, tapping it instantly opens Google Pay, PhonePe, Paytm, BHIM, or CRED with everything pre-filled.',
  },
  {
    q: 'What is the 3D Cesium Globe & OpenWeather Twin?',
    a: 'TriFork integrates CesiumJS for photorealistic 3D Earth terrain, waypoints, glowing transit corridors, and flight paths. Linked with OpenWeather live telemetry, it displays real-time Doppler radar tiles and temperature data for every stop, warning the group in advance of impending weather delays that could impact itineraries.',
  },
  {
    q: 'How does Bank SMS & UPI Auto-Reconciliation protect my privacy?',
    a: 'On Android, TriFork utilizes an SMS broadcast receiver to detect debit SMS alerts from Indian banks (HDFC, SBI, ICICI, Axis, etc.) directly on your device. The raw message stays local; only extracted expense metadata (amount, merchant name, timestamp) is matched against trip items with your one-tap consent.',
  },
];

export default function Home() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plannerModalOpen, setPlannerModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'group' | 'weekend'>('group');
  const [plannerSubmitted, setPlannerSubmitted] = useState(false);
  const [activeScenarioKey, setActiveScenarioKey] = useState<keyof typeof SIMULATION_SCENARIOS>('baseline');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Quick Trip Planning Form State
  const [tripDetails, setTripDetails] = useState({
    origin: 'Mumbai',
    destination: 'Goa',
    date: '2026-10-15',
    travelers: '4',
    tripType: 'Coastal Explorer',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentScenario = SIMULATION_SCENARIOS[activeScenarioKey];

  const handlePlannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPlannerSubmitted(true);
    setTimeout(() => {
      setPlannerSubmitted(false);
      setPlannerModalOpen(false);
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }, 1200);
  };

  return (
    <div
      className="min-h-screen font-['Inter',sans-serif] antialiased selection:bg-blue-600 selection:text-white bg-white text-slate-900"
    >
      {/* ── HERO SECTION WITH FULLSCREEN BACKGROUND VIDEO (AIRPLANE CRYSTAL CLEAR & VISIBLE) ── */}
      <section className="relative h-screen overflow-hidden bg-white">
        {/* Background Airplane Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
          style={{
            filter: 'contrast(1.05) saturate(1.1)',
          }}
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_091828_e240eb17-6edc-4129-ad9d-98678e3fd238.mp4"
            type="video/mp4"
          />
          Your browser does not support the video tag.
        </video>

        {/* Crisp Light Fades (Replaces dark burgundy overlays so the airplane is crystal clear) */}
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-white/70 via-white/20 to-transparent pointer-events-none z-[1]" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-[1]" />

        {/* Foreground Content Wrapper */}
        <div className="relative z-10 h-full flex flex-col justify-between">
          {/* ── Top Navigation Bar ── */}
          <header className="w-full relative z-40">
            <nav className="max-w-7xl mx-auto px-6 md:px-8 py-6 flex items-center justify-between relative z-40">
              {/* Brand Logo */}
              <Link
                href="/"
                className="flex items-center gap-2.5 transition-transform hover:scale-105 cursor-pointer relative z-50"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg bg-slate-900"
                >
                  <Plane className="w-4 h-4 text-white" />
                </div>
                <span
                  className="text-2xl font-black tracking-tight text-slate-900"
                >
                  TriFork
                </span>
              </Link>

              {/* Right CTA Actions */}
              <div className="hidden md:flex items-center space-x-4 relative z-50">
                {mounted && user ? (
                  <Link
                    href="/dashboard"
                    prefetch={true}
                    className="px-5 py-2.5 rounded-full font-bold text-sm text-white transition-all hover:scale-105 shadow-md flex items-center gap-1.5 cursor-pointer relative z-50 bg-slate-900 hover:bg-black"
                    id="nav-dashboard-btn"
                  >
                    <span>Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      prefetch={true}
                      className="px-5 py-2.5 rounded-full font-bold text-sm transition-all hover:scale-105 shadow-sm border border-slate-300 bg-white/90 hover:bg-white text-slate-900 cursor-pointer relative z-50"
                      id="nav-login-btn"
                    >
                      Log In
                    </Link>
                    <Link
                      href="/signup"
                      prefetch={true}
                      className="px-5 py-2.5 rounded-full text-white font-bold text-sm transition-transform hover:scale-105 shadow-lg flex items-center gap-1.5 cursor-pointer relative z-50 bg-slate-900 hover:bg-black"
                      id="nav-signup-btn"
                    >
                      <span>Get Started</span>
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Header Action & Hamburger */}
              <div className="md:hidden flex items-center gap-2 relative z-50">
                {mounted && (
                  <Link
                    href={user ? '/dashboard' : '/login'}
                    prefetch={true}
                    className="px-3 py-1.5 rounded-full font-bold text-xs text-white shadow-sm bg-slate-900"
                  >
                    {user ? 'Dashboard' : 'Log In'}
                  </Link>
                )}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-slate-900 focus:outline-none rounded-lg cursor-pointer"
                  aria-label="Toggle Navigation Menu"
                >
                  {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
                </button>
              </div>
            </nav>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
              <div className="md:hidden px-6 pt-2 pb-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-top-4 duration-200 relative z-50">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-slate-200 flex flex-col space-y-4">
                  {[
                    { label: 'Start', href: '#start' },
                    { label: 'Features', href: '#features' },
                    { label: 'What-If Simulator', href: '#simulator' },
                    { label: '3D Globe & Weather', href: '#cesium-3d' },
                    { label: 'Debt Engine & UPI', href: '#settlement' },
                    { label: 'How It Works', href: '#how-it-works' },
                  ].map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-slate-800 font-bold hover:text-blue-600 transition-colors py-2 px-3 rounded-lg hover:bg-slate-50"
                    >
                      {item.label}
                    </a>
                  ))}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                    {user ? (
                      <Link
                        href="/dashboard"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          router.push('/dashboard');
                        }}
                        className="w-full py-3 rounded-full text-white font-bold text-center shadow-md cursor-pointer bg-slate-900"
                      >
                        Go to Dashboard
                      </Link>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            router.push('/login');
                          }}
                          className="w-full py-2.5 rounded-full text-slate-800 font-bold text-center border border-slate-200 hover:bg-slate-50 cursor-pointer text-sm"
                        >
                          Log In
                        </Link>
                        <Link
                          href="/signup"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            router.push('/signup');
                          }}
                          className="w-full py-2.5 rounded-full text-white font-bold text-center shadow-md cursor-pointer text-sm bg-slate-900"
                        >
                          Get Started Free
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </header>

          {/* ── Main Hero Center Content (Overlapping Two-Line Heading) ── */}
          <main id="start" className="flex-1 flex items-center justify-center text-center px-4 relative z-10 pointer-events-auto">
            <div className="max-w-4xl mx-auto flex flex-col items-center -translate-y-4 md:-translate-y-8">
              {/* Brand Badge */}
              <span
                className="text-xs md:text-sm font-extrabold tracking-widest uppercase mb-4 px-4 py-1.5 rounded-full border shadow-sm backdrop-blur-md bg-white/90 border-slate-200 text-slate-800"
              >
                SMART GROUP EXPEDITIONS
              </span>

              {/* Overlapping Two-Line Heading Styled with High-Contrast TravelOS Typography */}
              <div className="flex flex-col items-center justify-center mb-5 select-none">
                <h1 className="text-6xl md:text-7xl lg:text-9xl font-light text-slate-600 leading-none tracking-tighter">
                  Split Expenses
                </h1>
                <h2
                  className="text-6xl md:text-7xl lg:text-9xl font-black leading-none tracking-tighter -mt-3 md:-mt-6 lg:-mt-8 text-slate-900"
                >
                  Not Vibes.
                </h2>
              </div>

              {/* Subtitle */}
              <p className="text-base md:text-xl text-slate-800 mb-6 max-w-2xl font-medium leading-relaxed drop-shadow-sm">
                AI-driven financial ledgers, 3D Cesium travel globes, and live weather twins for your group journeys.
              </p>

              {/* Hero Center Action Buttons */}
              <div className="flex items-center justify-center gap-3 relative z-20">
                {mounted && user ? (
                  <Link
                    href="/dashboard"
                    prefetch={true}
                    className="px-8 py-3.5 rounded-full font-bold text-sm text-white shadow-xl hover:scale-105 transition-all flex items-center gap-2 cursor-pointer border border-white/20 bg-slate-900 hover:bg-black"
                    id="hero-center-dashboard-btn"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Go to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      prefetch={true}
                      className="px-7 py-3 rounded-full font-bold text-sm text-white shadow-xl hover:scale-105 transition-all flex items-center gap-2 cursor-pointer border border-white/20 bg-slate-900 hover:bg-black"
                      id="hero-center-login-btn"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Log In</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/signup"
                      prefetch={true}
                      className="px-7 py-3 rounded-full font-bold text-sm bg-white/90 hover:bg-white text-slate-900 shadow-md hover:scale-105 transition-all border border-slate-300 cursor-pointer"
                      id="hero-center-signup-btn"
                    >
                      <span>Get Started</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </main>

          {/* Bottom Spacer / Arrow Indicator */}
          <div className="pb-8 flex justify-center relative z-20">
            <div className="w-6 h-10 rounded-full border-2 border-slate-400/50 flex items-start justify-center p-1">
              <div className="w-1.5 h-3 rounded-full bg-slate-600 animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE PILLARS & ARCHITECTURE (WHY TRIFORK) ── */}
      <section id="features" className="bg-white py-24 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span
              className="text-xs font-black uppercase tracking-widest px-3.5 py-1 rounded-full border mb-4 inline-block shadow-sm"
              style={{
                backgroundColor: COLORS.cream,
                borderColor: "#e2e8f0",
                color: COLORS.burgundy,
              }}
            >
              NOT JUST AN EXPENSE TRACKER
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: COLORS.burgundy }}>
              Engineered for Group Harmony.
            </h2>
            <p className="text-stone-600 text-base md:text-lg leading-relaxed">
              Traditional spreadsheets and apps only track debt after the fact. TriFork is a financial digital twin
              that safely simulates decisions, eliminates disputes before they happen, and reduces payment transactions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1: Event-Sourced Ledger */}
            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200/80 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                style={{ backgroundColor: COLORS.burgundy }}
              >
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-stone-900">Event-Sourced Ledger</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                Modeled as an append-only stream of immutable events (Bookings, Deposits, Cancellations, Refunds). Balances are always derived by replaying history—never a mutable balance sheet with sync bugs.
              </p>
              <ul className="text-xs text-stone-500 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>"Why do I owe this?" line-by-line audit trace</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Zero arithmetic errors or double-counted items</span>
                </li>
              </ul>
            </div>

            {/* Feature 2: What-If Time Machine */}
            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200/80 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                style={{ backgroundColor: COLORS.rose }}
              >
                <GitFork className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-stone-900">What-If Time Machine</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                "Priya leaves Day 2? Cancel the beachfront villa? Airline gave vouchers instead of cash?" TriFork forks the timeline to compute exact financial ripples across every participant before anyone commits.
              </p>
              <ul className="text-xs text-stone-500 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Parallel scenario comparisons (Cheapest vs Fair)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nothing commits until group approves scenario</span>
                </li>
              </ul>
            </div>

            {/* Feature 3: Smart Debt Engine & UPI */}
            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200/80 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md bg-slate-800"
              >
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-stone-900">Minimum Netting & 1-Tap UPI</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                Directed debt graph optimization eliminates circular liabilities. 50 random peer-to-peer transfers collapse into 2 or 3 payments. Instant deep-links launch Google Pay, PhonePe, and Paytm with amounts pre-filled.
              </p>
              <ul className="text-xs text-stone-500 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>80% reduction in individual bank transfers</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Deep-linked UPI URI scheme for zero typing</span>
                </li>
              </ul>
            </div>

            {/* Feature 4: 3D Cesium Globe */}
            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200/80 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                style={{ backgroundColor: COLORS.surfaceGold }}
              >
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-stone-900">Cesium 3D Globe & Routing</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                Full 3D geospatial itinerary planning on a photorealistic globe. Visualizes waypoints, flight arcs, terrain drop-lines, and transit corridors with participant tagging.
              </p>
              <ul className="text-xs text-stone-500 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>High-resolution terrain with multi-stop routes</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Multi-modal planning (Flights, Hotels, Food)</span>
                </li>
              </ul>
            </div>

            {/* Feature 5: OpenWeather Digital Twin */}
            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200/80 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                style={{ backgroundColor: '#2d6a4f' }}
              >
                <CloudSun className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-stone-900">OpenWeather Delay Twin</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                Real-time meteorological telemetries and Doppler radar tiles for every waypoint. Simulates cascading weather disruption impacts on your itinerary schedule and budget.
              </p>
              <ul className="text-xs text-stone-500 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Automated storm & monsoon travel alerts</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Contingency rescheduling suggestions</span>
                </li>
              </ul>
            </div>

            {/* Feature 6: Bank SMS & Ghost Refund Tracking */}
            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200/80 hover:shadow-xl hover:-translate-y-1 transition-all">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                style={{ backgroundColor: '#1d3557' }}
              >
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-stone-900">SMS / UPI Bank Reader</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                Native Android SMS parsing automatically detects debit alerts from major Indian banks (HDFC, SBI, ICICI, Axis). Flags unclaimed vendor refunds so money is never lost.
              </p>
              <ul className="text-xs text-stone-500 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1-tap confirmation to add to shared ledger</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ghost expense & missing refund reminders</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FLAGSHIP INTERACTIVE WHAT-IF SIMULATOR ── */}
      <section id="simulator" className="py-24 px-6" style={{ backgroundColor: COLORS.cream }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span
              className="text-xs font-black uppercase tracking-widest px-3.5 py-1 rounded-full border mb-4 inline-block shadow-sm"
              style={{
                backgroundColor: COLORS.offWhite,
                borderColor: "#e2e8f0",
                color: COLORS.burgundy,
              }}
            >
              FLAGSHIP INNOVATION: THE TRIP FORK
            </span>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-4" style={{ color: COLORS.burgundy }}>
              What-If Time Machine
            </h2>
            <p className="text-stone-700 text-base md:text-lg font-medium">
              Test hypothetical changes before anyone spends a rupee. See how room reassignments, cancellations, or early exits dynamically affect balances in real time.
            </p>
          </div>

          {/* Interactive Simulator Card */}
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden max-w-5xl mx-auto">
            {/* Scenario Selector Tabs */}
            <div className="p-6 md:p-8 bg-stone-50 border-b border-stone-200">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-3">
                Select a live simulation scenario to test:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(SIMULATION_SCENARIOS).map(([key, sc]) => {
                  const isSelected = activeScenarioKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveScenarioKey(key as keyof typeof SIMULATION_SCENARIOS)}
                      className={`text-left p-3.5 rounded-2xl border transition-all text-xs font-bold flex flex-col justify-between ${
                        isSelected
                          ? 'border-slate-900 bg-white shadow-md text-blue-600 ring-2 ring-slate-900/10'
                          : 'border-stone-200 bg-stone-100/70 text-stone-600 hover:bg-white hover:text-stone-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className="line-clamp-2 leading-snug break-words" title={sc.label}>
                          {sc.label}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                      </div>
                      <span className="text-xs text-stone-500 font-normal line-clamp-2 leading-relaxed">
                        {sc.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scenario Calculation Preview */}
            <div className="p-6 md:p-10">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-stone-100">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg text-white"
                      style={{ backgroundColor: COLORS.burgundy }}
                    >
                      Simulated Timeline
                    </span>
                    <h3 className="text-2xl font-black text-stone-900">
                      {currentScenario.label}
                    </h3>
                  </div>
                  <p className="text-stone-600 text-sm">{currentScenario.impactSummary}</p>
                </div>

                <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                  <div>
                    <span className="text-xs font-semibold text-stone-500 uppercase block">Total Trip Cost</span>
                    <span className="text-2xl font-black text-stone-900">₹{currentScenario.totalCost.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="h-8 w-px bg-stone-300" />
                  <div>
                    <span className="text-xs font-semibold text-stone-500 uppercase block">Settlements</span>
                    <span className="text-2xl font-black text-emerald-700 flex items-center gap-1">
                      {currentScenario.settlementFlows.length} transfers
                      <span className="text-xs font-normal text-stone-500">(vs {currentScenario.rawTransfers})</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Members Ledger Grid */}
              <div className="py-8">
                <h4 className="text-xs font-bold text-stone-600 mb-4 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  Participant balances under this counterfactual:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {currentScenario.members.map((m, idx) => {
                    const isCredit = m.balance > 0;
                    const isZero = m.balance === 0;
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-stone-900 text-sm truncate">{m.name}</span>
                          </div>
                          <div className="text-xs text-stone-500 space-y-1 mb-3">
                            <div className="flex justify-between">
                              <span>Paid Upfront:</span>
                              <span className="font-semibold text-stone-700">₹{m.paid.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Fair Share:</span>
                              <span className="font-semibold text-stone-700">₹{m.share.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`pt-2 border-t border-stone-200 text-xs font-black flex items-center justify-between ${
                            isCredit
                              ? 'text-emerald-700'
                              : isZero
                              ? 'text-stone-600'
                              : 'text-red-700'
                          }`}
                        >
                          <span>{isCredit ? 'Receives' : isZero ? 'Settled' : 'Owes'}</span>
                          <span className="text-sm">
                            {isCredit ? '+' : ''}₹{Math.abs(m.balance).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Minimal Transaction Routing Outputs */}
              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 mb-6">
                <h4 className="text-xs font-bold text-stone-600 mb-3 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600" />
                  Router output: minimum transfers needed ({currentScenario.settlementFlows.length} clean payments)
                </h4>
                <div className="space-y-2">
                  {currentScenario.settlementFlows.map((flow, i) => (
                    <div
                      key={i}
                      className="bg-white p-3 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-red-700 font-bold">{flow.from}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                        <span className="text-emerald-700 font-bold">{flow.to}</span>
                        <span className="text-stone-400">via</span>
                        <span className="text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-lg text-xs font-medium">
                          {flow.via}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-stone-900">
                          ₹{flow.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rule Citation */}
              <div className="flex items-center gap-2 text-xs text-stone-500 bg-amber-50/70 p-3 rounded-xl border border-amber-200/60 mb-6">
                <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>
                  <strong>Constitution Citation:</strong> {currentScenario.ruleApplied}
                </span>
              </div>

              {/* Call to action inside widget */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-stone-100">
                <span className="text-xs text-stone-500 font-medium">
                  Experience this instant counterfactual engine on your real trip expenses.
                </span>
                <Link
                  href={user ? '/dashboard' : '/signup'}
                  className="px-6 py-2.5 rounded-full text-white font-bold text-xs shadow-md hover:scale-105 transition-transform flex items-center gap-1.5"
                  style={{ backgroundColor: COLORS.burgundy }}
                >
                  <span>{user ? 'Launch What-If in Dashboard' : 'Try Free With Your Friends'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3D CESIUM GLOBE & OPENWEATHER TWIN ── */}
      <section id="cesium-3d" className="py-24 bg-stone-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest px-3.5 py-1 rounded-full bg-blue-950/80 border border-blue-500/30 text-blue-300 mb-4 inline-block">
                GEOSPATIAL ITINERARY ENGINE
              </span>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
                Cesium 3D Globe with OpenWeather Telemetry.
              </h2>
              <p className="text-stone-300 text-base md:text-lg leading-relaxed mb-8">
                TriFork merges 3D geospatial mapping with dynamic meteorological feeds. Your itinerary is plotted on
                a 3D high-resolution globe with waypoint droplines, glowing flight corridors, and real-time Doppler radar tiles.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <Globe className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-white">Photorealistic 3D Earth Terrain</h3>
                    <p className="text-stone-400 text-xs">
                      Fly into mountain passes, coastal routes, and urban centers with CesiumJS terrain tiles.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <CloudSun className="w-5 h-5 text-amber-400 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-white">Live Meteorological Digital Twin</h3>
                    <p className="text-stone-400 text-xs">
                      OpenWeather integration provides real-time wind speed, temperature, Doppler clouds, and storm alerts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <TrendingUp className="w-5 h-5 text-blue-500 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-white">Cascading Delay Impact Predictor</h3>
                    <p className="text-stone-400 text-xs">
                      If bad weather threatens a transfer, TriFork alerts the group and calculates cost ripples of rescheduling.
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href={user ? '/dashboard' : '/login'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-bold text-sm shadow-xl hover:scale-105 transition-all"
                style={{ backgroundColor: COLORS.rose }}
              >
                <span>{user ? 'Open Itinerary Globe' : 'Explore Itinerary Features'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Visual Graphic Mockup */}
            <div className="relative">
              <div className="bg-gradient-to-tr from-stone-800 to-stone-950 p-6 rounded-2xl border border-white/15 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                    <span className="font-bold">Cesium 3D Viewport — Goa Coastal Circuit</span>
                  </div>
                  <span className="text-emerald-400 font-mono text-xs">28.4°C • Clear Skies</span>
                </div>

                {/* Simulated Globe Visual */}
                <div className="my-6 relative h-64 rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center border border-white/10">
                  <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                  <div className="relative z-10 text-center">
                    <Globe className="w-20 h-20 text-cyan-400/80 mx-auto mb-3 animate-spin [animation-duration:30s]" />
                    <span className="text-xs font-mono text-cyan-300 block">WAYPOINT CLUSTER ACTIVE</span>
                    <span className="text-xs text-stone-400">4 Destination Stops Plotted • 3D Corridors Rendered</span>
                  </div>

                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/15 text-xs text-stone-300">
                    Lat: 15.2993° N • Lon: 74.1240° E
                  </div>
                </div>

                {/* Itinerary Waypoints Preview */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-xs text-stone-400 block">Stop 1 • 10:00 AM</span>
                    <span className="font-bold text-white">Anjuna Beach Villa</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-xs text-stone-400 block">Stop 2 • 02:30 PM</span>
                    <span className="font-bold text-white">Vagator Scuba Point</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SETTLEMENT ROUTER & 1-TAP UPI ── */}
      <section id="settlement" className="py-24 px-6 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span
              className="text-xs font-black uppercase tracking-widest px-3.5 py-1 rounded-full border mb-4 inline-block shadow-sm"
              style={{
                backgroundColor: COLORS.cream,
                borderColor: "#e2e8f0",
                color: COLORS.burgundy,
              }}
            >
              FINANCIAL RESOLUTION ENGINE
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: COLORS.burgundy }}>
              Settle in 1 Tap. No Bank Forms.
            </h2>
            <p className="text-stone-600 text-base md:text-lg">
              Never copy-paste IFSC codes, account numbers, or calculate who owes whom after a trip.
              TriFork simplifies debt cycles and deep-links directly into India's UPI apps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                style={{ backgroundColor: COLORS.burgundy }}
              >
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-stone-900">Debt Netting Algorithm</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                If A owes B ₹1,000, and B owes C ₹1,000, TriFork eliminates B from the middle and routes A directly to C.
                Even in complex 10-person trips, settlements collapse to minimum transfers.
              </p>
              <div className="text-xs font-semibold text-blue-600 bg-blue-50 p-3 rounded-xl border border-blue-200/60">
                Reduces 40+ back-and-forth transfers down to 3 simple payments.
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                style={{ backgroundColor: COLORS.rose }}
              >
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-stone-900">Direct UPI Deep Links</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                Tapping "Pay Now" on your phone triggers standard UPI payment intents for Google Pay, PhonePe, Paytm, BHIM, and CRED.
                The recipient's UPI VPA, exact amount, and reference note are populated automatically.
              </p>
              <div className="flex items-center gap-2 text-xs font-bold text-stone-700 bg-stone-100 p-2.5 rounded-xl">
                <span>GPay • PhonePe • Paytm • BHIM • CRED</span>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md"
                style={{ backgroundColor: COLORS.surfaceGold }}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-stone-900">Fairness Constitution</h3>
              <p className="text-stone-600 text-sm leading-relaxed mb-4">
                Before leaving, groups establish consensus rules: Do late joiners pay prior villa nights? Does voluntary exit bear cancellation penalty?
                TriFork cites the agreed rule on every single balance calculation.
              </p>
              <div className="text-xs font-semibold text-stone-700 bg-amber-50 p-3 rounded-xl border border-amber-200/60">
                Axiomatic game theory (Shapley Value) handles partial activity splits.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DUAL LENS: GROUP HUB VS PERSONAL VIEW ── */}
      <section id="dual-lens" className="py-24 px-6" style={{ backgroundColor: COLORS.warmIvory }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span
              className="text-xs font-black uppercase tracking-widest px-3.5 py-1 rounded-full border mb-4 inline-block shadow-sm"
              style={{
                backgroundColor: COLORS.cream,
                borderColor: "#e2e8f0",
                color: COLORS.burgundy,
              }}
            >
              DUAL PERSPECTIVE
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: COLORS.burgundy }}>
              Group Command Center & Personal Lens
            </h2>
            <p className="text-stone-600 text-base md:text-lg">
              Organizers get the macro bird’s-eye view; travelers get their private micro view.
              Everyone has complete transparency with zero confusion.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Group Lens */}
            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-lg">Group Dashboard</h3>
                    <span className="text-xs text-stone-500">Trip Organizer View</span>
                  </div>
                </div>
                <span className="text-xs font-bold bg-stone-100 text-stone-700 px-3 py-1 rounded-full">
                  Macro Perspective
                </span>
              </div>
              <ul className="space-y-4 text-sm text-stone-600">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-stone-900 block">Total Expenditure & Burn Rate:</strong>
                    Live breakdown across flights, villas, cabs, and meals with category budget meters.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-stone-900 block">Collective Settlement Progress:</strong>
                    Track who has paid their balance, pending vendor refunds, and verified transfers.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-stone-900 block">6-Character Invite Hub:</strong>
                    Onboard new members effortlessly via short codes or instant invite links.
                  </div>
                </li>
              </ul>
            </div>

            {/* Personal Lens */}
            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-lg">Personal Lens ("My Slice")</h3>
                    <span className="text-xs text-stone-500">Individual Participant View</span>
                  </div>
                </div>
                <span className="text-xs font-bold bg-stone-100 text-stone-700 px-3 py-1 rounded-full">
                  Micro Perspective
                </span>
              </div>
              <ul className="space-y-4 text-sm text-stone-600">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-stone-900 block">"Why Do I Owe This?" Button:</strong>
                    Click any number to view the exact math formula, events, and room proration that produced it.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-stone-900 block">Personal QR & UPI ID:</strong>
                    Receive owed payments directly to your personal UPI ID without sharing bank details.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-stone-900 block">Privacy-Scoped Visibility:</strong>
                    Clear line items for your joined activities without unwanted exposure of private spends.
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (STEP-BY-STEP WORKFLOW) ── */}
      <section id="how-it-works" className="py-24 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span
              className="text-xs font-black uppercase tracking-widest px-3.5 py-1 rounded-full border mb-4 inline-block shadow-sm"
              style={{
                backgroundColor: COLORS.cream,
                borderColor: "#e2e8f0",
                color: COLORS.burgundy,
              }}
            >
              SEAMLESS 5-STEP JOURNEY
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: COLORS.burgundy }}>
              How TriFork Powers Your Trip
            </h2>
            <p className="text-stone-600 text-base md:text-lg">
              From the initial idea to the final one-tap payment, here is how TriFork keeps your group organized.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {[
              {
                step: '01',
                title: 'Plan & Map',
                desc: 'Set destination, dates, and build stops on the 3D globe with live weather telemetry.',
                icon: Globe,
              },
              {
                step: '02',
                title: 'Invite & Agree',
                desc: 'Share a 6-character code and establish fairness rules for edge-case cancellations.',
                icon: Users,
              },
              {
                step: '03',
                title: 'Track & Sync',
                desc: 'Auto-capture bank SMS debit alerts or quickly log expenses with participant attribution.',
                icon: Receipt,
              },
              {
                step: '04',
                title: 'Simulate (Fork)',
                desc: 'Test "What if someone cancels or leaves early?" in a sandbox timeline before committing.',
                icon: GitFork,
              },
              {
                step: '05',
                title: 'Settle in 1 Tap',
                desc: 'Router computes minimum transfers. Tap to open GPay/PhonePe and settle instantly.',
                icon: Zap,
              },
            ].map((st, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between hover:bg-white hover:shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-slate-300">{st.step}</span>
                    <st.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-base font-bold text-stone-900 mb-2">{st.title}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURAL COMPARISON TABLE ── */}
      <section id="comparison" className="py-24 px-6" style={{ backgroundColor: COLORS.cream }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span
              className="text-xs font-black uppercase tracking-widest px-3.5 py-1 rounded-full border mb-4 inline-block shadow-sm"
              style={{
                backgroundColor: COLORS.offWhite,
                borderColor: "#e2e8f0",
                color: COLORS.burgundy,
              }}
            >
              FEATURE COMPARISON
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: COLORS.burgundy }}>
              Why TriFork Leaves Old Tools Behind
            </h2>
            <p className="text-stone-700 text-base md:text-lg">
              Compare TriFork against traditional expense splitters and spreadsheets.
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-stone-200 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="py-4 px-6 font-bold text-stone-900">Platform Capability</th>
                  <th className="py-4 px-6 font-bold text-blue-600 bg-blue-50/70">TriFork Platform</th>
                  <th className="py-4 px-6 font-semibold text-stone-600">Splitwise</th>
                  <th className="py-4 px-6 font-semibold text-stone-600">Google Sheets / Excel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {[
                  {
                    f: 'Event-Sourced Immutable Ledger',
                    tf: 'Full event stream replay with line-item citations',
                    sp: 'Mutable balance ledger (subject to sync edits)',
                    sh: 'Fragile manual formula editing',
                  },
                  {
                    f: 'What-If Time Machine / Scenario Simulator',
                    tf: 'Yes: Safe parallel scenario forks before commit',
                    sp: 'No: Edits directly alter real balances',
                    sh: 'Manual duplicate tabs required',
                  },
                  {
                    f: '1-Tap Indian UPI Payment Deep-Links',
                    tf: 'Yes: Pre-filled VPA, payee, and amount via upi://',
                    sp: 'Partial / Manual UPI ID typing',
                    sh: 'None',
                  },
                  {
                    f: '3D Geospatial Itinerary & Routing',
                    tf: 'Yes: Photorealistic Cesium 3D Globe',
                    sp: 'None',
                    sh: 'None',
                  },
                  {
                    f: 'Live Weather Digital Twin & Delay Radar',
                    tf: 'Yes: OpenWeather integration & delay cascades',
                    sp: 'None',
                    sh: 'None',
                  },
                  {
                    f: 'Game-Theoretic Shapley-Value Fairness',
                    tf: 'Yes: Axiomatic allocation for shared car/stays',
                    sp: 'Equal or fixed % only',
                    sh: 'Complex custom formulas',
                  },
                  {
                    f: 'Automated Bank SMS / Debit Alert Detection',
                    tf: 'Yes: Native Android SMS Broadcast Parser',
                    sp: 'Manual entry only',
                    sh: 'Manual entry only',
                  },
                  {
                    f: 'Ghost Expense & Unclaimed Refund Alerts',
                    tf: 'Yes: Enforces vendor refund accountability',
                    sp: 'None',
                    sh: 'None',
                  },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-stone-900">{row.f}</td>
                    <td className="py-4 px-6 font-semibold text-blue-600 bg-blue-50/40">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>{row.tf}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-stone-600">{row.sp}</td>
                    <td className="py-4 px-6 text-stone-500">{row.sh}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE FAQ SECTION ── */}
      <section id="faq" className="py-24 bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span
              className="text-xs font-black uppercase tracking-widest px-3.5 py-1 rounded-full border mb-4 inline-block shadow-sm"
              style={{
                backgroundColor: COLORS.cream,
                borderColor: "#e2e8f0",
                color: COLORS.burgundy,
              }}
            >
              ANSWERS & DETAILS
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ color: COLORS.burgundy }}>
              Frequently Asked Questions
            </h2>
            <p className="text-stone-600 text-base md:text-lg">
              Everything you need to know about TriFork's technology and how it simplifies group journeys.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-stone-200 overflow-hidden bg-stone-50 transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 font-bold text-stone-900 hover:text-blue-600 transition-colors"
                  >
                    <span className="text-base">{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-stone-500 transition-transform duration-200 flex-shrink-0 ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-6 pb-6 text-stone-600 text-sm leading-relaxed border-t border-stone-100 pt-3"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION SECTION (DYNAMIC AUTH) ── */}
      <section id="cta" className="relative py-28 px-6 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 w-full h-full">
          <img
            src="https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=2000&auto=format&fit=crop"
            alt="Group Travel Landscape"
            className="w-full h-full object-cover"
          />
          {/* Palette Tonal Overlay */}
          <div
            className="absolute inset-0 opacity-80 mix-blend-multiply"
            style={{ backgroundColor: COLORS.darkBurgundy }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50" />
        </div>

        <div className="relative z-10 text-center text-white px-4 max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md mb-6 inline-block border border-white/20">
            START YOUR NEXT ADVENTURE
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">
            Ready to Travel Smarter?
          </h2>
          <p className="text-base md:text-xl text-stone-200 mb-10 font-medium leading-relaxed">
            Create your trip workspace in seconds. Build 3D itineraries, simulate What-If changes, invite friends, and settle debts effortlessly with Indian UPI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {mounted && user ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 text-base font-bold rounded-full transition-transform hover:scale-105 shadow-2xl text-white"
                style={{ backgroundColor: COLORS.rose }}
                id="cta-dashboard-btn"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Go to My Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 text-base font-bold rounded-full transition-transform hover:scale-105 shadow-2xl text-white"
                  style={{ backgroundColor: COLORS.rose }}
                  id="cta-signup-btn"
                >
                  <span>Create Free Account</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all border border-white/30"
                  id="cta-login-btn"
                >
                  <span>Log In to Existing Trip</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER (ALL WORKING LINKS & CONDITIONAL AUTH) ── */}
      <footer
        className="py-14 px-8 border-t border-slate-800 bg-slate-950 text-slate-300"
      >
        <div className="max-w-7xl mx-auto flex flex-col gap-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Plane className="w-4 h-4 text-white" />
                </div>
                <span className="text-2xl font-black tracking-tight text-white">TriFork</span>
              </div>
              <p className="text-xs opacity-75 max-w-md">
                Plan Together. Explore Together. Settle Smarter.
                The event-sourced group travel platform combining 3D globes, scenario simulation, and instant UPI.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
              <a href="#simulator" className="hover:text-white transition-colors">
                What-If Simulator
              </a>
              <a href="#cesium-3d" className="hover:text-white transition-colors">
                3D Globe & Weather
              </a>
              <a href="#settlement" className="hover:text-white transition-colors">
                Settlements
              </a>
              <a href="#faq" className="hover:text-white transition-colors">
                FAQ
              </a>
              {mounted && user ? (
                <Link
                  href="/dashboard"
                  className="text-amber-200 hover:text-white transition-colors font-bold flex items-center gap-1"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-amber-200 hover:text-white transition-colors font-bold"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup"
                    className="bg-white/15 px-3 py-1.5 rounded-full hover:bg-white/25 text-white transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between text-xs opacity-70 gap-4">
            <p>© 2026 TriFork. Built for the modern traveler. All rights reserved.</p>
            <div className="flex items-center space-x-6">
              <a
                href="https://drive.google.com/file/d/1QdzKhRj0es53_jh1lPdCF0Efs_-tyKZr/view?usp=sharing"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <span>Demo Video</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://tripfor.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <span>Live App</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a href="#start" className="hover:text-white transition-colors">
                Back to Top ↑
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── INTERACTIVE TRIP PLANNER MODAL ── */}
      {plannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl relative overflow-hidden border border-stone-100">
            {/* Close Button */}
            <button
              onClick={() => setPlannerModalOpen(false)}
              className="absolute top-6 right-6 p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors"
              aria-label="Close Modal"
            >
              <X size={20} />
            </button>

            {plannerSubmitted ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-2 animate-bounce"
                  style={{ backgroundColor: `${COLORS.rose}20`, color: COLORS.rose }}
                >
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-2xl font-bold text-stone-900">Trip Workspace Prepared!</h3>
                <p className="text-stone-600 max-w-xs text-sm">
                  Connecting to your group ledger, 3D itinerary, and debt engine...
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <span
                    className="text-xs font-bold uppercase tracking-wider block mb-1"
                    style={{ color: COLORS.rose }}
                  >
                    TriFork Expedition Planner
                  </span>
                  <h3 className="text-2xl font-black" style={{ color: COLORS.burgundy }}>
                    Start Your Group Journey
                  </h3>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-stone-100 p-1 rounded-xl mb-6">
                  <button
                    onClick={() => setActiveTab('group')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
                      activeTab === 'group'
                        ? 'bg-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                    style={{ color: activeTab === 'group' ? COLORS.burgundy : undefined }}
                  >
                    Group Trip
                  </button>
                  <button
                    onClick={() => setActiveTab('weekend')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
                      activeTab === 'weekend'
                        ? 'bg-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                    style={{ color: activeTab === 'weekend' ? COLORS.burgundy : undefined }}
                  >
                    Weekend Getaway
                  </button>
                </div>

                {/* Quick Form */}
                <form onSubmit={handlePlannerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                        <MapPin size={12} /> Origin
                      </label>
                      <input
                        type="text"
                        value={tripDetails.origin}
                        onChange={e =>
                          setTripDetails({ ...tripDetails, origin: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-slate-900 transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                        <MapPin size={12} /> Destination
                      </label>
                      <input
                        type="text"
                        value={tripDetails.destination}
                        onChange={e =>
                          setTripDetails({ ...tripDetails, destination: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-slate-900 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                        <Calendar size={12} /> Start Date
                      </label>
                      <input
                        type="date"
                        value={tripDetails.date}
                        onChange={e =>
                          setTripDetails({ ...tripDetails, date: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-slate-900 transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                        <Users size={12} /> Group Size
                      </label>
                      <select
                        value={tripDetails.travelers}
                        onChange={e =>
                          setTripDetails({ ...tripDetails, travelers: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-slate-900 transition-colors"
                      >
                        {[2, 3, 4, 5, 6, 8, 10, 15, 20].map(num => (
                          <option key={num} value={num}>
                            {num} Travelers
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                      <Sparkles size={12} /> Trip Style
                    </label>
                    <select
                      value={tripDetails.tripType}
                      onChange={e =>
                        setTripDetails({ ...tripDetails, tripType: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-slate-900 transition-colors"
                    >
                      <option value="Coastal Explorer">Coastal Explorer (Beaches, Cafes & Watersports)</option>
                      <option value="Mountain Sanctuary">Mountain Sanctuary (Trekking & High Passes)</option>
                      <option value="Cultural Heritage">Cultural Heritage & Architecture</option>
                      <option value="Nightlife & Culinary">Nightlife, Fine Dining & Events</option>
                    </select>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full py-3.5 px-4 text-white rounded-full font-bold transition-all shadow-xl hover:shadow-2xl hover:scale-102 flex items-center justify-center space-x-2 group"
                      style={{ backgroundColor: COLORS.burgundy }}
                    >
                      <span>{user ? 'Initialize Trip in Dashboard' : 'Continue to Sign In & Launch'}</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
