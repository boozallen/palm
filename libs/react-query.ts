import {
  DefaultOptions,
  QueryClient,
  UseInfiniteQueryOptions,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
} from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { AxiosError, isAxiosError } from 'axios';

export const defaultOptions: DefaultOptions = {
  queries: {
    throwOnError: (error: any) => {
      if (isAxiosError(error) && error.response) {
        return error.response.status >= 500;
      } else if (error instanceof TRPCClientError) {
        return false;
      }
      return true;
    },
    refetchOnWindowFocus: false,
    retry: false,
  },
  mutations: {
    throwOnError: (error: any) => {
      if (isAxiosError(error) && error.response) {
        return error.response.status >= 500;
      } else if (error instanceof TRPCClientError) {
        return false;
      }
      return true;
    },
  },
};

export const queryClient = new QueryClient({ defaultOptions });

export type ExtractFnReturnType<FnType extends (...args: any) => any> = Awaited<PromiseLike<ReturnType<FnType>>>;

export type QueryConfig<QueryFnType extends (...args: any) => any> = Omit<
  UseQueryOptions<ExtractFnReturnType<QueryFnType>>,
  'queryKey' | 'queryFn'
>;

export type InfiniteQueryConfig<QueryFnType extends (...args: any) => any> = Omit<
  UseInfiniteQueryOptions<ExtractFnReturnType<QueryFnType>>,
  'queryKey' | 'queryFn' | 'getNextPageParam'
>;

export type MutationConfig<MutationFnType extends (...args: any) => any> = UseMutationOptions<
  ExtractFnReturnType<MutationFnType>,
  AxiosError,
  Parameters<MutationFnType>[0]
>;

export type MutationResult<MutationFnType extends (...args: any) => any> = UseMutationResult<
  ExtractFnReturnType<MutationFnType>,
  AxiosError,
  Parameters<MutationFnType>[0]
>;
