import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface AgentTransactionReport {
  employee_id: string;
  employee_name: string;
  total_transactions: number;
  total_deposits: number;
  total_withdrawals: number;
  net_value: number;
}

interface AccountTransactionSummary {
  account_id: string;
  customer_names: string;
  total_deposits: number;
  total_withdrawals: number;
  current_balance: number;
  transaction_count: number;
}

interface ActiveFDReport {
  fd_id: string;
  account_id: string;
  customer_names: string;
  fd_balance: number;
  interest_rate: number;
  open_date: string;
  maturity_date: string;
  next_interest_date: string;
  auto_renewal_status: string;
}

interface MonthlyInterestSummary {
  plan_type: string;
  account_type: string;
  total_interest: number;
  account_count: number;
  average_interest: number;
}

interface CustomerActivityReport {
  customer_id: string;
  customer_name: string;
  total_deposits: number;
  total_withdrawals: number;
  net_balance: number;
  account_count: number;
  last_activity: string;
}

const Reports: React.FC = () => {
  const [activeReport, setActiveReport] = useState<string>('agent-transactions');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);

  // Report data states
  const [agentTransactions, setAgentTransactions] = useState<AgentTransactionReport[]>([]);
  const [accountSummaries, setAccountSummaries] = useState<AccountTransactionSummary[]>([]);
  const [activeFDs, setActiveFDs] = useState<ActiveFDReport[]>([]);
  const [interestSummary, setInterestSummary] = useState<MonthlyInterestSummary[]>([]);
  const [customerActivity, setCustomerActivity] = useState<CustomerActivityReport[]>([]);

  const loadAgentTransactions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/reports/agent-transactions', {
        headers: { Authorization: `Bearer ${token}` },
        params: dateRange
      });
      // Normalize response to array to avoid runtime errors when backend returns an object or null
      setAgentTransactions(Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []));
    } catch (error) {
      console.error('Failed to load agent transactions report');
    } finally {
      setLoading(false);
    }
  };

  const loadAccountSummaries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/reports/account-summaries', {
        headers: { Authorization: `Bearer ${token}` },
        params: dateRange
      });
      setAccountSummaries(Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []));
    } catch (error) {
      console.error('Failed to load account summaries report');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveFDs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/reports/active-fds', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveFDs(Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []));
    } catch (error) {
      console.error('Failed to load active FDs report');
    } finally {
      setLoading(false);
    }
  };

  const loadInterestSummary = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/reports/interest-summary', {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: new Date().getMonth() + 1, year: new Date().getFullYear() }
      });
      setInterestSummary(Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []));
    } catch (error) {
      console.error('Failed to load interest summary report');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerActivity = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/reports/customer-activity', {
        headers: { Authorization: `Bearer ${token}` },
        params: dateRange
      });
      setCustomerActivity(Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []));
    } catch (error) {
      console.error('Failed to load customer activity report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    switch (activeReport) {
      case 'agent-transactions':
        loadAgentTransactions();
        break;
      case 'account-summaries':
        loadAccountSummaries();
        break;
      case 'active-fds':
        loadActiveFDs();
        break;
      case 'interest-summary':
        loadInterestSummary();
        break;
      case 'customer-activity':
        loadCustomerActivity();
        break;
    }
  }, [activeReport, dateRange]);

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  
  const getTotal = (data: any, field: string) => {
    // Defensive: ensure we have an array; if not, return 0 to avoid runtime crashes
    if (!Array.isArray(data)) {
      // sometimes the API may return an object or null; log in dev to help debugging
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('getTotal expected an array but received:', data);
      }
      return 0;
    }

    return data.reduce((sum: number, item: any) => {
      if (!item) return sum;

      const value = item[field];
      if (value == null) return sum;

      let num = 0;

      if (typeof value === 'number') {
        num = value;
      } else if (typeof value === 'string') {
        // Remove "LKR " prefix and any commas, then parse as float
        const cleanValue = value.replace(/LKR\s?|,/g, '').trim();
        const parsed = parseFloat(cleanValue);
        num = Number.isNaN(parsed) ? 0 : parsed;
      } else {
        const parsed = parseFloat(String(value));
        num = Number.isNaN(parsed) ? 0 : parsed;
      }

      return sum + num;
    }, 0 as number);
  };

  // helper function to format numbers properly:
  const formatCurrency = (value: any) => {
    // Defensive: handle undefined/null and non-numeric inputs
    if (value == null) {
      return 'LKR 0.00';
    }

    let num: number;
    if (typeof value === 'number') {
      num = value;
    } else if (typeof value === 'string') {
      const clean = value.replace(/LKR\s?|,/g, '').trim();
      const parsed = parseFloat(clean);
      num = Number.isNaN(parsed) ? 0 : parsed;
    } else {
      const parsed = parseFloat(String(value));
      num = Number.isNaN(parsed) ? 0 : parsed;
    }

    return `LKR ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };
    
  return (
    <div className="reports-section">
      <div className="reports-header">
        <h4>Management Reports</h4>
        <div className="report-controls">
          <div className="date-range">
            <label>Date Range:</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div className="report-actions">
            <button onClick={handlePrint} className="btn btn-primary">
              🖨️ Print Report
            </button>
          </div>
        </div>
      </div>

      <div className="report-tabs">
        <button 
          className={activeReport === 'agent-transactions' ? 'active' : ''}
          onClick={() => setActiveReport('agent-transactions')}
        >
          Agent Transactions
        </button>
        <button 
          className={activeReport === 'account-summaries' ? 'active' : ''}
          onClick={() => setActiveReport('account-summaries')}
        >
          Account Summaries
        </button>
        <button 
          className={activeReport === 'active-fds' ? 'active' : ''}
          onClick={() => setActiveReport('active-fds')}
        >
          Active FDs
        </button>
        <button 
          className={activeReport === 'interest-summary' ? 'active' : ''}
          onClick={() => setActiveReport('interest-summary')}
        >
          Interest Summary
        </button>
        <button 
          className={activeReport === 'customer-activity' ? 'active' : ''}
          onClick={() => setActiveReport('customer-activity')}
        >
          Customer Activity
        </button>
      </div>

      <div className="report-content">
        {loading ? (
          <div className="loading">Loading report data...</div>
        ) : (
          <>
            {/* Agent Transactions Report */}
            {activeReport === 'agent-transactions' && (
              <div className="report-card">
                <div className="report-header">
                  <h5>Agent-wise Transaction Summary</h5>
                  <button 
                    onClick={() => exportToCSV(agentTransactions, 'agent_transactions')}
                    className="btn btn-secondary btn-sm"
                  >
                    📥 Export CSV
                  </button>
                </div>
                <div className="report-summary">
                    <div className="summary-item">
                        <span>Total Agents:</span>
                        <strong>{agentTransactions.length}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Total Transactions:</span>
                        <strong>{getTotal(agentTransactions, 'total_transactions')}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Total Deposit Value:</span>
                        <strong>{formatCurrency(getTotal(agentTransactions, 'total_deposits'))}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Total Withdrawal Value:</span>
                        <strong>{formatCurrency(getTotal(agentTransactions, 'total_withdrawals'))}</strong>
                    </div>
                    </div>
                <div className="table-container">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Agent ID</th>
                        <th>Agent Name</th>
                        <th>Total Transactions</th>
                        <th>Total Deposits</th>
                        <th>Total Withdrawals</th>
                        <th>Net Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentTransactions.map(agent => (
                        <tr key={agent.employee_id}>
                          <td>{agent.employee_id}</td>
                          <td>{agent.employee_name}</td>
                          <td>{agent.total_transactions}</td>
                          <td>{formatCurrency(agent.total_deposits)}</td>
                          <td>{formatCurrency(agent.total_withdrawals)}</td>
                          <td className={agent.net_value >= 0 ? 'text-success' : 'text-danger'}>
                            {formatCurrency(agent.net_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Account Transaction Summary Report */}
            {activeReport === 'account-summaries' && (
              <div className="report-card">
                <div className="report-header">
                  <h5>Account-wise Transaction Summary</h5>
                  <button 
                    onClick={() => exportToCSV(accountSummaries, 'account_summaries')}
                    className="btn btn-secondary btn-sm"
                  >
                    📥 Export CSV
                  </button>
                </div>
                <div className="report-summary">
                    <div className="summary-item">
                        <span>Total Accounts:</span>
                        <strong>{accountSummaries.length}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Total Deposit Value:</span>
                        <strong>{formatCurrency(getTotal(accountSummaries, 'total_deposits'))}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Total Withdrawal Value:</span>
                        <strong>{formatCurrency(getTotal(accountSummaries, 'total_withdrawals'))}</strong>
                    </div>
                    </div>
                <div className="table-container">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Account ID</th>
                        <th>Customer Name(s)</th>
                        <th>Total Transactions</th>
                        <th>Total Deposits</th>
                        <th>Total Withdrawals</th>
                        <th>Current Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountSummaries.map(account => (
                        <tr key={account.account_id}>
                          <td>{account.account_id}</td>
                          <td>{account.customer_names}</td>
                          <td>{account.transaction_count}</td>
                          <td>{formatCurrency(account.total_deposits)}</td>
                          <td>{formatCurrency(account.total_withdrawals)}</td>
                          <td className={account.current_balance >= 0 ? 'text-success' : 'text-danger'}>
                            {formatCurrency(account.current_balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Active FDs Report */}
            {activeReport === 'active-fds' && (
              <div className="report-card">
                <div className="report-header">
                  <h5>Active Fixed Deposits Report</h5>
                  <button 
                    onClick={() => exportToCSV(activeFDs, 'active_fds')}
                    className="btn btn-secondary btn-sm"
                  >
                    📥 Export CSV
                  </button>
                </div>
                <div className="report-summary">
                    <div className="summary-item">
                        <span>Total Active FDs:</span>
                        <strong>{activeFDs.length}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Total FD Value:</span>
                        <strong>{formatCurrency(getTotal(activeFDs, 'fd_balance'))}</strong>
                    </div>
                </div>
                <div className="table-container">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>FD ID</th>
                        <th>Account ID</th>
                        <th>Customer Name(s)</th>
                        <th>FD Balance</th>
                        <th>Interest Rate</th>
                        <th>Open Date</th>
                        <th>Maturity Date</th>
                        <th>Next Interest Date</th>
                        <th>Auto Renewal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeFDs.map(fd => (
                        <tr key={fd.fd_id}>
                          <td>{fd.fd_id}</td>
                          <td>{fd.account_id}</td>
                          <td>{fd.customer_names}</td>
                          <td>{formatCurrency(fd.fd_balance)}</td>
                          <td>{fd.interest_rate}%</td>
                          <td>{new Date(fd.open_date).toLocaleDateString()}</td>
                          <td>{new Date(fd.maturity_date).toLocaleDateString()}</td>
                          <td>{new Date(fd.next_interest_date).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${fd.auto_renewal_status === 'True' ? 'badge-success' : 'badge-secondary'}`}>
                              {fd.auto_renewal_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Interest Summary Report */}
            {activeReport === 'interest-summary' && (
              <div className="report-card">
                <div className="report-header">
                  <h5>Monthly Interest Distribution Summary</h5>
                  <button 
                    onClick={() => exportToCSV(interestSummary, 'interest_summary')}
                    className="btn btn-secondary btn-sm"
                  >
                    📥 Export CSV
                  </button>
                </div>
                <div className="report-summary">
                    <div className="summary-item">
                        <span>Total Interest Distributed:</span>
                        <strong>{formatCurrency(getTotal(interestSummary, 'total_interest'))}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Total Accounts:</span>
                        <strong>{getTotal(interestSummary, 'account_count')}</strong>
                    </div>
                </div>
                <div className="table-container">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Plan Type</th>
                        <th>Account Type</th>
                        <th>Total Interest</th>
                        <th>Account Count</th>
                        <th>Average Interest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interestSummary.map(summary => (
                        <tr key={`${summary.plan_type}-${summary.account_type}`}>
                          <td>{summary.plan_type}</td>
                          <td>{summary.account_type}</td>
                          <td>{formatCurrency(summary.total_interest)}</td>
                          <td>{summary.account_count}</td>
                          <td>{formatCurrency(summary.average_interest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Customer Activity Report */}
            {activeReport === 'customer-activity' && (
              <div className="report-card">
                <div className="report-header">
                  <h5>Customer Activity Report</h5>
                  <button 
                    onClick={() => exportToCSV(customerActivity, 'customer_activity')}
                    className="btn btn-secondary btn-sm"
                  >
                    📥 Export CSV
                  </button>
                </div>
                <div className="report-summary">
                    <div className="summary-item">
                        <span>Total Customers:</span>
                        <strong>{customerActivity.length}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Total Deposits:</span>
                        <strong>{formatCurrency(getTotal(customerActivity, 'total_deposits'))}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Total Withdrawals:</span>
                        <strong>{formatCurrency(getTotal(customerActivity, 'total_withdrawals'))}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Net Balance F low:</span>
                        <strong>{formatCurrency(getTotal(customerActivity, 'net_balance'))}</strong>
                    </div>
                </div>
                <div className="table-container">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Customer ID</th>
                        <th>Customer Name</th>
                        <th>Total Deposits</th>
                        <th>Total Withdrawals</th>
                        <th>Net Balance</th>
                        <th>Accounts</th>
                        <th>Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerActivity.map(customer => (
                        <tr key={customer.customer_id}>
                          <td>{customer.customer_id}</td>
                          <td>{customer.customer_name}</td>
                          <td>{formatCurrency(customer.total_deposits)}</td>
                          <td>{formatCurrency(customer.total_withdrawals)}</td>
                          <td className={customer.net_balance >= 0 ? 'text-success' : 'text-danger'}>
                            {formatCurrency(customer.net_balance)}
                          </td>
                          <td>{customer.account_count}</td>
                          <td>{new Date(customer.last_activity).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>


    </div>
  );
};

export default Reports;