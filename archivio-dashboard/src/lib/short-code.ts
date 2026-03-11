import { customAlphabet } from "nanoid";

const safeAlphabet = "23456789abcdefghjkmnpqrstuvwxyz";

export const generateShortCode = customAlphabet(safeAlphabet, 8);
