const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!rawBaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL is not defined. Please add it to your environment."
  );
}

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export const buildApiUrl = (input: string): string => {
  if (/^https?:\/\//i.test(input)) {
    return input;
  }
  const trimmedPath = input.replace(/^\/+/, "");
  return `${API_BASE_URL}/${trimmedPath}`;
};

export type ApiFetchOptions = RequestInit;

export const apiFetch = (input: string, init?: ApiFetchOptions) => {
  return fetch(buildApiUrl(input), init);
};

export const apiFetchJson = async <T>(
  input: string,
  init?: ApiFetchOptions
): Promise<T> => {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(
      `API request failed with status ${response.status}: ${errorBody}`
    );
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return (await response.json()) as T;
};
