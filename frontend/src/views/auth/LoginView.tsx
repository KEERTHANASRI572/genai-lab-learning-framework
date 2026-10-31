import React, { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, Mail, ArrowRight, Loader2, KeyRound, Check, Eye, EyeOff, CheckCircle2, HelpCircle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/common/Alert';
import { useApp } from '../../context/AppContext';
import {
  activateAccount,
  requestPasswordReset,
  resetPassword,
} from '../../services/api';

type AuthMode = 'login' | 'activate' | 'forgot' | 'reset';

export const LoginView: React.FC = () => {
  const { login, checkSession, backendHealth } = useApp();
  const [mode, setMode] = useState<AuthMode>('login');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Activation & Reset state
  const [token, setToken] = useState('');
  const [hasUrlToken, setHasUrlToken] = useState(false);
  const [showManualTokenInput, setShowManualTokenInput] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password strength checklist calculations
  const passwordCriteria = {
    length: newPassword.length >= 8 && newPassword.length <= 128,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword),
  };
  const isPasswordStrong =
    passwordCriteria.length &&
    passwordCriteria.upper &&
    passwordCriteria.lower &&
    passwordCriteria.number &&
    passwordCriteria.special;

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Check URL query parameters for invitation or reset token on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const path = window.location.pathname;

    if (tokenParam) {
      setToken(tokenParam);
      setHasUrlToken(true);
      setShowManualTokenInput(false);
      if (path.includes('reset') || urlParams.get('mode') === 'reset') {
        setMode('reset');
      } else {
        setMode('activate');
      }
    } else if (path.includes('/activate')) {
      setMode('activate');
      setHasUrlToken(false);
      setShowManualTokenInput(true);
    } else if (path.includes('/reset')) {
      setMode('reset');
      setHasUrlToken(false);
      setShowManualTokenInput(true);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your institutional email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login({ email: trimmedEmail, password });
      if (!res.success) {
        setErrorMsg(res.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during sign-in.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!token.trim()) {
      setErrorMsg('An invitation token is required. Please check your invitation email or contact your college administrator.');
      return;
    }
    if (!isPasswordStrong) {
      setErrorMsg('Password does not satisfy complexity criteria: must be at least 8 characters with uppercase, lowercase, digit, and special character.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await activateAccount({ token: token.trim(), password: newPassword });
      if (res.success) {
        const activatedEmail = res.data?.user?.email;
        if (activatedEmail) {
          setEmail(activatedEmail);
        }
        setSuccessMsg('Account activated successfully! Please sign in with your newly established password.');
        setMode('login');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setToken('');
        setHasUrlToken(false);
        // Clean URL to base path so page reloads do not retain the consumed token
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, '/');
        }
      } else {
        const backendCode = res.error?.code;
        if (backendCode === 'INVALID_OR_EXPIRED_INVITATION') {
          setErrorMsg(
            'The invitation token is invalid, expired, or has already been used. If you already completed activation, please sign in below. Otherwise, contact your institution administrator to request a new invitation.'
          );
        } else {
          setErrorMsg(res.error?.message || 'Activation failed. Please verify your token or contact your administrator.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Activation request failed.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your institutional email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset({ email: email.trim() });
      if (res.success) {
        setSuccessMsg(
          'If an active account exists with this email, password reset instructions have been dispatched. You can paste your reset token below.'
        );
      } else {
        setErrorMsg(res.error?.message || 'Password reset request failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset request failed.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!token.trim()) {
      setErrorMsg('Reset token is required.');
      return;
    }
    if (!isPasswordStrong) {
      setErrorMsg('Password must be at least 8 characters with uppercase, lowercase, number, and symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPassword({ token: token.trim(), newPassword });
      if (res.success) {
        setSuccessMsg('Password updated successfully! You may now sign in with your new password.');
        setMode('login');
        setPassword('');
      } else {
        setErrorMsg(res.error?.message || 'Password reset failed. The token may be invalid or expired.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-gradient)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              marginBottom: 12,
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
            }}
          >
            <Cpu size={30} />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            GenAI Laboratory Framework
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Personalized Laboratory Learning Environment
          </p>
        </div>

        {/* Card */}
        <Card
          title={
            mode === 'login'
              ? 'Institutional Authentication'
              : mode === 'activate'
              ? 'Set Password & Activate Account'
              : mode === 'forgot'
              ? 'Request Password Reset'
              : 'Configure New Password'
          }
        >
          {errorMsg && (
            <div style={{ marginBottom: 16 }}>
              <Alert type="danger" title="Notice">
                <div>
                  <p style={{ margin: 0 }}>{errorMsg}</p>
                  {mode === 'activate' && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          setMode('login');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--brand-primary)',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '0.8rem',
                          textDecoration: 'underline',
                          fontWeight: 600,
                        }}
                      >
                        Try Signing In
                      </button>
                      {hasUrlToken && (
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg(null);
                            setShowManualTokenInput(true);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-accent)',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '0.8rem',
                            textDecoration: 'underline',
                          }}
                        >
                          Enter Different Token
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Alert>
            </div>
          )}

          {successMsg && (
            <div style={{ marginBottom: 16 }}>
              <Alert type="success" title="Success">
                {successMsg}
              </Alert>
            </div>
          )}

          {!backendHealth.isLive && (
            <div style={{ marginBottom: 16 }}>
              <Alert type="warning" title="Backend Connection Notice">
                The application backend is currently offline. Please ensure the backend server is running on port 5000.
              </Alert>
            </div>
          )}

          {/* 1. LOGIN MODE */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit}>
              <FormField label="Institutional Email" required>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu or operator email"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                />
              </FormField>

              <FormField label="Password" required>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your secure password"
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  margin: '14px 0 18px',
                  fontSize: '0.8rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('activate');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand-primary)',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Activate invited account?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('forgot');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-accent)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <Button
                variant="primary"
                style={{ width: '100%', justifyContent: 'center' }}
                size="lg"
                type="submit"
                disabled={isSubmitting}
                icon={isSubmitting ? <Loader2 size={18} className="spin-icon" /> : <ArrowRight size={18} />}
              >
                {isSubmitting ? 'Verifying Credentials...' : 'Sign In to Workspace'}
              </Button>
            </form>
          )}

          {/* 2. ACTIVATE MODE */}
          {mode === 'activate' && (
            <form onSubmit={handleActivateSubmit}>
              {/* Token Display or Input */}
              {hasUrlToken && !showManualTokenInput ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Activation Token Verified
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Single-use invitation token detected from link.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualTokenInput(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-accent)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <FormField
                  label="Single-Use Invitation Token"
                  required
                  helperText="Received via invitation email or provided by your college administrator"
                >
                  <input
                    type="text"
                    className="form-input"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste your 64-character token"
                    required
                    disabled={isSubmitting}
                  />
                  {hasUrlToken && (
                    <div style={{ marginTop: 4, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setShowManualTokenInput(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Hide manual entry
                      </button>
                    </div>
                  )}
                </FormField>
              )}

              <FormField
                label="Establish Private Password"
                required
                helperText="Must satisfy all security requirements below"
              >
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Configure new secure password"
                    required
                    disabled={isSubmitting}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              {/* Password Requirements Real-Time Indicator */}
              <div
                style={{
                  fontSize: '0.75rem',
                  marginTop: -6,
                  marginBottom: 16,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                <span style={{ color: passwordCriteria.length ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.length ? '✓' : '•'} At least 8 characters
                </span>
                <span style={{ color: passwordCriteria.upper ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.upper ? '✓' : '•'} Uppercase letter (A-Z)
                </span>
                <span style={{ color: passwordCriteria.lower ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.lower ? '✓' : '•'} Lowercase letter (a-z)
                </span>
                <span style={{ color: passwordCriteria.number ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.number ? '✓' : '•'} Number (0-9)
                </span>
                <span style={{ color: passwordCriteria.special ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.special ? '✓' : '•'} Symbol (!@#$...)
                </span>
                {confirmPassword.length > 0 && (
                  <span style={{ color: passwordsMatch ? '#10b981' : '#ef4444' }}>
                    {passwordsMatch ? '✓ Passwords match' : '✕ Passwords mismatch'}
                  </span>
                )}
              </div>

              <FormField label="Confirm Password" required>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  disabled={isSubmitting}
                />
              </FormField>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <Button variant="outline" type="button" onClick={() => setMode('login')}>
                  Back to Sign In
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={isSubmitting || !isPasswordStrong || !passwordsMatch}
                >
                  {isSubmitting ? 'Activating Account...' : 'Set Password & Enter'}
                </Button>
              </div>
            </form>
          )}

          {/* 3. FORGOT PASSWORD MODE */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Enter your institutional email. If an active account exists, password reset instructions will be sent.
              </p>

              <FormField label="Registered Institutional Email" required>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@college.edu"
                  required
                  disabled={isSubmitting}
                />
              </FormField>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <Button variant="outline" type="button" onClick={() => setMode('login')}>
                  Back to Sign In
                </Button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="ghost" type="button" onClick={() => setMode('reset')}>
                    Have a Token?
                  </Button>
                  <Button variant="primary" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Request Reset'}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* 4. RESET PASSWORD MODE */}
          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit}>
              <FormField label="Password Reset Token" required>
                <input
                  type="text"
                  className="form-input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your 64-character reset token"
                  required
                  disabled={isSubmitting}
                />
              </FormField>

              <FormField label="New Password" required helperText="Min 8 chars with uppercase, lowercase, number, and symbol">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New secure password"
                  required
                  disabled={isSubmitting}
                />
              </FormField>

              {/* Password Requirements Real-Time Indicator */}
              <div
                style={{
                  fontSize: '0.75rem',
                  marginTop: -6,
                  marginBottom: 16,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                <span style={{ color: passwordCriteria.length ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.length ? '✓' : '•'} At least 8 characters
                </span>
                <span style={{ color: passwordCriteria.upper ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.upper ? '✓' : '•'} Uppercase letter (A-Z)
                </span>
                <span style={{ color: passwordCriteria.lower ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.lower ? '✓' : '•'} Lowercase letter (a-z)
                </span>
                <span style={{ color: passwordCriteria.number ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.number ? '✓' : '•'} Number (0-9)
                </span>
                <span style={{ color: passwordCriteria.special ? '#10b981' : 'var(--text-muted)' }}>
                  {passwordCriteria.special ? '✓' : '•'} Symbol (!@#$...)
                </span>
                {confirmPassword.length > 0 && (
                  <span style={{ color: passwordsMatch ? '#10b981' : '#ef4444' }}>
                    {passwordsMatch ? '✓ Passwords match' : '✕ Passwords mismatch'}
                  </span>
                )}
              </div>

              <FormField label="Confirm New Password" required>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  disabled={isSubmitting}
                />
              </FormField>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <Button variant="outline" type="button" onClick={() => setMode('login')}>
                  Back to Sign In
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={isSubmitting || !isPasswordStrong || !passwordsMatch}
                >
                  {isSubmitting ? 'Updating...' : 'Set New Password'}
                </Button>
              </div>
            </form>
          )}

          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.775rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <ShieldCheck size={14} style={{ color: 'var(--brand-primary)' }} />
              Role-Based Access Control:
            </div>
            <span>
              Access is strictly governed by institutional membership. Supported roles include Platform Administrator, College Administrator, Faculty, and Student.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
};
