const WAIT_TIMEOUT_MS = 60_000;
let worker: SharedWorker | null = null;
let failed = false;
const waiting = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
const unavailable = () => new Error('Koordinator sesi terputus. Tutup seluruh tab iDesk lalu buka kembali sebelum mencoba lagi.');

function getWorker(): SharedWorker {
    if (failed) throw unavailable();
    if (worker) return worker;
    worker = new SharedWorker(new URL('./sessionLock.worker.ts', import.meta.url), { type: 'module', name: 'idesk-auth-cookie' });
    const stop = () => {
        failed = true;
        waiting.forEach(item => item.reject(unavailable()));
        waiting.clear();
    };
    worker.onerror = stop;
    worker.port.onmessageerror = stop;
    worker.port.onmessage = ({ data }) => {
        const pending = waiting.get(data?.id);
        if (!pending) return;
        if (data.type === 'granted') pending.resolve();
        else if (data.type === 'failed') { failed = true; pending.reject(unavailable()); }
    };
    worker.port.start();
    return worker;
}

export async function withSharedSessionLock<T>(operation: () => Promise<T>): Promise<T> {
    const port = getWorker().port;
    const id = crypto.randomUUID();
    let granted = false;
    let timer: ReturnType<typeof setTimeout>;
    try {
        await new Promise<void>((resolve, reject) => {
            waiting.set(id, { resolve, reject });
            timer = setTimeout(() => {
                port.postMessage({ type: 'cancel', id });
                reject(unavailable());
            }, WAIT_TIMEOUT_MS);
            port.postMessage({ type: 'acquire', id });
        });
        granted = true;
        clearTimeout(timer!);
        // Do not race the HTTP operation with a lease timer or release before it settles.
        const result = await operation();
        if (failed) throw unavailable();
        return result;
    } finally {
        clearTimeout(timer!);
        waiting.delete(id);
        if (granted) port.postMessage({ type: failed ? 'failed' : 'release', id });
    }
}
