import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface FDInterestSummary {
  monthly_interest: number;
  active_fds: {
    count: number;
    total_value: number;
  };
  recent_periods: Array<{
    period_start: string;
    period_end: string;
    processed_at: string;
  }>;
  next_scheduled_run: string;
}

const FDInterestManagement: React.FC = () => {
  const [summary, setSummary] = useState<FDInterestSummary | null>(null);

  const loadSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/fd-interest/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load summary');
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <div className="fd-interest-management">
      <h4>Fixed Deposit Interest Management</h4>
      
      <div className="auto-system-info">
        <div className="info-card success">
          <h5>🔄 Automatic System Status</h5>
          <p><strong>Schedule:</strong> Daily at 3:00 AM (per-account 30-day cycles)</p>
          <p><strong>Action:</strong> Fully automatic per-account calculation AND crediting</p>
          <p><strong>Status:</strong> <span className="status-active">ACTIVE</span></p>
        </div>

        {summary && (
          <div className="summary-grid">
            <div className="summary-item">
              <span>Active Fixed Deposits:</span>
              <strong>{summary.active_fds.count}</strong>
            </div>
            <div className="summary-item">
              <span>Total FD Value:</span>
              <strong>LKR {summary.active_fds.total_value.toLocaleString()}</strong>
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

      {/* Manual controls removed as processing is fully automatic on a daily schedule */}

      {/* Removed styled-jsx and using regular CSS classes instead */}
    </div>
  );
};

export default FDInterestManagement;