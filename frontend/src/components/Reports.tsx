import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';

interface AgentTransactionReport {
  employee_id: number;
  employee_name: string;
  total_transactions: number;
  total_deposits: number;
  total_withdrawals: number;
  net_value: number;
}

interface AccountTransactionSummary {
  account_id: number;
  customer_names: string;
  total_deposits: number;
  total_withdrawals: number;
  current_balance: number;
  transaction_count: number;
}

interface ActiveFDReport {
  fd_id: number;
  account_id: number;
  customer_names: string;
  fd_balance: number;
  interest_rate: number;
  open_date: string;
  maturity_date: string;
  next_interest_date: string;
  auto_renewal_status: string | boolean;
}

interface MonthlyInterestSummary {
  plan_type: string;
  account_type: string;
  total_interest: number;
  account_count: number;
  average_interest: number;
}

interface CustomerActivityReport {
  customer_id: number;
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
  const [error, setError] = useState<string | null>(null);

  // Report data states
  const [agentTransactions, setAgentTransactions] = useState<AgentTransactionReport[]>([]);
  const [accountSummaries, setAccountSummaries] = useState<AccountTransactionSummary[]>([]);
  const [activeFDs, setActiveFDs] = useState<ActiveFDReport[]>([]);
  const [interestSummary, setInterestSummary] = useState<MonthlyInterestSummary[]>([]);
  const [customerActivity, setCustomerActivity] = useState<CustomerActivityReport[]>([]);

  // Ref for the report content
  const reportContentRef = useRef<HTMLDivElement>(null);

  // Helper - robust parse to number
  const parseNumber = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const cleaned = value.replace(/LKR\s?|,/gi, '').trim();
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    }
    // Fallback
    const n = Number(value);
    return isNaN(n) ? 0 : n;
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return `LKR ${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Date helpers
  const daysUntil = (dateStr?: string | null): number | null => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const today = new Date();
    // normalize to date only
    const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const diffDays = Math.ceil((t - d) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const isToday = (dateStr?: string | null): boolean => {
    const du = daysUntil(dateStr);
    return du === 0;
  };

  // Generic total getter
  const getTotal = (data: any[], field: string): number => {
    return data.reduce((sum, item) => {
      return sum + parseNumber(item?.[field]);
    }, 0);
  };

  // Loaders memoized
  const loadAgentTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.get('/api/admin/reports/agent-transactions', {
        headers: { Authorization: `Bearer ${token}` },
        params: dateRange,
        timeout: 30000
      });
      
      if (response.data && Array.isArray(response.data)) {
        setAgentTransactions(response.data);
      } else {
        setAgentTransactions([]);
        console.warn('Unexpected response format:', response.data);
      }
    } catch (error) {
      console.error('Failed to load agent transactions report', error);
      setError('Failed to load agent transactions report. Please try again.');
      setAgentTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const loadAccountSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.get('/api/admin/reports/account-summaries', {
        headers: { Authorization: `Bearer ${token}` },
        params: dateRange,
        timeout: 30000
      });
      
      if (response.data && Array.isArray(response.data)) {
        setAccountSummaries(response.data);
      } else {
        setAccountSummaries([]);
        console.warn('Unexpected response format:', response.data);
      }
    } catch (error) {
      console.error('Failed to load account summaries report', error);
      setError('Failed to load account summaries report. Please try again.');
      setAccountSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const loadActiveFDs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.get('/api/admin/reports/active-fds', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      });
      
      if (response.data && Array.isArray(response.data)) {
        setActiveFDs(response.data);
      } else {
        setActiveFDs([]);
        console.warn('Unexpected response format:', response.data);
      }
    } catch (error) {
      console.error('Failed to load active FDs report', error);
      setError('Failed to load active FDs report. Please try again.');
      setActiveFDs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInterestSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.get('/api/admin/reports/interest-summary', {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          month: new Date().getMonth() + 1, 
          year: new Date().getFullYear() 
        },
        timeout: 30000
      });
      
      if (response.data && Array.isArray(response.data)) {
        setInterestSummary(response.data);
      } else {
        setInterestSummary([]);
        console.warn('Unexpected response format:', response.data);
      }
    } catch (error) {
      console.error('Failed to load interest summary report', error);
      setError('Failed to load interest summary report. Please try again.');
      setInterestSummary([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCustomerActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.get('/api/admin/reports/customer-activity', {
        headers: { Authorization: `Bearer ${token}` },
        params: dateRange,
        timeout: 30000
      });
      
      if (response.data && Array.isArray(response.data)) {
        setCustomerActivity(response.data);
      } else {
        setCustomerActivity([]);
        console.warn('Unexpected response format:', response.data);
      }
    } catch (error) {
      console.error('Failed to load customer activity report', error);
      setError('Failed to load customer activity report. Please try again.');
      setCustomerActivity([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

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
      default:
        break;
    }
  }, [activeReport, dateRange, loadAgentTransactions, loadAccountSummaries, loadActiveFDs, loadInterestSummary, loadCustomerActivity]);
 
  const handlePrint = () => {
    const printContent = reportContentRef.current;
    if (!printContent) return;
    
    const logoSrc = `${window.location.origin}/image.ico`;
    const clone = printContent.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print, .export-actions, .report-actions, button, input').forEach(n => n.remove());
    clone.querySelectorAll('.report-summary, .summary-item').forEach(n => n.remove());

    const reportTitle = getReportTitle();

    const buildSummaryHTML = () => {
      switch (activeReport) {
        case 'agent-transactions':
          return `
            <div class="summary-row">
              <div class="summary-box"><div class="label">Total Agents</div><div class="value">${totals.agent.count}</div></div>
              <div class="summary-box"><div class="label">Total Transactions</div><div class="value">${totals.agent.totalTransactions}</div></div>
              <div class="summary-box"><div class="label">Total Deposits</div><div class="value">${formatCurrency(totals.agent.totalDeposits)}</div></div>
              <div class="summary-box"><div class="label">Total Withdrawals</div><div class="value">${formatCurrency(totals.agent.totalWithdrawals)}</div></div>
            </div>
          `;
        case 'account-summaries':
          return `
            <div class="summary-row">
              <div class="summary-box"><div class="label">Total Accounts</div><div class="value">${totals.accounts.count}</div></div>
              <div class="summary-box"><div class="label">Total Deposits</div><div class="value">${formatCurrency(totals.accounts.totalDeposits)}</div></div>
              <div class="summary-box"><div class="label">Total Withdrawals</div><div class="value">${formatCurrency(totals.accounts.totalWithdrawals)}</div></div>
            </div>
          `;
        case 'active-fds':
          return `
            <div class="summary-row">
              <div class="summary-box"><div class="label">Total Active FDs</div><div class="value">${totals.fds.count}</div></div>
              <div class="summary-box"><div class="label">Total FD Value</div><div class="value">${formatCurrency(totals.fds.totalValue)}</div></div>
            </div>
          `;
        case 'interest-summary':
          return `
            <div class="summary-row">
              <div class="summary-box"><div class="label">Total Interest Distributed</div><div class="value">${formatCurrency(totals.interest.totalInterest)}</div></div>
              <div class="summary-box"><div class="label">Total Accounts</div><div class="value">${totals.interest.totalAccounts}</div></div>
            </div>
          `;
        case 'customer-activity':
          return `
            <div class="summary-row">
              <div class="summary-box"><div class="label">Total Customers</div><div class="value">${totals.customers.count}</div></div>
              <div class="summary-box"><div class="label">Total Deposits</div><div class="value">${formatCurrency(totals.customers.totalDeposits)}</div></div>
              <div class="summary-box"><div class="label">Total Withdrawals</div><div class="value">${formatCurrency(totals.customers.totalWithdrawals)}</div></div>
              <div class="summary-box"><div class="label">Net Balance Flow</div><div class="value">${formatCurrency(totals.customers.netFlow)}</div></div>
            </div>
          `;
        default:
          return '';
      }
    };

    const printedHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${reportTitle}</title>
          <style>
            html,body { height:100%; margin:0; padding:0; -webkit-print-color-adjust:exact; color:#111; font-family: "Helvetica Neue", Arial, sans-serif; }
            .print-wrapper { max-width:1100px; margin:0 auto; padding:18px; box-sizing:border-box; color:#111; }
            .print-header { display:flex; align-items:center; gap:16px; border-bottom:2px solid #e2e2e2; padding-bottom:12px; margin-bottom:14px; }
            .logo-img { width:72px; height:72px; object-fit:contain; border-radius:10px; background:#fff; padding:6px; }
            .header-text { flex:1; }
            .header-text h1 { margin:0; font-size:20px; color:#0b3b66; }
            .header-text p { margin:6px 0 0 0; color:#666; font-size:12px; }

            /* Summary */
            .summary-row { display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; margin-bottom:6px; }
            .summary-box { flex:1 1 200px; background:#fff; border:1px solid #e6e6e6; border-radius:6px; padding:10px 12px; box-shadow:0 1px 0 rgba(0,0,0,0.02); }
            .summary-box .label { font-size:12px; color:#666; }
            .summary-box .value { font-size:15px; font-weight:700; margin-top:6px; color:#111; }

            /* Tables */
            table.report-table { width:100%; border-collapse:collapse; margin-top:14px; font-size:12px; table-layout:fixed; }
            table.report-table th, table.report-table td { border:1px solid #e8e8e8; padding:8px 10px; text-align:left; vertical-align:middle; word-wrap:break-word; }
            table.report-table th { background:#f7fbff; color:#0b3b66; font-weight:700; font-size:12px; }
            table.report-table tbody tr:nth-child(even) { background:#fbfcfe; }
            table.report-table tbody tr { page-break-inside:avoid; break-inside:avoid; }

            /* Narrow columns & alignment */
            .col-id { width:12%; }
            .col-name { width:24%; }
            .col-amount { width:16%; text-align:right; }
            .col-count { width:8%; text-align:center; }
            .col-date { width:14%; text-align:center; }

            .text-success { color:#007a3d; font-weight:700; }
            .text-danger { color:#c82333; font-weight:700; }

            /* Footer */
            .page-footer { position:fixed; bottom:12px; left:0; right:0; text-align:center; font-size:11px; color:#666; }
            .page-footer .meta { display:inline-block; background:#fff; padding:6px 10px; border-radius:6px; border:1px solid #eee; }

            @page { size: auto; margin:18mm; }
            @media print {
              body { margin:0; }
              .page-footer { position:fixed; bottom:8px; }
              .print-wrapper { margin:0; padding:0; }
              a { color:inherit; text-decoration:none; }
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            <div class="print-header">
              <img src="${logoSrc}" class="logo-img" alt="logo" />
              <div class="header-text">
                <h1>${reportTitle}</h1>
                <p>Date Range: ${new Date(dateRange.startDate).toLocaleDateString()} — ${new Date(dateRange.endDate).toLocaleDateString()} • Generated: ${new Date().toLocaleString()}</p>
              </div>
            </div>

            ${buildSummaryHTML()}

            <div class="print-body">
              ${clone.innerHTML}
            </div>
          </div>

          <div class="page-footer">
            <span class="meta">Generated on ${new Date().toLocaleString()}</span>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
    if (!printWindow) {
      alert('Please allow popups for printing');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(printedHTML);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 700);
    }, 350);
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
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }
    
    try {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            
            // Handle dates
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                return `"${date.toLocaleDateString()}"`;
              }
            }
            
            // Handle numbers and currency
            const num = parseNumber(value);
            if (num !== 0 && !isNaN(num)) {
              return String(num);
            }
            
            // Handle strings - escape commas and quotes
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            
            return stringValue;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export CSV');
    }
  };

  // Memoized totals for each report to avoid recalculation on each render
  const totals = useMemo(() => ({
    agent: {
      count: agentTransactions.length,
      totalTransactions: getTotal(agentTransactions, 'total_transactions'),
      totalDeposits: getTotal(agentTransactions, 'total_deposits'),
      totalWithdrawals: getTotal(agentTransactions, 'total_withdrawals'),
    },
    accounts: {
      count: accountSummaries.length,
      totalDeposits: getTotal(accountSummaries, 'total_deposits'),
      totalWithdrawals: getTotal(accountSummaries, 'total_withdrawals'),
    },
    fds: {
      count: activeFDs.length,
      totalValue: getTotal(activeFDs, 'fd_balance'),
    },
    interest: {
      totalInterest: getTotal(interestSummary, 'total_interest'),
      totalAccounts: getTotal(interestSummary, 'account_count'),
    },
    customers: {
      count: customerActivity.length,
      totalDeposits: getTotal(customerActivity, 'total_deposits'),
      totalWithdrawals: getTotal(customerActivity, 'total_withdrawals'),
      netFlow: getTotal(customerActivity, 'net_balance'),
    }
  }), [agentTransactions, accountSummaries, activeFDs, interestSummary, customerActivity, getTotal]);

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
            <button onClick={handlePrint} className="btn btn-primary" disabled={loading} aria-disabled={loading}>
              🖨️ Print Report
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ 
          background: '#f8d7da', 
          color: '#721c24', 
          padding: '12px', 
          borderRadius: '6px', 
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}

      <div className="report-tabs">
        <button 
          className={activeReport === 'agent-transactions' ? 'active' : ''}
          onClick={() => setActiveReport('agent-transactions')}
          disabled={loading}
        >
          Agent Transactions
        </button>
        <button 
          className={activeReport === 'account-summaries' ? 'active' : ''}
          onClick={() => setActiveReport('account-summaries')}
          disabled={loading}
        >
          Account Summaries
        </button>
        <button 
          className={activeReport === 'active-fds' ? 'active' : ''}
          onClick={() => setActiveReport('active-fds')}
          disabled={loading}
        >
          Active FDs
        </button>
        <button 
          className={activeReport === 'interest-summary' ? 'active' : ''}
          onClick={() => setActiveReport('interest-summary')}
          disabled={loading}
        >
          Interest Summary
        </button>
        <button 
          className={activeReport === 'customer-activity' ? 'active' : ''}
          onClick={() => setActiveReport('customer-activity')}
          disabled={loading}
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
                <div className="report-summary no-print">
                  <div className="summary-item">
                    <span>Total Agents:</span>
                    <strong>{totals.agent.count}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total Transactions:</span>
                    <strong>{totals.agent.totalTransactions}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total Deposit Value:</span>
                    <strong>{formatCurrency(totals.agent.totalDeposits)}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total Withdrawal Value:</span>
                    <strong>{formatCurrency(totals.agent.totalWithdrawals)}</strong>
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
                          <td>{parseNumber(agent.total_transactions)}</td>
                          <td>{formatCurrency(parseNumber(agent.total_deposits))}</td>
                          <td>{formatCurrency(parseNumber(agent.total_withdrawals))}</td>
                          <td className={parseNumber(agent.net_value) >= 0 ? 'text-success' : 'text-danger'}>
                            {formatCurrency(parseNumber(agent.net_value))}
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
                <div className="report-summary no-print">
                  <div className="summary-item">
                    <span>Total Accounts:</span>
                    <strong>{totals.accounts.count}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total Deposit Value:</span>
                    <strong>{formatCurrency(totals.accounts.totalDeposits)}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total Withdrawal Value:</span>
                    <strong>{formatCurrency(totals.accounts.totalWithdrawals)}</strong>
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
                          <td>{parseNumber(account.transaction_count)}</td>
                          <td>{formatCurrency(parseNumber(account.total_deposits))}</td>
                          <td>{formatCurrency(parseNumber(account.total_withdrawals))}</td>
                          <td className={parseNumber(account.current_balance) >= 0 ? 'text-success' : 'text-danger'}>
                            {formatCurrency(parseNumber(account.current_balance))}
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
                <div className="report-summary no-print">
                  <div className="summary-item">
                    <span>Total Active FDs:</span>
                    <strong>{totals.fds.count}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total FD Value:</span>
                    <strong>{formatCurrency(totals.fds.totalValue)}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Due Today (Interest):</span>
                    <strong>{activeFDs.filter(fd => isToday(fd.next_interest_date)).length}</strong>
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
                        <th>Next Interest Date (30-day cycle)</th>
                        <th>Days Remaining</th>
                        <th>Auto Renewal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeFDs.map(fd => (
                        <tr key={fd.fd_id}>
                          <td>{fd.fd_id}</td>
                          <td>{fd.account_id}</td>
                          <td>{fd.customer_names}</td>
                          <td>{formatCurrency(parseNumber(fd.fd_balance))}</td>
                          <td>{parseNumber(fd.interest_rate)}%</td>
                          <td>{fd.open_date ? new Date(fd.open_date).toLocaleDateString() : ''}</td>
                          <td>{fd.maturity_date ? new Date(fd.maturity_date).toLocaleDateString() : ''}</td>
                          <td>{fd.next_interest_date ? new Date(fd.next_interest_date).toLocaleDateString() : ''}</td>
                          <td>
                            {(() => {
                              const du = daysUntil(fd.next_interest_date);
                              if (du === null) return '';
                              if (du === 0) return <span className="badge badge-success">Due Today</span>;
                              return `${du} day${du === 1 ? '' : 's'}`;
                            })()}
                          </td>
                          <td>
                            <span className={`badge ${String(fd.auto_renewal_status).toLowerCase() === 'true' ? 'badge-success' : 'badge-secondary'}`}>
                              {String(fd.auto_renewal_status)}
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
                <div className="report-summary no-print">
                  <div className="summary-item">
                    <span>Total Interest Distributed:</span>
                    <strong>{formatCurrency(totals.interest.totalInterest)}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total Accounts:</span>
                    <strong>{totals.interest.totalAccounts}</strong>
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
                          <td>{formatCurrency(parseNumber(summary.total_interest))}</td>
                          <td>{parseNumber(summary.account_count)}</td>
                          <td>{formatCurrency(parseNumber(summary.average_interest))}</td>
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
                <div className="report-summary no-print">
                  <div className="summary-item">
                    <span>Total Customers:</span>
                    <strong>{totals.customers.count}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total Deposits:</span>
                    <strong>{formatCurrency(totals.customers.totalDeposits)}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total Withdrawals:</span>
                    <strong>{formatCurrency(totals.customers.totalWithdrawals)}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Net Balance Flow:</span>
                    <strong>{formatCurrency(totals.customers.netFlow)}</strong>
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
                          <td>{formatCurrency(parseNumber(customer.total_deposits))}</td>
                          <td>{formatCurrency(parseNumber(customer.total_withdrawals))}</td>
                          <td className={parseNumber(customer.net_balance) >= 0 ? 'text-success' : 'text-danger'}>
                            {formatCurrency(parseNumber(customer.net_balance))}
                          </td>
                          <td>{parseNumber(customer.account_count)}</td>
                          <td>{customer.last_activity ? new Date(customer.last_activity).toLocaleDateString() : ''}</td>
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
      <div className="export-actions no-print">
        {activeReport === 'agent-transactions' && agentTransactions.length > 0 && (
          <button 
            onClick={() => exportToCSV(agentTransactions, 'agent_transactions')}
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            📥 Export CSV
          </button>
        )}
        {activeReport === 'account-summaries' && accountSummaries.length > 0 && (
          <button 
            onClick={() => exportToCSV(accountSummaries, 'account_summaries')}
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            📥 Export CSV
          </button>
        )}
        {activeReport === 'active-fds' && activeFDs.length > 0 && (
          <button 
            onClick={() => exportToCSV(activeFDs, 'active_fds')}
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            📥 Export CSV
          </button>
        )}
        {activeReport === 'interest-summary' && interestSummary.length > 0 && (
          <button 
            onClick={() => exportToCSV(interestSummary, 'interest_summary')}
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            📥 Export CSV
          </button>
        )}
        {activeReport === 'customer-activity' && customerActivity.length > 0 && (
          <button 
            onClick={() => exportToCSV(customerActivity, 'customer_activity')}
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            📥 Export CSV
          </button>
        )}
      </div>
    </div>
  );
};

export default Reports;