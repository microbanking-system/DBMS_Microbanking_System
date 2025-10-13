import React, { useState } from 'react';
import DashboardHome from './DashboardHome';
import UserManagement from './UserManagement';
import BranchManagement from './BranchManagement';
import FDInterestManagement from './FDInterestManagement';
import SavingsInterestManagement from './SavingsInterestManagement';
import Reports from './Reports';


const AdminDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState('home');

  return (
    <div className="admin-dashboard">
      {/* <h2>Admin Dashboard</h2> */}
      
      <div className="admin-nav">
        <button 
          className={activeSection === 'home' ? 'active' : ''}
          onClick={() => setActiveSection('home')}
        >
          🏠 Home
        </button>
        <button 
          className={activeSection === 'users' ? 'active' : ''}
          onClick={() => setActiveSection('users')}
        >
          👥 User Management
        </button>
        <button 
          className={activeSection === 'branches' ? 'active' : ''}
          onClick={() => setActiveSection('branches')}
        >
          🏦 Branch Management
        </button>
        <button 
          className={activeSection === 'fd-interest' ? 'active' : ''}
          onClick={() => setActiveSection('fd-interest')}
        >
          💰 FD Interest
        </button>
        <button 
          className={activeSection === 'savings-interest' ? 'active' : ''}
          onClick={() => setActiveSection('savings-interest')}
        >
          💵 Savings Interest
        </button>
        <button 
          className={activeSection === 'reports' ? 'active' : ''}
          onClick={() => setActiveSection('reports')}
        >
          📊 Reports
        </button>
      </div>

      <div className="admin-content">
        {activeSection === 'home' && <DashboardHome />}
        {activeSection === 'users' && <UserManagement />}
        {activeSection === 'branches' && <BranchManagement />}
        {activeSection === 'fd-interest' && <FDInterestManagement />}
        {activeSection === 'savings-interest' && <SavingsInterestManagement />}
        {activeSection === 'reports' && (
          <div className="reports-section">
            <h4>Reports</h4>
            <p>View system reports and analytics.</p>
            {activeSection === 'reports' && <Reports />}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;