/* eslint-disable @typescript-eslint/no-explicit-any */
let sequence = 0;

/** Minimal in-memory repository: plain where (and In) filters, save with ids, delete by where. */
export function memoryTable<T extends Record<string, any>>() {
    const rows: T[] = [];
    const matches = (row: any, where: any = {}) => Object.entries(where).every(([key, value]: [string, any]) =>
        value && typeof value === 'object' && value._type === 'in' ? value._value.includes(row[key]) : row[key] === value);
    return {
        rows,
        find: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where))),
        findOne: jest.fn(async (options: any = {}) => rows.find((row) => matches(row, options.where)) ?? null),
        count: jest.fn(async (options: any = {}) => rows.filter((row) => matches(row, options.where)).length),
        save: jest.fn(async (value: any) => {
            const list = Array.isArray(value) ? value : [value];
            const saved = list.map((item) => {
                const existing = item.id ? rows.find((row) => row.id === item.id) : undefined;
                if (existing) { Object.assign(existing, item); return existing; }
                const row = { id: `id-${++sequence}`, ...item };
                rows.push(row);
                return row;
            });
            return Array.isArray(value) ? saved : saved[0];
        }),
        delete: jest.fn(async (where: any) => {
            for (let index = rows.length - 1; index >= 0; index -= 1) if (matches(rows[index], where)) rows.splice(index, 1);
        }),
    };
}

