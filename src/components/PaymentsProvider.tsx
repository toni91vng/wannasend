import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/supabase';

export function PaymentsProvider({ children }: { children: React.ReactElement | React.ReactElement[] }) {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.wannasend" urlScheme="wannasend">
      {children}
    </StripeProvider>
  );
}
