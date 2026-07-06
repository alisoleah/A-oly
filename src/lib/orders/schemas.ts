import { z } from "zod";

/**
 * Checkout input validation (Zod).
 *
 * Every field has length caps + character allow-lists (security §B): these
 * values get printed on shipping labels and later injected into courier APIs,
 * so we never accept arbitrary strings. Egyptian phone + governorate for launch.
 *
 * The client-sent `total` is intentionally NOT in the request schema — totals
 * are recomputed server-side from DB prices (non-negotiable #4). Any total the
 * client sends is ignored; the tamper test proves this.
 */

/** Egyptian mobile numbers: optional +20, then a 10-digit starting with 1. */
const egyptianPhone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^(\+20|0)?1[0-9]{9}$/, "Enter a valid Egyptian mobile number"),
  );

/** Egyptian governorates (launch scope). COD availability is checked against these. */
export const GOVERNORATES = [
  "Cairo", "Giza", "Alexandria", "Dakahlia", "Red Sea", "Beheira",
  "Faiyum", "Gharbia", "Ismailia", "Menofia", "Minya", "Qalyubia",
  "New Valley", "Suez", "Aswan", "Asyut", "Beni Suef", "Port Said",
  "Damietta", "Sharkia", "South Sinai", "Kafr El Sheikh", "Matrouh",
  "Luxor", "Qena", "North Sinai", "Sohag",
] as const;

/** Allow-list for free-text address lines: letters, digits, spaces, basic punctuation. */
const addressLine = z
  .string()
  .trim()
  .min(3, "Address is too short")
  .max(120, "Address is too long")
  .regex(
    /^[A-Za-z0-9À-ÿ\u0600-\u06FF\s.,'#/-]+$/,
    "Address contains invalid characters",
  );

const nameField = z
  .string()
  .trim()
  .min(2, "Name is too short")
  .max(60, "Name is too long")
  .regex(/^[A-Za-zÀ-ÿ\u0600-\u06FF\s.'-]+$/, "Name contains invalid characters");

export const checkoutSchema = z.object({
  contact: z.object({
    fullName: nameField,
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    phone: egyptianPhone,
  }),
  delivery: z.object({
    governorate: z.enum(GOVERNORATES),
    city: z
      .string()
      .trim()
      .min(2, "City is too short")
      .max(60)
      .regex(/^[A-Za-zÀ-ÿ\u0600-\u06FF\s.'-]+$/),
    addressLine1: addressLine,
    addressLine2: addressLine.optional().or(z.literal("")),
    postalCode: z
      .string()
      .trim()
      .max(10)
      .regex(/^[A-Za-z0-9\s-]*$/, "Invalid postal code")
      .optional()
      .or(z.literal("")),
    notes: z.string().trim().max(300).optional().or(z.literal("")),
  }),
  payment: z.object({
    method: z.enum(["COD"]), // card/wallet added in Phase 4
  }),
  /**
   * Idempotency key issued to the checkout page. UNIQUE in the DB — a replay
   * returns the existing order instead of creating a duplicate.
   */
  idempotencyKey: z.string().min(16).max(64),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** The shipping country derived from governorate (Egypt at launch). */
export const SHIPPING_COUNTRY = "EG";
