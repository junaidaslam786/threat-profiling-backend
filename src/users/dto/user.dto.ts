// src/users/dto/user.dto.ts
export class UserDto {
  email: string; // Partition key
  client_name: string; // Organization reference
  name: string;
  partner_code?: string | null; // Optional, for partner system
  role: 'admin' | 'viewer';
  status: 'active' | 'pending_approval';
  created_at: string; // ISO string
}
