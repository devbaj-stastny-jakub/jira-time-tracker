/**
 * Error carrying the HTTP status of a failed API call so the UI can tell an
 * auth failure (the token is wrong — fix it in onboarding) apart from a
 * transient failure (network / 5xx — just retry).
 */
export class ApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }

    /** 401/403 — the credentials were rejected. */
    get isAuth(): boolean {
        return this.status === 401 || this.status === 403;
    }
}
