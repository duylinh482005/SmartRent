import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Trash2, Lightbulb, TrendingUp, BarChart2, Bell, Wrench, PenLine, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../api/aiApi';
import type { ChatHistoryItem } from '../api/aiApi';
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
  fillOnly?: boolean;
  subItems?: SuggestionItem[];
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
    id: 'revenue',
    label: 'Doanh thu',
    icon: TrendingUp,
    color: 'text-emerald-600',
    items: [
      { label: 'Tháng này so với tháng trước',  message: 'So sánh doanh thu tháng này với tháng trước' },
      { label: 'Doanh thu theo quý năm nay',    message: 'Doanh thu theo quý năm nay như thế nào?' },
      { label: 'Tổng quan tài chính và lời khuyên', message: 'Phân tích tình hình tổng thể và cho tôi lời khuyên' },
    ],
  },
  {
    id: 'analysis',
    label: 'Phân tích',
    icon: BarChart2,
    color: 'text-blue-600',
    items: [
      { label: 'Phòng trống lâu nhất',          message: 'Phòng nào đang trống quá lâu? Tôi đang bị mất bao nhiêu tiền?' },
      { label: 'Khách hay trễ hạn thanh toán',  message: 'Khách thuê nào hay trễ hạn thanh toán?' },
      { label: 'Khu trọ hiệu quả nhất',         message: 'Khu trọ nào đang hoạt động hiệu quả nhất?' },
    ],
  },
  {
    id: 'alerts',
    label: 'Cảnh báo',
    icon: Bell,
    color: 'text-amber-600',
    items: [
      { label: 'Hợp đồng sắp hết hạn',          message: 'Hợp đồng nào sắp hết hạn, tôi cần làm gì?' },
      { label: 'Hóa đơn chưa tạo tháng này',   message: 'Hóa đơn nào chưa được tạo tháng này?' },
      { label: 'Tổng tiền chưa thu và quá hạn', message: 'Tổng tiền chưa thu và quá hạn là bao nhiêu?' },
    ],
  },
  {
    id: 'actions',
    label: 'Thao tác',
    icon: Wrench,
    color: 'text-violet-600',
    items: [
      { label: 'Đánh dấu đã thu hóa đơn',      message: 'Đánh dấu đã thanh toán hóa đơn #',    fillOnly: true },
      { label: 'Chấm dứt hợp đồng',             message: 'Chấm dứt hợp đồng #',                 fillOnly: true },
      {
        label: 'Sửa hợp đồng', message: '', fillOnly: true,
        subItems: [
          { label: 'Gia hạn thêm tháng',  message: 'Sửa hợp đồng # thêm 6 tháng', fillOnly: true },
          { label: 'Đổi giá thuê',        message: 'Sửa hợp đồng # tiền thuê ',    fillOnly: true },
          { label: 'Đổi số người thuê',   message: 'Sửa hợp đồng # số người ',     fillOnly: true },
        ],
      },
      { label: 'Đặt phòng vào bảo trì',         message: 'Đặt phòng # vào bảo trì',             fillOnly: true },
      { label: 'Mở lại phòng sau bảo trì',      message: 'Phòng # sửa xong',                    fillOnly: true },
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      content: 'Xin chào! Tôi là trợ lý AI của SmartRent. Tôi có thể giúp bạn tra cứu thông tin, phân tích doanh thu, phát hiện vấn đề và đưa ra lời khuyên quản lý phòng trọ. Hãy hỏi tôi bất cứ điều gì!',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [activeCategory, setActiveCategory] = useState('revenue');
  const [expandedGroup, setExpandedGroup]   = useState<string | null>(null);
  const bottomRef                           = useRef<HTMLDivElement>(null);
  const inputRef                            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const history: ChatHistoryItem[] = messages
      .filter(m => m.id !== 0 && m.content !== '...')
      .slice(-10)
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
    if (item.fillOnly) {
      setInput(item.message);
      setTimeout(() => {
        const el = inputRef.current;
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 0);
    } else {
      sendMessage(item.message);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleClear = () => {
    setMessages([{
      id: 0,
      role: 'assistant',
      content: 'Cuộc trò chuyện đã được xóa. Tôi có thể giúp gì cho bạn?',
      timestamp: new Date(),
    }]);
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
                placeholder="Hỏi theo tên, hoặc ra lệnh trực tiếp với #ID..."
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
                <div key={i}>
                  {item.subItems ? (
                    <>
                      <button
                        onClick={() => setExpandedGroup(expandedGroup === item.label ? null : item.label)}
                        disabled={loading}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all disabled:opacity-50 flex items-center gap-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-100 hover:border-violet-200"
                      >
                        <PenLine className="w-3 h-3 flex-shrink-0 opacity-60" />
                        <span className="leading-snug flex-1">{item.label}</span>
                        <ChevronDown className={`w-3 h-3 flex-shrink-0 opacity-60 transition-transform ${expandedGroup === item.label ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedGroup === item.label && (
                        <div className="ml-4 mt-1 space-y-1">
                          {item.subItems.map((sub, j) => (
                            <button
                              key={j}
                              onClick={() => handleSuggestionClick(sub)}
                              disabled={loading}
                              className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all disabled:opacity-50 flex items-start gap-2 bg-violet-50/70 hover:bg-violet-100 text-violet-600 border border-violet-100 hover:border-violet-200"
                            >
                              <span className="leading-snug">{sub.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleSuggestionClick(item)}
                      disabled={loading}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all disabled:opacity-50 flex items-start gap-2 group ${
                        item.fillOnly
                          ? 'bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-100 hover:border-violet-200'
                          : 'bg-gray-50 hover:bg-primary-50 text-gray-600 hover:text-primary-800 border border-transparent hover:border-primary-100'
                      }`}
                    >
                      {item.fillOnly && (
                        <PenLine className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-60" />
                      )}
                      <span className="leading-snug">{item.label}</span>
                    </button>
                  )}
                </div>
              ))}
              {activeCat.id === 'actions' && (
                <p className="text-xs text-gray-400 px-1 pt-1 leading-snug">
                  Điền mẫu + #ID, hoặc hỏi theo tên trước rồi ra lệnh
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
