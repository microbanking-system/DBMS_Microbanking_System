import React, { useState, useEffect, useRef } from 'react';
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

   // Ref for the report content
  const reportContentRef = useRef<HTMLDivElement>(null);

  const loadAgentTransactions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/reports/agent-transactions', {
        headers: { Authorization: `Bearer ${token}` },
        params: dateRange
      });
      setAgentTransactions(response.data);
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
      setAccountSummaries(response.data);
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
      setActiveFDs(response.data);
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
      setInterestSummary(response.data);
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
      setCustomerActivity(response.data);
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
    const printContent = reportContentRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups for printing');
      return;
    }

    const reportTitle = getReportTitle();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #000;
            }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .print-header h1 {
              margin: 0 0 10px 0;
              font-size: 24px;
              color: #000;
            }
            .print-info {
              font-size: 14px;
              color: #666;
            }
            .print-summary {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
              margin: 20px 0;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 5px;
            }
            .print-summary-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px;
              background: white;
              border-radius: 5px;
              border-left: 4px solid #007bff;
            }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-top: 20px;
            }
            .print-table th {
              background: #f8f9fa;
              color: #000;
              font-weight: bold;
              padding: 10px;
              border: 1px solid #ddd;
              text-align: left;
            }
            .print-table td {
              padding: 8px;
              border: 1px solid #ddd;
            }
            .print-table tr:nth-child(even) {
              background: #f8f9fa;
            }
            .text-success { color: #28a745; font-weight: bold; }
            .text-danger { color: #dc3545; font-weight: bold; }
            .badge {
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: bold;
            }
            .badge-success { background: #d4edda; color: #155724; }
            .badge-secondary { background: #e2e3e5; color: #383d41; }
            @media print {
              body { margin: 0; }
              .print-header { margin-bottom: 15px; }
              .print-table { font-size: 10px; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${reportTitle}</h1>
            <div class="print-info">
              Date Range: ${new Date(dateRange.startDate).toLocaleDateString()} to ${new Date(dateRange.endDate).toLocaleDateString()} | 
              Generated on: ${new Date().toLocaleDateString()}
            </div>
          </div>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      // Don't close immediately to allow user to see print dialog
      setTimeout(() => {
        printWindow.close();
      }, 500);
    }, 250);
  };

  const getReportTitle = () => {
    switch (activeReport) {
      case 'agent-transactions': return 'Agent-wise Transaction Summary Report';
      case 'account-summaries': return 'Account-wise Transaction Summary Report';
      case 'active-fds': return 'Active Fixed Deposits Report';
      case 'interest-summary': return 'Monthly Interest Distribution Summary Report';
      case 'customer-activity': return 'Customer Activity Report';
      default: return 'Management Report';
    }
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

  
    const getTotal = (data: any[], field: string) => {
        return data.reduce((sum, item) => {
            const value = item[field];
            // Convert to number, handling different possible formats
            if (typeof value === 'string') {
            // Remove "LKR " prefix and any commas, then parse as float
            const cleanValue = value.replace(/LKR\s?|,/g, '');
            return sum + parseFloat(cleanValue) || 0;
            }
            return sum + (parseFloat(value) || 0);
        }, 0);
    };

    // helper function to format numbers properly:
    const formatCurrency = (value: number) => {
        return `LKR ${value.toLocaleString('en-US', {
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

      {/* Printable content - without export buttons */}
      <div className="report-content" ref={reportContentRef}>
        {loading ? (
          <div className="loading">Loading report data...</div>
        ) : (
          <>
            {/* Agent Transactions Report */}
            {activeReport === 'agent-transactions' && (
              <div className="report-card">
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
                    <span>Net Balance Flow:</span>
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

      {/* Export buttons - outside the printable content */}
      <div className="export-actions">
        {activeReport === 'agent-transactions' && agentTransactions.length > 0 && (
          <button 
            onClick={() => exportToCSV(agentTransactions, 'agent_transactions')}
            className="btn btn-secondary btn-sm"
          >
            📥 Export CSV
          </button>
        )}
        {activeReport === 'account-summaries' && accountSummaries.length > 0 && (
          <button 
            onClick={() => exportToCSV(accountSummaries, 'account_summaries')}
            className="btn btn-secondary btn-sm"
          >
            📥 Export CSV
          </button>
        )}
        {activeReport === 'active-fds' && activeFDs.length > 0 && (
          <button 
            onClick={() => exportToCSV(activeFDs, 'active_fds')}
            className="btn btn-secondary btn-sm"
          >
            📥 Export CSV
          </button>
        )}
        {activeReport === 'interest-summary' && interestSummary.length > 0 && (
          <button 
            onClick={() => exportToCSV(interestSummary, 'interest_summary')}
            className="btn btn-secondary btn-sm"
          >
            📥 Export CSV
          </button>
        )}
        {activeReport === 'customer-activity' && customerActivity.length > 0 && (
          <button 
            onClick={() => exportToCSV(customerActivity, 'customer_activity')}
            className="btn btn-secondary btn-sm"
          >
            📥 Export CSV
          </button>
        )}
      </div>
    </div>
  );
};

export default Reports;