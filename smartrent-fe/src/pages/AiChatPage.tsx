import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Trash2, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../api/aiApi';
import PageHeader from '../components/ui/PageHeader';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Câu hỏi gợi ý
const SUGGESTIONS = [
  'Phòng nào chưa thanh toán tiền phòng?',
  'Hiện có bao nhiêu phòng còn trống?',
  'Hợp đồng nào sắp hết hạn trong 30 ngày?',
  'Tổng tiền chưa thu là bao nhiêu?',
  'Cho tôi xem tổng quan khu trọ hiện tại',
  'Khách nào đang thuê phòng đắt nhất?',
];

export default function AiChatPage() {
  const [messages, setMessages]   = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      content: 'Xin chào! Tôi là trợ lý AI của SmartRent. Tôi có thể giúp bạn tra cứu thông tin về phòng trọ, hóa đơn, hợp đồng và khách thuê. Hãy hỏi tôi bất cứ điều gì!',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  // Auto scroll xuống tin nhắn mới nhất
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

    // Thêm tin nhắn loading
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

      // Thay loading bằng câu trả lời thật
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

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'assistant'
                    ? 'bg-primary-100'
                    : 'bg-gray-100'
                }`}>
                  {msg.role === 'assistant'
                    ? <Bot className="w-4 h-4 text-primary-700" />
                    : <User className="w-4 h-4 text-gray-500" />
                  }
                </div>

                {/* Bubble */}
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
                      // Render xuống dòng
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
                placeholder="Nhập câu hỏi... VD: Phòng nào chưa thanh toán?"
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
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700">Gợi ý câu hỏi</span>
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-primary-50 hover:text-primary-800 px-3 py-2.5 rounded-xl transition disabled:opacity-50 leading-relaxed"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 mt-3">
            <div className="text-xs font-medium text-blue-800 mb-2">Mẹo sử dụng</div>
            <ul className="text-xs text-blue-700 space-y-1.5">
              <li>• Hỏi về số liệu cụ thể</li>
              <li>• Hỏi về tình trạng phòng</li>
              <li>• Tra cứu hóa đơn nợ</li>
              <li>• Kiểm tra hợp đồng</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}