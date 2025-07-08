import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

function getPartitionKey(tableName: string) {
  if (tableName.endsWith('pending_joins')) return 'join_id';
  if (tableName.endsWith('users')) return 'email';
  return 'client_name';
}

@Injectable()
export class DynamoDbService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly logger = new Logger('DynamoDbService');

  constructor() {
    this.logger.log(
      `Initializing DynamoDbService with AWS SDK v3 in region: ${process.env.AWS_REGION}`,
    );

    const client = new DynamoDBClient({
      region: process.env.AWS_REGION,
      logger: {
        debug: (message) => this.logger.debug(`DynamoDB Client: ${message}`),
        info: (message) => this.logger.log(`DynamoDB Client: ${message}`),
        warn: (message) => this.logger.warn(`DynamoDB Client: ${message}`),
        error: (message) => this.logger.error(`DynamoDB Client: ${message}`),
      },
    });

    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true,
      },
    });
  }

  // Insert a document (auto-generates ID if none provided)
  async insert(tableName: string, item: Record<string, any>) {
    if (!item.id && !item.client_name && !item.join_id && !item.email) {
      item.id = uuidv4();
    }

    const params = {
      TableName: tableName,
      Item: item,
    };

    this.logOperation('PUT', params);

    try {
      await this.docClient.send(new PutCommand(params));
      this.logger.debug(`Successfully inserted item in table ${tableName}`);
      return item;
    } catch (error) {
      this.logError('PUT', error, params);
      throw error;
    }
  }

  // Find a document by partition key
  async findById(tableName: string, id: string) {
    const keyField = getPartitionKey(tableName);

    const params = {
      TableName: tableName,
      Key: { [keyField]: id },
    };

    this.logOperation('GET', params);

    try {
      const result = await this.docClient.send(new GetCommand(params));
      this.logger.debug(
        `GET result for ${tableName}: ${result.Item ? 'Item found' : 'Item not found'}`,
      );
      return result.Item || null;
    } catch (error) {
      this.logError('GET', error, params);
      throw error;
    }
  }

  // Update (merge fields)
  async update(tableName: string, id: string, updates: Record<string, any>) {
    const keyField = getPartitionKey(tableName);
    const exprs = [];
    const values = {};
    const attrNames = {};

    for (const [k, v] of Object.entries(updates)) {
      exprs.push(`#${k} = :${k}`);
      values[`:${k}`] = v;
      attrNames[`#${k}`] = k;
    }

    const updateExpr = 'SET ' + exprs.join(', ');

    const params = {
      TableName: tableName,
      Key: { [keyField]: id },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: attrNames,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW' as const,
    };

    this.logOperation('UPDATE', params);

    try {
      const result = await this.docClient.send(new UpdateCommand(params));
      this.logger.debug(`UPDATE successful for ${tableName}, id: ${id}`);
      return result.Attributes;
    } catch (error) {
      this.logError('UPDATE', error, params);
      throw error;
    }
  }

  // Query by field (scan)
  async find(tableName: string, filter: Record<string, any> = {}) {
    // First check if we can query using a partition key instead of scan
    const keyField = getPartitionKey(tableName);
    if (filter && filter[keyField] !== undefined) {
      this.logger.debug(
        `Optimizing find() operation to use QueryCommand on ${keyField} for table ${tableName}`,
      );
      return this.queryByPartitionKey(
        tableName,
        keyField,
        filter[keyField],
        filter,
      );
    }

    const params: any = {
      TableName: tableName,
    };

    // If no filter provided, do a plain scan
    if (!filter || Object.keys(filter).length === 0) {
      this.logOperation('SCAN (No Filter)', params);

      try {
        const result = await this.docClient.send(new ScanCommand(params));
        this.logger.debug(
          `SCAN (No Filter) returned ${result.Items?.length || 0} items from ${tableName}`,
        );
        return result.Items || [];
      } catch (error) {
        this.logError('SCAN', error, params);
        throw error;
      }
    }

    // Otherwise, build FilterExpression
    const exprs = [];
    const names = {};
    const values = {};

    for (const [k, v] of Object.entries(filter)) {
      if (Array.isArray(v)) {
        v.forEach((val, idx) => {
          exprs.push(`contains(#${k}, :${k}${idx})`);
          names[`#${k}`] = k;
          values[`:${k}${idx}`] = val;
        });
      } else {
        exprs.push(`#${k} = :${k}`);
        names[`#${k}`] = k;
        values[`:${k}`] = v;
      }
    }

    params.FilterExpression = exprs.join(' AND ');
    params.ExpressionAttributeNames = names;
    params.ExpressionAttributeValues = values;

    this.logOperation('SCAN (With Filter)', params);

    try {
      const result = await this.docClient.send(new ScanCommand(params));
      this.logger.debug(
        `SCAN (With Filter) returned ${result.Items?.length || 0} items from ${tableName} using filter: ${params.FilterExpression}`,
      );
      return result.Items || [];
    } catch (error) {
      this.logError('SCAN', error, params);
      throw error;
    }
  }

  // Query by partition key (more efficient than scan when possible)
  private async queryByPartitionKey(
    tableName: string,
    keyField: string,
    keyValue: string,
    additionalFilters: Record<string, any>,
  ) {
    // Remove the partition key from additional filters since it's used in KeyConditionExpression
    const { [keyField]: _, ...remainingFilters } = additionalFilters;

    const params: any = {
      TableName: tableName,
      KeyConditionExpression: '#pk = :pkVal',
      ExpressionAttributeNames: { '#pk': keyField },
      ExpressionAttributeValues: { ':pkVal': keyValue },
    };

    // Add remaining filters if any
    if (Object.keys(remainingFilters).length > 0) {
      const filterExprs = [];

      for (const [k, v] of Object.entries(remainingFilters)) {
        filterExprs.push(`#${k} = :${k}`);
        params.ExpressionAttributeNames[`#${k}`] = k;
        params.ExpressionAttributeValues[`:${k}`] = v;
      }

      params.FilterExpression = filterExprs.join(' AND ');
    }

    this.logOperation('QUERY', params);

    try {
      const result = await this.docClient.send(new QueryCommand(params));
      this.logger.debug(
        `QUERY returned ${result.Items?.length || 0} items from ${tableName} with key ${keyField}=${keyValue}`,
      );
      return result.Items || [];
    } catch (error) {
      this.logError('QUERY', error, params);
      throw error;
    }
  }

  // Delete by id
  async delete(tableName: string, id: string) {
    const keyField = getPartitionKey(tableName);

    const params = {
      TableName: tableName,
      Key: { [keyField]: id },
    };

    this.logOperation('DELETE', params);

    try {
      await this.docClient.send(new DeleteCommand(params));
      this.logger.debug(
        `Successfully deleted item with ${keyField}=${id} from ${tableName}`,
      );
      return true;
    } catch (error) {
      this.logError('DELETE', error, params);
      throw error;
    }
  }

  // Atomic increment
  async increment(
    tableName: string,
    id: string,
    field: string,
    by: number = 1,
  ) {
    const keyField = getPartitionKey(tableName);

    const params = {
      TableName: tableName,
      Key: { [keyField]: id },
      UpdateExpression: `ADD #field :inc`,
      ExpressionAttributeNames: { '#field': field },
      ExpressionAttributeValues: { ':inc': by },
      ReturnValues: 'UPDATED_NEW' as const,
    };

    this.logOperation('INCREMENT', params);

    try {
      const result = await this.docClient.send(new UpdateCommand(params));
      this.logger.debug(
        `Successfully incremented ${field} by ${by} for item with ${keyField}=${id} in ${tableName}`,
      );
      return result.Attributes;
    } catch (error) {
      this.logError('INCREMENT', error, params);
      throw error;
    }
  }

  // Logging helpers
  private logOperation(operation: string, params: any) {
    this.logger.debug(`DynamoDB ${operation} Operation:
      Table: ${params.TableName}
      ${params.Key ? `Key: ${JSON.stringify(params.Key)}` : ''}
      ${params.Item ? `Item: ${JSON.stringify(params.Item, null, 2).substring(0, 200)}...` : ''}
      ${params.UpdateExpression ? `UpdateExpression: ${params.UpdateExpression}` : ''}
      ${params.FilterExpression ? `FilterExpression: ${params.FilterExpression}` : ''}
      ${params.KeyConditionExpression ? `KeyConditionExpression: ${params.KeyConditionExpression}` : ''}
    `);
  }

  private logError(operation: string, error: any, params: any) {
    this.logger.error(`DynamoDB ${operation} Error:
      Error Type: ${error.name}
      Message: ${error.message}
      Table: ${params.TableName}
      ${params.Key ? `Key: ${JSON.stringify(params.Key)}` : ''}
      Stack: ${error.stack}
    `);
  }

  async findContains(
    tableName: string,
    arrayField: string,
    value: string,
  ): Promise<any[]> {
    const params = {
      TableName: tableName,
      FilterExpression: `contains(#${arrayField}, :value)`,
      ExpressionAttributeNames: { [`#${arrayField}`]: arrayField },
      ExpressionAttributeValues: { ':value': value },
    };
    this.logger.debug(
      `DynamoDB SCAN (Contains) Operation:\nTable: ${tableName}\nFilterExpression: contains(#${arrayField}, :value)\nValue: ${value}`,
    );
    const result = await this.docClient.send(new ScanCommand(params));
    this.logger.debug(
      `SCAN (Contains) returned ${result.Items?.length || 0} items from ${tableName} using filter: contains(#${arrayField}, :value)`,
    );
    return result.Items || [];
  }
}
