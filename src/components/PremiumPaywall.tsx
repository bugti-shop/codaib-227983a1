import { useState, useMemo, useEffect } from 'react';
import appLogo from '@/assets/app-logo.webp';
import { useTranslation } from 'react-i18next';
import { Crown, Unlock, Bell, Gift, Check, X, Lock } from 'lucide-react';
import { useSubscription, ProductType } from '@/contexts/SubscriptionContext';
import { Capacitor } from '@capacitor/core';
import { PurchasesPackage, PACKAGE_TYPE } from '@revenuecat/purchases-capacitor';
import { triggerTripleHeavyHaptic } from '@/utils/haptics';
import { supabase } from '@/lib/supabase';
import { getLocalLifetimeMax } from '@/utils/lifetimeCountersCloud';

import { m as motion, AnimatePresence } from 'framer-motion';

// Fallback prices (USD) used only when RevenueCat offerings aren't available (e.g. web)
const FALLBACK_PLANS: { id: ProductType; labelKey: string; price: string; badgeKey: string | null; hasTrial: boolean }[] = [
  { id: 'weekly', labelKey: 'onboarding.paywall.weekly', price: '$1.99/wk', badgeKey: null, hasTrial: false },
  { id: 'monthly', labelKey: 'onboarding.paywall.monthly', price: '$3.99/mo', badgeKey: 'onboarding.paywall.popular', hasTrial: true },
  { id: 'yearly', labelKey: 'onboarding.paywall.yearly', price: '$39.99/yearly', badgeKey: 'onboarding.paywall.bestValue', hasTrial: true },
];

const PERIOD_LABELS: Record<string, string> = {
  weekly: '/wk',
  monthly: '/mo',
  yearly: '/yr',
};

// Shared hook for plans and purchase logic
function usePaywallLogic() {
  const { t } = useTranslation();
  const { showPaywall, closePaywall, purchase, offerings, restorePurchases, isNewFreeUser, isPro, paywallFeature } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<ProductType>('monthly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [adminError, setAdminError] = useState('');

  const PLANS = useMemo(() => {
    const allPackages: PurchasesPackage[] = [];
    if (offerings?.current?.availablePackages) {
      allPackages.push(...offerings.current.availablePackages);
    }
    if (offerings?.all) {
      Object.values(offerings.all).forEach((offering: any) => {
        offering?.availablePackages?.forEach((p: PurchasesPackage) => {
          if (!allPackages.find(e => e.identifier === p.identifier)) {
            allPackages.push(p);
          }
        });
      });
    }

    const typeMap: Record<ProductType, PACKAGE_TYPE> = {
      weekly: PACKAGE_TYPE.WEEKLY,
      monthly: PACKAGE_TYPE.MONTHLY,
      yearly: PACKAGE_TYPE.ANNUAL,
    };

    const findPrice = (type: ProductType): string | null => {
      const pkg = allPackages.find(p => p.packageType === typeMap[type]);
      const product = pkg?.product;
      if (product?.priceString) {
        return `${product.priceString}${PERIOD_LABELS[type] || ''}`;
      }
      return null;
    };

    const findTrialPrice = (type: ProductType): string | null => {
      const pkg = allPackages.find(p => p.packageType === typeMap[type]);
      const product = pkg?.product;
      if (product?.introPrice) {
        return product.introPrice.priceString || null;
      }
      return null;
    };

    return FALLBACK_PLANS.map(plan => ({
      ...plan,
      price: findPrice(plan.id) || plan.price,
      trialPriceString: findTrialPrice(plan.id),
    }));
  }, [offerings]);

  const currentPlan = PLANS.find(p => p.id === selectedPlan)!;

  // Check if this device has already used a free trial
  const hasUsedTrial = useMemo(() => {
    try {
      return localStorage.getItem('flowist_trial_used') === 'true';
    } catch { return false; }
  }, []);

  const handlePurchase = async () => {
    setIsPurchasing(true);
    setAdminError('');
    try {
      if (Capacitor.isNativePlatform()) {
        const success = await purchase(selectedPlan);
        if (success) {
          // Mark trial as used on this device
          try { localStorage.setItem('flowist_trial_used', 'true'); } catch {}
          closePaywall();
        } else {
          setAdminError(t('onboarding.paywall.purchaseCancelled'));
          setTimeout(() => setAdminError(''), 4000);
        }
      } else {
        // Web: use Supabase edge function for Stripe checkout (works with or without auth)
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { planType: selectedPlan },
          headers,
        });

        if (error || !data?.url) {
          console.error('Checkout error:', error || data?.error);
          setAdminError(data?.error || 'Failed to create checkout session');
          setTimeout(() => setAdminError(''), 5000);
          return;
        }

        // Do NOT mark trial as used here — only after successful payment
        // Redirect to Stripe checkout — do NOT close paywall here
        // If user presses back without paying, paywall must remain visible
        window.location.href = data.url;
      }
    } catch (error: any) {
      if (error.code !== 'PURCHASE_CANCELLED' && !error.userCancelled) {
        console.error('Purchase failed:', error);
        setAdminError(`Purchase failed: ${error.message || 'Please try again.'}`);
        setTimeout(() => setAdminError(''), 5000);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const [restoreEmail, setRestoreEmail] = useState('');
  const [showRestoreEmail, setShowRestoreEmail] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const success = await restorePurchases();
        if (success) {
          closePaywall();
        } else {
          setAdminError(t('onboarding.paywall.noActivePurchases'));
          setTimeout(() => setAdminError(''), 4000);
        }
      } else {
        // Web: check Stripe subscription status
        const { data: { session } } = await supabase.auth.getSession();
        
        // If no auth session, ask for email
        if (!session?.access_token && !restoreEmail.trim()) {
          setShowRestoreEmail(true);
          setAdminError('Enter the email you used to subscribe');
          setTimeout(() => setAdminError(''), 5000);
          setIsRestoring(false);
          return;
        }

        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const { data, error } = await supabase.functions.invoke('check-subscription', {
          body: restoreEmail.trim() ? { email: restoreEmail.trim() } : undefined,
          headers,
        });

        if (data?.subscribed) {
          // Mark as subscribed locally
          try { localStorage.setItem('flowist_stripe_subscribed', 'true'); } catch {}
          try { localStorage.setItem('flowist_trial_used', 'true'); } catch {}
          if (data.plan_type) {
            (window as any).__stripePlanType = data.plan_type;
          }
          window.dispatchEvent(new Event('stripeSubscriptionRestored'));
          closePaywall();
        } else {
          setAdminError(t('onboarding.paywall.noActivePurchases'));
          setTimeout(() => setAdminError(''), 4000);
        }
      }
    } catch (error: any) {
      console.error('Restore failed:', error);
      setAdminError(error?.message || 'Restore failed.');
      setTimeout(() => setAdminError(''), 4000);
    } finally {
      setIsRestoring(false);
    }
  };

  // Soft-limit info derived from paywallFeature like "soft_limit_notes" / "soft_limit_tasks"
  const SOFT_LIMIT_COUNTS: Record<string, number> = {
    notes: 2, tasks: 1, noteFolders: 1, taskFolders: 1, taskSections: 1,
  };
  const softLimitKind = paywallFeature?.startsWith('soft_limit_') ? paywallFeature.replace('soft_limit_', '') : null;
  const softLimitMessage = softLimitKind && SOFT_LIMIT_COUNTS[softLimitKind] != null
    ? t(`onboarding.paywall.softLimit.${softLimitKind}`, { count: SOFT_LIMIT_COUNTS[softLimitKind] })
    : null;

  // Lifetime usage counts for the always-on usage banner.
  const [usageCounts] = useState(() => ({
    notes: getLocalLifetimeMax('notes'),
    tasks: getLocalLifetimeMax('tasks'),
  }));
  const usageBanner = (usageCounts.notes > 0 || usageCounts.tasks > 0)
    ? t('paywall.usageBanner', "You've created {{notes}} notes & {{tasks}} tasks. Unlock unlimited.", {
        notes: usageCounts.notes,
        tasks: usageCounts.tasks,
      })
    : null;
  const trialExpiredMessage = paywallFeature === 'trial_expired'
    ? t('paywall.trialExpired', 'Your 2-day free trial has ended. Unlock unlimited to keep creating.')
    : null;

  return {
    t, showPaywall, closePaywall, isNewFreeUser, isPro, selectedPlan, setSelectedPlan, isPurchasing, isRestoring,
    adminError,
    PLANS, currentPlan, handlePurchase, handleRestore, hasUsedTrial,
    restoreEmail, setRestoreEmail, showRestoreEmail, softLimitMessage,
    usageBanner, trialExpiredMessage,
  };
}

// Footer: Restore + legal links (shared across variants)
function PaywallFooter({ logic }: { logic: ReturnType<typeof usePaywallLogic> }) {
  const { t, isRestoring, handleRestore, adminError, restoreEmail, setRestoreEmail, showRestoreEmail } = logic;
  return (
    <div className="flex flex-col items-center gap-2 mt-3">
      {adminError && <p className="text-xs" style={{ color: 'hsl(0 84.2% 60.2%)' }}>{adminError}</p>}
      {showRestoreEmail && (
        <div className="flex items-center gap-2 mt-1">
          <input type="email" value={restoreEmail} onChange={(e) => setRestoreEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRestore()}
            placeholder="Enter subscription email" autoComplete="email"
            className="h-8 w-48 rounded-md px-2 text-sm" style={{ border: '1px solid hsl(0 0% 89.8%)', background: 'hsl(0 0% 100%)', color: 'hsl(0 0% 3.9%)' }} />
          <button onClick={handleRestore} disabled={isRestoring} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            {isRestoring ? '...' : 'Check'}
          </button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button onClick={handleRestore} disabled={isRestoring} className="text-xs underline disabled:opacity-50" style={{ color: 'hsl(0 0% 45.1%)' }}>
          {isRestoring ? t('onboarding.paywall.restoring') : t('onboarding.paywall.restorePurchase')}
        </button>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <a
          href="https://www.flowist.me/terms-and-conditions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] underline"
          style={{ color: 'hsl(0 0% 45.1%)' }}
        >
          {t('paywall.terms', 'Terms & Conditions')}
        </a>
        <span className="text-[11px]" style={{ color: 'hsl(0 0% 45.1%)' }}>•</span>
        <a
          href="https://www.flowist.me/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] underline"
          style={{ color: 'hsl(0 0% 45.1%)' }}
        >
          {t('paywall.privacy', 'Privacy Policy')}
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   VARIANT A — Timeline Feature List (Original)
   ═══════════════════════════════════════════ */
const COMPARISON_FEATURES: { label: string; free: string | 'x' | 'check'; pro: string | 'check' }[] = [
  { label: 'Notes', free: '2', pro: 'Unlimited' },
  { label: 'Tasks', free: '1', pro: 'Unlimited' },
  { label: 'Sections', free: '2', pro: 'Unlimited' },
  { label: 'Folders', free: '2', pro: 'Unlimited' },
  { label: 'Reminders', free: 'Limited', pro: 'Unlimited' },
  { label: 'View Layouts', free: '1', pro: 'All' },
  { label: 'Dark Mode', free: 'x', pro: 'check' },
  { label: 'Customize Notes Visibility', free: 'x', pro: 'check' },
  { label: 'Deadlines', free: 'x', pro: 'check' },
  { label: 'Widgets', free: 'x', pro: 'check' },
  { label: 'App Lock', free: 'x', pro: 'check' },
  { label: 'Customization', free: 'x', pro: 'check' },
];

const PRO_BLUE = '#3c78f0';

function FeatureCell({ value }: { value: string }) {
  if (value === 'check') {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto" style={{ background: PRO_BLUE }}>
        <Check size={14} strokeWidth={3} color="#fff" />
      </div>
    );
  }
  if (value === 'x') {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto" style={{ background: 'hsl(0 0% 92%)' }}>
        <Lock size={12} strokeWidth={2.5} color="hsl(0 0% 45%)" />
      </div>
    );
  }
  return <span className="text-sm font-semibold" style={{ color: 'hsl(0 0% 25%)' }}>{value}</span>;
}

function FeaturesComparison() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-sm rounded-2xl overflow-hidden relative"
      style={{ border: '1px solid hsl(0 0% 89.8%)', background: 'hsl(0 0% 100%)' }}
    >
      {/* Continuous Pro column highlight (spans header + all rows) */}
      <div
        aria-hidden
        className="absolute top-0 bottom-0 pointer-events-none z-10"
        style={{ right: 0, width: `${(1 / 3.8) * 100}%`, background: `${PRO_BLUE}14` }}
      />
      <div className="relative z-20 grid grid-cols-[1.8fr_1fr_1fr] items-center px-4 py-2.5">
        <span className="text-[13px] font-bold" style={{ color: 'hsl(0 0% 3.9%)', fontFamily: "'Nunito', sans-serif" }}>Features</span>
        <span className="text-center text-[13px] font-bold" style={{ color: 'hsl(0 0% 45%)' }}>Free</span>
        <span className="text-center text-[13px] font-bold" style={{ color: PRO_BLUE }}>Pro</span>
      </div>
      {COMPARISON_FEATURES.map((row, i) => (
        <div
          key={row.label}
          className="relative z-20 grid grid-cols-[1.8fr_1fr_1fr] items-center px-4 py-2.5"
          style={{ borderTop: i === 0 ? 'none' : '1px solid hsl(0 0% 93%)' }}
        >
          <span className="text-[13px] whitespace-nowrap" style={{ color: 'hsl(0 0% 3.9%)', fontFamily: "'Nunito Sans', sans-serif" }}>{row.label}</span>
          <div className="text-center"><FeatureCell value={row.free} /></div>
          <div className="text-center"><FeatureCell value={row.pro} /></div>
        </div>
      ))}
    </motion.div>
  );
}

function PaywallVariantA({ logic }: { logic: ReturnType<typeof usePaywallLogic> }) {
  const { t, selectedPlan, setSelectedPlan, isPurchasing, PLANS, currentPlan, handlePurchase, hasUsedTrial, isNewFreeUser, isPro, closePaywall, softLimitMessage, usageBanner, trialExpiredMessage } = logic;
  const canDismiss = true;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ paddingTop: 'calc(var(--safe-top, 0px) + 12px)', paddingBottom: 'max(var(--safe-bottom, 0px), 12px)', background: 'hsl(0 0% 100%)', color: 'hsl(0 0% 3.9%)', fontFamily: "'Nunito Sans', sans-serif" }}>
      {canDismiss && (
        <button
          onClick={closePaywall}
          aria-label="Close"
          className="absolute right-3 z-10 h-9 w-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ top: 'calc(var(--safe-top, 0px) + 12px)', background: 'hsl(0 0% 96.1%)', color: 'hsl(0 0% 3.9%)' }}
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      )}
      <div className="px-4 py-2" />
      <div className="flex-1 overflow-y-auto px-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2.5 mb-6">
          <img src={appLogo} alt="Flowist" className="h-9 w-9 flex-shrink-0" />
          <h1 className="text-[22px] font-black tracking-tight" style={{ color: 'hsl(0 0% 3.9%)', fontFamily: "'Nunito', sans-serif" }}>
            {t('onboarding.paywall.upgradeTitle')}
          </h1>
        </motion.div>

        {softLimitMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-6 max-w-sm rounded-xl px-4 py-3 text-center text-sm font-semibold"
            style={{
              background: 'hsl(var(--primary) / 0.08)',
              color: 'hsl(var(--primary))',
              border: '1px solid hsl(var(--primary) / 0.2)',
              fontFamily: "'Nunito Sans', sans-serif",
            }}
          >
            {softLimitMessage}
          </motion.div>
        )}

        {!softLimitMessage && trialExpiredMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-3 max-w-sm rounded-xl px-4 py-3 text-center text-sm font-semibold"
            style={{
              background: 'hsl(var(--primary) / 0.08)',
              color: 'hsl(var(--primary))',
              border: '1px solid hsl(var(--primary) / 0.2)',
              fontFamily: "'Nunito Sans', sans-serif",
            }}
          >
            {trialExpiredMessage}
          </motion.div>
        )}

        {usageBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-6 max-w-sm rounded-xl px-4 py-2.5 text-center text-[13px] font-medium"
            style={{
              background: 'hsl(0 0% 96.1%)',
              color: 'hsl(0 0% 25%)',
              fontFamily: "'Nunito Sans', sans-serif",
            }}
          >
            {usageBanner}
          </motion.div>
        )}

        {/* Free vs Pro features comparison */}
        <FeaturesComparison />

        {!hasUsedTrial && (selectedPlan === 'monthly' || selectedPlan === 'yearly') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 mx-auto max-w-sm flex items-center gap-2 justify-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#3c78f0' }}>
              <Gift size={14} strokeWidth={2.5} color="#fff" />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'hsl(0 0% 3.9%)', fontFamily: "'Nunito', sans-serif" }}>
              {t('onboarding.paywall.freeTrial14')}
            </p>
          </motion.div>
        )}

        {/* Plan cards */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex gap-3 w-full max-w-sm">
            {PLANS.map((plan) => (
              <button key={plan.id} onClick={() => { triggerTripleHeavyHaptic(); setSelectedPlan(plan.id); }}
                className={`flex-1 relative rounded-xl p-3 text-center border-2 transition-all ${selectedPlan === plan.id ? 'border-primary' : ''}`}
                style={{ 
                  background: selectedPlan === plan.id ? 'hsl(0 0% 96.1%)' : 'hsl(0 0% 100%)',
                  borderColor: selectedPlan === plan.id ? undefined : 'hsl(0 0% 89.8%)'
                }}>
                {plan.badgeKey && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full whitespace-nowrap">{t(plan.badgeKey)}</span>}
                <p className="font-bold text-sm" style={{ color: 'hsl(0 0% 3.9%)' }}>{t(plan.labelKey)}</p>
                <p className="text-xs mt-1" style={{ color: 'hsl(0 0% 45.1%)' }}>{plan.price}</p>
                {selectedPlan === plan.id && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center"><Check size={10} className="text-primary-foreground" /></div>
                )}
              </button>
            ))}
          </div>

          {!hasUsedTrial && currentPlan.hasTrial && (
            <p className="font-normal text-sm text-center mt-4" style={{ color: 'hsl(0 0% 45.1%)' }}>{t('onboarding.paywall.freeTrialThen', { price: currentPlan.price })}</p>
          )}

          <button onClick={() => { triggerTripleHeavyHaptic(); handlePurchase(); }} disabled={isPurchasing} className="w-80 mt-2 btn-duo disabled:opacity-50">
            {isPurchasing ? t('onboarding.paywall.processing') : (!hasUsedTrial && currentPlan.hasTrial) ? t('onboarding.paywall.tryForFree', { price: currentPlan.trialPriceString || '$0.00' }) : t('onboarding.paywall.continueWith', { price: currentPlan.price })}
          </button>

          <p className="text-[13px] font-medium text-center mt-3" style={{ color: 'hsl(0 0% 45.1%)' }}>
            {t('onboarding.noCommitment', 'No Commitment, cancel anytime')}
          </p>

          <p
            className="text-[11px] leading-snug text-center mt-2 px-4 max-w-sm"
            style={{ color: 'hsl(0 0% 55%)', fontFamily: "'Nunito Sans', sans-serif" }}
          >
            {(!hasUsedTrial && currentPlan.hasTrial)
              ? t(
                  'paywall.trialDisclosure',
                  '3-day free trial, then {{price}} auto-renews until cancelled. Cancel anytime in your App Store / Google Play account settings at least 24 hours before the trial ends to avoid charges.',
                  { price: currentPlan.price }
                )
              : t(
                  'paywall.renewDisclosure',
                  'Subscription renews automatically at {{price}} until cancelled. Manage or cancel anytime in your App Store / Google Play account settings.',
                  { price: currentPlan.price }
                )}
          </p>

          <PaywallFooter logic={logic} />

        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════ */
export const PremiumPaywall = () => {
  const logic = usePaywallLogic();

  if (!logic.showPaywall) return null;

  return <PaywallVariantA logic={logic} />;
};
