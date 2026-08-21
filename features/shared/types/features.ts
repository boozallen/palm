// Go to @/libs/featureFlags to edit the list of features
import { features } from '@/libs/featureFlags';

// temporary until everyone is using the new featureFlags from libs
export { features };

export type Features = typeof features;
