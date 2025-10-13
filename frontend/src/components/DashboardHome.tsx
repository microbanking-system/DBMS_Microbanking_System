import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface DashboardStats {
  totalCustomers: number;
  totalAccounts: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalFixedDeposits: number;
  monthlyGrowth: number;
  activeLoans: number;
  totalTransactions: number;
}

interface MonthlyData {
  month: string;
  deposits: number;
  withdrawals: number;
  newAccounts: number;
}

interface AccountTypeData {
  type: string;
  count: number;
  percentage: number;
}

const DashboardHome: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalAccounts: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalFixedDeposits: 0,
    monthlyGrowth: 0,
    activeLoans: 0,
    totalTransactions: 0,
  });

  const [monthlyData] = useState<MonthlyData[]>([
    { month: 'Jan', deposits: 45000, withdrawals: 32000, newAccounts: 45 },
    { month: 'Feb', deposits: 52000, withdrawals: 38000, newAccounts: 58 },
    { month: 'Mar', deposits: 48000, withdrawals: 35000, newAccounts: 52 },
    { month: 'Apr', deposits: 61000, withdrawals: 42000, newAccounts: 67 },
    { month: 'May', deposits: 58000, withdrawals: 39000, newAccounts: 61 },
    { month: 'Jun', deposits: 67000, withdrawals: 45000, newAccounts: 74 },
    { month: 'Jul', deposits: 72000, withdrawals: 48000, newAccounts: 82 },
    { month: 'Aug', deposits: 69000, withdrawals: 46000, newAccounts: 78 },
    { month: 'Sep', deposits: 75000, withdrawals: 51000, newAccounts: 85 },
    { month: 'Oct', deposits: 81000, withdrawals: 54000, newAccounts: 92 },
    { month: 'Nov', deposits: 78000, withdrawals: 52000, newAccounts: 88 },
    { month: 'Dec', deposits: 85000, withdrawals: 58000, newAccounts: 95 },
  ]);

  const [accountTypes] = useState<AccountTypeData[]>([
    { type: 'Savings', count: 245, percentage: 65 },
    { type: 'Fixed Deposit', count: 98, percentage: 26 },
    { type: 'Current', count: 34, percentage: 9 },
  ]);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Simulated data - replace with actual API call
      setStats({
        totalCustomers: 1247,
        totalAccounts: 1538,
        totalDeposits: 8450000,
        totalWithdrawals: 5230000,
        totalFixedDeposits: 3200000,
        monthlyGrowth: 12.5,
        activeLoans: 89,
        totalTransactions: 4521,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getMaxValue = (data: MonthlyData[]) => {
    const maxDeposit = Math.max(...data.map(d => d.deposits));
    const maxWithdrawal = Math.max(...data.map(d => d.withdrawals));
    return Math.max(maxDeposit, maxWithdrawal);
  };

  const maxValue = getMaxValue(monthlyData);

  return (
    <div className="dashboard-home">
      <div className="home-header">
        <div className="header-content">
          <h2 className="home-title">
            <span className="title-icon"><img src={require('../imgs/B_Trust_logo_Yellow.png')} alt="B-Trust Logo" style={{ width: '100px', height: '100px' }} /></span>
            B-Trust Analytics
          </h2>
          <p className="home-subtitle">Comprehensive banking insights and performance metrics</p>
        </div>
        <div className="year-badge">
          <span className="year-label">Year</span>
          <span className="year-value">2025</span>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">👥</div>
          <div className="kpi-content">
            <h3 className="kpi-value">{stats.totalCustomers.toLocaleString()}</h3>
            <p className="kpi-label">Total Customers</p>
          </div>
          <div className="kpi-trend positive">+{stats.monthlyGrowth}%</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">🏦</div>
          <div className="kpi-content">
            <h3 className="kpi-value">{stats.totalAccounts.toLocaleString()}</h3>
            <p className="kpi-label">Active Accounts</p>
          </div>
          <div className="kpi-trend positive">+8.2%</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <h3 className="kpi-value">{formatCurrency(stats.totalDeposits)}</h3>
            <p className="kpi-label">Total Deposits</p>
          </div>
          <div className="kpi-trend positive">+15.3%</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">💳</div>
          <div className="kpi-content">
            <h3 className="kpi-value">{stats.totalTransactions.toLocaleString()}</h3>
            <p className="kpi-label">Transactions</p>
          </div>
          <div className="kpi-trend positive">+22.1%</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Monthly Transactions Chart */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3 className="chart-title">
              <span className="chart-icon">📊</span>
              Monthly Transaction Overview
            </h3>
            <div className="chart-legend">
              <span className="legend-item deposits">
                <span className="legend-dot"></span>Deposits
              </span>
              <span className="legend-item withdrawals">
                <span className="legend-dot"></span>Withdrawals
              </span>
            </div>
          </div>
          <div className="bar-chart">
            {monthlyData.map((data, index) => (
              <div key={index} className="bar-group">
                <div className="bars">
                  <div
                    className="bar deposits-bar"
                    style={{ height: `${(data.deposits / maxValue) * 100}%` }}
                    title={`Deposits: ${formatCurrency(data.deposits)}`}
                  >
                    <span className="bar-value">{formatCurrency(data.deposits)}</span>
                  </div>
                  <div
                    className="bar withdrawals-bar"
                    style={{ height: `${(data.withdrawals / maxValue) * 100}%` }}
                    title={`Withdrawals: ${formatCurrency(data.withdrawals)}`}
                  >
                    <span className="bar-value">{formatCurrency(data.withdrawals)}</span>
                  </div>
                </div>
                <div className="bar-label">{data.month}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Account Distribution Pie Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">
              <span className="chart-icon">🥧</span>
              Account Distribution
            </h3>
          </div>
          <div className="pie-chart-container">
            <div className="pie-chart">
              {accountTypes.map((type, index) => {
                const startAngle = accountTypes
                  .slice(0, index)
                  .reduce((sum, t) => sum + (t.percentage * 3.6), 0);
                const endAngle = startAngle + (type.percentage * 3.6);
                
                return (
                  <div
                    key={index}
                    className={`pie-slice slice-${index + 1}`}
                    style={{
                      background: `conic-gradient(
                        var(--gold-primary) 0deg,
                        var(--gold-primary) ${type.percentage * 3.6}deg,
                        transparent ${type.percentage * 3.6}deg
                      )`,
                      transform: `rotate(${startAngle}deg)`,
                    }}
                  ></div>
                );
              })}
            </div>
            <div className="pie-legend">
              {accountTypes.map((type, index) => (
                <div key={index} className="pie-legend-item">
                  <span className={`legend-color color-${index + 1}`}></span>
                  <div className="legend-info">
                    <span className="legend-label">{type.type}</span>
                    <span className="legend-stats">
                      {type.count} ({type.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* New Accounts Growth */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">
              <span className="chart-icon">📈</span>
              New Accounts Growth
            </h3>
          </div>
          <div className="line-chart">
            <svg viewBox="0 0 400 200" className="line-chart-svg">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(212, 175, 55, 0.4)" />
                  <stop offset="100%" stopColor="rgba(212, 175, 55, 0)" />
                </linearGradient>
              </defs>
              <polyline
                fill="url(#lineGradient)"
                stroke="none"
                points={monthlyData
                  .map((d, i) => `${(i * 400) / 11},${200 - (d.newAccounts / 95) * 180}`)
                  .join(' ') + ' 400,200 0,200'}
              />
              <polyline
                fill="none"
                stroke="var(--gold-primary)"
                strokeWidth="3"
                points={monthlyData
                  .map((d, i) => `${(i * 400) / 11},${200 - (d.newAccounts / 95) * 180}`)
                  .join(' ')}
              />
              {monthlyData.map((d, i) => (
                <circle
                  key={i}
                  cx={(i * 400) / 11}
                  cy={200 - (d.newAccounts / 95) * 180}
                  r="4"
                  fill="var(--gold-light)"
                  stroke="var(--bg-card)"
                  strokeWidth="2"
                >
                  <title>{d.month}: {d.newAccounts} accounts</title>
                </circle>
              ))}
            </svg>
            <div className="line-chart-labels">
              {monthlyData.map((d, i) => i % 2 === 0 && (
                <span key={i} className="chart-label">{d.month}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-item">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <h4>Fixed Deposits</h4>
            <p className="stat-value">{formatCurrency(stats.totalFixedDeposits)}</p>
            <span className="stat-trend positive">+18.5% this month</span>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h4>Active Loans</h4>
            <p className="stat-value">{stats.activeLoans}</p>
            <span className="stat-trend neutral">Stable</span>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">💸</div>
          <div className="stat-content">
            <h4>Total Withdrawals</h4>
            <p className="stat-value">{formatCurrency(stats.totalWithdrawals)}</p>
            <span className="stat-trend negative">-3.2% this month</span>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <h4>Avg. Processing Time</h4>
            <p className="stat-value">2.3 min</p>
            <span className="stat-trend positive">-15% faster</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
