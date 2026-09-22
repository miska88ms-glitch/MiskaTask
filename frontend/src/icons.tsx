// Phosphor icon registry. Activities store an icon key (string); we map it to a
// filled Phosphor component. Also the icon picker options for custom activities.

import type { ComponentType } from "react";
import {
  BookOpenText,
  Broom,
  TShirt,
  ForkKnife,
  Trash,
  Bed,
  Plant,
  Dog,
  ShoppingCartSimple,
  Drop,
  Star,
  SoccerBall,
  MusicNotes,
  GraduationCap,
  CalendarBlank,
  Heart,
  PawPrint,
  Bicycle,
  PaintBrush,
  PuzzlePiece,
  Basketball,
  Books,
  Cake,
  GameController,
  type IconProps,
} from "phosphor-react-native";

export type PhosphorIcon = ComponentType<IconProps>;

export const ICONS: Record<string, PhosphorIcon> = {
  book: BookOpenText,
  broom: Broom,
  laundry: TShirt,
  dishes: ForkKnife,
  trash: Trash,
  table: ForkKnife,
  bed: Bed,
  plant: Plant,
  dog: Dog,
  cart: ShoppingCartSimple,
  drop: Drop,
  star: Star,
  soccer: SoccerBall,
  music: MusicNotes,
  study: GraduationCap,
  calendar: CalendarBlank,
  heart: Heart,
  paw: PawPrint,
  bike: Bicycle,
  paint: PaintBrush,
  puzzle: PuzzlePiece,
  basket: Basketball,
  books: Books,
  cake: Cake,
  game: GameController,
};

export function getIcon(key: string | undefined): PhosphorIcon {
  return (key && ICONS[key]) || Star;
}

// Options shown in the icon picker for custom activities.
export const CHORE_ICONS: string[] = [
  "book",
  "broom",
  "laundry",
  "dishes",
  "trash",
  "bed",
  "plant",
  "dog",
  "cart",
  "drop",
  "star",
  "study",
];

export const COMMITMENT_ICONS: string[] = [
  "soccer",
  "basket",
  "music",
  "study",
  "calendar",
  "heart",
  "bike",
  "paint",
  "puzzle",
  "game",
  "cake",
  "star",
];
