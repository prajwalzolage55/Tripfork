'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { Plane, Mail, Lock, User, Phone, ArrowRight, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import Link from 'next/link';

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
    transition: { staggerChildren: 0.1 }
  }
};

const itemAnim: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120, damping: 14 } }
};

export default function SignupPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!displayName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const cleanPhone = phone.replace(/[\s\-+]/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number (this will be your UPI ID).');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = userCredential.user;

      const userProfile = {
        id: user.uid,
        display_name: displayName.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        avatar_url: null,
      };

      try {
        await setDoc(doc(db, 'user_profiles', user.uid), userProfile);
      } catch (docErr) {
        console.warn('Could not save user profile doc to Firestore:', docErr);
      }

      setUser({
        id: user.uid,
        display_name: userProfile.display_name,
        email: userProfile.email,
        phone: userProfile.phone,
        avatar_url: userProfile.avatar_url,
      });

      router.push('/hub');
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReactLenis root>
      <main className="min-h-screen flex font-['Inter']" style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}>
        
        {/* Left Side: Split Image */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center">
          <motion.img 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            src="https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=1400&auto=format&fit=crop" 
            alt="Road Trip with Friends"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Rose/Burgundy Overlay */}
          <div className="absolute inset-0 opacity-50 mix-blend-multiply" style={{ backgroundColor: COLORS.burgundy }} />
          
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="relative z-10 p-16 max-w-xl text-white"
          >
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-md">
                <Plane className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-black tracking-tight">TriFork</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter leading-[1.1] mb-6">
              Create an account & start packing.
            </h1>
            <p className="text-lg font-medium opacity-90 leading-relaxed">
              Join thousands of travelers using TriFork to organize their itineraries and automatically split expenses without the headache.
            </p>
          </motion.div>
        </div>

        {/* Right Side: Animated Signup Form */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12" style={{ backgroundColor: COLORS.cream }}>
          
          <Link href="/" className="absolute top-8 right-8 text-sm font-bold opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2" style={{ color: COLORS.burgundy }}>
            Back to Home
          </Link>

          <motion.div 
            className="w-full max-w-lg mx-auto"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={itemAnim} className="mb-8 text-center lg:text-left">
              <h2 className="text-4xl font-black tracking-tight mb-3">Join TriFork</h2>
              <p className="text-base font-medium opacity-70">
                Setup your account in seconds.
              </p>
            </motion.div>

            {/* Error Message Animation */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="overflow-hidden mb-6"
                >
                  <div className="px-5 py-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-md bg-red-100 text-red-700 border border-red-200">
                    <Sparkles className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSignup} className="space-y-4">
              
              <motion.div variants={itemAnim} className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider opacity-80" style={{ color: COLORS.burgundy }}>
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" style={{ color: COLORS.burgundy }} />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl outline-none transition-all font-medium text-base shadow-sm focus:shadow-md border-2 border-transparent placeholder-gray-400"
                    style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}
                    onFocus={(e) => e.target.style.borderColor = `${COLORS.burgundy}40`}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />
                </div>
              </motion.div>

              <motion.div variants={itemAnim} className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider opacity-80" style={{ color: COLORS.burgundy }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" style={{ color: COLORS.burgundy }} />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl outline-none transition-all font-medium text-base shadow-sm focus:shadow-md border-2 border-transparent placeholder-gray-400"
                    style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}
                    onFocus={(e) => e.target.style.borderColor = `${COLORS.burgundy}40`}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />
                </div>
              </motion.div>

              <motion.div variants={itemAnim} className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider opacity-80 flex justify-between" style={{ color: COLORS.burgundy }}>
                  <span>Mobile Number</span>
                  <span className="opacity-60 normal-case tracking-normal">Used as UPI ID</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" style={{ color: COLORS.burgundy }} />
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl outline-none transition-all font-medium text-base shadow-sm focus:shadow-md border-2 border-transparent placeholder-gray-400"
                    style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}
                    onFocus={(e) => e.target.style.borderColor = `${COLORS.burgundy}40`}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />
                </div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div variants={itemAnim} className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-80" style={{ color: COLORS.burgundy }}>
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" style={{ color: COLORS.burgundy }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 chars"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-10 pr-10 py-3.5 rounded-2xl outline-none transition-all font-medium text-sm shadow-sm focus:shadow-md border-2 border-transparent placeholder-gray-400"
                      style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}
                      onFocus={(e) => e.target.style.borderColor = `${COLORS.burgundy}40`}
                      onBlur={(e) => e.target.style.borderColor = 'transparent'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 transition-opacity focus:outline-none"
                      style={{ color: COLORS.burgundy }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </motion.div>

                <motion.div variants={itemAnim} className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-80" style={{ color: COLORS.burgundy }}>
                    Confirm
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" style={{ color: COLORS.burgundy }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Re-enter"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl outline-none transition-all font-medium text-sm shadow-sm focus:shadow-md border-2 border-transparent placeholder-gray-400"
                      style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}
                      onFocus={(e) => e.target.style.borderColor = `${COLORS.burgundy}40`}
                      onBlur={(e) => e.target.style.borderColor = 'transparent'}
                    />
                  </div>
                </motion.div>
              </div>

              <motion.div variants={itemAnim} className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-lg transition-transform hover:-translate-y-1 shadow-xl hover:shadow-2xl disabled:opacity-70 disabled:hover:translate-y-0"
                  style={{ backgroundColor: COLORS.rose }}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Create Account <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </motion.div>

            </form>

            <motion.div variants={itemAnim} className="mt-8 text-center text-sm font-semibold opacity-70">
              Already have an account?{' '}
              <Link href="/login" className="hover:underline" style={{ color: COLORS.rose }}>
                Sign in
              </Link>
            </motion.div>

          </motion.div>
        </div>
        
      </main>
    </ReactLenis>
  );
}
