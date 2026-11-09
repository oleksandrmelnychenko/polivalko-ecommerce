export function GoogleAnalytics() {
  // Bearer URLs are used by orders and recovery. A global third-party script
  // can read them even with automatic page views disabled. Keep collection
  // off until it goes through a first-party, allowlisted event boundary.
  return null;
}
