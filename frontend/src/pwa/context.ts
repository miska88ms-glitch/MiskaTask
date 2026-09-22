import { createContext, useContext } from "react";

export type PwaState = {
  installed: boolean;
  isApple: boolean;
  canInstall: boolean;
  online: boolean;
  ready: boolean;
  error: string | null;
  install: () => Promise<boolean>;
};

export const PwaContext = createContext<PwaState>({
  installed: false, isApple: false, canInstall: false, online: true,
  ready: false, error: null, install: async () => false,
});
export const usePwa = () => useContext(PwaContext);