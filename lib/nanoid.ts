import { customAlphabet } from "nanoid"

// Create a custom nanoid generator with a specific alphabet and length
// Using a URL-friendly alphabet (no special characters)
export const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10)

