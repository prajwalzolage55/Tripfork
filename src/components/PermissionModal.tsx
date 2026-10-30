'use client';

import { useState, useEffect } from 'react';
import { Bell, Camera, MapPin, CheckCircle, ShieldCheck, ArrowRight, Loader2, X } from 'lucide-react';
import { registerPushNotifications } from '@/lib/notifications';
import { useAuth } from './AuthProvider';

const STORAGE_KEY = 'gtl_permissions_reviewed';

export default function PermissionModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only check once mounted in browser
    try {
      const reviewed = localStorage.getItem(STORAGE_KEY);
      if (!reviewed) {
        // Show after brief entrance delay for smooth animation
        const timer = setTimeout(() => setIsOpen(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore SSR or local storage error
    }
  }, []);

  const handleAllowPermissions = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        await registerPushNotifications(user.id);
      } else {
        // Web fallback permission request even before auth
        if (typeof window !== 'undefined' && 'Notification' in window) {
          await Notification.requestPermission();
        }
      }
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (err) {
      console.error('Error during permission request:', err);
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="permission-overlay" data-lenis-prevent="true">
      <style>{`
        .permission-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(12px);
          animation: permFadeIn 0.3s ease-out;
        }

        @keyframes permFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }

        .permission-card {
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          overscroll-behavior: contain;
          border-radius: 1.5rem;
          background: var(--color-surface-0, #ffffff);
          border: 1px solid var(--color-glass-border, rgba(226, 232, 240, 0.8));
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          position: relative;
        }

        .permission-header {
          background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
          padding: 2rem 1.75rem 1.5rem;
          color: white;
          text-align: center;
          position: relative;
        }

        .permission-header .badge-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 1rem;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }

        .permission-header h2 {
          font-size: 1.35rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin-bottom: 0.35rem;
        }

        .permission-header p {
          font-size: 0.875rem;
          opacity: 0.9;
          line-height: 1.45;
          max-width: 360px;
          margin: 0 auto;
        }

        .permission-close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255, 255, 255, 0.12);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
        }

        .permission-close-btn:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .permission-body {
          padding: 1.5rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .permission-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 0.875rem;
          border-radius: 1rem;
          background: var(--color-surface-50, #f8fafc);
          border: 1px solid var(--color-surface-200, #e2e8f0);
          transition: transform 0.2s, border-color 0.2s;
        }

        .permission-item:hover {
          transform: translateY(-1px);
          border-color: #6366f1;
        }

        .permission-item-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .permission-item-icon.bell {
          background: rgba(99, 102, 241, 0.12);
          color: #4f46e5;
        }

        .permission-item-icon.camera {
          background: rgba(16, 185, 129, 0.12);
          color: #059669;
        }

        .permission-item-icon.map {
          background: rgba(245, 158, 11, 0.12);
          color: #d97706;
        }

        .permission-item-info h4 {
          font-size: 0.925rem;
          font-weight: 600;
          color: var(--color-text-primary, #0f172a);
          margin-bottom: 0.2rem;
        }

        .permission-item-info p {
          font-size: 0.8rem;
          color: var(--color-text-muted, #64748b);
          line-height: 1.4;
        }

        .permission-actions {
          padding: 0.5rem 1.75rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .btn-allow-all {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.875rem 1.5rem;
          border-radius: 0.875rem;
          font-size: 0.95rem;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #4f46e5, #4338ca);
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
        }

        .btn-allow-all:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(79, 70, 229, 0.45);
        }

        .btn-allow-all:active {
          transform: translateY(0);
        }

        .btn-allow-all:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .btn-skip {
          background: none;
          border: none;
          color: var(--color-text-muted, #64748b);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          text-align: center;
          padding: 0.375rem;
          transition: color 0.15s;
        }

        .btn-skip:hover {
          color: var(--color-text-primary, #0f172a);
          text-decoration: underline;
        }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="permission-card animate-in" role="dialog" aria-modal="true" data-lenis-prevent="true">
        <div className="permission-header">
          <button className="permission-close-btn" onClick={handleDismiss} title="Close">
            <X size={16} />
          </button>
          <div className="badge-icon">
            <ShieldCheck size={28} />
          </div>
          <h2>Stay In The Loop</h2>
          <p>Enable permissions to unlock real-time trip expense tracking and collaborative travel planning.</p>
        </div>

        <div className="permission-body">
          <div className="permission-item">
            <div className="permission-item-icon bell">
              <Bell size={20} />
            </div>
            <div className="permission-item-info">
              <h4>Instant Expense Alerts</h4>
              <p>Get notified when friends pay for food, transport, or hotels (e.g. ₹5,000 for dinner), even when the app is closed.</p>
            </div>
          </div>

          <div className="permission-item">
            <div className="permission-item-icon camera">
              <Camera size={20} />
            </div>
            <div className="permission-item-info">
              <h4>Receipts &amp; Bill Attachments</h4>
              <p>Easily upload bill photos and invoices so all split calculations stay verified and transparent.</p>
            </div>
          </div>

          <div className="permission-item">
            <div className="permission-item-icon map">
              <MapPin size={20} />
            </div>
            <div className="permission-item-info">
              <h4>Collaborative Itinerary</h4>
              <p>Access location pins, stops, and schedules on the interactive trip map.</p>
            </div>
          </div>
        </div>

        <div className="permission-actions">
          <button className="btn-allow-all" onClick={handleAllowPermissions} disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : <CheckCircle size={18} />}
            <span>Allow &amp; Continue</span>
          </button>
          <button className="btn-skip" onClick={handleDismiss}>
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
