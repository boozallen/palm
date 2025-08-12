import Axios, { RawAxiosRequestConfig } from 'axios';

export const AxiosConfig: RawAxiosRequestConfig = {
  baseURL: '/api',
  timeout: 30_000,
  withCredentials: true,
  headers: {
    accept: 'application/json',
    'content-type': 'application/json; charset=utf-8',
  },
};

export const axios = Axios.create(AxiosConfig);
