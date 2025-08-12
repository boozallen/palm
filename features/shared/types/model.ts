export type Model = {
  id: string;
  aiProviderId: string;
  name: string;
  externalId: string;
  costPerInputToken: number;
  costPerOutputToken: number;
};

export type AvailableModel = {
  providerLabel: string;
} & Model;
