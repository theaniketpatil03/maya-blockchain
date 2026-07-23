const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return response.json();
}

export function short(value?: string | number, size = 14): string {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (text.length <= size) return text;
  return `${text.slice(0, size)}...`;
}

export function formatTime(value?: string | number): string {
  if (!value) return '';
  const timestamp = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(timestamp)) return String(value);
  return new Date(timestamp).toLocaleString();
}
