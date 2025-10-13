import React, { useEffect } from 'react'; // Add useEffect import
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import ManagerDashboard from './ManagerDashboard';
import AgentDashboard from './AgentDashboard';

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
        <div className="brand-section">
          <h1>✦ B-Trust Dashboard</h1>
        </div>
        <div className="user-info">
          <div className="user-details">
            <span className="user-welcome">Welcome, <strong>{user.first_name}</strong>
            <span className="user-role">{user.role}</span></span>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm logout-btn">
            <span>Logout</span>
            <span className="logout-icon">→</span>
          </button>
        </div>
      </header>
      
      <main className="dashboard-content">
        {user.role === 'Admin' && <AdminDashboard />}
        {user.role === 'Manager' && <ManagerDashboard />}
        {user.role === 'Agent' && <AgentDashboard />}
        
        {!['Admin', 'Manager', 'Agent'].includes(user.role) && (
          <div className="no-access-card">
            <div className="no-access-icon">🔒</div>
            <h3>Access Restricted</h3>
            <p>No dashboard available for your role: {user.role}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;