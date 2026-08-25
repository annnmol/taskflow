import axios, { type AxiosRequestConfig } from "axios";
import { onRequest, onResponse, onResponseError } from "./interceptors";

const baseURL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

const client = axios.create({ baseURL: `${baseURL}/api` });

client.interceptors.request.use(onRequest);
client.interceptors.response.use(onResponse, onResponseError);

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) => client.get<T, T>(url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.post<T, T>(url, data, config),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.put<T, T>(url, data, config),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => client.patch<T, T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) => client.delete<T, T>(url, config),
};

export const uploadToUrl = (url: string, file: File) =>
  axios.put(url, file, { headers: { "Content-Type": file.type || "text/csv" } });
