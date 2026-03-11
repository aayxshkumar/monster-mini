export interface FontOption {
  name: string;
  category: "sans" | "serif" | "script" | "display" | "mono";
}

export const GOOGLE_FONTS: FontOption[] = [
  // Sans-serif (15)
  { name: "Inter", category: "sans" },
  { name: "DM Sans", category: "sans" },
  { name: "Space Grotesk", category: "sans" },
  { name: "Outfit", category: "sans" },
  { name: "Sora", category: "sans" },
  { name: "Josefin Sans", category: "sans" },
  { name: "Poppins", category: "sans" },
  { name: "Montserrat", category: "sans" },
  { name: "Raleway", category: "sans" },
  { name: "Nunito", category: "sans" },
  { name: "Work Sans", category: "sans" },
  { name: "Rubik", category: "sans" },
  { name: "Quicksand", category: "sans" },
  { name: "Manrope", category: "sans" },
  { name: "Plus Jakarta Sans", category: "sans" },
  // Serif (13)
  { name: "Playfair Display", category: "serif" },
  { name: "Lora", category: "serif" },
  { name: "Merriweather", category: "serif" },
  { name: "Cormorant Garamond", category: "serif" },
  { name: "Libre Baskerville", category: "serif" },
  { name: "EB Garamond", category: "serif" },
  { name: "Crimson Text", category: "serif" },
  { name: "Source Serif 4", category: "serif" },
  { name: "Cinzel", category: "serif" },
  { name: "Zilla Slab", category: "serif" },
  { name: "DM Serif Display", category: "serif" },
  { name: "Bitter", category: "serif" },
  { name: "Noto Serif", category: "serif" },
  // Script / Handwriting (12)
  { name: "Pacifico", category: "script" },
  { name: "Dancing Script", category: "script" },
  { name: "Great Vibes", category: "script" },
  { name: "Sacramento", category: "script" },
  { name: "Satisfy", category: "script" },
  { name: "Caveat", category: "script" },
  { name: "Shadows Into Light", category: "script" },
  { name: "Indie Flower", category: "script" },
  { name: "Kalam", category: "script" },
  { name: "Amatic SC", category: "script" },
  { name: "Patrick Hand", category: "script" },
  { name: "Handlee", category: "script" },
  // Display / Decorative (16)
  { name: "Abril Fatface", category: "display" },
  { name: "Bebas Neue", category: "display" },
  { name: "Lobster", category: "display" },
  { name: "Righteous", category: "display" },
  { name: "Permanent Marker", category: "display" },
  { name: "Bungee Shade", category: "display" },
  { name: "Alfa Slab One", category: "display" },
  { name: "Comfortaa", category: "display" },
  { name: "Fredoka", category: "display" },
  { name: "Lilita One", category: "display" },
  { name: "Monoton", category: "display" },
  { name: "Orbitron", category: "display" },
  { name: "Press Start 2P", category: "display" },
  { name: "Fascinate Inline", category: "display" },
  { name: "Russo One", category: "display" },
  { name: "Bungee", category: "display" },
  // Monospace (6)
  { name: "JetBrains Mono", category: "mono" },
  { name: "Space Mono", category: "mono" },
  { name: "Fira Code", category: "mono" },
  { name: "Source Code Pro", category: "mono" },
  { name: "IBM Plex Mono", category: "mono" },
  { name: "Courier Prime", category: "mono" },
];

const loadedFonts = new Set<string>();
let allPreloaded = false;

export function loadGoogleFont(fontName: string) {
  if (loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, "+")}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

/** Preload ALL Google Fonts in one request so the font picker shows actual typefaces. */
export function preloadAllFonts() {
  if (allPreloaded) return;
  allPreloaded = true;
  // Build a single Google Fonts URL with all families (much faster than individual requests)
  const families = GOOGLE_FONTS
    .filter((f) => !loadedFonts.has(f.name))
    .map((f) => `family=${f.name.replace(/ /g, "+")}:wght@400;700`);
  if (families.length === 0) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
  document.head.appendChild(link);
  // Mark all as loaded
  GOOGLE_FONTS.forEach((f) => loadedFonts.add(f.name));
}
