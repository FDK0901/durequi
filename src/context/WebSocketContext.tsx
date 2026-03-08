import { createContext } from "react";
import type { WsStatus } from "../hooks/useWebSocket";

interface WebSocketContextValue {
    status: WsStatus;
}

export const WebSocketContext = createContext<WebSocketContextValue>({
    status: 'disconnected',
});