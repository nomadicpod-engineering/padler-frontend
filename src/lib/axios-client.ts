import axios from 'axios';
import { getAuthSession } from './auth';

const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8080/padler-admin';

export const padlerApi = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' }
});

padlerApi.interceptors.request.use((config) => {
  const session = getAuthSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});
