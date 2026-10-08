const HOLDER_TIMEOUT_MS = 45_000;
interface Port {
    postMessage(message: unknown): void;
}

/** Never reassign an uncertain lock: a missing holder may still have an HTTP request in flight. */
export function createSessionLockServer() {
    let holder: { port: Port; id: string } | null = null;
    let poisoned = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const queue: Array<{ port: Port; id: string }> = [];
    const fail = () => {
        poisoned = true;
        if (timer) clearTimeout(timer);
        holder?.port.postMessage({ type: 'failed', id: holder.id });
        queue.splice(0).forEach(({ port, id }) => port.postMessage({ type: 'failed', id }));
    };
    const grant = () => {
        if (holder || poisoned) return;
        holder = queue.shift() ?? null;
        if (!holder) return;
        timer = setTimeout(fail, HOLDER_TIMEOUT_MS);
        holder.port.postMessage({ type: 'granted', id: holder.id });
    };
    return {
        receive(port: Port, message: { type?: string; id?: string }) {
            if (typeof message.id !== 'string') return;
            if (poisoned) { port.postMessage({ type: 'failed', id: message.id }); return; }
            if (message.type === 'acquire') {
                queue.push({ port, id: message.id });
                grant();
            } else if (holder?.port === port && holder.id === message.id) {
                if (message.type === 'release') {
                    if (timer) clearTimeout(timer);
                    holder = null;
                    grant();
                } else if (message.type === 'failed') fail();
            } else if (message.type === 'cancel') {
                const index = queue.findIndex(item => item.port === port && item.id === message.id);
                if (index >= 0) queue.splice(index, 1);
            }
        },
        disconnect(port: Port) {
            if (holder?.port === port) fail();
        },
    };
}
