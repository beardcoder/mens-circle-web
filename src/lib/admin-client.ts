/**
 * Client-side fetch helpers for the admin Svelte islands. Thin wrappers around
 * the /api/admin/* endpoints returning a uniform { success, message }.
 */
export interface AdminResponse {
  success: boolean;
  message: string;
  id?: string;
}

async function send(method: string, path: string, body?: unknown): Promise<AdminResponse> {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data: Partial<AdminResponse> = {};
    try {
      data = await res.json();
    } catch {
      // empty body
    }
    return {
      success: res.ok && data.success !== false,
      message: data.message ?? (res.ok ? 'OK' : 'Etwas ist schiefgelaufen.'),
      id: data.id,
    };
  } catch {
    return { success: false, message: 'Netzwerkfehler. Bitte erneut versuchen.' };
  }
}

export const adminApi = {
  post: (path: string, body?: unknown) => send('POST', path, body),
  put: (path: string, body?: unknown) => send('PUT', path, body),
  patch: (path: string, body?: unknown) => send('PATCH', path, body),
  del: (path: string) => send('DELETE', path),
};
