import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Trash2, Lightbulb, TrendingUp, BarChart2, Bell, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../api/aiApi';
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
  items: SuggestionItem[];
}

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  {
    id: 'revenue',
    label: 'Doanh thu',
    icon: TrendingUp,
    items: [
      { label: 'Tháng này vs tháng trước',   message: 'So sánh doanh thu tháng này với tháng trước' },
      { label: 'Doanh thu theo quý',          message: 'Doanh thu theo quý năm nay như thế nào?' },
      { label: 'Tổng quan tài chính',         message: 'Phân tích tình hình tổng thể và cho tôi lời khuyên' },
    ],
  },
  {
    id: 'analysis',
    label: 'Phân tích',
    icon: BarChart2,
    items: [
      { label: 'Phòng trống lâu nhất',        message: 'Phòng nào đang trống quá lâu? Tôi đang bị mất bao nhiêu tiền?' },
      { label: 'Khách hay trễ hạn',           message: 'Khách thuê nào hay trễ hạn thanh toán?' },
      { label: 'Khu trọ hiệu quả nhất',       message: 'Khu trọ nào đang hoạt động hiệu quả nhất?' },
    ],
  },
  {
    id: 'alerts',
    label: 'Cảnh báo',
    icon: Bell,
    items: [
      { label: 'HĐ sắp hết hạn',             message: 'Hợp đồng nào sắp hết hạn, tôi cần làm gì?' },
      { label: 'Hóa đơn chưa tạo',           message: 'Hóa đơn nào chưa được tạo tháng này?' },
      { label: 'Tổng tiền chưa thu',          message: 'Tổng tiền chưa thu và quá hạn là bao nhiêu?' },
    ],
  },
  {
    id: 'actions',
    label: 'Hành động',
    icon: Wrench,
    items: [
      { label: 'Đánh dấu đã thu',            message: 'Đánh dấu đã thanh toán hóa đơn' },
      { label: 'Chấm dứt hợp đồng',          message: 'Chấm dứt hợp đồng' },
    ],
  },
];

export default function AiChatPage() {
  const [messages, setMessages]             = useState<Message[]>([
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
  const bottomRef                           = useRef<HTMLDivElement>(null);
  const inputRef                            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

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
      const res = await aiApi.chat(text.trim());
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

  const activeCategoryData = SUGGESTION_CATEGORIES.find(c => c.id === activeCategory)!;

  return (
    <div className="p-6 h-screen flex flex-col">
      <PageHeader
        icon={Bot}
        title="AI Assistant"
        subtitle="Hỏi về phòng trọ, hóa đơn, hợp đồng..."
        action={
          <button onClick={handleClear}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
            <Trash2 className="w-3.5 h-3.5" />
            Xóa hội thoại
          </button>
        }
      />

      <div className="flex gap-4 flex-1 min-h-0">

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'assistant' ? 'bg-primary-100' : 'bg-gray-100'
                }`}>
                  {msg.role === 'assistant'
                    ? <Bot className="w-4 h-4 text-primary-700" />
                    : <User className="w-4 h-4 text-gray-500" />
                  }
                </div>

                <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'assistant'
                      ? 'bg-gray-50 text-gray-800 rounded-tl-sm'
                      : 'bg-primary-800 text-white rounded-tr-sm'
                  }`}>
                    {msg.content === '...' ? (
                      <div className="flex gap-1 items-center py-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      msg.content.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
                      ))
                    )}
                  </div>
                  <span className="text-xs text-gray-400 px-1">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Nhập câu hỏi..."
                disabled={loading}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-10 h-10 flex items-center justify-center bg-primary-800 text-white rounded-xl hover:bg-primary-900 disabled:opacity-40 transition flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Suggestions sidebar */}
        <div className="w-52 flex-shrink-0 flex flex-col gap-3">

          {/* Category tabs + items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700">Gợi ý</span>
            </div>

            {/* 2×2 category tab grid */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {SUGGESTION_CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-primary-800 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Items for active category */}
            <div className="space-y-1.5">
              {activeCategoryData.items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(item.message)}
                  disabled={loading}
                  className="w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-primary-50 hover:text-primary-800 px-3 py-2 rounded-xl transition disabled:opacity-50 leading-snug"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-3.5">
            <div className="text-xs font-medium text-blue-800 mb-2">Mẹo sử dụng</div>
            <ul className="text-xs text-blue-700 space-y-1.5">
              <li>• Hỏi so sánh theo tháng/quý</li>
              <li>• Hỏi lý do và giải pháp</li>
              <li>• Nhờ tư vấn cụ thể</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
