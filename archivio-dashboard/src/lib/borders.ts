export interface BorderStyle {
  id: string;
  label: string;
  stroke: string | null;
  strokeWidth: number;
  dash?: number[];
  cornerRadius?: number;
  padding?: number;
}

export const BORDER_STYLES: BorderStyle[] = [
  { id: "none", label: "None", stroke: null, strokeWidth: 0 },
  { id: "thin", label: "Thin", stroke: "#000000", strokeWidth: 1 },
  { id: "medium", label: "Medium", stroke: "#000000", strokeWidth: 3 },
  { id: "thick", label: "Thick", stroke: "#000000", strokeWidth: 5 },
  { id: "rounded", label: "Rounded", stroke: "#000000", strokeWidth: 2, cornerRadius: 12 },
  { id: "dashed", label: "Dashed", stroke: "#000000", strokeWidth: 2, dash: [8, 4] },
  { id: "dotted", label: "Dotted", stroke: "#000000", strokeWidth: 2, dash: [2, 4] },
  { id: "polaroid", label: "Polaroid", stroke: "#000000", strokeWidth: 1, padding: 8 },
  { id: "vintage", label: "Vintage", stroke: "#4a3728", strokeWidth: 4, cornerRadius: 6 },
  { id: "double", label: "Double", stroke: "#000000", strokeWidth: 1, dash: [0, 0] },
];

export function getBorderById(id: string): BorderStyle {
  return BORDER_STYLES.find((b) => b.id === id) || BORDER_STYLES[0];
}
