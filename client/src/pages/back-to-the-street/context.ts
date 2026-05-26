import { createContext, useContext } from "react";

export type EditCtx = {
  isAdmin: boolean;
  openProgram:  (item: any) => void;
  openLineup:   (item: any) => void;
  openBattle:   (item: any) => void;
  openGallery:  (item: any) => void;
};

export const EditContext = createContext<EditCtx>({
  isAdmin: false,
  openProgram: () => {},
  openLineup:  () => {},
  openBattle:  () => {},
  openGallery: () => {},
});

export const useEdit = () => useContext(EditContext);
