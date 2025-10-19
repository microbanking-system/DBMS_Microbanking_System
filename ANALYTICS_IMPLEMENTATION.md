# Agent Analytics Implementation

## Overview
Added two analytics charts to the Agent Performance dashboard:
1. **Pie Chart** - Transaction distribution by account type (Child, Teen, Adult, Senior, Joint)
2. **Line Chart** - Last 30 days transaction trend

## Backend Changes

### 1. New Controller Functions (`backend/controllers/agentController.js`)

#### `getTransactionTypeAnalytics`
- **Endpoint**: `GET /api/agent/analytics/transaction-types`
- **Purpose**: Get transaction counts grouped by account plan type
- **SQL Query**:
  ```sql
  SELECT 
    sp.plan_type,
    COUNT(t.transaction_id) as transaction_count
  FROM transaction t
  JOIN account a ON t.account_id = a.account_id
  JOIN savingplan sp ON a.saving_plan_id = sp.saving_plan_id
  WHERE t.employee_id = $1
  GROUP BY sp.plan_type
  ORDER BY transaction_count DESC
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": [
      { "plan_type": "Adult", "transaction_count": "150" },
      { "plan_type": "Children", "transaction_count": "80" },
      { "plan_type": "Senior", "transaction_count": "45" },
      { "plan_type": "Teen", "transaction_count": "30" },
      { "plan_type": "Joint", "transaction_count": "20" }
    ]
  }
  ```

#### `getTransactionTrend`
- **Endpoint**: `GET /api/agent/analytics/transaction-trend`
- **Purpose**: Get daily transaction counts for the last 30 days
- **SQL Query**:
  ```sql
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '29 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS date
  )
  SELECT 
    ds.date,
    COALESCE(COUNT(t.transaction_id), 0) as transaction_count
  FROM date_series ds
  LEFT JOIN transaction t ON DATE(t.time) = ds.date AND t.employee_id = $1
  GROUP BY ds.date
  ORDER BY ds.date ASC
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": [
      { "date": "2025-09-19", "transaction_count": "5" },
      { "date": "2025-09-20", "transaction_count": "8" },
      ...
      { "date": "2025-10-19", "transaction_count": "12" }
    ]
  }
  ```

### 2. New Routes (`backend/routes/agent.js`)
```javascript
router.get('/analytics/transaction-types', agentController.getTransactionTypeAnalytics);
router.get('/analytics/transaction-trend', agentController.getTransactionTrend);
```

## Frontend Changes

### 1. Dependencies Added
- **recharts**: Chart library for React
  ```bash
  npm install recharts
  ```

### 2. Component Updates (`frontend/src/components/AgentPerformance.tsx`)

#### New State Variables
```typescript
const [transactionTypes, setTransactionTypes] = useState<TransactionTypeData[]>([]);
const [transactionTrend, setTransactionTrend] = useState<TransactionTrendData[]>([]);
```

#### New Interfaces
```typescript
interface TransactionTypeData {
  plan_type: string;
  transaction_count: string;
}

interface TransactionTrendData {
  date: string;
  transaction_count: string;
}
```

#### New API Fetch Function
```typescript
const fetchAnalytics = async () => {
  const token = localStorage.getItem('token');
  
  const typesResponse = await axios.get('/api/agent/analytics/transaction-types', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const trendResponse = await axios.get('/api/agent/analytics/transaction-trend', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  setTransactionTypes(typesResponse.data.data || []);
  setTransactionTrend(trendResponse.data.data || []);
};
```

#### Chart Components
1. **Pie Chart** (Left Side):
   - Shows transaction distribution by account type
   - Uses 5 colors: ['#1a365d', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd']
   - Displays percentage labels on each segment
   - Interactive hover tooltips

2. **Line Chart** (Right Side):
   - Shows daily transaction count for last 30 days
   - X-axis: Dates (formatted as "Oct 19")
   - Y-axis: Transaction count
   - Blue line (#1a365d) with 2px stroke width
   - Interactive dots on hover

### 3. CSS Styles (`frontend/src/App.css`)

```css
/* Analytics Grid */
.analytics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.analytics-card {
  background: var(--bg-white);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-md);
  transition: var(--transition);
}

.analytics-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.analytics-title {
  margin: 0 0 var(--spacing-md) 0;
  color: var(--primary-color);
  font-size: var(--font-size-lg);
  font-weight: 600;
  text-align: center;
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--secondary-color);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .analytics-grid {
    grid-template-columns: 1fr;
  }
}
```

## Features

### ✅ Real-time Data
- All data is fetched from the backend database
- No hardcoded values
- Reflects actual agent transactions

### ✅ Account Type Categories
The pie chart includes all account types:
- **Child** (Children plan)
- **Teen** (Teen plan)
- **Adult** (Adult plan)
- **Senior** (Senior plan)
- **Joint** (Joint plan)

### ✅ Time-based Analysis
- Line chart covers exactly 30 days
- Uses PostgreSQL's `generate_series` for complete date range
- Shows 0 for days with no transactions

### ✅ Responsive Design
- Two-column layout on desktop
- Single-column layout on tablets/mobile (< 1024px)
- Charts scale responsively with ResponsiveContainer

### ✅ Interactive Features
- Hover tooltips on both charts
- Legend for identifying data series
- Smooth transitions and animations
- Percentage labels on pie chart

## Testing

To test the implementation:

1. Login as an agent
2. Navigate to Agent Dashboard → Performance tab
3. View the analytics section at the top
4. Charts should display:
   - Pie chart showing your transaction distribution by account type
   - Line chart showing your daily transaction count for the last 30 days

## Database Requirements

The implementation uses existing tables:
- `transaction` - Transaction records
- `account` - Account information
- `savingplan` - Account plan types (Child, Teen, Adult, Senior, Joint)

No database schema changes required.

## Authentication

Both endpoints require:
- Valid JWT token
- Agent or Admin role
- Data is filtered by logged-in agent's employee_id

## Notes

- Charts automatically update when component mounts
- Empty states are handled gracefully (empty arrays)
- All dates are formatted consistently
- Colors follow the app's design system
- Performance optimized with single DB queries
