// src/orgs/dto/client-data.dto.ts
export class ClientDataDto {
  client_name: string; // Partition key
  created_at: string;
  email?: string;
  name?: string;
  organization_name: string;
  owner_email?: string; // Who owns this org
  partner_code?: string | null;

  // Optionals & for profiling
  sector?: string;
  website_url?: string;
  countries_of_operation?: string[];
  home_url?: string;
  about_us_url?: string;
  additional_details?: string;

  apps?: Array<{
    app_name: string;
    app_profile: string;
    app_url?: string;
    app_additional_details?: string;
    // app_id?: string (if needed)
  }>;

  user_ids?: string[]; // Set of users for this org

  // Profiling/Reporting
  report?: any; // Store profiling result here (structured JSON)
  assessment?: any; // Assessment questions and user answers
  controls_accepted_implemented?: {
    controls_implemented?: Record<string, { comment: string }>;
    controls_risk_accepted?: Record<string, { comment: string }>;
  };
}
