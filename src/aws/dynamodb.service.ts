import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DynamoDbService {
  private readonly docClient: AWS.DynamoDB.DocumentClient;

  constructor() {
    AWS.config.update({ region: process.env.AWS_REGION });
    this.docClient = new AWS.DynamoDB.DocumentClient();
  }

  // Insert a document (auto-generates ID if none provided)
  async insert(tableName: string, item: Record<string, any>) {
    if (!item.id && !item.client_name) {
      item.id = uuidv4();
    }
    const params = {
      TableName: tableName,
      Item: item,
    };
    await this.docClient.put(params).promise();
    return item;
  }

  // Find a document by partition key (supports id or client_name)
  async findById(tableName: string, id: string) {
    const params = {
      TableName: tableName,
      Key: { client_name: id },
    };
    const result = await this.docClient.get(params).promise();
    return result.Item || null;
  }

  // Update (merge fields)
  async update(tableName: string, id: string, updates: Record<string, any>) {
    // Build update expression
    const exprs = [];
    const values = {};
    for (const [k, v] of Object.entries(updates)) {
      exprs.push(`#${k} = :${k}`);
      values[`:${k}`] = v;
    }
    const updateExpr = 'SET ' + exprs.join(', ');
    const attrNames = Object.fromEntries(
      Object.keys(updates).map((k) => [`#${k}`, k]),
    );

    const params = {
      TableName: tableName,
      Key: { client_name: id },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: attrNames,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    };
    const result = await this.docClient.update(params).promise();
    return result.Attributes;
  }

  // Query by field (scan)
  // src/aws/dynamodb.service.ts
  async find(tableName: string, filter: Record<string, any> = {}) {
    const params: any = {
      TableName: tableName,
    };

    // If no filter provided, do a plain scan
    if (!filter || Object.keys(filter).length === 0) {
      const result = await this.docClient.scan(params).promise();
      return result.Items || [];
    }

    // Otherwise, build FilterExpression
    const exprs = [];
    const names = {};
    const values = {};

    for (const [k, v] of Object.entries(filter)) {
      if (Array.isArray(v)) {
        // Supports: admins: ['userId']
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

    // If for some reason nothing got added, fall back to a plain scan
    if (exprs.length === 0 || Object.keys(values).length === 0) {
      const result = await this.docClient
        .scan({ TableName: tableName })
        .promise();
      return result.Items || [];
    }

    params.FilterExpression = exprs.join(' AND ');
    params.ExpressionAttributeNames = names;
    params.ExpressionAttributeValues = values;

    const result = await this.docClient.scan(params).promise();
    return result.Items || [];
  }

  // Delete by id
  async delete(tableName: string, id: string) {
    const params = {
      TableName: tableName,
      Key: { client_name: id },
    };
    await this.docClient.delete(params).promise();
    return true;
  }

  // Atomic increment
  async increment(
    tableName: string,
    id: string,
    field: string,
    by: number = 1,
  ) {
    const params = {
      TableName: tableName,
      Key: { client_name: id },
      UpdateExpression: `ADD #field :inc`,
      ExpressionAttributeNames: { '#field': field },
      ExpressionAttributeValues: { ':inc': by },
      ReturnValues: 'UPDATED_NEW',
    };
    const result = await this.docClient.update(params).promise();
    return result.Attributes;
  }
}
