export interface FontOption {
  name: string;
  category: "sans" | "serif" | "script" | "display" | "mono";
}

export const GOOGLE_FONTS: FontOption[] = [
  { name: "Inter", category: "sans" },
  { name: "DM Sans", category: "sans" },
  { name: "Space Grotesk", category: "sans" },
  { name: "Outfit", category: "sans" },
  { name: "Sora", category: "sans" },
  { name: "Josefin Sans", category: "sans" },
  { name: "Poppins", category: "sans" },
  { name: "Playfair Display", category: "serif" },
  { name: "Lora", category: "serif" },
  { name: "Merriweather", category: "serif" },
  { name: "Cormorant Garamond", category: "serif" },
  { name: "Libre Baskerville", category: "serif" },
  { name: "EB Garamond", category: "serif" },
  { name: "Crimson Text", category: "serif" },
  { name: "Source Serif 4", category: "serif" },
  { name: "Pacifico", category: "script" },
  { name: "Dancing Script", category: "script" },
  { name: "Great Vibes", category: "script" },
  { name: "Sacramento", category: "script" },
  { name: "Satisfy", category: "script" },
  { name: "Caveat", category: "script" },
  { name: "Abril Fatface", category: "display" },
  { name: "Bebas Neue", category: "display" },
  { name: "Lobster", category: "display" },
  { name: "Righteous", category: "display" },
  { name: "Permanent Marker", category: "display" },
  { name: "Bungee Shade", category: "display" },
  { name: "JetBrains Mono", category: "mono" },
  { name: "Space Mono", category: "mono" },
  { name: "Fira Code", category: "mono" },
];

const loadedFonts = new Set<string>();

export function loadGoogleFont(fontName: string) {
  if (loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, "+")}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}
