import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import DashboardPage from '../../pages/DashboardPage';
import PropertyPage from '../../pages/PropertyPage.tsx';
import RoomPage from '../../pages/RoomPage.tsx';
import TenantPage from '../../pages/TenantPage.tsx';
import ContractPage from '../../pages/ContractPage.tsx';
import InvoicePage from '../../pages/InvoicePage.tsx';
import AiChatPage from '../../pages/AiChatPage.tsx';
import ProfilePage from '../../pages/ProfilePage.tsx';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/"            element={<DashboardPage />} />
          <Route path="/properties"  element={<PropertyPage />} />
          <Route path="/rooms"       element={<RoomPage />} />
          <Route path="/tenants"     element={<TenantPage />} />
          <Route path="/contracts"   element={<ContractPage />} />
          <Route path="/invoices"    element={<InvoicePage />} />
          <Route path="/ai"          element={<AiChatPage />} />
          <Route path="/profile"     element={<ProfilePage />} />
        </Routes>
      </main>
    </div>
  );
}
