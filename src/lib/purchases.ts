import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

export const ENTITLEMENT_ID = 'fit AI Pro';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? '';

export function configurePurchases() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey: API_KEY });
}

/** Call after Supabase login so RC links purchases to your user. */
export async function identifyPurchasesUser(userId: string) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('[RC] logIn failed:', e);
  }
}

/** Call on logout so the next user starts anonymous. */
export async function resetPurchasesUser() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('[RC] logOut failed:', e);
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn('[RC] getCustomerInfo failed:', e);
    return null;
  }
}

export function isEntitled(customerInfo: CustomerInfo | null): boolean {
  return !!customerInfo?.entitlements.active[ENTITLEMENT_ID];
}
