import { useState, useCallback, useEffect } from 'react';
import type { SubscriptionState } from '../types';
import { useAuth } from '../contexts/AuthContext';

// API 서버 URL
const API_BASE_URL = 'http://localhost:3001';

interface UseSubscriptionReturn extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  upgradeToPremium: () => Promise<{ success: boolean; checkoutUrl?: string; error?: string }>;
  redeemCoupon: (code: string) => Promise<{ success: boolean; error?: string }>;
  cancelSubscription: () => Promise<{ success: boolean; error?: string }>;
  isPremium: boolean;
}

export function useSubscription(): UseSubscriptionReturn {
  const { sessionToken, isAuthenticated, user, refreshUser } = useAuth();
  const [tier, setTier] = useState<'free' | 'premium'>(user?.subscriptionTier || 'free');
  const [expiresAt, setExpiresAt] = useState<string | null>(user?.subscriptionExpiresAt || null);
  const [isCanceled, setIsCanceled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 유저 정보가 변경되면 구독 상태도 업데이트
  useEffect(() => {
    if (user) {
      setTier(user.subscriptionTier);
      setExpiresAt(user.subscriptionExpiresAt);
    } else {
      setTier('free');
      setExpiresAt(null);
    }
  }, [user]);

  // Premium 여부
  const isPremium = tier === 'premium' && (!expiresAt || new Date(expiresAt) > new Date());

  // 구독 상태 확인
  const checkSubscription = useCallback(async () => {
    if (!isAuthenticated || !sessionToken) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/status`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTier(data.tier);
        setExpiresAt(data.expires_at);
        setIsCanceled(data.canceled_at !== null);
      }
    } catch (error) {
      console.error('[useSubscription] Check subscription error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, sessionToken]);

  // Premium으로 업그레이드 (Stripe Checkout URL 반환)
  const upgradeToPremium = useCallback(async (): Promise<{
    success: boolean;
    checkoutUrl?: string;
    error?: string;
  }> => {
    if (!isAuthenticated || !sessionToken) {
      return { success: false, error: 'Not authenticated' };
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Checkout failed' };
      }

      const data = await response.json();
      return { success: true, checkoutUrl: data.checkoutUrl };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Checkout failed';
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, sessionToken]);

  // 쿠폰 사용
  const redeemCoupon = useCallback(async (code: string): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!isAuthenticated || !sessionToken) {
      return { success: false, error: 'Please sign in to use a coupon' };
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/coupon/redeem`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to redeem coupon' };
      }

      // 유저 정보 새로고침
      await refreshUser();
      setTier('premium');
      if (data.subscription?.expires_at) {
        setExpiresAt(data.subscription.expires_at);
      }
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to redeem coupon';
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, sessionToken, refreshUser]);

  // 구독 취소
  const cancelSubscription = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!isAuthenticated || !sessionToken) {
      return { success: false, error: 'Not authenticated' };
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Cancel failed' };
      }

      // 유저 정보 새로고침
      await refreshUser();
      setIsCanceled(true);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Cancel failed';
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, sessionToken, refreshUser]);

  return {
    tier,
    expiresAt,
    isCanceled,
    isLoading,
    isPremium,
    checkSubscription,
    upgradeToPremium,
    redeemCoupon,
    cancelSubscription,
  };
}
