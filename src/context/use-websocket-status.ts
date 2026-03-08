import { useContext } from "react";
import { WebSocketContext } from "./WebSocketContext";

export function useWebSocketStatus() {
    return useContext(WebSocketContext);
}