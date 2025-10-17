import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Customer {
  customer_id: number;
  first_name: string;
  last_name: string;
  nic: string;
  date_of_birth: string;
}

interface AccountFormData {
  customer_id: number;
  saving_plan_id: number;
  initial_deposit: number;
  branch_id: number;
  joint_holders?: number[]; // Array of customer IDs for joint account
}

interface SavingPlan {
  saving_plan_id: number;
  plan_type: string;
  interest: number;
  min_balance: number;
}

interface Branch {
  branch_id: number;
  name: string;
}

interface FormErrors {
  [key: string]: string;
}

interface ExistingAccount {
  account_id: number;
  balance: number;
  account_status: string;
  open_date: string;
  branch_id: number;
  saving_plan_id: number;
  fd_id: number | null;
  plan_type: string;
  interest: number;
  min_balance: number;
  customer_names: string;
  customer_count: number;
  branch_name: string;
  customer_nics?: string;
}

interface PlanChangeState {
  selectedAccountId: number | null;
  newSavingPlanId: number | null;
  reason: string;
  isSubmitting: boolean;
  newNic?: string;
}

const AccountCreation: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [savingPlans, setSavingPlans] = useState<SavingPlan[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SavingPlan | null>(null);
  const [jointHolders, setJointHolders] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  
  // New state for account management
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [existingAccounts, setExistingAccounts] = useState<ExistingAccount[]>([]);
  const [searchAccountId, setSearchAccountId] = useState('');
  const [accountSearchResults, setAccountSearchResults] = useState<ExistingAccount[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [planChange, setPlanChange] = useState<PlanChangeState>({
    selectedAccountId: null,
    newSavingPlanId: null,
    reason: '',
    isSubmitting: false,
    newNic: ''
  });
  
  const [formData, setFormData] = useState<AccountFormData>({
    customer_id: 0,
    saving_plan_id: 0,
    initial_deposit: 0,
    branch_id: 0
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Load existing accounts when switching to manage tab
  useEffect(() => {
    if (activeTab === 'manage') {
      loadExistingAccounts();
    }
  }, [activeTab]);
  
  // Sync search results with existing accounts
  useEffect(() => {
    setAccountSearchResults(existingAccounts);
  }, [existingAccounts]);
  
  // Search for customers
  useEffect(() => {
    if (customerSearchTerm.trim()) {
      const results = customers.filter(customer => 
        customer.first_name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        customer.last_name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
        customer.nic.includes(customerSearchTerm)
      );
      setCustomerSearchResults(results.slice(0, 5)); // Limit to 5 results
    } else {
      setCustomerSearchResults([]);
    }
  }, [customerSearchTerm, customers]);

  // Search for joint holders
  useEffect(() => {
    if (searchTerm.trim()) {
      const results = customers.filter(customer => 
        customer.customer_id !== formData.customer_id && // Exclude primary account holder
        !jointHolders.find(jh => jh.customer_id === customer.customer_id) && // Exclude already added joint holders
        (
          customer.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.nic.includes(searchTerm)
        )
      );
      setSearchResults(results.slice(0, 5)); // Limit to 5 results
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, customers, formData.customer_id, jointHolders]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [customersRes, plansRes, branchesRes] = await Promise.all([
        axios.get('/api/agent/customers', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/api/saving-plans', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/api/branches', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setCustomers(customersRes.data.customers);
      setSavingPlans(plansRes.data.saving_plans);
      setBranches(branchesRes.data.branches);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      alert('Failed to load required data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadExistingAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/agent/all-accounts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExistingAccounts(response.data.accounts);
    } catch (error: any) {
      console.error('Failed to load existing accounts:', error);
      alert('Failed to load existing accounts');
    }
  };

  const searchAccount = () => {
    setHasSearched(true);
    
    if (!searchAccountId.trim()) {
      // empty search should not show all accounts
      setAccountSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    // Simple client-side search (Manage tab): only by Account ID or Customer NIC
    const term = searchAccountId.toLowerCase();
    const results = existingAccounts.filter(account => {
      const idMatch = account.account_id.toString().includes(term);
      // Try to match NICs if provided; backend list may not include NICs per customer, so rely on substring search in names field only for NIC if embedded
      const nicMatch = (account.customer_nics || '').toLowerCase().includes(term);
      return idMatch || nicMatch;
    });
    
    setAccountSearchResults(results);
    setIsSearching(false);
  };

  const deactivateAccount = async (accountId: number, balance: number, customerNames: string) => {
  if (!window.confirm(
    `Are you sure you want to deactivate Account ${accountId}?\n\n` +
    `• Customer: ${customerNames}\n` +
    `• Current Balance: LKR ${balance.toLocaleString()}\n\n` +
    `This will automatically:\n` +
    `• Withdraw the full balance of LKR ${balance.toLocaleString()}\n` +
    `• Close the savings account permanently\n` +
    `• Create transaction records for audit\n\n` +
    `This action cannot be undone.`
  )) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await axios.post('/api/agent/accounts/deactivate', 
      { 
        account_id: accountId,
        reason: 'Account closure - full balance withdrawal'
      },
      { 
        headers: { Authorization: `Bearer ${token}` } 
      }
    );
    
    alert(response.data.message);
    // Refresh the list
    loadExistingAccounts();
    setAccountSearchResults(accountSearchResults.filter(acc => acc.account_id !== accountId));
  } catch (error: any) {
    alert(error.response?.data?.message || 'Failed to deactivate account');
  }
  };

  const eligiblePlansForAccount = (account: ExistingAccount) => {
    // Exclude Joint from candidates
    const nonJoint = savingPlans.filter(p => p.plan_type !== 'Joint');

    // Determine owner age from customers list isn't available here; for simplicity, rely on backend validation.
    // Show all non-Joint plans except identical current plan.
    return nonJoint.filter(p => p.saving_plan_id !== account.saving_plan_id);
  };

  const shouldShowNicForAccount = (account: ExistingAccount) => {
    if (planChange.selectedAccountId !== account.account_id || !planChange.newSavingPlanId) return false;
    const targetPlan = savingPlans.find(p => p.saving_plan_id === planChange.newSavingPlanId);
    return account.plan_type === 'Teen' && targetPlan?.plan_type === 'Adult';
  };

  const changePlan = async (account: ExistingAccount) => {
    if (!planChange.newSavingPlanId) {
      alert('Please select a new plan');
      return;
    }
    if (!planChange.reason.trim()) {
      alert('Please provide a reason');
      return;
    }

    try {
      setPlanChange(pc => ({ ...pc, isSubmitting: true }));
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/agent/accounts/change-plan', {
        account_id: account.account_id,
        new_saving_plan_id: planChange.newSavingPlanId,
        reason: planChange.reason.trim(),
        new_nic: planChange.newNic && planChange.selectedAccountId === account.account_id ? planChange.newNic.trim() : undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update UI: refresh existing accounts and search results
      await loadExistingAccounts();
      setSuccessMessage('Plan changed successfully');
  setPlanChange({ selectedAccountId: null, newSavingPlanId: null, reason: '', isSubmitting: false, newNic: '' });
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to change plan';
      alert(msg);
      setPlanChange(pc => ({ ...pc, isSubmitting: false }));
    }
  };

  const calculateAge = (dateOfBirth: string): number => {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const getAgeRequirement = (planType: string): number => {
    switch (planType.toLowerCase()) {
      case 'senior':
        return 60;
      case 'joint':
        return 18;
      case 'children':
        return 0; // No minimum age for children accounts
      case 'teen':
        return 12; // Teen accounts require minimum age 12
      default:
        return 18; // Default adult account
    }
  };

  // Determine the single-holder plan type based on age
  const getSinglePlanTypeForAge = (age: number): 'Children' | 'Teen' | 'Adult' | 'Senior' => {
    if (age >= 60) return 'Senior';
    if (age >= 18) return 'Adult';
    if (age >= 12) return 'Teen';
    return 'Children';
  };

  // Get eligible plans given the selected customer's age
  const getEligiblePlans = (): SavingPlan[] => {
    if (!selectedCustomer || savingPlans.length === 0) return savingPlans;
    const age = calculateAge(selectedCustomer.date_of_birth);
    const singleType = getSinglePlanTypeForAge(age);
    const singlePlan = savingPlans.find(p => p.plan_type === singleType);
    const jointPlan = age >= 18 ? savingPlans.find(p => p.plan_type === 'Joint') : undefined;
    return [singlePlan, jointPlan].filter(Boolean) as SavingPlan[];
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.customer_id) {
      newErrors.customer_id = 'Please select a customer';
    } else if (selectedCustomer && selectedPlan) {
      // Validate age requirement for primary account holder
      const customerAge = calculateAge(selectedCustomer.date_of_birth);
      const requiredAge = getAgeRequirement(selectedPlan.plan_type);
      
      if (customerAge < requiredAge) {
        newErrors.customer_id = `${selectedPlan.plan_type} account requires account holder to be at least ${requiredAge} years old. Current age: ${customerAge}`;
      }
    }
    
    if (!formData.saving_plan_id) {
      newErrors.saving_plan_id = 'Please select a saving plan';
    }
    
    if (!formData.branch_id) {
      newErrors.branch_id = 'Please select a branch';
    }
    
    if (formData.initial_deposit < 0) {
      newErrors.initial_deposit = 'Initial deposit cannot be negative';
    } else if (selectedPlan && formData.initial_deposit < selectedPlan.min_balance-0.00) {
      newErrors.initial_deposit = `Minimum balance for ${selectedPlan.plan_type} plan is LKR ${selectedPlan.min_balance.toLocaleString()}`;
    }

    // Validate joint account requirements
    if (selectedPlan?.plan_type === 'Joint') {
      if (jointHolders.length === 0) {
        newErrors.joint_holders = 'Joint account requires at least one joint holder';
      }
      
      // Validate age for joint holders
      const underageJointHolder = jointHolders.find(holder => {
        const holderAge = calculateAge(holder.date_of_birth);
        return holderAge < 18;
      });
      
      if (underageJointHolder) {
        newErrors.joint_holders = `Joint holder ${underageJointHolder.first_name} ${underageJointHolder.last_name} must be at least 18 years old. Current age: ${calculateAge(underageJointHolder.date_of_birth)}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Ensure numeric fields are numbers when sending to backend
      const submitData = {
        customer_id: Number(formData.customer_id) || 0,
        saving_plan_id: Number(formData.saving_plan_id) || 0,
        initial_deposit: Number(formData.initial_deposit) || 0,
        branch_id: Number(formData.branch_id) || 0,
        joint_holders: jointHolders.map(holder => holder.customer_id)
      };

      const response = await axios.post('/api/agent/accounts/create', submitData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setSuccessMessage(`Account created successfully! Account Number: ${response.data.account_id}`);
      setFormData({
        customer_id: 0,
        saving_plan_id: 0,
        initial_deposit: 0,
        branch_id: 0
      });
      setSelectedCustomer(null);
      setSelectedPlan(null);
      setJointHolders([]);
      setSearchTerm('');
      setSearchResults([]);
      setShowSearch(false);
      setCustomerSearchTerm('');
      setCustomerSearchResults([]);
      setShowCustomerSearch(false);
      setErrors({});
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Coerce numeric fields to numbers to avoid string vs number issues
    let parsedValue: any = value;
    if (name === 'saving_plan_id' || name === 'branch_id' || name === 'customer_id') {
      // empty string -> 0, otherwise parse int
      parsedValue = value === '' ? 0 : parseInt(value as string, 10);
    } else if (name === 'initial_deposit') {
      // allow decimals
      parsedValue = value === '' ? 0 : parseFloat(value as string);
    }

    setFormData({
      ...formData,
      [name]: parsedValue
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Update selected plan when it changes
    if (name === 'saving_plan_id') {
      const plan = savingPlans.find(p => p.saving_plan_id === (parsedValue as number));
      setSelectedPlan(plan || null);
      // Clear joint holders if plan is changed from Joint to something else
      if (plan?.plan_type !== 'Joint') {
        setJointHolders([]);
        setShowSearch(false);
      }
    }
  };

  const selectCustomer = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customer_id: customer.customer_id
    }));
    setSelectedCustomer(customer);
    setCustomerSearchTerm('');
    setCustomerSearchResults([]);
    setShowCustomerSearch(false);
    // Auto-select plan based on age bracket when customer is chosen
    const age = calculateAge(customer.date_of_birth);
    const targetType = getSinglePlanTypeForAge(age);
    const targetPlan = savingPlans.find(p => p.plan_type === targetType) || null;
    if (targetPlan) {
      setFormData(prev => ({ ...prev, saving_plan_id: targetPlan.saving_plan_id }));
      setSelectedPlan(targetPlan);
      // Clear joint holders since we're defaulting to a single-holder plan
      setJointHolders([]);
      setShowSearch(false);
    }
    
    // Clear customer selection error
    if (errors.customer_id) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.customer_id;
        return newErrors;
      });
    }
  };

  // Keep selected plan in sync if saving plans or selected customer changes
  useEffect(() => {
    if (!selectedCustomer || savingPlans.length === 0) return;
    const age = calculateAge(selectedCustomer.date_of_birth);
    const eligible = getEligiblePlans();
    // If current selection is not eligible, switch to age-based single plan
    const current = savingPlans.find(p => p.saving_plan_id === formData.saving_plan_id) || null;
    const stillEligible = current && eligible.some(p => p.saving_plan_id === current.saving_plan_id);
    if (!stillEligible) {
      const singleType = getSinglePlanTypeForAge(age);
      const singlePlan = savingPlans.find(p => p.plan_type === singleType) || null;
      if (singlePlan) {
        setFormData(prev => ({ ...prev, saving_plan_id: singlePlan.saving_plan_id }));
        setSelectedPlan(singlePlan);
        setJointHolders([]);
        setShowSearch(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer, savingPlans]);

  const removeSelectedCustomer = () => {
    setFormData(prev => ({
      ...prev,
      customer_id: 0
    }));
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
  };

  const addJointHolder = (customer: Customer) => {
    if (!jointHolders.find(jh => jh.customer_id === customer.customer_id)) {
      setJointHolders(prev => [...prev, customer]);
      setSearchTerm('');
      setSearchResults([]);
      setShowSearch(false);
    }
  };

  const removeJointHolder = (customerId: number) => {
    setJointHolders(prev => prev.filter(holder => holder.customer_id !== customerId));
  };

  const getPlanDescription = (plan: SavingPlan) => {
    const ageRequirement = getAgeRequirement(plan.plan_type);
    const ageText = ageRequirement > 0 ? `, Min Age: ${ageRequirement}+` : '';
    return `${plan.plan_type} Plan - ${plan.interest}% interest, Min: LKR ${plan.min_balance.toLocaleString()}${ageText}`;
  };

  const getAgeBadge = (age: number, planType: string) => {
    const requiredAge = getAgeRequirement(planType);
    if (age < requiredAge) {
      return <span className="age-badge age-invalid">Age: {age} (Min: {requiredAge}+)</span>;
    }
    return <span className="age-badge age-valid">Age: {age}</span>;
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'Active': 'success',
      'Closed': 'danger'
    };
    
    const color = statusColors[status as keyof typeof statusColors] || 'secondary';
    return <span className={`badge badge-${color}`}>{status}</span>;
  };

  if (isLoadingData) {
    return (
      <div className="customer-registration">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading account creation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-creation">
      <div className="section-header">
        <div>
          <h4>Account Management</h4>
          <p className="section-subtitle">Create and manage savings accounts</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create New Account
        </button>
        <button 
          className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          Manage Existing Accounts
        </button>
      </div>

      {successMessage && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          {successMessage}
          <button 
            className="close-btn"
            onClick={() => setSuccessMessage('')}
          >
            ×
          </button>
        </div>
      )}

      {activeTab === 'create' ? (
        <div className="account-form-container">
          <form className="account-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <h4>Customer Selection</h4>
              <div className="form-group">
                <label>Select Customer *</label>
                
                {selectedCustomer ? (
                  <div className="selected-customer-card">
                    <div className="customer-info">
                      <strong>{selectedCustomer.first_name} {selectedCustomer.last_name}</strong>
                      <span>ID: {selectedCustomer.customer_id} | NIC: {selectedCustomer.nic}</span>
                      {selectedPlan && (
                        <div className="age-validation">
                          {getAgeBadge(calculateAge(selectedCustomer.date_of_birth), selectedPlan.plan_type)}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={removeSelectedCustomer}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="customer-search-section">
                    {!showCustomerSearch ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-block"
                        onClick={() => setShowCustomerSearch(true)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', verticalAlign: 'middle'}}>
                          <circle cx="11" cy="11" r="8"></circle>
                          <path d="m21 21-4.35-4.35"></path>
                        </svg>
                        Search Customer
                      </button>
                    ) : (
                      <div className="search-customer">
                        <div className="search-box">
                          <input
                            type="text"
                            placeholder="Search by customer name or NIC/birth certificate number..."
                            value={customerSearchTerm}
                            onChange={(e) => setCustomerSearchTerm(e.target.value)}
                            className="search-input"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setShowCustomerSearch(false);
                              setCustomerSearchTerm('');
                              setCustomerSearchResults([]);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                        
                        {customerSearchResults.length > 0 && (
                          <div className="search-results">
                            {customerSearchResults.map(customer => (
                              <div 
                                key={customer.customer_id} 
                                className="search-result-item"
                                onClick={() => selectCustomer(customer)}
                              >
                                <div className="customer-info">
                                  <strong>{customer.first_name} {customer.last_name}</strong>
                                  <span>ID: {customer.customer_id} | NIC: {customer.nic} | Age: {calculateAge(customer.date_of_birth)}</span>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                >
                                  Select
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {customerSearchTerm && customerSearchResults.length === 0 && (
                          <div className="no-results">
                            No customers found matching your search.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {errors.customer_id && <span className="error-text">{errors.customer_id}</span>}
              </div>
            </div>

            <div className="form-section">
              <h4>Account Details</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Saving Plan *</label>
                  <select
                    name="saving_plan_id"
                    value={formData.saving_plan_id}
                    onChange={handleInputChange}
                    required
                    className={errors.saving_plan_id ? 'error' : ''}
                  >
                    <option value="">Choose a saving plan...</option>
                    {(getEligiblePlans()).map(plan => (
                      <option key={plan.saving_plan_id} value={plan.saving_plan_id}>
                        {getPlanDescription(plan)}
                      </option>
                    ))}
                  </select>
                  
                  {errors.saving_plan_id && <span className="error-text">{errors.saving_plan_id}</span>}
                </div>

                <div className="form-group">
                  <label>Branch *</label>
                  <select
                    name="branch_id"
                    value={formData.branch_id}
                    onChange={handleInputChange}
                    required
                    className={errors.branch_id ? 'error' : ''}
                  >
                    <option value="">Choose a branch...</option>
                    {branches.map(branch => (
                      <option key={branch.branch_id} value={branch.branch_id}>
                        {branch.name} ({branch.branch_id})
                      </option>
                    ))}
                  </select>
                  {errors.branch_id && <span className="error-text">{errors.branch_id}</span>}
                </div>
              </div>

              {/* Joint Account Holders Section - MOVED ABOVE INITIAL DEPOSIT */}
              {selectedPlan?.plan_type === 'Joint' && (
                <div className="joint-holders-section">
                  <p>Joint Account Holders</p>
                  <p className="form-help">
                    Add other customers who will be joint holders of this account. All joint holders must be at least 18 years old.
                  </p>
                  
                  {errors.joint_holders && (
                    <span className="error-text">{errors.joint_holders}</span>
                  )}

                  {/* Current Joint Holders */}
                  {jointHolders.length > 0 && (
                    <div className="joint-holders-list">
                      <h6>Added Joint Holders ({jointHolders.length})</h6>
                      {jointHolders.map(holder => (
                        <div key={holder.customer_id} className="joint-holder-card">
                          <div className="holder-info">
                            <strong>{holder.first_name} {holder.last_name}</strong>
                            <span>ID: {holder.customer_id} | NIC: {holder.nic}</span>
                            {getAgeBadge(calculateAge(holder.date_of_birth), 'Joint')}
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeJointHolder(holder.customer_id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Joint Holder Search */}
                  <div className="add-joint-holder">
                    {!showSearch ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setShowSearch(true)}
                      >
                        + Add Joint Holder
                      </button>
                    ) : (
                      <div className="search-joint-holder">
                        <div className="search-box">
                          <input
                            type="text"
                            placeholder="Search by customer name or NIC/birth certificate number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setShowSearch(false);
                              setSearchTerm('');
                              setSearchResults([]);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                        
                        {searchResults.length > 0 && (
                          <div className="search-results">
                            {searchResults.map(customer => (
                              <div key={customer.customer_id} className="search-result-item">
                                <div className="customer-info">
                                  <strong>{customer.first_name} {customer.last_name}</strong>
                                  <span>ID: {customer.customer_id} | NIC: {customer.nic}</span>
                                  {getAgeBadge(calculateAge(customer.date_of_birth), 'Joint')}
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => addJointHolder(customer)}
                                  disabled={calculateAge(customer.date_of_birth) < 18}
                                >
                                  {calculateAge(customer.date_of_birth) < 18 ? 'Under 18' : 'Add'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {searchTerm && searchResults.length === 0 && (
                          <div className="no-results">
                            No customers found matching your search.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Initial Deposit - MOVED BELOW JOINT HOLDERS SECTION */}
              <div className="form-group">
                <label>Initial Deposit (LKR) *</label>
                <input
                  type="number"
                  name="initial_deposit"
                  value={formData.initial_deposit === 0 ? '' : formData.initial_deposit}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="Enter initial deposit amount"
                  className={errors.initial_deposit ? 'error' : ''}
                />
                {errors.initial_deposit && <span className="error-text">{errors.initial_deposit}</span>}
                {selectedPlan && (
                  <small className="form-help">
                    Minimum deposit for {selectedPlan.plan_type} plan: LKR {selectedPlan.min_balance.toLocaleString()}
                  </small>
                )}
              </div>

              {selectedPlan && formData.initial_deposit >= selectedPlan.min_balance && (
                <div className="account-summary">
                  <h5>Account Summary</h5>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span>Plan Type:</span>
                      <strong>{selectedPlan.plan_type}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Interest Rate:</span>
                      <strong>{selectedPlan.interest}%</strong>
                    </div>
                    <div className="summary-item">
                      <span>Initial Deposit:</span>
                      <strong>LKR {formData.initial_deposit.toLocaleString()}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Minimum Balance:</span>
                      <strong>LKR {selectedPlan.min_balance.toLocaleString()}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Age Requirement:</span>
                      <strong>{getAgeRequirement(selectedPlan.plan_type)}+ years</strong>
                    </div>
                    {selectedPlan.plan_type === 'Joint' && (
                      <div className="summary-item">
                        <span>Joint Holders:</span>
                        <strong>{jointHolders.length + 1} total</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setFormData({
                    customer_id: 0,
                    saving_plan_id: 0,
                    initial_deposit: 0,
                    branch_id: 0
                  });
                  setSelectedCustomer(null);
                  setSelectedPlan(null);
                  setJointHolders([]);
                  setSearchTerm('');
                  setSearchResults([]);
                  setShowSearch(false);
                  setCustomerSearchTerm('');
                  setCustomerSearchResults([]);
                  setShowCustomerSearch(false);
                  setErrors({});
                }}
              >
                Clear Form
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        // Manage Existing Accounts Tab
                
        <div className="account-management">
          <div className="search-section">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search by Account ID or Customer NIC..."
                value={searchAccountId}
                onChange={(e) => setSearchAccountId(e.target.value)}
                className="search-input"
              />
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={searchAccount}
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setSearchAccountId('');
                  setAccountSearchResults([]);
                  setHasSearched(false);
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Minimal results area: only show after a search */}
          {hasSearched && (
            <div className="account-list">
              {accountSearchResults.length === 0 ? (
                <div className="no-data">
                  {searchAccountId
                    ? `No accounts found matching "${searchAccountId}"`
                    : 'Enter a term above and click Search.'}
                </div>
              ) : (
                <div className="account-grid">
                  {accountSearchResults.map(account => (
                    <div key={account.account_id} className="account-card">
                      <div className="account-header">
                        <h6>Account: {account.account_id}</h6>
                        {getStatusBadge(account.account_status)}
                      </div>
                      <div className="account-details">
                        <div className="account-detail-row">
                          <div className="detail-label">Customer(s):</div>
                          <div className="detail-value">
                            <div className="customer-info">
                              <strong>{account.customer_names}</strong>
                              {account.customer_count > 1 && (
                                <small className="joint-badge">Joint Account ({account.customer_count})</small>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="account-detail-row">
                          <div className="detail-label">Plan Type:</div>
                          <div className="detail-value">
                            <strong>{account.plan_type}</strong>
                          </div>
                        </div>

                        <div className="account-detail-row">
                          <div className="detail-label">Current Balance:</div>
                          <div className="detail-value">
                            <strong className={account.balance > 0 ? 'text-success' : 'text-muted'}>
                              LKR {account.balance.toLocaleString()}
                            </strong>
                          </div>
                        </div>
                      </div>
                      <div className="account-actions">
                        {account.account_status === 'Active' && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => deactivateAccount(
                              account.account_id,
                              account.balance,
                              account.customer_names
                            )}
                            disabled={account.fd_id !== null}
                          >
                            {account.fd_id ? 'Has Active FD' : 'Close Account'}
                          </button>
                        )}

                        {account.account_status === 'Closed' && (
                          <span className="text-muted">Account Closed</span>
                        )}
                      </div>

                      {/* Plan Change UI */}
                      {account.account_status === 'Active' && account.plan_type !== 'Joint' && (
                        <div className="plan-change">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Change Plan</label>
                              <select
                                value={planChange.selectedAccountId === account.account_id ? (planChange.newSavingPlanId || '') : ''}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : null;
                                  const targetPlan = val ? savingPlans.find(p => p.saving_plan_id === val) : undefined;
                                  const willShowNic = account.plan_type === 'Teen' && targetPlan?.plan_type === 'Adult';
                                  setPlanChange({
                                    selectedAccountId: account.account_id,
                                    newSavingPlanId: val,
                                    reason: planChange.selectedAccountId === account.account_id ? planChange.reason : '',
                                    isSubmitting: false,
                                    newNic: planChange.selectedAccountId === account.account_id && willShowNic ? (planChange.newNic || '') : ''
                                  });
                                }}
                              >
                                <option value="">Select new plan...</option>
                                {eligiblePlansForAccount(account).map(p => (
                                  <option key={p.saving_plan_id} value={p.saving_plan_id}>
                                    {p.plan_type} — {p.interest}% (Min LKR {p.min_balance.toLocaleString()})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label>Reason</label>
                              <input
                                type="text"
                                placeholder="e.g., Customer reached age threshold"
                                value={planChange.selectedAccountId === account.account_id ? planChange.reason : ''}
                                onChange={(e) => setPlanChange(pc => pc.selectedAccountId === account.account_id ? { ...pc, reason: e.target.value } : pc)}
                              />
                            </div>
                          </div>
                          {shouldShowNicForAccount(account) && (
                            <div className="form-row">
                              <div className="form-group" style={{ flex: 1 }}>
                                <label>New NIC (required when Teen → Adult)</label>
                                <input
                                  type="text"
                                  maxLength={15}
                                  placeholder="Enter new NIC"
                                  value={planChange.selectedAccountId === account.account_id ? (planChange.newNic || '') : ''}
                                  onChange={(e) => setPlanChange(pc => pc.selectedAccountId === account.account_id ? { ...pc, newNic: e.target.value } : pc)}
                                />
                                <small className="form-help">Provide the official NIC to replace the birth certificate number.</small>
                              </div>
                            </div>
                          )}
                          <div className="form-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => changePlan(account)}
                              disabled={planChange.isSubmitting || planChange.selectedAccountId !== account.account_id}
                            >
                              {planChange.isSubmitting && planChange.selectedAccountId === account.account_id ? 'Changing...' : 'Apply Plan Change'}
                            </button>
                          </div>
                        </div>
                      )}

                      {account.account_status === 'Active' && account.fd_id && (
                        <div className="account-warning">
                          <small className="text-warning">
                            ⚠️ Deactivate FD first before closing account
                          </small>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountCreation;