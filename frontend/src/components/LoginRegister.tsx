import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logoImage from '../imgs/B_Trust_logo_Yellow.png';

interface LoginData {
  username: string;
  password: string;
}

interface LoginRegisterProps {
  onLoginSuccess: () => void;
}

interface FormErrors {
  [key: string]: string;
}

const LoginRegister: React.FC<LoginRegisterProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loginData, setLoginData] = useState<LoginData>({
    username: '',
    password: ''
  });

  const navigate = useNavigate();

  const validateLoginForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!loginData.username.trim()) {
      newErrors.loginUsername = 'Username is required';
    }
    
    if (!loginData.password) {
      newErrors.loginPassword = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;
    
    setIsLoading(true);
    try {
      const response = await axios.post('/api/login', {
        username: loginData.username,
        password: loginData.password
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      onLoginSuccess();
      navigate('/dashboard');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData({
      ...loginData,
      [name]: value
    });
    // Clear error when user starts typing
    const errorKey = `login${name.charAt(0).toUpperCase() + name.slice(1)}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  return (
    <div className="App login-page">
      <div className="login-background">
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>
      
      {/* <header className="App-header">
        <h1>✦ B-Trust</h1>
        <p className="tagline">Modern Microbanking System</p>
      </header> */}

      <div className="auth-container">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner">
              <div className="spinner-ring"></div>
            </div>
          </div>
        )}
        
        <form className="auth-form" onSubmit={handleLogin}>
          <div className="auth-header">
            <img src={logoImage} alt="B-Trust Logo" className="login-logo" />
            <h2>Welcome Back</h2>
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={loginData.username}
              onChange={handleLoginChange}
              required
              className={errors.loginUsername ? 'error' : ''}
              placeholder="Enter your username"
            />
            {errors.loginUsername && <span className="error-text">{errors.loginUsername}</span>}
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={loginData.password}
              onChange={handleLoginChange}
              required
              className={errors.loginPassword ? 'error' : ''}
              placeholder="Enter your password"
            />
            {errors.loginPassword && <span className="error-text">{errors.loginPassword}</span>}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="loading-dots">Signing in</span>
              </>
            ) : (
              <>
                Sign In
                <span className="arrow">→</span>
              </>
            )}
          </button>

          <div className="login-footer">
            
            <p className="secure-text">Secure • Encrypted • Trusted</p>
          </div>
        </form>

        <div className="login-info">
          {/* <div className="info-card">
            <span className="info-icon">🔒</span>
            <p>Secure access for authorized personnel only</p>
          </div>
          <div className="info-card">
            <span className="info-icon">👥</span>
            <p>Contact administrator for account creation</p>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default LoginRegister;