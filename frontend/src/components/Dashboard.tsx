import React, { useEffect } from 'react'; // Add useEffect import
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';
import AgentDashboard from './AgentDashboard';
import Footer from './Footer';

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
    navigate('/');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Microbanking System Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {user.first_name} ({user.role})</span>
          <span className="username">@{user.username}</span>
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        </div>
      </header>
      
      <main className="dashboard-content">
        {user.role === 'Admin' && <AdminDashboard />}
        {user.role === 'Manager' && <ManagerDashboard />}
        {user.role === 'Agent' && <AgentDashboard />}
        
        {!['Admin', 'Manager', 'Agent'].includes(user.role) && (
          <div>No dashboard available for your role: {user.role}</div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;