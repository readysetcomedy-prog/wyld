import { useLocalSearchParams } from 'expo-router';
import { MemberWaiversList } from '@/components/MemberWaiversList';

export default function GymWaivers() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  return <MemberWaiversList gymIdFilter={gymId} />;
}
