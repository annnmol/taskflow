export type ApiSuccessResponse<T> = {
  data: T;
  message?: string;
  status?: number;
};

export const unwrapApiResponse = <T>(payload: T | ApiSuccessResponse<T>): T => {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return payload.data;
  }

  return payload;
};

export const getApiErrorMessage = (payload: unknown, fallback: string): string => {
  const error = payload && typeof payload === "object" && "error" in payload
    ? payload.error
    : payload;

  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  if (error && typeof error === "object") return JSON.stringify(error);

  return fallback;
};
