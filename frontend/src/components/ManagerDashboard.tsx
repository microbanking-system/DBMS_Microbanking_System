import React, { useState, useEffect } from 'react';
import TeamManagement from './TeamManagement';
import TransactionReports from './TransactionReports';
import CustomerAccounts from './CustomerAccounts';
import ManagerCustomerSearch from './ManagerCustomerSearch';

const ManagerDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>(() => {
    const saved = localStorage.getItem('managerDashboard.activeSection');
    return saved || 'overview';
  });

  useEffect(() => {
    localStorage.setItem('managerDashboard.activeSection', activeSection);
  }, [activeSection]);

  return (
    <div className="manager-dashboard">
      
      
      <nav className="admin-nav manager-nav">
        <ul>
          <li>
            <button 
              className={activeSection === 'overview' ? 'active' : ''}
              onClick={() => setActiveSection('overview')}
            >
              Overview
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'team' ? 'active' : ''}
              onClick={() => setActiveSection('team')}
            >
              Team Management
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'transactions' ? 'active' : ''}
              onClick={() => setActiveSection('transactions')}
            >
              Transaction Summary
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'customers' ? 'active' : ''}
              onClick={() => setActiveSection('customers')}
            >
              Customer Accounts
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'customer-search' ? 'active' : ''}
              onClick={() => setActiveSection('customer-search')}
            >
              Customer Details
            </button>
          </li>
        </ul>
      </nav>

      <div className="admin-content manager-content">
        {activeSection === 'overview' && (
          <div className="dashboard-overview">
            <div className="dashboard-cards">
              <div className="card">
                <h3>Team Management</h3>
                <p>Manage your agents and view their performance</p>
                <button onClick={() => setActiveSection('team')}>Manage Team</button>
              </div>
              <div className="card">
                <h3>Transaction Reports</h3>
                <p>View branch transactions and agent-wise reports</p>
                <button onClick={() => setActiveSection('transactions')}>View Transactions</button>
              </div>
              <div className="card">
                <h3>Customer Accounts</h3>
                <p>Manage customer accounts in your branch</p>
                <button onClick={() => setActiveSection('customers')}>Manage Accounts</button>
              </div>
              <div className="card">
                <h3>Search Customers</h3>
                <p>Find customers by name or NIC in your branch</p>
                <button onClick={() => setActiveSection('customer-search')}>Search</button>
              </div>
              
            </div>
          </div>
        )}
        {activeSection === 'team' && <TeamManagement />}
        {activeSection === 'transactions' && <TransactionReports />}
        {activeSection === 'customers' && <CustomerAccounts />}
        {activeSection === 'customer-search' && <ManagerCustomerSearch />}
      </div>
    </div>
  );
};

export default ManagerDashboard;