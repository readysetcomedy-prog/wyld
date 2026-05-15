import { SubTabsPage } from '@/components/SubTabs';

export default function Employees() {
  return (
    <SubTabsPage
      title="Employees"
      blurb="Roles, schedules, payroll, and HR for your team — all in one place."
      tabs={[
        {
          key: 'time-cards',
          label: 'Time Cards',
          body: 'Clock-ins and clock-outs, total hours per pay period, and exports for payroll.',
        },
        {
          key: 'scheduling',
          label: 'Scheduling',
          body: 'Build shifts, publish a schedule, and let your team request changes.',
        },
        {
          key: 'hr',
          label: 'HR',
          body: 'Onboarding, employment documents, certifications, and time-off tracking.',
        },
        {
          key: 'payroll',
          label: 'Payroll',
          body: 'Run payroll from time cards, manage rates and deductions, and export tax forms.',
        },
      ]}
    />
  );
}
