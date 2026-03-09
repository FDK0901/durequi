import { createContext } from "react";
import type { WsStatus } from "../hooks/useWebSocket";

interface WebsocketContextValue {
    status: WsStatus;
}

export const WebsocketContext = createContext<WebsocketContextValue>({
    status: 'disconnected',
});