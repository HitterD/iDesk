import { createSessionLockServer } from './sessionLockServer';

const server = createSessionLockServer();
const scope = self as unknown as {
    onconnect: (event: MessageEvent) => void;
};
scope.onconnect = (event) => {
    const port = event.ports[0];
    port.onmessage = (message) => server.receive(port, message.data);
    port.onmessageerror = () => server.disconnect(port);
    port.start();
};
