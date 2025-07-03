export class CreateOrgDto {
  orgName: string;
  orgDomain: string;
  sector?: string;
  websiteUrl?: string;
  countriesOfOperation?: string[];
  homeUrl?: string;
  aboutUsUrl?: string;
  additionalDetails?: string;
}
