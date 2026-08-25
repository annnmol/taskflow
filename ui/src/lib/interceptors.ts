import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { getApiErrorMessage, unwrapApiResponse } from "./response";

export type HttpError = Error & { status?: number };

export const onRequest = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  config.headers.Accept = "application/json";
  return config;
};

export const onResponse = <T>(response: AxiosResponse<T | { data: T }>): T => unwrapApiResponse(response.data);

export const onResponseError = (error: AxiosError): Promise<never> => {
  const httpError = new Error(
    getApiErrorMessage(error.response?.data, "Something went wrong. Please try again."),
  ) as HttpError;
  httpError.status = error.response?.status;
  return Promise.reject(httpError);
};
