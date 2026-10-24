'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTripId } from '@/lib/trip-routing';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { dispatchExpenseNotification } from '@/lib/notifications';
import { appendEvent } from '@/lib/ledger';
import type { ExpenseAddedPayload, ExpenseDeletedPayload } from '@/lib/ledger';
import type { Expense, ItineraryItem, TripMember, ItemParticipant, SplitType } from '@/lib/types';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Plus, Receipt, DollarSign, Upload, X, Loader2, Check, User, Tag, Trash2,
  Compass, Map, Sparkles
} from 'lucide-react';

const COLORS = {
  burgundy: '#0f172a',
  cream: '#f8fafc',
  offWhite: '#ffffff',
  rose: '#2563eb'
};

const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: 'equal', label: 'Split Equally' },
  { value: 'flat_per_person', label: 'Flat Per Person' },
  { value: 'percentage', label: 'By Percentage' },
  { value: 'organizer_paid', label: 'Organizer Paid' },
];

/* ── Framer Motion Variants ── */
const staggerList: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

const listItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1, y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
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

export default function ExpensesPage() {
  const { user: authUser } = useAuth();
  const tripId = useTripId();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [participantsMap, setParticipantsMap] = useState<Record<string, ItemParticipant[]>>({});
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [formItemId, setFormItemId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPaidBy, setFormPaidBy] = useState('');
  const [formSplitType, setFormSplitType] = useState<SplitType>('equal');
  const [formNote, setFormNote] = useState('');
  const [formReceipt, setFormReceipt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const expQ = query(collection(db, 'expenses'), where('trip_id', '==', tripId));
      const itemQ = query(collection(db, 'itinerary_items'), where('trip_id', '==', tripId), where('status', '==', 'active'));
      const memQ = query(collection(db, 'trip_members'), where('trip_id', '==', tripId));

      const [expRes, itemRes, memRes] = await Promise.all([
        getDocs(expQ),
        getDocs(itemQ),
        getDocs(memQ),
      ]);

      const loadedExpenses = expRes.docs
        .map(d => ({ id: d.id, ...d.data() } as unknown as Expense))
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
      const loadedItems = itemRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ItineraryItem));
      const loadedMembers = memRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as TripMember));

      setExpenses(loadedExpenses);
      setItems(loadedItems);
      setMembers(loadedMembers);

      const storedUser = localStorage.getItem('gtl_user');
      if (storedUser && loadedMembers.length > 0) {
        const parsed = JSON.parse(storedUser);
        const me = loadedMembers.find(m => m.user_id === parsed.id);
        if (me) {
          setCurrentMemberId(me.id);
          if (!formPaidBy) setFormPaidBy(me.id);
        }
      }

      if (loadedItems.length > 0) {
        const partsQ = query(collection(db, 'item_participants'));
        const partsRes = await getDocs(partsQ);
        const parts = partsRes.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ItemParticipant));
        const activeIds = new Set(loadedItems.map(i => i.id));
        const map: Record<string, ItemParticipant[]> = {};
        parts.forEach(p => {
          if (activeIds.has(p.item_id)) {
            if (!map[p.item_id]) map[p.item_id] = [];
            map[p.item_id].push(p);
          }
        });
        setParticipantsMap(map);
      }
    } catch (err) {
      console.error('Failed to load expenses page data:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId, formPaidBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function uploadReceipt(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormReceipt(reader.result as string);
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Failed to read receipt image file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      alert('Upload failed');
      setUploading(false);
    }
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const expRef = doc(collection(db, 'expenses'));
      const parsedAmount = parseFloat(formAmount);
      const expParticipants = formItemId && participantsMap[formItemId]
        ? participantsMap[formItemId].map(p => p.member_id)
        : members.map(m => m.id);

      await setDoc(expRef, {
        id: expRef.id,
        trip_id: tripId,
        item_id: formItemId || null,
        amount: parsedAmount,
        paid_by: formPaidBy,
        split_type: formSplitType,
        receipt_url: formReceipt || null,
        note: formNote || null,
        created_at: new Date().toISOString()
      });

      const storedUser = localStorage.getItem('gtl_user');
      const actorId = storedUser ? JSON.parse(storedUser).id : 'unknown';
      const eventPayload: ExpenseAddedPayload = {
        expenseId: expRef.id,
        itemId: formItemId || null,
        amount: parsedAmount,
        currency: 'INR',
        paidByMemberId: formPaidBy,
        splitType: formSplitType,
        participantMemberIds: expParticipants,
        note: formNote || null,
        receiptUrl: formReceipt || null,
      };
      appendEvent(tripId, 'EXPENSE_ADDED', actorId, eventPayload).catch(err => console.warn(err));

      const payer = members.find(m => m.id === formPaidBy);
      dispatchExpenseNotification({
        tripId,
        tripName: 'Trip',
        payerId: payer?.user_id || authUser?.id || '',
        payerName: payer?.display_name || authUser?.display_name || 'A group member',
        amount: parsedAmount,
        note: formNote || null,
      }).catch(err => console.warn(err));

      setShowForm(false);
      setFormItemId('');
      setFormAmount('');
      setFormSplitType('equal');
      setFormNote('');
      setFormReceipt('');
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
    setSaving(false);
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      const originalExpense = expenses.find(e => e.id === id);
      await deleteDoc(doc(db, 'expenses', id));
      if (originalExpense) {
        const storedUser = localStorage.getItem('gtl_user');
        const actorId = storedUser ? JSON.parse(storedUser).id : 'unknown';
        appendEvent(tripId, 'EXPENSE_DELETED', actorId, {
          expenseId: id,
          originalAmount: Number(originalExpense.amount),
          originalPaidBy: originalExpense.paid_by,
          reason: 'User deleted',
        }).catch(err => console.warn(err));
      }
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  const memberName = (id: string) => members.find(m => m.id === id)?.display_name || '?';
  const itemLabel = (id: string | null) => {
    if (!id) return 'General Expense';
    return items.find(i => i.id === id)?.label || 'Unknown Item';
  };

  function handleItemChange(itemId: string) {
    setFormItemId(itemId);
    const item = items.find(i => i.id === itemId);
    if (item) setFormSplitType(item.default_split_type);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
          <Compass size={32} style={{ color: COLORS.burgundy }} />
        </motion.div>
        <span className="font-bold text-sm tracking-tight opacity-70">Loading expenses…</span>
      </div>
    );
  }

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="pb-32 font-['Inter']">
      {/* Header */}
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3 border" style={{ backgroundColor: `${COLORS.rose}15`, borderColor: `${COLORS.rose}30`, color: COLORS.rose }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black tracking-widest uppercase">Ledger</span>
          </div>
          <h2 className="text-4xl font-black tracking-tighter" style={{ color: COLORS.burgundy }}>Expenses</h2>
        </div>
        <motion.button 
          onClick={() => { setShowForm(true); setFormPaidBy(currentMemberId || ''); }}
          whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-6 py-3 rounded-full text-white font-bold shadow-xl transition-all"
          style={{ backgroundColor: COLORS.rose }}
        >
          <Plus size={18} /> Add Expense
        </motion.button>
      </motion.div>

      {/* Stats */}
      <motion.div 
        className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="p-8 rounded-[2rem] shadow-xl border bg-white" style={{ borderColor: COLORS.cream }}>
          <div className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">Total Trip Expenses</div>
          <div className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br" style={{ backgroundImage: `linear-gradient(to bottom right, ${COLORS.burgundy}, ${COLORS.rose})` }}>
            ₹{totalAmount.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="p-8 rounded-[2rem] shadow-md border bg-white" style={{ borderColor: COLORS.cream }}>
          <div className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">Total Transactions</div>
          <div className="text-5xl font-black tracking-tighter" style={{ color: COLORS.burgundy }}>
            {expenses.length}
          </div>
        </div>
      </motion.div>

      {/* List */}
      {expenses.length === 0 ? (
        <motion.div 
          className="py-24 text-center rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center"
          style={{ borderColor: COLORS.cream, backgroundColor: `${COLORS.cream}30` }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: COLORS.cream }}>
            <Receipt className="w-8 h-8 opacity-60" style={{ color: COLORS.burgundy }} />
          </div>
          <h3 className="text-2xl font-black mb-3">No expenses logged yet</h3>
          <p className="text-lg opacity-70 font-medium max-w-md mx-auto">Track everything you spend to easily split costs later.</p>
        </motion.div>
      ) : (
        <motion.div variants={staggerList} initial="hidden" animate="show" className="space-y-4">
          {expenses.map((exp) => (
            <motion.div 
              key={exp.id} 
              variants={listItem}
              className="flex items-center gap-4 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border bg-white"
              style={{ borderColor: COLORS.cream }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.cream, color: COLORS.burgundy }}>
                <DollarSign size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold truncate tracking-tight">{exp.note || itemLabel(exp.item_id)}</div>
                <div className="flex items-center flex-wrap gap-3 mt-1 text-sm font-semibold opacity-70">
                  <span className="flex items-center gap-1"><User size={14} /> {memberName(exp.paid_by)} paid</span>
                  <span className="flex items-center gap-1"><Tag size={14} /> {itemLabel(exp.item_id)}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: COLORS.cream }}>
                    {SPLIT_OPTIONS.find(s => s.value === exp.split_type)?.label}
                  </span>
                </div>
              </div>
              <div className="text-xl font-black font-mono tracking-tighter" style={{ color: COLORS.burgundy }}>
                ₹{Number(exp.amount).toLocaleString('en-IN')}
              </div>
              {exp.receipt_url && (
                <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="ml-2 block border rounded-lg overflow-hidden hover:opacity-80 transition-opacity" style={{ borderColor: COLORS.cream }}>
                  <img src={exp.receipt_url} alt="Receipt" className="w-10 h-10 object-cover" />
                </a>
              )}
              <div className="ml-2">
                <button 
                  onClick={() => deleteExpense(exp.id)}
                  className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete Expense"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            />
            <motion.div 
              variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              className="relative w-full max-w-lg p-8 rounded-[2rem] shadow-2xl bg-white border max-h-[90vh] overflow-y-auto"
              style={{ borderColor: COLORS.cream }}
            >
              <h2 className="text-3xl font-black mb-6" style={{ color: COLORS.burgundy }}>Add Expense</h2>
              <form onSubmit={saveExpense} className="space-y-5">
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Linked To</label>
                  <select 
                    value={formItemId} onChange={e => handleItemChange(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all appearance-none cursor-pointer"
                    style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                  >
                    <option value="">— General Expense (Not tied to itinerary) —</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>{item.label} ({item.type})</option>
                    ))}
                  </select>
                  {formItemId && participantsMap[formItemId] && (
                    <div className="mt-2 text-xs font-bold px-4 py-2 rounded-xl" style={{ backgroundColor: COLORS.cream, color: COLORS.burgundy }}>
                      Splitting among: {participantsMap[formItemId].map(p => memberName(p.member_id)).join(', ')}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Amount (₹)</label>
                    <input 
                      type="number" step="0.01" min="0.01" required value={formAmount} onChange={e => setFormAmount(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl outline-none font-bold font-mono text-lg shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Paid By</label>
                    <select 
                      required value={formPaidBy} onChange={e => setFormPaidBy(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all appearance-none cursor-pointer"
                      style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                    >
                      <option value="">Select...</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Split Type</label>
                  <select 
                    value={formSplitType} onChange={e => setFormSplitType(e.target.value as SplitType)}
                    className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all appearance-none cursor-pointer"
                    style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                  >
                    {SPLIT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Note</label>
                  <input 
                    type="text" value={formNote} onChange={e => setFormNote(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl outline-none font-medium text-base shadow-inner border-2 border-transparent bg-gray-50 focus:bg-white transition-all"
                    style={{ color: COLORS.burgundy }} onFocus={e => e.target.style.borderColor = `${COLORS.burgundy}40`} onBlur={e => e.target.style.borderColor = 'transparent'}
                    placeholder="What was this for?"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Receipt (Optional)</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-dashed cursor-pointer hover:bg-gray-50 transition-colors" style={{ borderColor: COLORS.cream }}>
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 opacity-60" />}
                      <span className="font-bold text-sm opacity-80">Upload Image</span>
                      <input type="file" accept="image/*" hidden onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) uploadReceipt(file);
                      }} />
                    </label>
                    {formReceipt && (
                      <div className="relative">
                        <img src={formReceipt} alt="Receipt" className="w-12 h-12 rounded-xl object-cover border" style={{ borderColor: COLORS.cream }} />
                        <button type="button" onClick={() => setFormReceipt('')} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"><X size={12} /></button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" disabled={saving} className="flex-1 py-4 rounded-2xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.burgundy }}>
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    Save Expense
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-8 py-4 rounded-2xl font-bold transition-colors hover:bg-gray-100 bg-gray-50 border">Cancel</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
