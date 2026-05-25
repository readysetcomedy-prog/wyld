// Admin Reports & Analytics — landing placeholder for the platform-wide
// reporting surface. Eventually this is where MRR / ARR, gym revenue
// roll-ups, location-level revenue + expenses, retention cohorts, and
// payout exports will live. Stubbed so the sidebar tab has a real page
// behind it.

import { TabPlaceholder } from '@/components/TabPlaceholder';

export default function AdminReports() {
  return (
    <TabPlaceholder
      title="Reports & Analytics"
      body={
        "Platform-wide reporting goes here:\n\n" +
        "• MRR / ARR across every paying gym\n" +
        "• Per-gym revenue, expenses, and net (rolling up Bear-Gym-Centralia vs Bear-Gym-Olympia separately so each location is its own line)\n" +
        "• Member + employee counts over time, with churn cohorts\n" +
        "• Setup-fee bookings vs recurring\n" +
        "• Payout / tax export bundles\n\n" +
        "Will share components with the gym-side Analytics tab so the rollups stay consistent."
      }
    />
  );
}
