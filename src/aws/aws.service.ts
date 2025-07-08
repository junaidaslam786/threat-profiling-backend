import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class AwsService {
  private readonly client: DynamoDBClient;
  public readonly docClient: DynamoDBDocumentClient;
  private readonly logger = new Logger('AwsService');

  constructor() {
    this.logger.log(`Initializing AWS SDK v3 with region: ${process.env.AWS_REGION}`);
    
    // Create the DynamoDB client
    this.client = new DynamoDBClient({ 
      region: process.env.AWS_REGION,
      logger: {
        debug: (message) => this.logger.debug(`DynamoDB Client: ${message}`),
        info: (message) => this.logger.log(`DynamoDB Client: ${message}`),
        warn: (message) => this.logger.warn(`DynamoDB Client: ${message}`),
        error: (message) => this.logger.error(`DynamoDB Client: ${message}`),
      }
    });
    
    // Create the DocumentClient with marshalling options for better debugging
    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      }
    });
    
    this.logger.log('AWS Services initialized successfully');
  }
  
  // Helper method to log DynamoDB operations for debugging
  logDynamoOperation(operation: string, params: any): void {
    this.logger.debug(`DynamoDB ${operation} Operation:
      Table: ${params.TableName}
      ${params.Key ? `Key: ${JSON.stringify(params.Key)}` : ''}
      ${params.Item ? `Item: ${JSON.stringify(params.Item, null, 2)}` : ''}
      ${params.UpdateExpression ? `UpdateExpression: ${params.UpdateExpression}` : ''}
      ${params.FilterExpression ? `FilterExpression: ${params.FilterExpression}` : ''}
    `);
  }
}