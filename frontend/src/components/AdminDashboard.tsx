import React, { useState, useEffect } from 'react';
import UserManagement from './UserManagement';
import BranchManagement from './BranchManagement';
import FDInterestManagement from './FDInterestManagement';
import SavingsInterestManagement from './SavingsInterestManagement';
import Reports from './Reports';


const AdminDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>(() => {
    const saved = localStorage.getItem('adminDashboard.activeSection');
    return saved || 'users';
  });

  useEffect(() => {
    localStorage.setItem('adminDashboard.activeSection', activeSection);
  }, [activeSection]);

  return (
    <div className="admin-dashboard">
      {/* <h2>Admin Dashboard</h2> */}
      
      <nav className="admin-nav">
        <ul>
          
          <li>
            <button 
              className={activeSection === 'users' ? 'active' : ''}
              onClick={() => setActiveSection('users')}
            >
              User Management
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'branches' ? 'active' : ''}
              onClick={() => setActiveSection('branches')}
            >
              Branch Management
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'fd-interest' ? 'active' : ''}
              onClick={() => setActiveSection('fd-interest')}
            >
              FD Interest
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'savings-interest' ? 'active' : ''}
              onClick={() => setActiveSection('savings-interest')}
            >
              Savings Interest
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'reports' ? 'active' : ''}
              onClick={() => setActiveSection('reports')}
            >
              Reports
            </button>
          </li>
        </ul>
      </nav>

      <div className="admin-content">
        {/* {activeSection === 'home' && <DashboardHome />} */}
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