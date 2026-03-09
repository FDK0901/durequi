import { useContext } from "react";
import { WebsocketContext } from "./WebsocketContext";

export function useWebSocketStatus() {
    return useContext(WebsocketContext);
}