import type { Database } from "@/types/database";
import type { Role } from "@/lib/constants/roles";

// `role` se acota al union type de lib/constants/roles.ts en vez del
// `string` suelto del Row.
export type Profile = Omit<
  Database["public"]["Tables"]["profiles"]["Row"],
  "role"
> & {
  role: Role;
};
