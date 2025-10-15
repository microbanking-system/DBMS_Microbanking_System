import React, { useState } from 'react';
import CustomerRegistration from './CustomerRegistration';
import AccountCreation from './AccountCreation';
import FixedDepositCreation from './FixedDepositCreation';
import AccountDetailsView from './AccountDetailsView';
import TransactionProcessing from './TransactionProcessing';
import AgentPerformance from './AgentPerformance';

const AgentDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState('performance');

  return (
    <div className="agent-dashboard">
      {/* <h2>Agent Dashboard</h2> */}
      
      <nav className="admin-nav agent-nav">
        <ul>
          <li>
            <button 
              className={activeSection === 'performance' ? 'active' : ''}
              onClick={() => setActiveSection('performance')}
            >
              My Performance
            </button>
          </li>
          
          <li>
            <button 
              className={activeSection === 'register' ? 'active' : ''}
              onClick={() => setActiveSection('register')}
            >
              Register Customer
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'account' ? 'active' : ''}
              onClick={() => setActiveSection('account')}
            >
              Savings Account
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'fixed-deposit' ? 'active' : ''}
              onClick={() => setActiveSection('fixed-deposit')}
            >
              Fixed Deposit
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'view-accounts' ? 'active' : ''}
              onClick={() => setActiveSection('view-accounts')}
            >
              View Account Details
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'transactions' ? 'active' : ''}
              onClick={() => setActiveSection('transactions')}
            >
              Process Transaction
            </button>
          </li>
          
          
        </ul>
      </nav>

      <div className="admin-content agent-content">
        {activeSection === 'register' && <CustomerRegistration />}
        {activeSection === 'account' && <AccountCreation />}
        {activeSection === 'fixed-deposit' && <FixedDepositCreation />}
        {activeSection === 'view-accounts' && <AccountDetailsView />}
        {activeSection === 'transactions' && <TransactionProcessing />}
        {activeSection === 'performance' && <AgentPerformance />}
      </div>
    </div>
  );
};

export default AgentDashboard;