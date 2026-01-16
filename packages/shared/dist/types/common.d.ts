export type UUID = string;
export interface Timestamp {
    createdAt: Date;
    updatedAt: Date;
}
export interface PaginationParams {
    limit: number;
    offset: number;
}
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
}
export type Result<T, E = Error> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export declare function ok<T>(value: T): Result<T, never>;
export declare function err<E>(error: E): Result<never, E>;
//# sourceMappingURL=common.d.ts.map