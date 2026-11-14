import { Client } from '@elastic/elasticsearch';
import prisma from '../prisma/db';
import dotenv from 'dotenv';
dotenv.config();

const ES_NODE = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
export const ES_INDEX = 'reachinbox_emails';

let esClient: Client | null = null;
let esAvailable = false;

export async function initElasticsearch() {
  try {
    esClient = new Client({
      node: ES_NODE,
      maxRetries: 1,
      requestTimeout: 2000,
    });

    const ping = await esClient.ping();
    if (ping) {
      esAvailable = true;
      console.log(`[Elasticsearch] ✅ Connected to Elasticsearch cluster at ${ES_NODE}`);

      // Ensure index exists
      const exists = await esClient.indices.exists({ index: ES_INDEX });
      if (!exists) {
        await esClient.indices.create({
          index: ES_INDEX,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                recipient: { type: 'text' },
                sender: { type: 'keyword' },
                subject: { type: 'text' },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                createdAt: { type: 'date' },
              },
            },
          },
        });
        console.log(`[Elasticsearch] Created index: "${ES_INDEX}"`);
      }
    }
  } catch (err: any) {
    esAvailable = false;
    console.warn(`[Elasticsearch Notice] Elasticsearch at ${ES_NODE} is currently offline (${err.message}). Using hybrid DB search fallback.`);
  }
}

/**
 * Indexes an email document into Elasticsearch
 */
export async function indexEmailDocument(email: any) {
  if (!esAvailable || !esClient) {
    return;
  }

  try {
    await esClient.index({
      index: ES_INDEX,
      id: email.id,
      document: {
        id: email.id,
        recipient: email.recipient,
        sender: email.sender,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        createdAt: email.createdAt,
      },
    });
  } catch (err: any) {
    console.warn(`[Elasticsearch Index Error] Failed to index email ${email.id}:`, err.message);
  }
}

/**
 * Searches emails via Elasticsearch (with graceful DB fallback)
 */
export async function searchEmails(query: string, status?: string) {
  if (esAvailable && esClient) {
    try {
      const mustClauses: any[] = [];

      if (query && query.trim()) {
        mustClauses.push({
          multi_match: {
            query: query.trim(),
            fields: ['recipient^3', 'subject^2', 'body', 'sender'],
            fuzziness: 'AUTO',
          },
        });
      }

      if (status && status !== 'ALL') {
        mustClauses.push({
          term: { status },
        });
      }

      const response = await esClient.search({
        index: ES_INDEX,
        body: {
          query: mustClauses.length > 0 ? { bool: { must: mustClauses } } : { match_all: {} },
          sort: [{ scheduledAt: { order: 'desc' } }],
          size: 50,
        },
      });

      const hits = response.hits.hits.map((hit: any) => hit._source);
      return {
        source: 'elasticsearch',
        total: response.hits.total,
        results: hits,
      };
    } catch (err: any) {
      console.warn('[Elasticsearch Search Error] Falling back to DB search:', err.message);
    }
  }

  // Resilient Fallback to Prisma SQLite/Postgres full-text search
  const where: any = {};
  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (query && query.trim()) {
    where.OR = [
      { recipient: { contains: query.trim() } },
      { subject: { contains: query.trim() } },
      { body: { contains: query.trim() } },
      { sender: { contains: query.trim() } },
    ];
  }

  const results = await prisma.email.findMany({
    where,
    orderBy: { scheduledAt: 'desc' },
    take: 50,
  });

  return {
    source: esAvailable ? 'elasticsearch' : 'database-search-engine',
    total: results.length,
    results,
  };
}

export function isElasticsearchAvailable() {
  return esAvailable;
}
