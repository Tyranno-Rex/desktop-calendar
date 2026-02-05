import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Ticket, CreditCard, Check, Sparkles, Cloud, Calendar } from 'lucide-react';
import './PremiumModal.css';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCouponSubmit: (code: string) => Promise<{ success: boolean; error?: string }>;
  onStripeCheckout: () => Promise<{ success: boolean; checkoutUrl?: string; error?: string }>;
}

type TabType = 'coupon' | 'stripe';

export function PremiumModal({ isOpen, onClose, onCouponSubmit, onStripeCheckout }: PremiumModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('stripe');
  const [couponCode, setCouponCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCouponSubmit = async () => {
    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await onCouponSubmit(couponCode.trim().toUpperCase());
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(result.error || 'Invalid coupon code');
      }
    } catch {
      setError('Failed to validate coupon');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStripeCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await onStripeCheckout();
      if (result.success && result.checkoutUrl) {
        // 외부 브라우저에서 Stripe Checkout 페이지 열기
        window.open(result.checkoutUrl, '_blank');
        onClose();
      } else {
        setError(result.error || 'Failed to start checkout');
      }
    } catch {
      setError('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setCouponCode('');
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  const features = [
    { icon: Calendar, text: 'Google Calendar Sync' },
    { icon: Cloud, text: 'Cloud Backup & Sync' },
    { icon: Sparkles, text: 'Priority Support' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="premium-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="premium-modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="premium-modal-header">
              <h2 className="premium-modal-title">Upgrade to Premium</h2>
              <button className="premium-modal-close" onClick={handleClose} disabled={isLoading}>
                <X size={16} />
              </button>
            </div>

            {/* Features */}
            <div className="premium-features">
              {features.map((feature, index) => (
                <div key={index} className="premium-feature">
                  <feature.icon size={16} />
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="premium-tabs">
              <button
                className={`premium-tab ${activeTab === 'stripe' ? 'active' : ''}`}
                onClick={() => setActiveTab('stripe')}
                disabled={isLoading}
              >
                <CreditCard size={16} />
                Card Payment
              </button>
              <button
                className={`premium-tab ${activeTab === 'coupon' ? 'active' : ''}`}
                onClick={() => setActiveTab('coupon')}
                disabled={isLoading}
              >
                <Ticket size={16} />
                Coupon Code
              </button>
            </div>

            {/* Content */}
            <div className="premium-content">
              {success ? (
                <motion.div
                  className="premium-success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="success-icon">
                    <Check size={32} />
                  </div>
                  <h3>Welcome to Premium!</h3>
                  <p>Your account has been upgraded successfully.</p>
                </motion.div>
              ) : activeTab === 'stripe' ? (
                <div className="premium-stripe">
                  <div className="stripe-pricing">
                    <div className="price-option">
                      <div className="price-label">Monthly</div>
                      <div className="price-amount">
                        <span className="currency">$</span>
                        <span className="value">4.99</span>
                        <span className="period">/mo</span>
                      </div>
                    </div>
                    <div className="price-divider">or</div>
                    <div className="price-option recommended">
                      <div className="price-badge">Save 20%</div>
                      <div className="price-label">Yearly</div>
                      <div className="price-amount">
                        <span className="currency">$</span>
                        <span className="value">47.99</span>
                        <span className="period">/yr</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="premium-checkout-btn"
                    onClick={handleStripeCheckout}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="loading-spinner" />
                    ) : (
                      <>
                        <CreditCard size={18} />
                        Continue to Checkout
                      </>
                    )}
                  </button>
                  <p className="stripe-note">
                    Secure payment powered by Stripe
                  </p>
                </div>
              ) : (
                <div className="premium-coupon">
                  <p className="coupon-description">
                    Enter your coupon code to activate Premium
                  </p>
                  <div className="coupon-input-group">
                    <input
                      type="text"
                      className="coupon-input"
                      placeholder="XXXX-XXXX-XXXX"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleCouponSubmit()}
                      disabled={isLoading}
                      maxLength={20}
                    />
                    <button
                      className="coupon-submit-btn"
                      onClick={handleCouponSubmit}
                      disabled={isLoading || !couponCode.trim()}
                    >
                      {isLoading ? (
                        <span className="loading-spinner" />
                      ) : (
                        'Apply'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <motion.div
                  className="premium-error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
