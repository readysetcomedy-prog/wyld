import { useLocalSearchParams } from 'expo-router';
import { EmployeeProfileEditor } from '@/components/EmployeeProfileEditor';

export default function MemberGymEmployee() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  if (!gymId) return null;
  return <EmployeeProfileEditor gymId={gymId} />;
}
