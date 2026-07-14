import type { SimActions, SimSettings } from "./SimContext";
import { createContext } from "react";

export const SettingsCtx = createContext<SimSettings | null>(null);
export const ActionsCtx = createContext<SimActions | null>(null);
