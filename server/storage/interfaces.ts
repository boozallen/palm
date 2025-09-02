export interface DataStore {
  hset(key: string, values: Record<string, any>): Promise<void>;
  hgetall(key: string): Promise<Record<string, any>>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setex(key: string, seconds: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
}
