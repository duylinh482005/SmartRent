import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Trash2, Lightbulb, TrendingUp, Zap, Bell, AlertTriangle, Clock, FileWarning } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { aiApi } from '../api/aiApi';
import type { ChatHistoryItem, AiAlertItem } from '../api/aiApi';

function alertMeta(type: AiAlertItem['type']) {
  switch (type) {
    case 'OVERDUE':         return { icon: AlertTriangle, color: 'text-red-600',   bg: 'bg-red-50   hover:bg-red-100   border-red-100' };
    case 'EXPIRING':        return { icon: Clock,          color: 'text-amber-600', bg: 'bg-amber-50 hover:bg-amber-100 border-amber-100' };
    case 'MISSING_INVOICE': return { icon: FileWarning,    color: 'text-blue-600',  bg: 'bg-blue-50  hover:bg-blue-100  border-blue-100' };
  }
}
import PageHeader from '../components/ui/PageHeader';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SuggestionItem {
  label: string;
  message: string;
}

interface SuggestionCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  items: SuggestionItem[];
}

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  {
    id: 'status',
    label: 'Tình hình',
    icon: Bell,
    color: 'text-amber-600',
    items: [
      { label: 'Báo cáo tình hình hôm nay',         message: 'Báo cáo tình hình hôm nay' },
      { label: 'Việc cần ưu tiên làm hôm nay',      message: 'Hôm nay tôi cần làm gì trước, việc nào cần ưu tiên nhất?' },
      { label: 'Khách rủi ro cao — nên xử lý thế nào?', message: 'Khách thuê nào đang có rủi ro cao? Tôi nên xử lý thế nào?' },
    ],
  },
  {
    id: 'finance',
    label: 'Tài chính',
    icon: TrendingUp,
    color: 'text-emerald-600',
    items: [
      { label: 'Tổng quan tài chính và lời khuyên', message: 'Phân tích tình hình tài chính tổng thể và cho tôi lời khuyên cải thiện' },
      { label: 'Dự báo doanh thu tháng tới',        message: 'Dự báo doanh thu tháng tới dựa trên lịch sử thu thực tế' },
      { label: 'So sánh hiệu suất các khu trọ',     message: 'So sánh hiệu suất các khu trọ, khu nào đang tốt nhất và khu nào đang kém?' },
    ],
  },
  {
    id: 'optimize',
    label: 'Tối ưu',
    icon: Zap,
    color: 'text-violet-600',
    items: [
      { label: 'Phòng trống — đang mất bao nhiêu?', message: 'Phòng trống đang làm tôi mất bao nhiêu tiền mỗi tháng? Tôi nên làm gì để cải thiện?' },
      { label: 'Lịch sử trễ hạn — tư vấn xử lý',   message: 'Phân tích chi tiết lịch sử trễ hạn của các khách thuê và tư vấn cách xử lý từng người' },
      { label: 'Hợp đồng sắp hết hạn — giữ khách', message: 'Hợp đồng nào sắp hết hạn? Tôi nên liên hệ ai trước và làm gì để giữ khách?' },
    ],
  },
];

// ── Inline markdown renderer ──────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    if (line.startsWith('## ')) {
      elements.push(
        <p key={idx} className="font-semibold text-gray-900 mt-3 mb-0.5 first:mt-0">
          {renderInline(line.slice(3))}
        </p>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <p key={idx} className="font-medium text-gray-800 mt-2 mb-0.5 first:mt-0">
          {renderInline(line.slice(4))}
        </p>
      );
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      const text = line.startsWith('- ') ? line.slice(2) : line.slice(2);
      elements.push(
        <p key={idx} className="mt-0.5 pl-1">
          {'• '}{renderInline(text)}
        </p>
      );
    } else if (!line.trim()) {
      elements.push(<div key={idx} className="h-1.5" />);
    } else {
      elements.push(
        <p key={idx} className={idx > 0 ? 'mt-1' : ''}>
          {renderInline(line)}
        </p>
      );
    }
  });

  return <>{elements}</>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [activeCategory, setActiveCategory] = useState('status');
  const bottomRef                           = useRef<HTMLDivElement>(null);
  const inputRef                            = useRef<HTMLInputElement>(null);
  const autoGreeted                         = useRef(false);

  const { data: alertsData } = useQuery({
    queryKey: ['ai-alerts'],
    queryFn: () => aiApi.getAlerts().then(r => r.data.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const alerts = alertsData?.alerts ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (autoGreeted.current) return;
    autoGreeted.current = true;
    sendMessage('Báo cáo tình hình hôm nay');
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const history: ChatHistoryItem[] = messages
      .filter(m => m.content !== '...')
      .slice(-4)
      .map(m => ({ role: m.role, content: m.content }));

    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const loadingId = Date.now() + 1;
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant',
      content: '...',
      timestamp: new Date(),
    }]);

    try {
      const res = await aiApi.chat(text.trim(), history);
      const answer = res.data.data.answer;
      setMessages(prev => prev.map(m =>
        m.id === loadingId ? { ...m, content: answer } : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, content: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.' }
          : m
      ));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSuggestionClick = (item: SuggestionItem) => {
    sendMessage(item.message);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleClear = () => {
    setMessages([]);
    toast.success('Đã xóa cuộc trò chuyện');
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const activeCat = SUGGESTION_CATEGORIES.find(c => c.id === activeCategory)!;

  return (
    <div className="p-6 h-screen flex flex-col">
      <PageHeader
        icon={Bot}
        title="AI Assistant"
        subtitle="Trợ lý ảo thông minh cho quản lý phòng trọ hiệu quả"
        action={
          <button onClick={handleClear}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
            <Trash2 className="w-3.5 h-3.5" />
            Xóa hội thoại
          </button>
        }
      />

      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Chat area ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                  msg.role === 'assistant'
                    ? 'bg-gradient-to-br from-primary-100 to-primary-200'
                    : 'bg-gradient-to-br from-gray-100 to-gray-200'
                }`}>
                  {msg.role === 'assistant'
                    ? <Bot className="w-4 h-4 text-primary-700" />
                    : <User className="w-4 h-4 text-gray-500" />
                  }
                </div>

                <div className={`max-w-[78%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'assistant'
                      ? 'bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-100'
                      : 'bg-primary-800 text-white rounded-tr-sm'
                  }`}>
                    {msg.content === '...' ? (
                      <div className="flex gap-1.5 items-center py-0.5">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : msg.role === 'assistant' ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      msg.content.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
                      ))
                    )}
                  </div>
                  <span className="text-xs text-gray-400 px-1">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Hỏi về tài chính, khách thuê, phòng trọ..."
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 transition"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-10 h-10 flex items-center justify-center bg-primary-800 text-white rounded-xl hover:bg-primary-900 disabled:opacity-40 transition flex-shrink-0 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* Alert panel — chỉ hiện khi có vấn đề */}
          {alerts.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-gray-700">Cần xử lý ngay</span>
                <span className="ml-auto text-xs font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">
                  {alerts.length}
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                {alerts.map((alert, i) => {
                  const { icon: Icon, color, bg } = alertMeta(alert.type);
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(alert.aiMessage)}
                      disabled={loading}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all disabled:opacity-50 border flex items-start gap-2 ${bg}`}
                    >
                      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${color}`} />
                      <span className={`leading-snug font-medium ${color}`}>{alert.message}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold text-gray-700">Gợi ý</span>
            </div>

            {/* Category tabs — single row, no truncation */}
            <div className="flex border-b border-gray-100">
              {SUGGESTION_CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    title={cat.label}
                    className={`flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 text-xs font-medium transition-all border-b-2 ${
                      isActive
                        ? `border-primary-700 ${cat.color} bg-primary-50/40`
                        : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Suggestion items */}
            <div className="p-3 space-y-1.5">
              {activeCat.items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(item)}
                  disabled={loading}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all disabled:opacity-50 bg-gray-50 hover:bg-primary-50 text-gray-600 hover:text-primary-800 border border-transparent hover:border-primary-100"
                >
                  <span className="leading-snug">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
