import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, DoorOpen, Users,
  FileText, Receipt, Bot, LogOut, ChevronRight, UserCircle2
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/properties', icon: Building2,       label: 'Khu trọ' },
  { to: '/rooms',      icon: DoorOpen,        label: 'Phòng' },
  { to: '/tenants',    icon: Users,           label: 'Khách thuê' },
  { to: '/contracts',  icon: FileText,        label: 'Hợp đồng' },
  { to: '/invoices',   icon: Receipt,         label: 'Hóa đơn' },
  { to: '/ai',         icon: Bot,             label: 'AI Assistant' },
];

export default function Sidebar() {
  const { username, role, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isProfileActive = location.pathname === '/profile';
  const avatarLetter = username ? username.charAt(0).toUpperCase() : '?';

  const handleLogout = () => {
    logout();
    toast.success('Đã đăng xuất');
    navigate('/login');
  };

  return (
    <aside className="w-56 min-h-screen bg-primary-900 flex flex-col flex-shrink-0">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-primary-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary-800" />
          </div>
          <div>
            <div className="text-white font-medium text-sm">SmartRent</div>
            <div className="text-primary-400 text-xs">Quản lý phòng trọ</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
                isActive
                  ? 'bg-white text-primary-800 font-medium shadow'
                  : 'text-primary-300 hover:bg-primary-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info + Logout */}
      <div className="px-3 py-4 border-t border-primary-800">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className={`w-full flex items-center gap-3 px-3 py-2 mb-2 rounded-xl text-left transition ${
            isProfileActive
              ? 'bg-primary-800 text-white'
              : 'hover:bg-primary-800'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white text-sm font-medium">
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{username}</div>
            <div className={`${isProfileActive ? 'text-primary-200' : 'text-primary-400'} text-xs`}>
              {role}
            </div>
          </div>
          <UserCircle2 className={`w-4 h-4 flex-shrink-0 ${isProfileActive ? 'text-white' : 'text-primary-300'}`} />
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-primary-300 hover:bg-red-500 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
