import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface SavingsInterestSummary {
  monthly_interest: number;
  active_savings_accounts: {
    count: number;
    total_balance: number;
  };
  recent_periods: Array<{
    period_start: string;
    period_end: string;
    processed_at: string;
  }>;
  next_scheduled_run: string;
}

const SavingsInterestManagement: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<SavingsInterestSummary | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const loadSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/savings-interest/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load savings interest summary');
    }
  };

  const processInterestNow = async () => {
    if (!window.confirm('Process savings interest now? This will calculate and credit interest for all active savings accounts for the previous month.')) return;
    
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/savings-interest/process-now', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(response.data.message);
      setLastRun(new Date().toLocaleString());
      loadSummary(); // Refresh summary
    } catch (error: any) {
      if (error.response?.status === 400) {
        // This is the "already processed" error
        alert(`⚠️ ${error.response.data.message}\n\n${error.response.data.note}`);
      } else {
        alert(error.response?.data?.message || 'Processing failed');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <div className="savings-interest-management">
      <h4>Savings Account Interest Management</h4>
      <br/>
      
      <div className="auto-system-info">
        <div className="info-card success">
          <h5>🔄 Automatic System Status</h5>
          <p><strong>Schedule:</strong> 1st of every month at 3:30 AM</p>
          <p><strong>Action:</strong> Fully automatic calculation AND crediting</p>
          <p><strong>Status:</strong> <span className="status-active">ACTIVE</span></p>
        </div>

        {summary && (
          <div className="summary-grid">
            <div className="summary-item">
              <span>Active Savings Accounts:</span>
              <strong>{summary.active_savings_accounts.count}</strong>
            </div>
            <div className="summary-item">
              <span>Total Savings Balance:</span>
              <strong>LKR {summary.active_savings_accounts.total_balance.toLocaleString()}</strong>
            </div>
            <div className="summary-item">
              <span>Interest This Month:</span>
              <strong>LKR {summary.monthly_interest.toLocaleString()}</strong>
            </div>
            <div className="summary-item">
              <span>Next Auto-run:</span>
              <strong>{summary.next_scheduled_run}</strong>
            </div>
          </div>
        )}
        <div> <br/></div>
        <div className="recent-periods">
          <p>Recently Processed Periods</p>
          {summary && summary.recent_periods && summary.recent_periods.length > 0 ? (
            <div className="periods-list">
              {summary.recent_periods.map((period, index) => (
                <div key={index} className="period-item">
                  <span>{new Date(period.period_start).toLocaleDateString()} to {new Date(period.period_end).toLocaleDateString()}</span>
                  <small>{new Date(period.processed_at).toLocaleDateString()}</small>
                </div>
              ))}
            </div>
          ) : (
            <p>No periods processed yet.</p>
          )}
        </div>
      </div>

      <div className="manual-control-section">
        <p>Manual Control (For Testing Only)</p>
        <p className="warning-text">
          ⚠️ Use only for testing or emergency processing. The system runs automatically every month.
        </p>
        
        <button 
          onClick={processInterestNow}
          disabled={isProcessing}
          className="btn btn-warning"
        >
          {isProcessing ? '🔄 Processing...' : '🚀 Process Interest Now'}
        </button>
        
        {lastRun && (
          <p className="last-run">Last manual run: {lastRun}</p>
        )}
      </div>
    </div>
  );
};

export default SavingsInterestManagement;