import cfg from "@/config/customFields.json";

// account_key -> { vriendelijkeNaam: pipedrive-veld-key }
export const CUSTOM_FIELDS: Record<string, Record<string, string>> = cfg as any;

export function customFieldsFor(accountKey: string): Record<string, string> {
  return (CUSTOM_FIELDS as any)[accountKey] || {};
}
