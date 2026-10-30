'use client';

import { useState } from 'react';
import type { Trip, TripPreferences, ItineraryDayRecord, ItineraryItem } from '@/lib/types';
import {
  Sparkles, X, Send, Bot, User, ArrowRight, Check,
  Clock, MapPin, Compass, AlertCircle, Loader2
} from 'lucide-react';

interface AITravelAssistantProps {
  trip: Trip | null;
  preferences: TripPreferences | null;
  days: ItineraryDayRecord[];
  items: ItineraryItem[];
  isOpen: boolean;
  onClose: () => void;
  onAddSuggestedItem: (item: {
    label: string;
    dayId?: string;
    type: 'activity' | 'dining' | 'hotel' | 'transfer';
    cost: number;
    description: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<void>;
  onRegenerate: () => Promise<void>;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  actionCard?: {
    type: 'add_item' | 'regenerate';
    title: string;
    subtitle: string;
    payload?: any;
  };
}

export default function AITravelAssistant({
  trip,
  preferences,
  days,
  items,
  isOpen,
  onClose,
  onAddSuggestedItem,
  onRegenerate,
}: AITravelAssistantProps) {
  const destination = trip?.destination || trip?.name || 'your destination';

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionDone, setActionDone] = useState<Record<string, boolean>>({});

  const defaultSuggestions = [
    `🏖️ Best scenic spots in ${destination}`,
    `🍽️ Recommend top authentic dinner places`,
    `⚡ What are the must-visit highlights?`,
    `🌅 Where is the best sunset viewpoint?`,
  ];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I'm your Gemini AI Travel Companion for **${trip?.name || 'this trip'}** to **${destination}**. How can I help fine-tune your itinerary today?`,
      time: 'Just now',
    },
  ]);

  async function handleSend(customText?: string) {
    const query = (customText || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          destination,
          tripName: trip?.name,
          currentActivities: items.map(i => i.label),
          travelStyle: preferences?.travel_style || 'Balanced',
        }),
      });

      const data = await res.json();
      const aiText = data.text || `Here is what I recommend for ${destination}!`;
      let actionCard: Message['actionCard'] = undefined;

      if (data.actionCard && data.actionCard.item) {
        actionCard = {
          type: 'add_item',
          title: data.actionCard.title || data.actionCard.item.label,
          subtitle: data.actionCard.subtitle || `~₹${data.actionCard.item.cost || 0} • ${data.actionCard.item.type}`,
          payload: {
            ...data.actionCard.item,
            dayId: days[0]?.id,
          },
        };
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionCard,
        },
      ]);
    } catch (err: any) {
      console.warn('AI Assistant API call error, falling back:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `For ${destination}, I recommend balancing visits to top cultural sights with local culinary tastings! Feel free to ask about specific activities or dining spots.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteAction(msgId: string, actionCard: Message['actionCard']) {
    if (!actionCard || actionDone[msgId]) return;

    setActionDone(prev => ({ ...prev, [msgId]: true }));

    if (actionCard.type === 'add_item' && actionCard.payload) {
      await onAddSuggestedItem(actionCard.payload);
    } else if (actionCard.type === 'regenerate') {
      await onRegenerate();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-lenis-prevent="true"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white/95 backdrop-blur-xl border-l border-slate-200/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-purple-50/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">Gemini AI Travel Companion</h3>
            <p className="text-[11px] text-slate-500">Exploring {destination}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Messages */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4"
        data-lenis-prevent="true"
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                  : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/70'
              }`}
            >
              <div className="whitespace-pre-line font-normal">{msg.text}</div>
            </div>

            {/* Action Card Attachment */}
            {msg.actionCard && (
              <div className="mt-2 max-w-[85%] w-full bg-white rounded-xl border border-indigo-100 p-3 shadow-xs space-y-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    Suggested Action
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">{msg.actionCard.title}</h4>
                  <p className="text-[11px] text-slate-500">{msg.actionCard.subtitle}</p>
                </div>
                <button
                  onClick={() => handleExecuteAction(msg.id, msg.actionCard)}
                  disabled={actionDone[msg.id]}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    actionDone[msg.id]
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                  }`}
                >
                  {actionDone[msg.id] ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Added to Itinerary</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{msg.actionCard.type === 'add_item' ? 'Add to Itinerary' : 'Apply Change'}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl p-3 w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            <span>Gemini is thinking...</span>
          </div>
        )}
      </div>

      {/* Quick Suggestions Chips */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
        {defaultSuggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(s)}
            className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0">
        <input
          type="text"
          placeholder="Ask Gemini to find places, dishes, tips..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
