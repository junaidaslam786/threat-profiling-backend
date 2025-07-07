// src/users/dto/pending-join.dto.ts
export class PendingJoinDto {
  join_id: string; // Partition key (email:client_name or UUID)
  client_name: string;
  email: string;
  name: string;
  created_at: string; // ISO string
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
}
