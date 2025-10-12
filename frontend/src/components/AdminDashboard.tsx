import React, { useState } from 'react';
import UserManagement from './UserManagement';
import BranchManagement from './BranchManagement';
import FDInterestManagement from './FDInterestManagement';
import SavingsInterestManagement from './SavingsInterestManagement';

const AdminDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState('users');

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      
      <div className="admin-nav">
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
        {activeSection === 'users' && <UserManagement />}
        {activeSection === 'branches' && <BranchManagement />}
        {activeSection === 'fd-interest' && <FDInterestManagement />}
        {activeSection === 'savings-interest' && <SavingsInterestManagement />}
        {activeSection === 'reports' && (
          <div className="reports-section">
            <h4>Reports</h4>
            <p>View system reports and analytics.</p>
            {/* Existing reports content */}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;