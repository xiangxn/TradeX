type Listener = (...args: any[]) => void;

export class EventBus {
    private listeners: Map<string, Listener[]> = new Map();

    on(event: string, listener: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
    }

    emit(event: string, ...args: any[]) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            for (const handler of handlers) {
                handler(...args);
            }
        }
    }

    off(event: string, listener: Listener) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            this.listeners.set(event, handlers.filter(l => l !== listener));
        }
    }

    clear() {
        this.listeners.clear();
    }
}

export const eventBus = new EventBus();
