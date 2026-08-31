const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://127.0.0.1:8000';
    }
    return `http://${host}:8000`;
  }
  return 'http://127.0.0.1:8000';
};

export const environment = {
  production: false,
  get apiUrl(): string {
    return getApiUrl();
  }
};
