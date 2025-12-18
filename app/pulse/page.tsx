import { getThreats } from '@/app/threats/actions';
import { PulsePageClient } from './client';

// Prevent static prerendering - requires database connection
export const dynamic = 'force-dynamic';

export default async function PulsePage() {
  // Fetch initial threats server-side
  const { threats } = await getThreats(50);

  return <PulsePageClient initialThreats={threats} />;
}
