import { SubTabsPage } from '@/components/SubTabs';

export default function Settings() {
  return (
    <SubTabsPage
      title="Settings"
      blurb="Configure your gym's account-level options."
      tabs={[
        {
          key: 'waivers',
          label: 'Waivers',
          body: 'Upload liability waivers, require new members to sign on signup, and track signatures.',
        },
        {
          key: 'forms',
          label: 'Forms',
          body: 'Custom intake forms, member surveys, and post-class feedback.',
        },
        {
          key: 'time-zone',
          label: 'Time Zone',
          body: 'Set the time zone used for your schedule, bookings, and exports.',
        },
      ]}
    />
  );
}
