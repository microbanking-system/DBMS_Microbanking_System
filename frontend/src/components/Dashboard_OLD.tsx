import React, { useEffect, useState } from 'react'; // Add useEffect and useState import
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';
import AgentDashboard from './AgentDashboard';
import Footer from './Footer';
import bankLogo from '../assets/imgs/B_Trust_logo_white.png';

interface DashboardProps {
  onLogout: () => void;
}

interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('dashboard.sidebarCollapsed');
    return saved === 'true';
  });
  
  const userData = localStorage.getItem('user');
  const user: User = userData ? JSON.parse(userData) : { 
    id: '', 
    username: '', 
    first_name: '', 
    last_name: '', 
    role: '' 
  };

  // Add token expiration check
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        handleLogout();
      }
    };
    
    // Check token on component mount
    checkToken();
    
    // Optional: Set up periodic checks (every 5 minutes)
    const interval = setInterval(checkToken, 5 * 60 * 1000);
    
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard.sidebarCollapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
    navigate('/');
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="dashboard-layout">
      {/* Collapsible Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <img src={bankLogo} alt='Bank Trust Logo' className="sidebar-logo"/>
          {!sidebarCollapsed && <h2>B-Trust Bank</h2>}
        </div>

        {/* Toggle Button */}
        <button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarCollapsed ? (
              <path d="M3 12h18M3 6h18M3 18h18" />
            ) : (
              <path d="M21 12H3M21 6H3M21 18H3" />
            )}
          </svg>
        </button>

        {/* Sidebar Navigation - Only render navigation part */}
        <div className="sidebar-content">
          {user.role === 'Admin' && <AdminDashboard sidebarCollapsed={sidebarCollapsed} />}
          {user.role === 'Manager' && <ManagerDashboard sidebarCollapsed={sidebarCollapsed} />}
          {user.role === 'Agent' && <AgentDashboard sidebarCollapsed={sidebarCollapsed} />}
        </div>

        {/* User Info at Bottom */}
        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            {!sidebarCollapsed && (
              <div className="user-details">
                <span className="user-name">{user.first_name} {user.last_name}</span>
                <span className="user-role">{user.role}</span>
              </div>
            )}
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout} title="Logout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* Main content is now rendered here by the child dashboards */}
        {!['Admin', 'Manager', 'Agent'].includes(user.role) && (
          <div className="no-dashboard-message">
            <p>No dashboard available for your role: {user.role}</p>
          </div>
        )}
        <Footer />
      </main>
    </div>
  );
};

export default Dashboard;