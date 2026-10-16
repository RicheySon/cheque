import { STROOPS } from "./config";

export function shorten(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function formatXlm(stroops: bigint): string {
  const negative = stroops < 0n;
  const value = negative ? -stroops : stroops;
  const whole = value / STROOPS;
  const fraction = (value % STROOPS).toString().padStart(7, "0").replace(/0+$/, "");
  const text = fraction.length > 0 ? `${whole}.${fraction}` : `${whole}`;
  return negative ? `-${text}` : text;
}

export function parseXlm(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const stroops = BigInt(whole) * STROOPS + BigInt(fraction.padEnd(7, "0"));
  return stroops > 0n ? stroops : null;
}

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const rest = n % 10;
    return rest === 0 ? TENS[Math.floor(n / 10)] : `${TENS[Math.floor(n / 10)]}-${ONES[rest]}`;
  }
  const rest = n % 100;
  const head = `${ONES[Math.floor(n / 100)]} hundred`;
  return rest === 0 ? head : `${head} ${underThousand(rest)}`;
}

export function amountInWords(stroops: bigint): string {
  const whole = stroops / STROOPS;
  if (whole > 999_999n) return `${formatXlm(stroops)} XLM`;
  const n = Number(whole);
  const words = n === 0 ? "zero" : underThousand(n);
  const titled = words.charAt(0).toUpperCase() + words.slice(1);
  return `${titled} XLM`;
}

export function statusLabel(status: number): "Issued" | "Cashed" | "Voided" {
  if (status === 1) return "Cashed";
  if (status === 2) return "Voided";
  return "Issued";
}

export function formatWhen(unix: bigint): string {
  if (unix === 0n) return "No expiry";
  return new Date(Number(unix) * 1000).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isStellarAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}
