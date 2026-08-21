declare module '@/libs/featureFlags' {
  export const features: Record<string,string>;
  export const isFeatureOn: (feature: string) => boolean;
  export const __resetFeatures: () => void;
  export const __enableFeature: (feature: string) => void;
  export const __disableFeature: (feature: string) => void;
}
