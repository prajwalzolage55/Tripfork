'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { Plane, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';
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

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = userCredential.user;

      const docRef = doc(db, 'user_profiles', user.uid);
      const defaultName = user.displayName || (email.split('@')[0] ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : 'User');
      let profileData = {
        id: user.uid,
        display_name: defaultName,
        email: user.email || email.trim().toLowerCase(),
        phone: user.phoneNumber || '',
        avatar_url: user.photoURL || null,
      };

      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          profileData = {
            id: user.uid,
            display_name: data.display_name || profileData.display_name,
            email: data.email || profileData.email,
            phone: data.phone || profileData.phone,
            avatar_url: data.avatar_url || profileData.avatar_url,
          };
        } else {
          await setDoc(docRef, profileData);
        }
      } catch (firestoreErr) {
        console.warn('Could not fetch or create Firestore user profile:', firestoreErr);
      }

      setUser(profileData);
      router.push('/hub');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
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
            src="https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?q=80&w=1400&auto=format&fit=crop" 
            alt="Travel Beach"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Burgundy Overlay */}
          <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{ backgroundColor: COLORS.burgundy }} />
          
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
              Your next adventure is waiting.
            </h1>
            <p className="text-lg font-medium opacity-90 leading-relaxed">
              Login to access your automated group itineraries, AI-powered expense splitting, and seamless ledger settlements.
            </p>
          </motion.div>
        </div>

        {/* Right Side: Animated Login Form */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24" style={{ backgroundColor: COLORS.cream }}>
          
          <Link href="/" className="absolute top-8 right-8 text-sm font-bold opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2" style={{ color: COLORS.burgundy }}>
            Back to Home
          </Link>

          <motion.div 
            className="w-full max-w-md mx-auto"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={itemAnim} className="mb-10 text-center lg:text-left">
              <h2 className="text-4xl font-black tracking-tight mb-3">Welcome Back</h2>
              <p className="text-base font-medium opacity-70">
                Sign in to manage your group trips.
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
                    <Sparkles className="w-5 h-5" />
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleLogin} className="space-y-6">
              
              <motion.div variants={itemAnim} className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider opacity-80" style={{ color: COLORS.burgundy }}>
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
                    className="w-full pl-12 pr-4 py-4 rounded-2xl outline-none transition-all font-medium text-base shadow-sm focus:shadow-md border-2 border-transparent placeholder-gray-400"
                    style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}
                    onFocus={(e) => e.target.style.borderColor = `${COLORS.burgundy}40`}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />
                </div>
              </motion.div>

              <motion.div variants={itemAnim} className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider opacity-80" style={{ color: COLORS.burgundy }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" style={{ color: COLORS.burgundy }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-12 py-4 rounded-2xl outline-none transition-all font-medium text-base shadow-sm focus:shadow-md border-2 border-transparent placeholder-gray-400"
                    style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}
                    onFocus={(e) => e.target.style.borderColor = `${COLORS.burgundy}40`}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 transition-opacity focus:outline-none"
                    style={{ color: COLORS.burgundy }}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>

              <motion.div variants={itemAnim} className="pt-2">
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
                      Sign In <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </motion.div>

            </form>

            <motion.div variants={itemAnim} className="mt-10 text-center text-sm font-semibold opacity-70">
              Don't have an account?{' '}
              <Link href="/signup" className="hover:underline" style={{ color: COLORS.rose }}>
                Create one now.
              </Link>
            </motion.div>

          </motion.div>
        </div>
        
      </main>
    </ReactLenis>
  );
}
